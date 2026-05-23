import os

from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend

from .models import SystemSetting


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in ("true", "1", "yes", "on")


def _smtp_config_from_env():
    """Return SMTP kwargs from environment when SMTP_HOST or EMAIL_HOST is set."""
    host = os.getenv("SMTP_HOST") or os.getenv("EMAIL_HOST")
    if not host:
        return None
    port = os.getenv("SMTP_PORT") or os.getenv("EMAIL_PORT") or "1025"
    return {
        "host": host,
        "port": int(port),
        "username": os.getenv("SMTP_USER") or os.getenv("EMAIL_HOST_USER") or "",
        "password": os.getenv("SMTP_PASSWORD") or os.getenv("EMAIL_HOST_PASSWORD") or "",
        "use_tls": _env_bool("SMTP_TLS") or _env_bool("EMAIL_USE_TLS"),
        "use_ssl": _env_bool("SMTP_SSL") or _env_bool("EMAIL_USE_SSL"),
    }


class DynamicEmailBackend(SMTPEmailBackend):
    """
    SMTP backend for Commission Decision App mail.

    Priority:
      1. SMTP_* / EMAIL_* environment variables (.env — use for local Mailpit)
      2. SystemSetting rows (SMTP_HOST, SMTP_PORT, … — admin UI / production)
      3. Django settings EMAIL_* defaults
    """

    def __init__(self, **kwargs):
        from django.conf import settings

        env_cfg = _smtp_config_from_env()
        if env_cfg:
            cfg = env_cfg
        else:
            cfg = {
                "host": SystemSetting.get_val("SMTP_HOST") or getattr(settings, "EMAIL_HOST", "localhost"),
                "port": int(SystemSetting.get_val("SMTP_PORT") or getattr(settings, "EMAIL_PORT", 25)),
                "username": SystemSetting.get_val("SMTP_USER") or getattr(settings, "EMAIL_HOST_USER", ""),
                "password": SystemSetting.get_val("SMTP_PASSWORD") or getattr(settings, "EMAIL_HOST_PASSWORD", ""),
                "use_tls": SystemSetting.get_bool("SMTP_TLS", getattr(settings, "EMAIL_USE_TLS", False)),
                "use_ssl": SystemSetting.get_bool("SMTP_SSL", getattr(settings, "EMAIL_USE_SSL", False)),
            }

        kwargs.setdefault("host", cfg["host"])
        kwargs.setdefault("port", cfg["port"])
        kwargs.setdefault("username", cfg["username"])
        kwargs.setdefault("password", cfg["password"])
        kwargs.setdefault("use_tls", cfg["use_tls"])
        kwargs.setdefault("use_ssl", cfg["use_ssl"])

        super().__init__(**kwargs)
