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
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from .action_officer import officer_text_for_block, parse_action_officer
from .opsc_access import MANAGER_ROLE_TO_ROUTED_UNIT
from .models import (
    AgendaItem,
    CommissionActionUnit,
    CommissionDecisionOutcome,
    CommissionTask,
    Meeting,
    Minutes,
    Notification,
    Role,
    WorkflowStage,
)

logger = logging.getLogger("scdms.app")

_OPEN_STATUSES = ("open", "in_progress")

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
    "noted": CommissionDecisionOutcome.NOTED,
    "not_approved": CommissionDecisionOutcome.NOT_APPROVED,
    "rejected": CommissionDecisionOutcome.REJECTED,
    "deferred_back_to_unit": CommissionDecisionOutcome.DEFERRED_BACK_TO_UNIT,
    "deferred": CommissionDecisionOutcome.DEFERRED_NEXT,
}


def _effective_routed_unit(submission) -> str:
    """Submission's routed unit, falling back to the intake form-type mapping.

    Submissions that reached the Commission without passing through checklist
    review never get ``routed_unit`` set, which used to force manual allocation
    of their decisions. The form type → unit mapping (admin-configurable on
    PSCFormType) is just as authoritative, so use it as a fallback.
    """
    if submission is None:
        return ""
    if submission.routed_unit:
        return submission.routed_unit

    from .intake_routing import routed_unit_for_form_type

    return routed_unit_for_form_type(submission.form_type_code) or ""


def advance_to_decision_entered_assigned(submission, actor, remarks: str = "") -> bool:
    """Once a decision has an allocated CommissionTask, the submission has
    moved past the bare decision outcome into 'decision entered & assigned for
    implementation' — advance current_stage to match (a graph-valid direct hop
    from APPROVED/REJECTED/NOTED/NOT_APPROVED, per transitions._STAGE_GRAPH),
    so the ministry-facing journey and public tracker reflect that a unit
    manager is now working the decision instead of showing it stuck at the
    bare outcome. Deferred outcomes (sent back to the unit / next meeting)
    are not concluding decisions and are left alone. Returns True if advanced.
    """
    from .models import WorkflowEvent

    if submission is None or submission.current_stage not in _CONCLUDING_STAGES:
        return False
    prev = submission.current_stage
    submission.current_stage = WorkflowStage.DECISION_ENTERED_ASSIGNED
    submission.save(update_fields=["current_stage", "updated_at"])
    WorkflowEvent.objects.create(
        submission=submission,
        actor=actor,
        previous_stage=prev,
        new_stage=WorkflowStage.DECISION_ENTERED_ASSIGNED,
        remarks=remarks or "Decision allocated to unit manager.",
    )
    return True


def unit_manager_for(routed_unit: str) -> User | None:
    role = ROUTED_UNIT_TO_MANAGER_ROLE.get(routed_unit or "")
    if not role:
        return None
    # Least-loaded active manager first (ties → lowest id), so a unit with two
    # managers shares decisions instead of always piling onto the first.
    return (
        User.objects.filter(is_active=True, psc_profile__role=role)
        .annotate(
            open_tasks=Count(
                "managed_commission_tasks",
                filter=Q(managed_commission_tasks__status__in=_OPEN_STATUSES),
            )
        )
        .order_by("open_tasks", "id")
        .first()
    )


def can_action_minutes(minutes) -> bool:
    """Signed minutes can always be actioned. Unsigned minutes can be actioned
    once the Secretary has authorised it (the signed scan then follows later)."""
    return minutes.status == "signed" or minutes.unsigned_actioning_allowed_at is not None


def basis_text(minutes) -> str:
    """How to describe the minutes in remarks and notices."""
    if minutes.status == "signed":
        return "signed minutes"
    return "minutes not yet signed (actioning authorised by the Secretary)"


