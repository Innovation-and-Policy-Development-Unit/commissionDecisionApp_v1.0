import os
import re

from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend

from .models import SystemSetting


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in ("true", "1", "yes", "on")


def _normalize_password(value: str) -> str:
    """Google App Passwords are often copied with spaces (abcd efgh ...)."""
    return re.sub(r"\s+", "", (value or "").strip())


def _normalize_cfg(cfg: dict) -> dict:
    cfg = dict(cfg)
    cfg["username"] = (cfg.get("username") or "").strip()
    cfg["password"] = _normalize_password(cfg.get("password") or "")
    cfg["port"] = int(cfg.get("port") or 25)
    return cfg


def _smtp_config_from_env():
    """Return SMTP kwargs from environment when SMTP_HOST or EMAIL_HOST is set."""
    host = os.getenv("SMTP_HOST") or os.getenv("EMAIL_HOST")
    if not host:
        return None
    port = os.getenv("SMTP_PORT") or os.getenv("EMAIL_PORT") or "1025"
    return _normalize_cfg(
        {
            "host": host.strip(),
            "port": int(port),
            "username": os.getenv("SMTP_USER") or os.getenv("EMAIL_HOST_USER") or "",
            "password": os.getenv("SMTP_PASSWORD") or os.getenv("EMAIL_HOST_PASSWORD") or "",
            "use_tls": _env_bool("SMTP_TLS") or _env_bool("EMAIL_USE_TLS"),
            "use_ssl": _env_bool("SMTP_SSL") or _env_bool("EMAIL_USE_SSL"),
        }
    )


def _smtp_config_from_settings():
    from django.conf import settings

    return _normalize_cfg(
        {
            "host": SystemSetting.get_val("SMTP_HOST") or getattr(settings, "EMAIL_HOST", "localhost"),
            "port": int(SystemSetting.get_val("SMTP_PORT") or getattr(settings, "EMAIL_PORT", 25)),
            "username": SystemSetting.get_val("SMTP_USER") or getattr(settings, "EMAIL_HOST_USER", ""),
            "password": SystemSetting.get_val("SMTP_PASSWORD") or getattr(settings, "EMAIL_HOST_PASSWORD", ""),
            "use_tls": SystemSetting.get_bool("SMTP_TLS", getattr(settings, "EMAIL_USE_TLS", False)),
            "use_ssl": SystemSetting.get_bool("SMTP_SSL", getattr(settings, "EMAIL_USE_SSL", False)),
        }
    )


def resolve_smtp_config():
    """
    Resolve SMTP connection settings.

    When Admin has saved an SMTP password (SystemSetting), use Admin values
    entirely so Render/.env partial overrides cannot strip authentication.
    """
    db_cfg = _smtp_config_from_settings()
    if db_cfg.get("password"):
        return db_cfg

    env_cfg = _smtp_config_from_env()
    if not env_cfg:
        return db_cfg

    if not env_cfg["username"] and db_cfg.get("username"):
        return db_cfg

    merged = _normalize_cfg(
        {
            "host": env_cfg["host"] or db_cfg.get("host"),
            "port": env_cfg["port"] or db_cfg.get("port"),
            "username": env_cfg["username"] or db_cfg["username"],
            "password": env_cfg["password"] or db_cfg["password"],
            "use_tls": env_cfg["use_tls"] if env_cfg.get("host") else db_cfg["use_tls"],
            "use_ssl": env_cfg["use_ssl"] if env_cfg.get("host") else db_cfg["use_ssl"],
        }
    )
    # Render often sets SMTP_HOST in env while the App Password lives in Admin only.
    if not env_cfg.get("password") and db_cfg.get("password"):
        merged["password"] = db_cfg["password"]
        if db_cfg.get("username"):
            merged["username"] = db_cfg["username"]
        if db_cfg.get("host"):
            merged["host"] = db_cfg["host"]
        merged["port"] = db_cfg["port"]
        merged["use_tls"] = db_cfg["use_tls"]
        merged["use_ssl"] = db_cfg["use_ssl"]
    return merged


