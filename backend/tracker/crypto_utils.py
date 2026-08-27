"""Encryption-at-rest for standing third-party credentials (e.g. the Google
Drive OAuth refresh token in CloudBackupConnection) — the first use of this
in the codebase. Other DB-stored secrets (GEMINI_API_KEY, SMTP_PASSWORD in
SystemSetting) are plaintext, only masked at the API-response layer; an
OAuth refresh token is a standing credential to someone's real account, so
it gets real encryption instead of that pattern.

Deliberately keyed by its own env var (BACKUP_CLOUD_ENCRYPTION_KEY), not
derived from DJANGO_SECRET_KEY, so rotating one doesn't affect the other.
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured


def _fernet() -> Fernet:
    key = os.getenv("BACKUP_CLOUD_ENCRYPTION_KEY")
    if not key:
        raise ImproperlyConfigured(
            "BACKUP_CLOUD_ENCRYPTION_KEY is not set — required to store/read "
            "cloud-backup OAuth tokens. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    """Returns an opaque encrypted string, safe to store in a TextField."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    """Raises ValueError if the key is wrong or the ciphertext was tampered with."""
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Could not decrypt — wrong key or corrupted value.") from exc
