"""Encrypt backup files before they leave the server.

Backups hold the whole database and every uploaded document. The copy that goes
to a cloud account (Google Drive or MEGA) is encrypted here first, with a key
that stays on the SCDMS server and in the administrators' own safe place, never
in the cloud account. Local backups on the server are left as they are.

Format of a `.enc` file: the 9-byte marker `SCDMSBK1\\n`, then a series of
records (4-byte big-endian length, then a Fernet token). Each token holds an
8-byte chunk number and up to 4 MiB of the backup. The last record is a token
that holds the chunk count. Fernet authenticates every token, the chunk number
catches reordering, and the final record catches truncation, so any change to
the file makes decryption fail instead of returning damaged data.

Key: BACKUP_ENCRYPTION_KEY, a Fernet key (generate once with
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
Keep a copy somewhere other than the server: without it the cloud backups cannot be read.
"""
from __future__ import annotations

import contextlib
import os
import struct
import tempfile

from cryptography.fernet import Fernet, InvalidToken

MAGIC = b"SCDMSBK1\n"
CHUNK = 4 * 1024 * 1024
SUFFIX = ".enc"


class BackupEncryptionNotConfigured(RuntimeError):
    """BACKUP_ENCRYPTION_KEY is not set: nothing is uploaded rather than uploading in the clear."""


class BackupDecryptionError(ValueError):
    """Wrong key, or the file was changed, cut short or is not an SCDMS backup."""


def _fernet(key: str | bytes | None = None) -> Fernet:
    key = key or os.getenv("BACKUP_ENCRYPTION_KEY")
    if not key:
        raise BackupEncryptionNotConfigured(
            "BACKUP_ENCRYPTION_KEY is not set, so the backup was not uploaded. "
            "Generate a key and add it to the server's environment (see docs/deployment-backup-encryption.md)."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def cloud_name(filename: str) -> str:
    return filename if filename.endswith(SUFFIX) else filename + SUFFIX


def encrypt_stream(src, dst, key=None, chunk_size: int = CHUNK) -> int:
    f = _fernet(key)
    dst.write(MAGIC)
    n = 0
    while True:
        block = src.read(chunk_size)
        if not block:
            break
        token = f.encrypt(struct.pack(">Q", n) + block)
        dst.write(struct.pack(">I", len(token)) + token)
        n += 1
    end = f.encrypt(b"END" + struct.pack(">Q", n))
    dst.write(struct.pack(">I", len(end)) + end)
    return n


def decrypt_stream(src, dst, key=None) -> int:
    f = _fernet(key)
    if src.read(len(MAGIC)) != MAGIC:
        raise BackupDecryptionError("This is not an SCDMS encrypted backup.")
    n = 0
    while True:
        head = src.read(4)
        if len(head) != 4:
            raise BackupDecryptionError("The file ends early: it is incomplete.")
        (size,) = struct.unpack(">I", head)
        token = src.read(size)
        if len(token) != size:
            raise BackupDecryptionError("The file ends early: it is incomplete.")
        try:
            plain = f.decrypt(token)
        except InvalidToken as exc:
            raise BackupDecryptionError("Wrong key, or the file has been changed.") from exc
        if plain.startswith(b"END") and len(plain) == 11:
            if struct.unpack(">Q", plain[3:])[0] != n:
                raise BackupDecryptionError("Chunks are missing or out of order.")
            return n
        if struct.unpack(">Q", plain[:8])[0] != n:
            raise BackupDecryptionError("Chunks are missing or out of order.")
        dst.write(plain[8:])
        n += 1


def encrypt_bytes(data: bytes, key=None) -> bytes:
    import io
    out = io.BytesIO()
    encrypt_stream(io.BytesIO(data), out, key)
    return out.getvalue()


def decrypt_bytes(data: bytes, key=None) -> bytes:
    import io
    out = io.BytesIO()
    decrypt_stream(io.BytesIO(data), out, key)
    return out.getvalue()


def encrypt_for_cloud(filepath: str, filename: str) -> tuple[bytes, str]:
    """Encrypted contents of a local backup, and the name to upload it under."""
    _fernet()  # fail before reading a large file if the key is missing
    with open(filepath, "rb") as fh:
        return encrypt_bytes(fh.read()), cloud_name(filename)


@contextlib.contextmanager
def encrypted_tempfile(filepath: str, filename: str):
    """For uploaders that take a file path: yields (path, name) of an encrypted copy, removed afterwards."""
    _fernet()
    with tempfile.TemporaryDirectory(prefix="scdms_enc_") as tmp:
        dest = os.path.join(tmp, cloud_name(filename))
        with open(filepath, "rb") as src, open(dest, "wb") as dst:
            encrypt_stream(src, dst)
        os.chmod(dest, 0o600)
        yield dest, cloud_name(filename)
