"""Google Drive OAuth + upload for the cloud-backup feature.

Uses a confidential client (client_id + client_secret held server-side,
never exposed to the browser) with the standard OAuth2 authorization-code
flow — PKCE isn't added on top since it protects public clients that can't
hold a secret, which doesn't apply here; CSRF is handled via `state` tied to
the admin's Django session instead (see BackupViewSet.cloud_connect/callback).

Scope is deliberately narrow: drive.file only grants access to files this
app creates — it can never see or touch anything else in the connected
account's Drive. Backups go in a single "SCDMS Backups" folder created on
first upload.
"""
from __future__ import annotations

import os

import requests

SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"]
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
BACKUP_FOLDER_NAME = "SCDMS Backups"
# Must be a multiple of 256 KiB per Drive's requirement; 5 MiB keeps backups
# with media attachments (now routinely over the old 4MB simple-upload
# limit) to a handful of requests without holding too much in memory.
_CHUNK_SIZE = 5 * 1024 * 1024


class GoogleDriveConfigError(RuntimeError):
    """GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI not configured."""


class GoogleDriveAuthError(RuntimeError):
    """Token exchange/refresh failed — the connection needs to be redone."""


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise GoogleDriveConfigError(f"{name} is not set — see Google Cloud OAuth Client setup.")
    return val


def build_auth_url(state: str) -> str:
    params = {
        "client_id": _require_env("GOOGLE_CLIENT_ID"),
        "redirect_uri": _require_env("GOOGLE_REDIRECT_URI"),
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "offline",
        # Google only returns a refresh_token on the first consent for a
        # given account; forcing the consent screen every time guarantees
        # we get one even on a reconnect.
        "prompt": "consent",
    }
    return requests.Request("GET", AUTH_URL, params=params).prepare().url


def exchange_code_for_tokens(code: str) -> dict:
    """Returns {access_token, refresh_token, expires_in, email} or raises GoogleDriveAuthError."""
    resp = requests.post(TOKEN_URL, data={
        "code": code,
        "client_id": _require_env("GOOGLE_CLIENT_ID"),
        "client_secret": _require_env("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": _require_env("GOOGLE_REDIRECT_URI"),
        "grant_type": "authorization_code",
    }, timeout=15)
    result = resp.json()
    if resp.status_code != 200 or "access_token" not in result:
        raise GoogleDriveAuthError(result.get("error_description") or result.get("error") or "Token exchange failed.")
    if not result.get("refresh_token"):
        raise GoogleDriveAuthError("Google did not return a refresh token — try disconnecting any prior SCDMS access at myaccount.google.com/permissions and reconnecting.")
    email = _fetch_email(result["access_token"])
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "expires_in": result.get("expires_in", 3600),
        "email": email,
    }


def refresh_access_token(refresh_token: str) -> dict:
    """Returns {access_token, refresh_token, expires_in} or raises GoogleDriveAuthError."""
    resp = requests.post(TOKEN_URL, data={
        "refresh_token": refresh_token,
        "client_id": _require_env("GOOGLE_CLIENT_ID"),
        "client_secret": _require_env("GOOGLE_CLIENT_SECRET"),
        "grant_type": "refresh_token",
    }, timeout=15)
    result = resp.json()
    if resp.status_code != 200 or "access_token" not in result:
        raise GoogleDriveAuthError(result.get("error_description") or result.get("error") or "Token refresh failed.")
    return {
        "access_token": result["access_token"],
        # Google doesn't reissue a refresh token on a plain refresh — keep
        # the old one.
        "refresh_token": result.get("refresh_token") or refresh_token,
        "expires_in": result.get("expires_in", 3600),
    }


def _fetch_email(access_token: str) -> str:
    resp = requests.get(
        USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("email", "")


def _get_or_create_backup_folder(access_token: str) -> str:
    headers = {"Authorization": f"Bearer {access_token}"}
    query = (
        f"name='{BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' "
        "and trashed=false and 'root' in parents"
    )
    resp = requests.get(
        DRIVE_FILES_URL, headers=headers,
        params={"q": query, "fields": "files(id)", "spaces": "drive"}, timeout=15,
    )
    resp.raise_for_status()
    files = resp.json().get("files", [])
    if files:
        return files[0]["id"]

    resp = requests.post(
        DRIVE_FILES_URL, headers=headers,
        json={"name": BACKUP_FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def _find_existing_file(access_token: str, folder_id: str, filename: str) -> str | None:
    resp = requests.get(
        DRIVE_FILES_URL, headers={"Authorization": f"Bearer {access_token}"},
        params={
            "q": f"name='{filename}' and '{folder_id}' in parents and trashed=false",
            "fields": "files(id)", "spaces": "drive",
        },
        timeout=15,
    )
    resp.raise_for_status()
    files = resp.json().get("files", [])
    return files[0]["id"] if files else None


def upload_backup_file(access_token: str, filename: str, content: bytes) -> None:
    """Uploads to the "SCDMS Backups" folder in the connected account's
    Google Drive via the Drive API's resumable upload session, replacing any
    existing file of the same name. Backups now include every
    submission-document attachment (zip format), routinely well over the
    5MB simple-upload limit, so this is used unconditionally rather than
    branching on file size — it works fine for small files too."""
    folder_id = _get_or_create_backup_folder(access_token)
    existing_id = _find_existing_file(access_token, folder_id, filename)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/zip",
        "X-Upload-Content-Length": str(len(content)),
    }
    if existing_id:
        session_resp = requests.patch(
            f"{DRIVE_UPLOAD_URL}/{existing_id}", headers=headers,
            params={"uploadType": "resumable"}, json={}, timeout=30,
        )
    else:
        session_resp = requests.post(
            DRIVE_UPLOAD_URL, headers=headers,
            params={"uploadType": "resumable"},
            json={"name": filename, "parents": [folder_id]}, timeout=30,
        )
    session_resp.raise_for_status()
    upload_url = session_resp.headers["Location"]

    total = len(content)
    for start in range(0, total, _CHUNK_SIZE):
        end = min(start + _CHUNK_SIZE, total)
        chunk = content[start:end]
        # Upload-session URLs are pre-authenticated by Drive — no
        # Authorization header on these chunk requests, only the
        # Content-Range.
        chunk_resp = requests.put(
            upload_url,
            headers={
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {start}-{end - 1}/{total}",
            },
            data=chunk,
            timeout=120,
        )
        if chunk_resp.status_code not in (200, 201, 308):
            chunk_resp.raise_for_status()
