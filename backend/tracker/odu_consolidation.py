"""ODU's consolidated papers: one paper to the Commission per type of ministry submission.

Ministries lodge their Business Plan, Corporate Plan or Annual Report with ODU. For Business and
Corporate Plans ODU only acknowledges receipt; an Annual Report is reviewed first. The Manager NOTES it, which ends that ministry submission at ODU. ODU then writes ONE
paper (``ODU-BUSINESS-PLANS``, ``ODU-CORPORATE-PLANS`` or ``ODU-ANNUAL-REPORTS``) covering all
the ones it has noted. The Commission notes that paper and may decide on particular ministries.

Rules, as ODU set them out:

* ODU waits until the receipt due date for that type of plan has passed (Business and Corporate
  Plans each have their own), and until every lodged plan has had its receipt acknowledged.
* Every lodged plan is covered. A paper cannot go up while a lodged plan of its type is still
  with ODU or with the ministry for clarification.
* No supplementary paper. A plan that arrives after the paper has gone up waits for the next
  one, and the Commission decides what to do about its lateness.

Coverage needs no picking: when the paper leaves Draft, every noted plan of its type that no
earlier paper covers is attached to it.
"""

from __future__ import annotations

import os
from datetime import date

from django.db.models import Q
from django.utils import timezone

from .models import ReportAIReview, Submission, WorkflowStage
from .odu_checklist_rules import ODU_CONSOLIDATED_COVERS

LABELS = {
    "BUSINESS-PLAN": ("Business Plan", "Business Plans"),
    "CORPORATE-PLAN": ("Corporate Plan", "Corporate Plans"),
    "ANNUAL-REPORT": ("Annual Report", "Annual Reports"),
}

# Lodged with PSC and not yet noted: still in ODU's hands, or back with the ministry for
# clarification. Drafts and recalled papers have not been lodged, so they do not hold a paper up.
WAITING_STAGES = frozenset({
    WorkflowStage.SUBMITTED,
    WorkflowStage.RECEIVED_BY_PSC,
    WorkflowStage.REGISTERED_ROUTED,
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.PENDING_SECRETARY_APPROVAL,
})


# Receipt due dates, one per type of plan: ODU may send its paper to the Commission once the due
# date has passed. "MM-DD" each year; override with the env vars below. A type with no date set has
# no date gate (the Corporate Plan's date has not been fixed yet).
_DEFAULT_RECEIPT_DUE = {"BUSINESS-PLAN": "02-28", "CORPORATE-PLAN": ""}


def receipt_due_date(plan_type: str, year: int) -> date | None:
    raw = os.environ.get(f"ODU_RECEIPT_DUE_{plan_type.replace('-', '_')}", _DEFAULT_RECEIPT_DUE.get(plan_type, ""))
    try:
        month, day = (int(x) for x in raw.strip().split("-"))
        return date(year, month, day)
    except (ValueError, AttributeError):
        return None


def _due_gap(paper, plural: str) -> tuple[date | None, str | None]:
    """(due date, reason the paper cannot go up yet because the due date has not passed)."""
    covers = covered_form_type(paper)
    year = timezone.localtime(paper.received_at or paper.created_at).year
    due = receipt_due_date(covers, year)
    if due and timezone.localdate() <= due:
        return due, (
            f"the receipt due date for {plural.lower()} is {due.day} {due.strftime('%B %Y')}: "
            "this paper can go up after that date."
        )
    return due, None


def covered_form_type(paper) -> str | None:
    return ODU_CONSOLIDATED_COVERS.get(paper.form_type_code or "")


def _base(paper):
    # Test papers neither hold up nor join a real paper.
    return Submission.objects.filter(
        form_type_code=covered_form_type(paper), is_attachment=False, is_test=False,
    ).select_related("ministry", "department")


def covered(paper):
    """Ministry submissions this paper already covers."""
    return _base(paper).filter(consolidated_into=paper)


def ready_to_cover(paper):
    """Noted plans no paper covers yet: they will be covered when this paper goes up."""
    return _base(paper).filter(
        current_stage=WorkflowStage.NOTED, consolidated_into__isnull=True,
    )


def waiting(paper):
    """Lodged plans ODU has not noted yet, and that no paper covers."""
    return _base(paper).filter(current_stage__in=WAITING_STAGES, consolidated_into__isnull=True)


