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

    return _normalize_cfg(
        {
            "host": env_cfg["host"],
            "port": env_cfg["port"],
            "username": env_cfg["username"] or db_cfg["username"],
            "password": env_cfg["password"] or db_cfg["password"],
            "use_tls": env_cfg["use_tls"],
            "use_ssl": env_cfg["use_ssl"],
        }
    )


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
