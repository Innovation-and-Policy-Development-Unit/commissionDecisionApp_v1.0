"""Sitting Pack (Meeting Mode) session helpers."""

from __future__ import annotations

import secrets

from django.utils import timezone

from .models import Role, SittingPackSession

SITTING_PACK_ROLES = frozenset({
    Role.PSC_COMMISSIONER,
    Role.CHAIRPERSON,
    Role.PSC_SECRETARY,
    Role.SENIOR_ADMIN_OFFICER,
    Role.PSC_ADMIN,
    Role.PSC_MANAGER,
})

BRIEF_REQUEST_ROLES = SITTING_PACK_ROLES


def _user_profile(user):
    from .models import Profile

    return Profile.objects.get(user=user)


def user_can_use_sitting_pack(user) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    try:
        profile = _user_profile(user)
    except Exception:
        return False
    return profile.role in SITTING_PACK_ROLES


def _viewer_display_name(user) -> str:
    try:
        profile = _user_profile(user)
        role_label = profile.get_role_display()
    except Exception:
        role_label = ""
    name = (user.get_full_name() or "").strip() or user.username
    return f"{name} · {role_label}" if role_label else name


def _new_seal_code() -> str:
    return secrets.token_hex(4).upper()


def end_active_sessions(*, meeting_id: int, user_id: int) -> None:
    SittingPackSession.objects.filter(
        meeting_id=meeting_id,
        user_id=user_id,
        ended_at__isnull=True,
    ).update(ended_at=timezone.now())


def start_session(*, meeting, user) -> SittingPackSession:
    end_active_sessions(meeting_id=meeting.id, user_id=user.id)
    return SittingPackSession.objects.create(
        meeting=meeting,
        user=user,
        seal_code=_new_seal_code(),
    )


def session_payload(session: SittingPackSession, *, user) -> dict:
    meeting = session.meeting
    return {
        "session_id": session.id,
        "seal_code": session.seal_code,
        "meeting_id": meeting.id,
        "meeting_reference": meeting.reference_number,
        "meeting_title": meeting.title,
        "viewer_name": _viewer_display_name(user),
        "started_at": session.started_at.isoformat(),
        "last_heartbeat_at": session.last_heartbeat_at.isoformat(),
        "active": session.is_active,
    }


def get_active_session(*, meeting_id: int, user_id: int) -> SittingPackSession | None:
    qs = (
        SittingPackSession.objects.filter(
            meeting_id=meeting_id,
            user_id=user_id,
            ended_at__isnull=True,
        )
        .select_related("meeting")
        .order_by("-started_at")
    )
    for session in qs[:3]:
        if session.is_active:
            return session
        session.ended_at = timezone.now()
        session.save(update_fields=["ended_at"])
    return None
