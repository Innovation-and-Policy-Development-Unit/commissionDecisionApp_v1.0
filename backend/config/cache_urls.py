"""Redis URL helpers for Django settings (no tracker imports)."""

from urllib.parse import urlparse, urlunparse


def redis_cache_url_from_broker(broker_url: str) -> str:
    """Map Celery broker URL (typically …/0) to cache URL on database 1."""
    broker_url = (broker_url or "").strip()
    if not broker_url:
        return "redis://127.0.0.1:6379/1"
    if broker_url.endswith("/0"):
        return f"{broker_url[:-2]}/1"
    parsed = urlparse(broker_url)
    if parsed.path in ("", "/"):
        return urlunparse(parsed._replace(path="/1"))
    return broker_url


def redis_channel_url_from_broker(broker_url: str) -> str:
    """Map Celery broker URL (typically …/0) to the chat channel layer's URL
    on database 2 — kept separate from both Celery (0) and the cache (1)."""
    broker_url = (broker_url or "").strip()
    if not broker_url:
        return "redis://127.0.0.1:6379/2"
    if broker_url.endswith("/0"):
        return f"{broker_url[:-2]}/2"
    parsed = urlparse(broker_url)
    if parsed.path in ("", "/"):
        return urlunparse(parsed._replace(path="/2"))
    return broker_url
