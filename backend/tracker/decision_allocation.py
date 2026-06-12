"""
Automatic post-signing allocation: signed minutes → unit manager tasks.

When the minutes are signed, each agenda item that carries a decision becomes
a CommissionTask assigned to the responsible unit's manager (resolved from
Submission.routed_unit). The manager then assigns a Principal/Senior through
the existing task flow. Items that cannot be auto-allocated (no routed unit,
or no active manager for the unit) are reported to the Secretariat for manual
allocation. Idempotent: re-signing edited minutes only allocates new items.
"""
from __future__ import annotations

import logging

from django.contrib.auth.models import User
from django.db.models import Q

from .models import (
    AgendaItem,
    CommissionActionUnit,
    CommissionDecisionOutcome,
    CommissionTask,
    Minutes,
    Notification,
    Role,
)

logger = logging.getLogger("scdms.app")

ROUTED_UNIT_TO_MANAGER_ROLE: dict[str, str] = {
    "odu": Role.ODU_MANAGER,
    "vipam": Role.VIPAM_MANAGER,
    "hr": Role.HR_UNIT_MANAGER,
    "compliance": Role.COMPLIANCE_MANAGER,
    "csu": Role.CSU_MANAGER,
}

ROUTED_UNIT_TO_ACTION_UNIT: dict[str, str] = {
    "odu": CommissionActionUnit.ODU,
    "vipam": CommissionActionUnit.VIPAM_HRDU,
    "hr": CommissionActionUnit.HRMU,
    "csu": CommissionActionUnit.CSU,
    # "compliance" has no CommissionActionUnit entry — left blank on the task.
}

_DECISION_TYPE_TO_OUTCOME: dict[str, str] = {
    "approved": CommissionDecisionOutcome.APPROVED,
    "rejected": CommissionDecisionOutcome.REJECTED,
    "deferred": CommissionDecisionOutcome.DEFERRED_NEXT,
}


def unit_manager_for(routed_unit: str) -> User | None:
    role = ROUTED_UNIT_TO_MANAGER_ROLE.get(routed_unit or "")
    if not role:
        return None
    return (
        User.objects.filter(is_active=True, psc_profile__role=role)
        .order_by("id")
        .first()
    )


def _secretariat_deciders() -> list[User]:
    return list(
        User.objects.filter(
            Q(psc_profile__role__in=[Role.PSC_SECRETARY, Role.PSC_ADMIN])
            | Q(is_superuser=True),
            is_active=True,
        ).distinct()
    )


def allocate_decision_tasks(minutes: Minutes, actor) -> dict:
    """Create unit-manager tasks for every decided agenda item. Returns stats."""
    meeting = minutes.meeting
    content = minutes.content or {}
    blocks = [b for b in (content.get("agenda_items") or []) if isinstance(b, dict)]

    agenda_ids = [b.get("agenda_item_id") for b in blocks if b.get("agenda_item_id")]
    agenda_items = {
        row.id: row
        for row in AgendaItem.objects.filter(id__in=agenda_ids).select_related("submission")
    }
    already_allocated = set(
        CommissionTask.objects.filter(agenda_item_id__in=agenda_ids)
        .values_list("agenda_item_id", flat=True)
    )

    created, unallocated = [], []
    for index, block in enumerate(blocks, start=1):
        decision_text = (block.get("decision") or "").strip()
        agenda_item_id = block.get("agenda_item_id")
        title = block.get("title") or block.get("submission_ref") or f"Item {index}"
        if not decision_text:
            continue
        if not agenda_item_id or agenda_item_id not in agenda_items:
            unallocated.append((title, "no linked submission"))
            continue
        if agenda_item_id in already_allocated:
            continue  # re-sign of edited minutes — task already exists

        agenda_item = agenda_items[agenda_item_id]
        submission = agenda_item.submission
        routed_unit = (submission.routed_unit or "") if submission else ""
        manager = unit_manager_for(routed_unit)
        if manager is None:
            unallocated.append(
                (title, f"no active manager for unit '{routed_unit or 'unrouted'}'")
            )
            continue

        task = CommissionTask.objects.create(
            title=f"Action Commission decision — {title}"[:255],
            description=(block.get("discussion") or "")[:2000],
            decision_detail=decision_text,
            decision_outcome=_DECISION_TYPE_TO_OUTCOME.get(
                (block.get("decision_type") or "").lower(), ""
            ),
            action_unit=ROUTED_UNIT_TO_ACTION_UNIT.get(routed_unit, ""),
            meeting=meeting,
            meeting_reference=meeting.reference_number or "",
            meeting_date=meeting.date,
            minute_reference=f"Item {block.get('sequence') or index}",
            submission=submission,
            agenda_item=agenda_item,
            assigned_manager=manager,
            created_by=actor,
        )
        created.append(task)
        Notification.objects.create(
            recipient=manager,
            submission=submission,
            channel=Notification.Channel.BOTH,
            title=f"Commission decision allocated to your unit — {meeting.reference_number}",
            body=(
                f'The Commission\'s decision on "{title}" has been allocated to your unit '
                f"following the signing of the minutes of {meeting.reference_number}. "
                f"Open the task register to assign an officer."
            ),
            link="/secretariat/tasks",
        )

    if unallocated:
        details = "; ".join(f'"{t}" ({why})' for t, why in unallocated[:10])
        for decider in _secretariat_deciders():
            Notification.objects.create(
                recipient=decider,
                channel=Notification.Channel.BOTH,
                title=f"Decisions need manual allocation — {meeting.reference_number}",
                body=(
                    f"{len(unallocated)} decision(s) from the signed minutes could not be "
                    f"auto-allocated to a unit manager: {details}. "
                    f"Please allocate them from the task register."
                ),
                link="/secretariat/tasks",
            )

    stats = {"created": len(created), "unallocated": len(unallocated)}
    logger.info(
        "DECISION_AUTO_ALLOCATE | Meeting %s | actor=%s | %s",
        meeting.reference_number, getattr(actor, "username", "?"), stats,
    )
    return stats


def queue_post_signing_automation(minutes: Minutes) -> None:
    """C-automation on sign: AI decision extraction + outcome letter drafts."""
    from .tasks import extract_decisions_from_minutes, queue_outcome_letter

    try:
        extract_decisions_from_minutes.delay(minutes.meeting_id)
    except Exception as exc:  # Celery unavailable — non-fatal
        logger.warning("POST_SIGN_EXTRACT_SKIP | %s", exc)

    content = minutes.content or {}
    for block in content.get("agenda_items") or []:
        if not isinstance(block, dict):
            continue
        decision_type = (block.get("decision_type") or "").lower()
        agenda_item_id = block.get("agenda_item_id")
        if decision_type not in {"approved", "rejected"} or not agenda_item_id:
            continue
        agenda_item = (
            AgendaItem.objects.filter(id=agenda_item_id).select_related("submission").first()
        )
        if agenda_item and agenda_item.submission_id:
            queue_outcome_letter(
                agenda_item.submission_id, outcome=decision_type, force=True,
            )
