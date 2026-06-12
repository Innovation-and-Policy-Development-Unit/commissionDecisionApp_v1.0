"""
Unit-scoped visibility of signed Commission minutes.

The Secretariat and Commission see the whole document. OPSC unit staff see the
document structure, but each agenda item's discussion/decision is visible only
when the underlying submission is routed to *their* unit, or when they are
assigned to the CommissionTask produced by that item. Everything else renders
as a redacted placeholder. Redaction happens server-side — the text of another
unit's agenda item never leaves the API.
"""
from __future__ import annotations

from .models import AgendaItem, Minutes, Role

# Roles that always see the full minutes (and may edit them).
FULL_ACCESS_ROLES = frozenset({
    Role.PSC_SECRETARY,
    Role.PSC_ADMIN,
    Role.CHAIRPERSON,
    Role.PSC_COMMISSIONER,
    Role.SENIOR_ADMIN_OFFICER,
})

# Unit staff → submission routing key (Submission.routed_unit).
ROLE_TO_ROUTED_UNIT: dict[str, str] = {
    Role.ODU_MANAGER: "odu",
    Role.ODU_PRINCIPAL: "odu",
    Role.PRINCIPAL_ORG_DEV_ANALYST: "odu",
    Role.PRINCIPAL_JOB_ANALYST: "odu",
    Role.VIPAM_MANAGER: "vipam",
    Role.VIPAM_PRINCIPAL: "vipam",
    Role.HR_UNIT_MANAGER: "hr",
    Role.HR_UNIT_PRINCIPAL: "hr",
    Role.COMPLIANCE_MANAGER: "compliance",
    Role.COMPLIANCE_PRINCIPAL: "compliance",
    Role.COMPLIANCE_SENIOR: "compliance",
    Role.CSU_MANAGER: "csu",
}

# Keys of an agenda block that stay visible on a redacted placeholder.
_PLACEHOLDER_KEYS = ("agenda_item_id", "item_key", "sequence", "submission_ref", "title")


def _profile_role(user) -> str | None:
    profile = getattr(user, "psc_profile", None)
    return profile.role if profile else None


def user_has_full_minutes_access(user) -> bool:
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return _profile_role(user) in FULL_ACCESS_ROLES


def block_key(block: dict) -> str | None:
    """Stable identity of an agenda block (used to merge edits safely)."""
    if not isinstance(block, dict):
        return None
    agenda_item_id = block.get("agenda_item_id")
    if agenda_item_id:
        return f"ai-{agenda_item_id}"
    return block.get("item_key") or None


def _routed_units_by_agenda_item(content: dict) -> dict[int, str]:
    """agenda_item_id → submission.routed_unit for every block in the minutes."""
    ids = [
        b.get("agenda_item_id")
        for b in (content.get("agenda_items") or [])
        if isinstance(b, dict) and b.get("agenda_item_id")
    ]
    if not ids:
        return {}
    rows = AgendaItem.objects.filter(id__in=ids).select_related("submission")
    return {row.id: (row.submission.routed_unit or "") for row in rows}


def _task_agenda_item_ids(user, agenda_item_ids: list[int]) -> set[int]:
    """Agenda items whose CommissionTask is assigned to this user."""
    from django.db.models import Q

    from .models import CommissionTask

    if not agenda_item_ids:
        return set()
    return set(
        CommissionTask.objects.filter(
            Q(assigned_manager=user) | Q(assigned_staff=user) | Q(assigned_staff_m2m=user),
            agenda_item_id__in=agenda_item_ids,
        ).values_list("agenda_item_id", flat=True)
    )


def redact_content(minutes: Minutes, user) -> tuple[dict, bool]:
    """Return (content for this user, fully_cleared).

    Agenda blocks outside the viewer's unit (and not assigned to them as a
    task) are replaced with placeholders carrying ``restricted: true`` plus
    identifying fields only. ``fully_cleared`` is False when at least one
    block was redacted — used to hide the stored full PDF from this user.
    """
    content = minutes.content or {}
    items = content.get("agenda_items") or []
    if not items or user_has_full_minutes_access(user):
        return content, True

    unit_map = _routed_units_by_agenda_item(content)
    user_unit = ROLE_TO_ROUTED_UNIT.get(_profile_role(user) or "", "")
    task_items = _task_agenda_item_ids(user, list(unit_map.keys()))

    fully_cleared = True
    out_items = []
    for block in items:
        agenda_item_id = block.get("agenda_item_id") if isinstance(block, dict) else None
        routed_unit = unit_map.get(agenda_item_id, "")
        visible = bool(
            (user_unit and routed_unit and routed_unit == user_unit)
            or (agenda_item_id in task_items)
        )
        if visible:
            out_items.append(block)
            continue
        fully_cleared = False
        placeholder = {k: block.get(k) for k in _PLACEHOLDER_KEYS if block.get(k) is not None}
        placeholder["restricted"] = True
        out_items.append(placeholder)

    redacted = dict(content)
    redacted["agenda_items"] = out_items
    return redacted, fully_cleared


def merge_protected_content(minutes: Minutes, incoming: dict, user) -> dict:
    """Restore redacted blocks a saver was never shown.

    Editors are full-access roles today, but as defence in depth: if a saver
    sends back a ``restricted`` placeholder, the stored original block is kept
    rather than overwritten. Matched by block key; unmatched placeholders are
    dropped — a redaction is never persisted.
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
            continue
        merged_items.append(block)

    merged = dict(incoming)
    merged["agenda_items"] = merged_items
    return merged
