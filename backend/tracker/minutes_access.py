"""
Per-agenda-item visibility locks on signed Commission minutes.

Everyone who can open the minutes sees the whole document; agenda items under
an AgendaItemRestriction render as locked placeholders unless the viewer holds
``manage_minute_access`` (Secretary / Admin) or has an AgendaAccessGrant.
Redaction happens server-side — the locked text never leaves the API.
"""
from __future__ import annotations

import secrets

from django.contrib.auth.models import User

from .models import (
    AgendaAccessRequestStatus,
    AgendaItemRestriction,
    Minutes,
    Notification,
    Role,
)
from .rbac import rbac_user_has_permission

# Keys of an agenda block that stay visible on a locked placeholder.
_PLACEHOLDER_KEYS = ("agenda_item_id", "item_key", "sequence", "submission_ref", "title")


def user_can_manage_minute_access(user) -> bool:
    """Restrict/unrestrict items, manage allowlists, decide access requests."""
    return rbac_user_has_permission(user, "manage_minute_access")


def block_key(block: dict) -> str | None:
    """Stable identity of an agenda block in Minutes.content.agenda_items."""
    if not isinstance(block, dict):
        return None
    agenda_item_id = block.get("agenda_item_id")
    if agenda_item_id:
        return f"ai-{agenda_item_id}"
    return block.get("item_key") or None


def ensure_block_key(minutes: Minutes, index: int) -> str:
    """Return the key of the agenda block at ``index``, assigning one if missing.

    Manual blocks (added in the editor) have no agenda_item_id; we write a
    generated ``item_key`` into the block so the restriction survives reorders.
    """
    content = minutes.content or {}
    items = content.get("agenda_items") or []
    if index < 0 or index >= len(items):
        raise IndexError("Agenda item index out of range.")
    block = items[index]
    key = block_key(block)
    if key:
        return key
    key = f"k-{secrets.token_hex(6)}"
    block["item_key"] = key
    minutes.content = content
    minutes.save(update_fields=["content", "updated_at"])
    return key


def restrictions_for(minutes: Minutes) -> dict[str, AgendaItemRestriction]:
    rows = (
        minutes.agenda_restrictions
        .select_related("restricted_by")
        .prefetch_related("grants__user", "access_requests__requested_by")
        .all()
    )
    return {r.item_key: r for r in rows}


def user_can_view_item(user, restriction: AgendaItemRestriction) -> bool:
    if user_can_manage_minute_access(user):
        return True
    return any(g.user_id == user.id for g in restriction.grants.all())


def _my_request_status(user, restriction: AgendaItemRestriction) -> str | None:
    """Latest request status by this user (pending wins over older decisions)."""
    mine = [r for r in restriction.access_requests.all() if r.requested_by_id == user.id]
    if not mine:
        return None
    for req in mine:
        if req.status == AgendaAccessRequestStatus.PENDING:
            return req.status
    return mine[0].status  # access_requests ordered -created_at


def redact_content(minutes: Minutes, user) -> tuple[dict, bool]:
    """Return (content for this user, fully_cleared).

    Restricted blocks the user may not see are replaced with a placeholder
    carrying ``restricted: true`` plus identifying fields only. ``fully_cleared``
    is False when at least one block was redacted (used to hide the stored
    full PDF from this user).
    """
    content = minutes.content or {}
    items = content.get("agenda_items") or []
    if not items:
        return content, True

    restrictions = restrictions_for(minutes)
    if not restrictions:
        return content, True

    fully_cleared = True
    out_items = []
    for block in items:
        key = block_key(block)
        restriction = restrictions.get(key) if key else None
        if restriction is None or user_can_view_item(user, restriction):
            out_items.append(block)
            continue
        fully_cleared = False
        placeholder = {k: block.get(k) for k in _PLACEHOLDER_KEYS if block.get(k) is not None}
        placeholder["restricted"] = True
        placeholder["restriction_reason"] = restriction.reason
        placeholder["my_request_status"] = _my_request_status(user, restriction)
        out_items.append(placeholder)

    redacted = dict(content)
    redacted["agenda_items"] = out_items
    return redacted, fully_cleared


