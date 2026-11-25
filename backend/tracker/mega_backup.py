"""MEGA upload for the cloud-backup feature, using the `megatools` command-line client.

MEGA has no OAuth for third-party apps, so the connected admin supplies a MEGA
account email and password. The password is stored encrypted at rest
(crypto_utils, in CloudBackupConnection.refresh_token_encrypted) and handed to
megatools through a short-lived 0600 config file, never on the command line
where `ps` could show it. Accounts with two-factor authentication on are not
supported by megatools: use a dedicated MEGA account for backups.

Everything MEGA stores is end-to-end encrypted. Backups go in a single
"SCDMS Backups" folder under the account's Cloud Drive root.
"""
from __future__ import annotations

import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta

BACKUP_FOLDER = "/Root/SCDMS Backups"
MEGATOOLS = os.getenv("MEGATOOLS_BIN", "megatools")
# Full backups are scdms_backup_<ts>; selective ones are scdms_backup_partial_<ts>.
_TS_RE = re.compile(r"^scdms_backup_(?:partial_)?(\d{8})_(\d{6})\.(zip|json)(\.enc)?$")


class MegaError(RuntimeError):
    """megatools failed for a reason that is not an authentication problem."""


class MegaAuthError(MegaError):
    """The email/password was rejected: the connection needs to be redone."""


class MegaNetworkError(MegaError):
    """mega.nz could not be reached or the transfer timed out: retry later."""


def _classify(stderr: str) -> MegaError:
    text = (stderr or "").strip().splitlines()
    msg = text[-1] if text else "megatools failed with no output"
    low = (stderr or "").lower()
    if "can't login" in low or "login failed" in low or "server returned 402" in low or "ekey" in low:
        # Server-side 402 / EKEY is "wrong email or password".
        return MegaAuthError(msg)
    if any(s in low for s in ("can't connect", "could not resolve", "timed out", "timeout",
                               "connection reset", "http post failed", "http get failed",
                               "temporarily unavailable", "eagain")):
        return MegaNetworkError(msg)
    return MegaError(msg)


def _run(email: str, password: str, args: list[str], timeout: int = 600) -> str:
    """Run one megatools command with the credentials in a throwaway config file."""
    fd, path = tempfile.mkstemp(prefix="mega_", suffix=".ini")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(f"[Login]\nUsername = {email}\nPassword = {password}\n")
        os.chmod(path, 0o600)
        cmd = [MEGATOOLS, args[0], "--config", path, "--no-ask-password", *args[1:]]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise MegaNetworkError(f"megatools {args[0]} timed out after {timeout}s") from exc
        except FileNotFoundError as exc:
            raise MegaError("megatools is not installed in this container.") from exc
        if proc.returncode != 0:
            raise _classify(proc.stderr or proc.stdout)
        return proc.stdout
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def verify_login(email: str, password: str) -> None:
    """Raises MegaAuthError if the credentials are wrong. Cheap: lists storage quota."""
    _run(email, password, ["df"], timeout=60)


def upload_backup_file(email: str, password: str, filepath: str) -> None:
    """Upload one backup file into the SCDMS Backups folder (created if missing)."""
    try:
        _run(email, password, ["mkdir", BACKUP_FOLDER], timeout=60)
    except MegaAuthError:
        raise
    except MegaError:
        pass  # most likely "already exists"; the upload below fails loudly if not
    _run(email, password, ["put", "--no-progress", "--path", BACKUP_FOLDER + "/", filepath], timeout=3600)


def _list_names(email: str, password: str) -> list[str]:
    out = _run(email, password, ["ls", "--names", BACKUP_FOLDER], timeout=120)
    return [os.path.basename(line.strip()) for line in out.splitlines() if line.strip()]


def delete_backup_file(email: str, password: str, filename: str) -> bool:
    if not _TS_RE.match(filename):
        return False
    try:
        names = _list_names(email, password)
    except MegaAuthError:
        raise
    except MegaError:
        return False  # folder not created yet
    if filename not in names:
        return False
    _run(email, password, ["rm", f"{BACKUP_FOLDER}/{filename}"], timeout=120)
    return True


def delete_old_backups(email: str, password: str, retention_days: int) -> int:
    """Remove backups older than the retention window, judged by the timestamp in the name."""
    cutoff = datetime.now() - timedelta(days=retention_days)
    try:
        names = _list_names(email, password)
    except MegaAuthError:
        raise
    except MegaError:
        return 0
    removed = 0
    for name in names:
        m = _TS_RE.match(name)
        if not m:
            continue  # never touch anything we did not name
        when = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
        if when < cutoff:
            _run(email, password, ["rm", f"{BACKUP_FOLDER}/{name}"], timeout=120)
            removed += 1
    return removed
