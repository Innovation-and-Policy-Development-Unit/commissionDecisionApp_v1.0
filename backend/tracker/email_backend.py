from django.core.mail.backends.smtp import EmailBackend as SMTPEmailBackend
from .models import SystemSetting

class DynamicEmailBackend(SMTPEmailBackend):
    """
    SMTP backend that pulls configuration from SystemSetting model.
    Keys: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_TLS, SMTP_SSL
    """
    def __init__(self, **kwargs):
        # Read from DB. Defaults to settings if not in DB.
        from django.conf import settings
        
        host = SystemSetting.get_val("SMTP_HOST") or getattr(settings, "EMAIL_HOST", "localhost")
        port = int(SystemSetting.get_val("SMTP_PORT") or getattr(settings, "EMAIL_PORT", 25))
        user = SystemSetting.get_val("SMTP_USER") or getattr(settings, "EMAIL_HOST_USER", "")
        password = SystemSetting.get_val("SMTP_PASSWORD") or getattr(settings, "EMAIL_HOST_PASSWORD", "")
        use_tls = SystemSetting.get_bool("SMTP_TLS", getattr(settings, "EMAIL_USE_TLS", False))
        use_ssl = SystemSetting.get_bool("SMTP_SSL", getattr(settings, "EMAIL_USE_SSL", False))

        kwargs.setdefault("host", host)
        kwargs.setdefault("port", port)
        kwargs.setdefault("username", user)
        kwargs.setdefault("password", password)
        kwargs.setdefault("use_tls", use_tls)
        kwargs.setdefault("use_ssl", use_ssl)
        
        super().__init__(**kwargs)