def merge_protected_content(minutes: Minutes, incoming: dict, user) -> dict:
    """Restore restricted blocks a saver was never shown.

    Editors who are not cleared on an item receive a placeholder; if they save
    the minutes back, the placeholder must not overwrite the locked original.
    Matched by block key; unmatched placeholders are dropped.
    """
    if not isinstance(incoming, dict):
        return incoming
    items = incoming.get("agenda_items")
    if not isinstance(items, list):
        return incoming

    stored = {
        block_key(b): b
        for b in ((minutes.content or {}).get("agenda_items") or [])
        if block_key(b)
    }
    merged_items = []
    for block in items:
        if isinstance(block, dict) and block.get("restricted") is True:
            original = stored.get(block_key(block))
            if original is not None:
                merged_items.append(original)
            # placeholder with no stored original: drop it — never persist redactions
            continue
        merged_items.append(block)

    merged = dict(incoming)
    merged["agenda_items"] = merged_items
    return merged


def access_control_payload(minutes: Minutes, user) -> dict:
    """Per-user access metadata serialized alongside the minutes."""
    can_manage = user_can_manage_minute_access(user)
    payload = {"can_manage": can_manage, "restrictions": []}
    for restriction in restrictions_for(minutes).values():
        row = {
            "id": restriction.id,
            "item_key": restriction.item_key,
            "item_title": restriction.item_title,
            "reason": restriction.reason,
            "created_at": restriction.created_at,
            "can_view": user_can_view_item(user, restriction),
        }
        if can_manage:
            row["restricted_by_name"] = (
                restriction.restricted_by.get_full_name()
                or restriction.restricted_by.username
            )
            row["visible_to"] = [
                {
                    "id": g.user_id,
                    "username": g.user.username,
                    "full_name": g.user.get_full_name(),
                }
                for g in restriction.grants.all()
            ]
            row["pending_requests"] = [
                {
                    "id": req.id,
                    "requested_by": req.requested_by_id,
                    "requested_by_name": (
                        req.requested_by.get_full_name() or req.requested_by.username
                    ),
                    "message": req.message,
                    "created_at": req.created_at,
                }
                for req in restriction.access_requests.all()
                if req.status == AgendaAccessRequestStatus.PENDING
            ]
        else:
            row["my_request_status"] = _my_request_status(user, restriction)
        payload["restrictions"].append(row)
    return payload


def minute_access_deciders() -> list[User]:
    """Users notified of new access requests (Secretary / Admin profiles)."""
    return list(
        User.objects.filter(
            is_active=True,
            psc_profile__role__in=[Role.PSC_SECRETARY, Role.PSC_ADMIN],
        )
    )


def _minutes_view_link(restriction: AgendaItemRestriction, *, manage: bool = False) -> str:
    """In-app path to the minutes view; ``manage`` deep-links the access modal."""
    link = f"/secretariat/meetings/{restriction.minutes.meeting_id}/minutes?mode=view"
    if manage:
        link += f"&item={restriction.item_key}"
    return link


def notify_access_request(restriction: AgendaItemRestriction, requester) -> None:
    ref = restriction.minutes.meeting.reference_number
    title = restriction.item_title or restriction.item_key
    requester_name = requester.get_full_name() or requester.username
    for decider in minute_access_deciders():
        if decider.id == requester.id:
            continue
        Notification.objects.create(
            recipient=decider,
            channel=Notification.Channel.BOTH,
            title=f"Agenda access request — {ref}",
            body=(
                f'{requester_name} requested access to the restricted agenda item '
                f'"{title}" in the minutes of {ref}. Open the minutes to approve or deny.'
            ),
            link=_minutes_view_link(restriction, manage=True),
        )


def notify_access_decision(request_row) -> None:
    restriction = request_row.restriction
    ref = restriction.minutes.meeting.reference_number
    title = restriction.item_title or restriction.item_key
    approved = request_row.status == AgendaAccessRequestStatus.APPROVED
    note = (request_row.decision_note or "").strip()
    Notification.objects.create(
        recipient=request_row.requested_by,
        channel=Notification.Channel.BOTH,
        title=(
            f"Agenda access {'granted' if approved else 'declined'} — {ref}"
        ),
        body=(
            f'Your request to view the agenda item "{title}" in the minutes of {ref} '
            f"was {'approved' if approved else 'declined'}."
            + (f' Note: "{note}"' if note else "")
        ),
        link=_minutes_view_link(restriction),
    )


def notify_access_granted(restriction: AgendaItemRestriction, user, granted_by) -> None:
    ref = restriction.minutes.meeting.reference_number
    title = restriction.item_title or restriction.item_key
    granter = granted_by.get_full_name() or granted_by.username
    Notification.objects.create(
        recipient=user,
        channel=Notification.Channel.BOTH,
        title=f"Agenda item shared with you — {ref}",
        body=(
            f'{granter} shared the restricted agenda item "{title}" '
            f"from the minutes of {ref} with you."
        ),
        link=_minutes_view_link(restriction),
    )