def active_holds(agenda_item_ids=None) -> dict[int, dict]:
    """Decisions the Secretary is holding, keyed by agenda item id.

    Two kinds count as a hold: one placed here on a decision in the minutes
    (``source="decision"``), and the older hold on the decided paper itself
    (``source="submission"``, set from the submission page, which also stops its
    letter being served). Either way the decision is not actioned meanwhile.
    """
    from .models import DecisionActioningHold

    qs = DecisionActioningHold.objects.filter(released_at__isnull=True)
    items = AgendaItem.objects.filter(submission__decision_hold_active=True).select_related("submission")
    if agenda_item_ids is not None:
        ids = list(agenda_item_ids)
        qs = qs.filter(agenda_item_id__in=ids)
        items = items.filter(id__in=ids)
    out = {
        i.id: {"reason": i.submission.decision_hold_reason, "source": "submission"}
        for i in items
    }
    out.update({h.agenda_item_id: {"reason": h.reason, "source": "decision"} for h in qs})
    return out


def named_unit_manager(officer_units: list[str]) -> tuple[str, User] | tuple[None, None]:
    """First unit named as Action Officer that has an active manager."""
    for unit in officer_units:
        manager = unit_manager_for(unit)
        if manager is not None:
            return unit, manager
    return None, None


def also_involved_note(officer_text: str, officer_units: list[str], chosen_unit: str) -> str:
    """Task-description line for units the minutes name besides the one that owns the task."""
    others = [u.upper() for u in officer_units if u != chosen_unit]
    if not others:
        return ""
    return f'\n\nAlso named in the minutes ("{officer_text}"): {", ".join(others)}.'


def _minutes_decision_numbers(meeting) -> list[str]:
    """Decision numbers the Commission already wrote into this sitting's minutes."""
    out = []
    for minutes in Minutes.objects.filter(meeting_id=meeting.pk):
        for block in (minutes.content or {}).get("agenda_items") or []:
            if isinstance(block, dict) and (block.get("decision_number") or "").strip():
                out.append(block["decision_number"].strip())
    return out


def minutes_block_for(agenda_item) -> dict | None:
    """The minutes block (decision, decision_number, …) written for an agenda item."""
    if agenda_item is None:
        return None
    for minutes in Minutes.objects.filter(meeting_id=agenda_item.meeting_id):
        for block in (minutes.content or {}).get("agenda_items") or []:
            if isinstance(block, dict) and block.get("agenda_item_id") == agenda_item.pk:
                return block
    return None


def decision_number_for(block: dict | None, meeting) -> str:
    """The decision number for a task: the Commission's own number from the
    minutes when the minute-taker recorded one, else a generated fallback."""
    real = ((block or {}).get("decision_number") or "").strip()[:64]
    return real or next_decision_number(meeting)


