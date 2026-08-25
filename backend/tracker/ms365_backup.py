"""Microsoft 365 / OneDrive OAuth + upload for the cloud-backup feature.

Uses a confidential client (client_id + client_secret held server-side,
never exposed to the browser) with the delegated authorization-code flow —
PKCE isn't added on top since it protects public clients that can't hold a
secret, which doesn't apply here; CSRF is handled via `state` tied to the
admin's Django session instead (see BackupViewSet.cloud_connect/callback).

Scope is deliberately narrow: Files.ReadWrite.AppFolder restricts SCDMS to
its own isolated app folder in the connected account's OneDrive — it can
never see or touch anything else in that Drive.
"""
from __future__ import annotations

import os

import msal
import requests

SCOPES = ["Files.ReadWrite.AppFolder"]
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_UPLOAD_SESSION_URL_TMPL = GRAPH_BASE + "/me/drive/special/approot:/{filename}:/createUploadSession"
# Must be a multiple of 320 KiB per Graph's requirement; 5 MiB keeps backups
# with media attachments (now routinely over the old 4MB simple-upload
# limit) to a handful of requests without holding too much in memory.
_CHUNK_SIZE = 5 * 1024 * 1024


class MS365ConfigError(RuntimeError):
    """MS365_CLIENT_ID/MS365_CLIENT_SECRET/MS365_REDIRECT_URI not configured."""


class MS365AuthError(RuntimeError):
    """Token exchange/refresh failed — the connection needs to be redone."""


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise MS365ConfigError(f"{name} is not set — see Azure AD App Registration setup.")
    return val


def _client_app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        client_id=_require_env("MS365_CLIENT_ID"),
        client_credential=_require_env("MS365_CLIENT_SECRET"),
        # 'common' accepts both personal and work/school accounts; this is a
        # work-account-only integration in practice (OneDrive app-folder),
        # but restricting the authority doesn't add real security here since
        # the app-folder scope already limits blast radius.
        authority="https://login.microsoftonline.com/common",
    )


def build_auth_url(state: str) -> str:
    return _client_app().get_authorization_request_url(
        scopes=SCOPES,
        state=state,
        redirect_uri=_require_env("MS365_REDIRECT_URI"),
    )


def exchange_code_for_tokens(code: str) -> dict:
    """Returns {access_token, refresh_token, expires_in, email} or raises MS365AuthError."""
    result = _client_app().acquire_token_by_authorization_code(
        code=code, scopes=SCOPES, redirect_uri=_require_env("MS365_REDIRECT_URI"),
    )
    if "access_token" not in result:
        raise MS365AuthError(result.get("error_description") or result.get("error") or "Token exchange failed.")
    email = _fetch_email(result["access_token"])
    return {
        "access_token": result["access_token"],
        "refresh_token": result.get("refresh_token", ""),
        "expires_in": result.get("expires_in", 3600),
        "email": email,
    }


def refresh_access_token(refresh_token: str) -> dict:
    """Returns {access_token, refresh_token, expires_in} or raises MS365AuthError."""
    result = _client_app().acquire_token_by_refresh_token(refresh_token, scopes=SCOPES)
    if "access_token" not in result:
        raise MS365AuthError(result.get("error_description") or result.get("error") or "Token refresh failed.")
    return {
        "access_token": result["access_token"],
        # Microsoft may or may not rotate the refresh token — keep the old
        # one if a new one wasn't issued.
        "refresh_token": result.get("refresh_token") or refresh_token,
        "expires_in": result.get("expires_in", 3600),
    }


def _fetch_email(access_token: str) -> str:
    resp = requests.get(
        f"{GRAPH_BASE}/me", headers={"Authorization": f"Bearer {access_token}"}, timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("mail") or data.get("userPrincipalName") or ""


def upload_backup_file(access_token: str, filename: str, content: bytes) -> None:
    """Uploads to /Apps/<app folder name>/<filename> in the connected
    account's OneDrive via Graph's resumable upload session API. Backups now
    include every submission-document attachment (zip format), routinely
    well over the 4MB simple-upload limit, so this is used unconditionally
    rather than branching on file size — it works fine for small files too."""
    session_resp = requests.post(
        _UPLOAD_SESSION_URL_TMPL.format(filename=filename),
        headers={"Authorization": f"Bearer {access_token}"},
        json={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
        timeout=30,
    )
    session_resp.raise_for_status()
    upload_url = session_resp.json()["uploadUrl"]

    total = len(content)
    for start in range(0, total, _CHUNK_SIZE):
        end = min(start + _CHUNK_SIZE, total)
        chunk = content[start:end]
        # Upload-session URLs are pre-authenticated by Graph — no Authorization
        # header on these chunk requests, only the Content-Range.
        chunk_resp = requests.put(
            upload_url,
            headers={
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {start}-{end - 1}/{total}",
            },
            data=chunk,
            timeout=120,
        )
        chunk_resp.raise_for_status()
