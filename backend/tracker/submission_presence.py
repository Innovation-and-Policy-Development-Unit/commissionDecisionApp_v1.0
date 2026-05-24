"""Submission detail presence — 30s heartbeat, 90s expiry."""

from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlparse

from django.utils import timezone

from .models import Profile, SubmissionPresence


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