def consolidation_gaps(paper) -> list[str]:
    """Plain-English reasons the paper cannot go up yet; empty when it can."""
    covers = covered_form_type(paper)
    if not covers:
        return []
    singular, plural = LABELS[covers]
    gaps: list[str] = []
    _, due_gap = _due_gap(paper, plural)
    if due_gap:
        gaps.append(due_gap)
    still = list(waiting(paper).order_by("ministry__name")[:6])
    if still:
        names = ", ".join(f"{s.ministry.name if s.ministry_id else s.reference_number}" for s in still)
        more = waiting(paper).count() - len(still)
        gaps.append(
            f"{waiting(paper).count()} lodged {plural.lower()} ha{'s' if waiting(paper).count() == 1 else 've'} not "
            f"had receipt acknowledged by ODU yet ({names}{f' and {more} more' if more > 0 else ''}): "
            "every lodged one has to be covered."
        )
    if not still and not covered(paper).exists() and not ready_to_cover(paper).exists():
        gaps.append(f"there are no noted {plural.lower()} for this paper to cover.")
    return gaps


def cover_all(paper) -> int:
    """Attach every noted, uncovered plan of this paper's type to it. Returns how many."""
    return ready_to_cover(paper).update(consolidated_into=paper)


def _review_summary(sub) -> dict:
    review = ReportAIReview.objects.filter(submission=sub, state="done").first()
    if not review:
        return {}
    r = review.result or {}
    out = {
        "recommendation": r.get("recommendation"),
        "met": (r.get("counts") or {}).get("met"),
        "total": r.get("total"),
    }
    period = r.get("plan_period")
    if isinstance(period, dict):
        out["plan_period"] = period
    return out


def _row(sub, state: str) -> dict:
    from .ai.annual_report_review import late_info

    late = late_info(sub)
    return {
        "id": sub.id,
        "reference_number": sub.reference_number,
        "ministry": sub.ministry.name if sub.ministry_id else "",
        "title": sub.title,
        "stage": sub.current_stage,
        "stage_label": sub.get_current_stage_display(),
        "received_at": sub.received_at,
        "late": late["late"],
        "days_late": late["days_late"],
        "deadline_text": late["deadline_text"],
        "state": state,
        "ai_review": _review_summary(sub),
    }


def coverage_payload(paper) -> dict:
    """What the ODU screen shows: what the paper covers, will cover, is waiting on, and who has not lodged."""
    from .models import Ministry

    covers = covered_form_type(paper)
    if not covers:
        return {}
    singular, plural = LABELS[covers]
    rows_covered = [_row(s, "covered") for s in covered(paper).order_by("ministry__name")]
    rows_ready = [_row(s, "will_cover") for s in ready_to_cover(paper).order_by("ministry__name")]
    rows_waiting = [_row(s, "waiting") for s in waiting(paper).order_by("ministry__name")]

    # Informational, for the two yearly papers: ministries with nothing lodged this year. (A
    # Corporate Plan covers five years, so a yearly "not lodged" list would mislead.)
    not_lodged: list[str] = []
    if covers in ("BUSINESS-PLAN", "ANNUAL-REPORT"):
        year = (paper.received_at or paper.created_at).year
        have = set(
            Submission.objects.filter(
                form_type_code=covers, is_test=False, received_at__year=year,
            ).exclude(current_stage__in=[WorkflowStage.DRAFT, WorkflowStage.RECALLED])
            .values_list("ministry_id", flat=True)
        )
        not_lodged = list(
            # OPSC's own ministry (the one that holds the OPSC department) never lodges with ODU.
            Ministry.objects.exclude(id__in=have).exclude(departments__code="OPSC")
            .order_by("name").values_list("name", flat=True)
        )
    gaps = consolidation_gaps(paper)
    return {
        "plan_type": covers,
        "plan_label": singular,
        "plan_label_plural": plural,
        "receipt_due_date": (_due_gap(paper, plural)[0].isoformat() if _due_gap(paper, plural)[0] else None),
        "receipt_due_passed": _due_gap(paper, plural)[1] is None,
        "rows": rows_covered + rows_ready + rows_waiting,
        "counts": {"covered": len(rows_covered), "will_cover": len(rows_ready), "waiting": len(rows_waiting)},
        "not_lodged": not_lodged,
        "gaps": gaps,
        "can_go_up": not gaps,
    }
