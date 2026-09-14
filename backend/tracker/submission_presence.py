"""Submission detail presence — WebSocket-driven (see
submission_presence_consumer.py), 90s expiry as a safety net for connections
that drop without a clean close frame."""

from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlparse

from django.core.cache import cache
from django.utils import timezone

from .models import Profile, SubmissionPresence

# Mirrors chat_consumers.ONLINE_TTL: refreshed on every 'ping' from the client
# and on connect/disconnect. A missed disconnect (dead connection with no
# clean close frame) self-heals once this expires.
CONNECTION_TTL = 90


def _connection_count_key(submission_id: int, user_id: int) -> str:
    return f"submission:presence_count:{submission_id}:{user_id}"


def mark_connect(*, submission_id: int, user_id: int) -> bool:
    """Increments this user's live-connection count for this submission.
    Returns True the first time they go from 0 -> 1 (i.e. just joined)."""
    key = _connection_count_key(submission_id, user_id)
    cache.add(key, 0, timeout=CONNECTION_TTL)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=CONNECTION_TTL)
        count = 1
    cache.touch(key, CONNECTION_TTL)
    return count == 1


def mark_disconnect(*, submission_id: int, user_id: int) -> bool:
    """Decrements the connection count. Returns True once it reaches zero
    (i.e. the user's last tab/device just left this submission)."""
    key = _connection_count_key(submission_id, user_id)
    try:
        count = cache.decr(key)
    except ValueError:
        return True
    if count <= 0:
        cache.delete(key)
        return True
    cache.touch(key, CONNECTION_TTL)
    return False


def refresh_connection(*, submission_id: int, user_id: int) -> None:
    cache.touch(_connection_count_key(submission_id, user_id), CONNECTION_TTL)


def profile_picture_url(profile: Profile | None) -> str | None:
    if not profile or not profile.profile_picture:
        return None
    raw = profile.profile_picture.url
    if raw.startswith(("http://", "https://")):
        path = urlparse(raw).path
        return path if path.startswith("/") else f"/{path.lstrip('/')}"
    if raw.startswith("/"):
        return raw
    return f"/{raw.lstrip('/')}"


def _display_name(user) -> str:
    full = (user.get_full_name() or "").strip()
    return full or user.username


def touch_presence(*, submission_id: int, user) -> None:
    SubmissionPresence.objects.update_or_create(
        submission_id=submission_id,
        user_id=user.id,
        defaults={"last_seen_at": timezone.now()},
    )


def clear_presence(*, submission_id: int, user_id: int) -> None:
    SubmissionPresence.objects.filter(
        submission_id=submission_id,
        user_id=user_id,
    ).delete()


def active_presence_queryset(submission_id: int):
    cutoff = timezone.now() - timedelta(seconds=SubmissionPresence.PRESENCE_TIMEOUT_SECONDS)
    return (
        SubmissionPresence.objects.filter(
            submission_id=submission_id,
            last_seen_at__gte=cutoff,
        )
        .select_related("user", "user__psc_profile")
        .order_by("-last_seen_at")
    )


def serialize_viewers(*, submission_id: int, current_user_id: int) -> list[dict]:
    viewers = []
    for row in active_presence_queryset(submission_id):
        user = row.user
        try:
            profile = user.psc_profile
            role_label = profile.get_role_display()
        except Profile.DoesNotExist:
            profile = None
            role_label = ""
        viewers.append({
            "user_id": user.id,
            "username": user.username,
            "display_name": _display_name(user),
            "role_label": role_label,
            "profile_picture": profile_picture_url(profile),
            "last_seen_at": row.last_seen_at.isoformat(),
            "is_self": user.id == current_user_id,
        })
    return viewers