def format_smtp_error(exc: Exception) -> str:
    """Human-readable SMTP failure (avoids raw dict dumps in API responses)."""
    import smtplib

    if isinstance(exc, smtplib.SMTPAuthenticationError):
        code = getattr(exc, "smtp_code", None)
        msg = getattr(exc, "smtp_error", b"")
        if isinstance(msg, bytes):
            msg = msg.decode("utf-8", errors="replace")
        return f"SMTP login failed ({code}): {msg or exc}".strip()

    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        parts = []
        for addr, detail in exc.recipients.items():
            if isinstance(detail, tuple) and len(detail) >= 2:
                code, msg = detail[0], detail[1]
                if isinstance(msg, bytes):
                    msg = msg.decode("utf-8", errors="replace")
                parts.append(f"{addr}: {code} {msg}")
            else:
                parts.append(f"{addr}: {detail}")
        return "; ".join(parts) or str(exc)

    return str(exc)


def send_smtp_message(
    *,
    cfg: dict,
    from_email: str,
    recipients: list[str],
    subject: str,
    body: str,
) -> None:
    """Send one plain-text message with explicit TLS + login (used by SMTP test)."""
    import smtplib
    from email.message import EmailMessage

    cfg = _normalize_cfg(cfg)
    if not cfg.get("username") or not cfg.get("password"):
        raise ValueError("SMTP username and password are required.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    timeout = 30
    if cfg["use_ssl"]:
        server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=timeout)
    else:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=timeout)

    try:
        server.ehlo()
        if cfg["use_tls"] and not cfg["use_ssl"]:
            server.starttls()
            server.ehlo()
        server.login(cfg["username"], cfg["password"])
        refused = server.send_message(msg)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def email_config_diagnostics() -> dict:
    """Active email provider summary (Resend or SMTP)."""
    from .resend_backend import resend_config_diagnostics, uses_resend

    if uses_resend():
        return resend_config_diagnostics()
    diag = smtp_config_diagnostics()
    diag["provider"] = "smtp"
    return diag


def smtp_config_diagnostics() -> dict:
    """Non-secret summary for admin troubleshooting."""
    db_cfg = _smtp_config_from_settings()
    env_cfg = _smtp_config_from_env()
    active = resolve_smtp_config()
    if db_cfg.get("password"):
        source = "admin_settings"
    elif env_cfg and env_cfg.get("username"):
        source = "environment"
    elif env_cfg:
        source = "environment_host_only"
    else:
        source = "defaults"

    return {
        "source": source,
        "host": active.get("host"),
        "port": active.get("port"),
        "use_tls": active.get("use_tls"),
        "use_ssl": active.get("use_ssl"),
        "username": active.get("username") or "",
        "password_configured": bool(active.get("password")),
        "env_host_set": bool(env_cfg and env_cfg.get("host")),
        "env_user_set": bool(env_cfg and env_cfg.get("username")),
        "env_password_set": bool(env_cfg and env_cfg.get("password")),
        "admin_password_set": bool(db_cfg.get("password")),
    }


class DynamicEmailBackend(SMTPEmailBackend):
    """SMTP backend — reads resolve_smtp_config() on each connection."""

    def __init__(self, **kwargs):
        cfg = resolve_smtp_config()
        kwargs.setdefault("host", cfg["host"])
        kwargs.setdefault("port", cfg["port"])
        kwargs.setdefault("username", cfg["username"])
        kwargs.setdefault("password", cfg["password"])
        kwargs.setdefault("use_tls", cfg["use_tls"])
        kwargs.setdefault("use_ssl", cfg["use_ssl"])
        super().__init__(**kwargs)

    def open(self):
        if self.connection:
            return False
        cfg = resolve_smtp_config()
        self.host = cfg["host"]
        self.port = cfg["port"]
        self.username = cfg["username"]
        self.password = cfg["password"]
        self.use_tls = cfg["use_tls"]
        self.use_ssl = cfg["use_ssl"]
        return super().open()