def next_decision_number(meeting) -> str:
    """Fallback number for a decision whose minutes carry none, in the register's
    format ``decision#-meeting#-year`` (e.g. ``07-23-2026``).

    Only generated when the sitting has the Commission's own meeting number
    (``Meeting.psc_meeting_number``) — the system's ``MTG-…`` reference is not
    that number, so it is never used. Continues after the highest plain
    number already used for the sitting, counting both existing tasks and
    numbers written in the minutes, so it can never collide with a real
    number. Returns "" when it cannot be generated (the field stays blank).
    """
    import re

    if meeting is None:
        return ""
    meeting_no = (getattr(meeting, "psc_meeting_number", "") or "").strip()
    if not meeting_no:
        return ""
    # ``date`` is a str on a Meeting built in memory and not yet reloaded.
    year = int(str(meeting.date)[:4]) if meeting.date else timezone.now().year
    suffix = f"-{meeting_no}-{year}"
    pattern = re.compile(r"^(\d+)" + re.escape(suffix) + r"$")

    with transaction.atomic():
        # Serialise concurrent allocations for the same sitting.
        type(meeting).objects.select_for_update().filter(pk=meeting.pk).first()
        existing = list(
            CommissionTask.objects.filter(
                meeting_id=meeting.pk, decision_number__endswith=suffix
            ).values_list("decision_number", flat=True)
        )
        used = [
            int(hit.group(1))
            for num in existing + _minutes_decision_numbers(meeting)
            if (hit := pattern.match(num))
        ]
    return f"{(max(used) if used else 0) + 1:02d}{suffix}"


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
    holds = active_holds(agenda_ids)

    created, unallocated, held = [], [], []
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
        if agenda_item_id in holds:
            held.append(title)  # the Secretary is holding this decision
            continue

        agenda_item = agenda_items[agenda_item_id]
        submission = agenda_item.submission
        routed_unit = _effective_routed_unit(submission)
        if submission and routed_unit and not submission.routed_unit:
            # Persist the form-type-derived unit so the rest of the app
            # (checklists, unit dashboards) sees the same routing.
            submission.routed_unit = routed_unit
            submission.save(update_fields=["routed_unit"])
        # The Commission's named Action Officer outranks the submission's routing.
        officer_text = officer_text_for_block(block)
        officer_units = parse_action_officer(officer_text)
        target_unit, manager = named_unit_manager(officer_units)
        if manager is None:
            target_unit = routed_unit
            manager = unit_manager_for(routed_unit)
        if manager is None:
            unallocated.append(
                (title, f"no active manager for unit '{routed_unit or 'unrouted'}'")
            )
            continue

        task = CommissionTask.objects.create(
            decision_number=decision_number_for(block, meeting),
            title=f"Action Commission decision — {title}"[:255],
            description=(
                (block.get("discussion") or "")[:1900]
                + also_involved_note(officer_text, officer_units, target_unit)
            ),
            decision_detail=decision_text,
            decision_outcome=_DECISION_TYPE_TO_OUTCOME.get(
                (block.get("decision_type") or "").lower(), ""
            ),
            action_unit=ROUTED_UNIT_TO_ACTION_UNIT.get(target_unit, ""),
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
        if submission is not None:
            advance_to_decision_entered_assigned(
                submission, actor,
                remarks=f"Decision allocated to unit manager following the {basis_text(minutes)} of {meeting.reference_number}.",
            )
        Notification.objects.create(
            recipient=manager,
            submission=submission,
            channel=Notification.Channel.BOTH,
            title=f"Commission decision allocated to your unit — {meeting.reference_number}",
            body=(
                f'The Commission\'s decision on "{title}" has been allocated to your unit '
                f"following the {basis_text(minutes)} of {meeting.reference_number}. "
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
    if held:
        stats["held"] = len(held)  # only reported when the Secretary is holding something
    logger.info(
        "DECISION_AUTO_ALLOCATE | Meeting %s | actor=%s | %s",
        meeting.reference_number, getattr(actor, "username", "?"), stats,
    )
    return stats


def pending_decision_allocations() -> list[dict]:
    """Decided agenda items from signed minutes that still have no task.

    Same selection rules as ``allocate_decision_tasks`` (decision text present,
    linked agenda item, no existing CommissionTask). Powers the "prefill from a
    pending decision" picker in the manual Allocate-task modal, so the
    Secretariat never retypes what the signed minutes already contain.
    """
    pending: list[dict] = []
    for minutes in Minutes.objects.filter(
        Q(status="signed") | Q(unsigned_actioning_allowed_at__isnull=False)
    ).select_related("meeting"):
        meeting = minutes.meeting
        blocks = [
            b
            for b in ((minutes.content or {}).get("agenda_items") or [])
            if isinstance(b, dict)
        ]
        agenda_ids = [b.get("agenda_item_id") for b in blocks if b.get("agenda_item_id")]
        agenda_items = {
            row.id: row
            for row in AgendaItem.objects.filter(id__in=agenda_ids).select_related("submission")
        }
        tasked = set(
            CommissionTask.objects.filter(agenda_item_id__in=agenda_ids)
            .values_list("agenda_item_id", flat=True)
        )
        holds = active_holds(agenda_ids)

        for index, block in enumerate(blocks, start=1):
            decision_text = (block.get("decision") or "").strip()
            agenda_item_id = block.get("agenda_item_id")
            if not decision_text or agenda_item_id in tasked:
                continue
            agenda_item = agenda_items.get(agenda_item_id)
            if agenda_item is None:
                continue

            submission = agenda_item.submission
            routed_unit = _effective_routed_unit(submission)
            title = block.get("title") or block.get("submission_ref") or f"Item {index}"
            officer_text = officer_text_for_block(block)
            pending.append(
                {
                    "agenda_item": agenda_item_id,
                    "minutes": minutes.id,
                    "minutes_signed": minutes.status == "signed",
                    "held": agenda_item_id in holds,
                    "hold_reason": holds[agenda_item_id]["reason"] if agenda_item_id in holds else "",
                    "hold_source": holds[agenda_item_id]["source"] if agenda_item_id in holds else "",
                    "meeting": meeting.id,
                    "meeting_reference": meeting.reference_number or "",
                    "meeting_date": meeting.date.isoformat() if meeting.date else None,
                    "minute_reference": f"Item {block.get('sequence') or index}",
                    "decision_number": (block.get("decision_number") or "").strip()[:64],
                    "item_title": title,
                    "suggested_task_title": f"Action Commission decision — {title}"[:255],
                    "decision_detail": decision_text,
                    "description": (block.get("discussion") or "")[:2000],
                    "decision_outcome": _DECISION_TYPE_TO_OUTCOME.get(
                        (block.get("decision_type") or "").lower(), ""
                    ),
                    "action_unit": ROUTED_UNIT_TO_ACTION_UNIT.get(routed_unit, ""),
                    "routed_unit": routed_unit,
                    "officer_text": officer_text,
                    "officer_units": parse_action_officer(officer_text),
                    "submission": submission.id if submission else None,
                    "submission_reference": (
                        submission.reference_number if submission else ""
                    ),
                }
            )
    return pending


def queue_post_signing_automation(minutes: Minutes, only: set | None = None) -> None:
    """C-automation on sign: AI decision extraction + outcome letter drafts.

    Decisions the Secretary is holding are skipped. ``only`` limits it to the
    given agenda items (used when a held decision is released)."""
    from .tasks import extract_decisions_from_minutes, queue_outcome_letter

    if only is None:
        try:
            extract_decisions_from_minutes.delay(minutes.meeting_id)
        except Exception as exc:  # Celery unavailable — non-fatal
            logger.warning("POST_SIGN_EXTRACT_SKIP | %s", exc)

    content = minutes.content or {}
    holds = active_holds()
    for block in content.get("agenda_items") or []:
        if not isinstance(block, dict):
            continue
        decision_type = (block.get("decision_type") or "").lower()
        agenda_item_id = block.get("agenda_item_id")
        if decision_type not in {"approved", "rejected"} or not agenda_item_id:
            continue
        if agenda_item_id in holds or (only is not None and agenda_item_id not in only):
            continue
        agenda_item = (
            AgendaItem.objects.filter(id=agenda_item_id).select_related("submission").first()
        )
        if agenda_item and agenda_item.submission_id:
            queue_outcome_letter(
                agenda_item.submission_id, outcome=decision_type, force=True,
            )


# Decision recorded in the minutes (block.decision_type) → submission stage.
_DECISION_TYPE_TO_STAGE: dict[str, str] = {
    "approved": WorkflowStage.APPROVED,
    "noted": WorkflowStage.NOTED,
    "not_approved": WorkflowStage.NOT_APPROVED,
    "rejected": WorkflowStage.REJECTED,
    "deferred_back_to_unit": WorkflowStage.DEFERRED_BACK_TO_UNIT,
    "deferred": WorkflowStage.MATTERS_ARISING,  # deferred to next meeting
}

# Stages an item may be at while before the Commission (or in a hold state).
_COMMISSION_SOURCE_STAGES = frozenset({
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.TABLED,
    WorkflowStage.MATTERS_ARISING,
    WorkflowStage.AWAITING_LEGAL_ADVICE,
})

_CONCLUDING_STAGES = frozenset({
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.NOTED,
    WorkflowStage.NOT_APPROVED,
})


def advance_submissions_for_signed_minutes(minutes: Minutes, actor, only: set | None = None) -> dict:
    """Move each decided submission from its Commission stage to the recorded
    outcome — a single hop mirroring the old per-submission decision action.

    For every agenda block carrying a ``decision_type``, this stamps the outcome
    stage, sets ``commission_approved_at`` on approval, resolves/records the
    relevant deferral, writes a tamper-evident decision proof + ``WorkflowEvent``,
    and cascades final decisions to attached children. Idempotent: it skips any
    submission no longer at a Commission stage, so re-signing a corrected scan
    does not re-transition. Best-effort per item — one failure never aborts the
    rest of the signing automation.
    """
    from .deferral_tracking import record_deferral, resolve_open_deferrals
    from .decision_proof import create_decision_proof, is_decision_stage
    from .models import DeferralType, Submission, WorkflowEvent

    content = minutes.content or {}
    blocks = [b for b in (content.get("agenda_items") or []) if isinstance(b, dict)]
    advanced = 0
    holds = active_holds()
    for block in blocks:
        agenda_item_id = block.get("agenda_item_id")
        target = _DECISION_TYPE_TO_STAGE.get((block.get("decision_type") or "").lower())
        if not agenda_item_id or not target:
            continue
        # A decision on hold stays exactly as it was until the Secretary releases it.
        if agenda_item_id in holds or (only is not None and agenda_item_id not in only):
            continue
        agenda_item = (
            AgendaItem.objects.filter(id=agenda_item_id).select_related("submission").first()
        )
        submission = agenda_item.submission if agenda_item else None
        if submission is None:
            continue
        prev = submission.current_stage
        if prev == target or prev not in _COMMISSION_SOURCE_STAGES:
            continue  # already decided, or not at a Commission stage

        remarks = (block.get("decision") or "").strip()
        try:
            with transaction.atomic():
                submission.current_stage = target
                update_fields = ["current_stage", "updated_at"]
                if target == WorkflowStage.APPROVED and submission.commission_approved_at is None:
                    submission.commission_approved_at = timezone.now()
                    update_fields.append("commission_approved_at")
                submission.save(update_fields=update_fields)

                if target in _CONCLUDING_STAGES:
                    resolve_open_deferrals(submission)
                elif target == WorkflowStage.DEFERRED_BACK_TO_UNIT:
                    record_deferral(
                        submission,
                        deferral_type=DeferralType.BACK_TO_UNIT,
                        deferred_by=actor,
                        from_meeting=minutes.meeting,
                        agenda_item=agenda_item,
                        reason=remarks,
                    )

                proof_hash, proof_payload = "", {}
                if is_decision_stage(target):
                    proof_hash, proof_payload = create_decision_proof(
                        submission=submission,
                        previous_stage=prev,
                        new_stage=target,
                        actor=actor,
                        remarks=remarks,
                    )
                WorkflowEvent.objects.create(
                    submission=submission,
                    actor=actor,
                    previous_stage=prev,
                    new_stage=target,
                    remarks=remarks or f"Recorded from the {basis_text(minutes)}.",
                    content_hash=proof_hash,
                    proof_payload=proof_payload,
                )

                if target in {WorkflowStage.APPROVED, WorkflowStage.REJECTED}:
                    for child in Submission.objects.filter(
                        parent_submission=submission, is_attachment=True
                    ):
                        child_prev = child.current_stage
                        child.current_stage = target
                        child.save(update_fields=["current_stage", "updated_at"])
                        WorkflowEvent.objects.create(
                            submission=child,
                            actor=actor,
                            previous_stage=child_prev,
                            new_stage=target,
                            remarks=f"Auto-cascaded from parent {submission.reference_number} ({basis_text(minutes)}).",
                        )
            advanced += 1
        except Exception:
            logger.exception(
                "STAGE_ADVANCE_FAIL | minutes=%s submission=%s",
                minutes.id, getattr(submission, "id", None),
            )

    logger.info("DECISION_STAGE_ADVANCE | minutes=%s | advanced=%d", minutes.id, advanced)
    return {"advanced": advanced}


# ── Allocation review: rule + AI suggestions, one-click bulk allocation ──────

def manager_candidates() -> list[dict]:
    """Active users who can own a Commission task, with their open-task load."""
    from .opsc_access import COMMISSION_TASK_MANAGER_ROLES

    qs = (
        User.objects.filter(is_active=True, psc_profile__role__in=COMMISSION_TASK_MANAGER_ROLES)
        .select_related("psc_profile")
        .annotate(
            open_tasks=Count(
                "managed_commission_tasks",
                filter=Q(managed_commission_tasks__status__in=_OPEN_STATUSES),
            )
        )
        .order_by("username")
    )
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.get_full_name() or u.username,
            "role": u.psc_profile.role,
            "open_tasks": u.open_tasks,
        }
        for u in qs
    ]


def _rule_suggestion(item: dict, managers_by_id: dict[int, dict]) -> dict | None:
    # 1. The Action Officer the Commission named in the minutes.
    unit, named = named_unit_manager(item.get("officer_units") or [])
    if named is not None and named.id in managers_by_id:
        m = managers_by_id[named.id]
        also = [u.upper() for u in item["officer_units"] if u != unit]
        return {
            "manager_id": m["id"],
            "manager_username": m["username"],
            "manager_name": m["name"],
            "action_unit": ROUTED_UNIT_TO_ACTION_UNIT.get(unit) or item.get("action_unit") or "",
            "due_days": 30,
            "confidence": 98,
            "source": "minutes",
            "reason": (
                f'The minutes name "{item["officer_text"]}" as Action Officer, so {m["name"]} '
                f"({unit.upper()}) acts."
                + (f" Also named: {', '.join(also)}." if also else "")
            ),
        }
    # 2. The unit the submission was routed to.
    manager = unit_manager_for(item.get("routed_unit") or "")
    if manager is None or manager.id not in managers_by_id:
        return None
    m = managers_by_id[manager.id]
    return {
        "manager_id": m["id"],
        "manager_username": m["username"],
        "manager_name": m["name"],
        "action_unit": item.get("action_unit") or "",
        "due_days": 30,
        "confidence": 95,
        "source": "rule",
        "reason": f"Submission is routed to the {item['routed_unit'].upper()} unit; {m['name']} is its manager.",
    }


def build_allocation_suggestions(*, use_ai: bool) -> dict:
    """Pending decisions with a suggested manager each.

    Rules (routed unit → unit manager) always run. With ``use_ai`` the
    decisions the rules could not place go to the AI allocator in one call.
    """
    from .ai.reliability import FEATURE_TASK_ALLOCATION, log_ai_call, timed_call
    from .ai.task_allocation import suggest_allocations
    from .models import AIGenerationLog, Submission

    managers = manager_candidates()
    managers_by_id = {m["id"]: m for m in managers}
    items = pending_decision_allocations()

    for it in items:
        # A held decision is shown but never suggested or allocated.
        it["suggestion"] = None if it["held"] else _rule_suggestion(it, managers_by_id)

    ai_error = None
    unresolved = [it for it in items if it["suggestion"] is None and not it["held"]]
    if use_ai and unresolved:
        subs = {
            s.id: s
            for s in Submission.objects.filter(
                id__in=[it["submission"] for it in unresolved if it["submission"]]
            ).select_related("ministry")
        }
        payload = []
        for it in unresolved:
            sub = subs.get(it["submission"])
            payload.append({
                "title": it["item_title"],
                "decision": it["decision_detail"],
                "action_officer": it["officer_text"],
                "outcome": it["decision_outcome"],
                "form_type": sub.form_type_code if sub else "",
                "ministry": sub.ministry.name if sub and sub.ministry_id else "",
            })
        with timed_call() as elapsed:
            result, ai_error = suggest_allocations(payload, managers)
        log_ai_call(
            feature=FEATURE_TASK_ALLOCATION,
            status=AIGenerationLog.Status.FAILED if ai_error else AIGenerationLog.Status.SUCCESS,
            error_detail=ai_error or "",
            latency_ms=elapsed(),
        )
        for idx, sug in (result or {}).items():
            m = managers_by_id[sug["manager_id"]]
            unresolved[idx]["suggestion"] = {
                **sug,
                "manager_username": m["username"],
                "manager_name": m["name"],
                "source": "ai",
            }

    return {
        "items": items,
        "managers": managers,
        "ai_error": ai_error,
        "ai_ran": bool(use_ai and unresolved),
    }


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def allocate_pending_items(allocations: list[dict], actor) -> dict:
    """Create tasks for pending decisions from the Secretariat's accepted
    suggestions. Decision text, meeting and submission always come from the
    signed minutes (never from the request), so a client cannot alter them."""
    from datetime import date, timedelta

    from .email_notify import notify_task_assigned, task_assignees

    managers_by_id = {m["id"]: m for m in manager_candidates()}
    pending = {it["agenda_item"]: it for it in pending_decision_allocations()}
    created, skipped = [], []

    # Number decisions in minutes order, whatever order the client sent them.
    order = {agenda_id: i for i, agenda_id in enumerate(pending)}
    allocations = sorted(allocations, key=lambda r: order.get(_as_int(r.get("agenda_item")), len(order)))

    for row in allocations:
        try:
            agenda_item_id = int(row.get("agenda_item"))
            manager_id = int(row.get("assigned_manager"))
        except (TypeError, ValueError):
            skipped.append({"agenda_item": row.get("agenda_item"), "reason": "Invalid request row."})
            continue
        item = pending.get(agenda_item_id)
        if item is None:
            skipped.append({"agenda_item": agenda_item_id, "reason": "Already allocated, or not in minutes that can be actioned."})
            continue
        if item["held"]:
            skipped.append({"agenda_item": agenda_item_id, "reason": "On hold — release it first."})
            continue
        if manager_id not in managers_by_id:
            skipped.append({"agenda_item": agenda_item_id, "reason": "Not an eligible manager."})
            continue

        action_unit = str(row.get("action_unit") or item.get("action_unit") or "")
        if action_unit not in {c.value for c in CommissionActionUnit}:
            action_unit = ""
        try:
            due = date.fromisoformat(str(row["due_date"])) if row.get("due_date") else None
        except ValueError:
            due = None
        if due is None:
            try:
                due = date.today() + timedelta(days=max(1, min(365, int(row.get("due_days") or 30))))
            except (TypeError, ValueError):
                due = date.today() + timedelta(days=30)

        with transaction.atomic():
            meeting = Meeting.objects.filter(pk=item["meeting"]).first()
            task = CommissionTask.objects.create(
                decision_number=item["decision_number"] or next_decision_number(meeting),
                title=item["suggested_task_title"],
                description=item["description"][:1900] + also_involved_note(
                    item["officer_text"], item["officer_units"],
                    MANAGER_ROLE_TO_ROUTED_UNIT.get(managers_by_id[manager_id]["role"], ""),
                ),
                decision_detail=item["decision_detail"],
                decision_outcome=item["decision_outcome"],
                action_unit=action_unit,
                meeting_id=item["meeting"],
                meeting_reference=item["meeting_reference"],
                meeting_date=date.fromisoformat(item["meeting_date"]) if item["meeting_date"] else None,
                minute_reference=item["minute_reference"],
                submission_id=item["submission"],
                agenda_item_id=agenda_item_id,
                assigned_manager_id=manager_id,
                due_date=due,
                created_by=actor,
            )
            if task.submission_id:
                advance_to_decision_entered_assigned(
                    task.submission, actor,
                    remarks="Decision allocated to unit manager by the Secretariat (allocation review).",
                )
        notify_task_assigned(task, task_assignees(task))
        created.append(task.id)

    return {"created": created, "skipped": skipped}
