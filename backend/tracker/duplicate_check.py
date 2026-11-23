"""Possible repeat submissions, for the Secretary and the unit Manager.

A ministry paper can legitimately repeat an earlier one (an acting or extra-responsibility
allowance for a different period, for instance), so this only ever *flags*: it never blocks
or delays a paper. Two steps:

1. Rules build a short list of earlier papers from the same ministry and form type that are
   about the same officer (same email, or the same name in the form answers). The AI never
   searches the database, it only sees this list.
2. The AI reads each pair and says whether it looks like the same claim sent twice or a
   genuinely separate matter (see ``ai/A4_duplicate_detector.py``).

If the AI is off or fails, the short list is still shown, so the flag never depends on it.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import timedelta

from django.utils import timezone

MAX_CASES = 6
LOOKBACK_DAYS_WITH_OFFICER = 730
LOOKBACK_DAYS_NO_OFFICER = 365
MAX_CASES_NO_OFFICER = 5

# Verdicts the AI may give per earlier paper.
SAME_CLAIM = "same_claim"
DIFFERENT_PERIOD = "different_period"
DIFFERENT_MATTER = "different_matter"
UNCLEAR = "unclear"
VERDICTS = (SAME_CLAIM, DIFFERENT_PERIOD, DIFFERENT_MATTER, UNCLEAR)

_PERSON_HINTS = (
    "officer", "employee", "candidate", "recommended", "nominee", "applicant",
    "staff", "person", "incumbent", "appointee", "traveller", "traveler",
)
_NOT_A_PERSON = (
    "department", "ministry", "position", "title", "unit", "school", "supervisor", "head",
    "director", "agency", "organi", "approving", "recommending", "witness", "signed",
)
_EXPLICIT_KEYS = {"officer_name", "candidate_name", "recommended_name", "employee_name", "full_name"}
_TITLES = {"mr", "mrs", "ms", "miss", "dr", "hon", "rev", "sir", "pastor", "chief", "mx"}


def _name_tokens(value) -> frozenset:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    tokens = [t for t in re.split(r"[^a-z]+", text.lower()) if t and t not in _TITLES and len(t) > 1]
    return frozenset(tokens)


def officer_names(submission) -> list[frozenset]:
    """Name token-sets for the person(s) this paper concerns, found in its form answers."""
    try:
        data = submission.dynamic_form_response.data or {}
    except Exception:
        data = {}
    found = []
    for key, value in data.items():
        k = str(key).lower()
        if not isinstance(value, str) or not (3 <= len(value.strip()) <= 120):
            continue
        is_person_key = k in _EXPLICIT_KEYS or (
            "name" in k
            and any(h in k for h in _PERSON_HINTS)
            and not any(n in k for n in _NOT_A_PERSON)
        )
        if not is_person_key:
            continue
        tokens = _name_tokens(value)
        if tokens and tokens not in found:
            found.append(tokens)
    return found


def _names_match(a: frozenset, b: frozenset) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    small, big = (a, b) if len(a) <= len(b) else (b, a)
    return len(small) >= 2 and small <= big


def shortlist(submission) -> list[dict]:
    """Earlier papers worth comparing: [{"submission": Submission, "matched_on": [str, ...]}]."""
    from .models import Submission, WorkflowStage

    if not submission.ministry_id or not submission.form_type_code:
        return []

    names = officer_names(submission)
    email = (submission.applicant_email or "").strip().lower()
    has_person = bool(names or email)
    days = LOOKBACK_DAYS_WITH_OFFICER if has_person else LOOKBACK_DAYS_NO_OFFICER
    candidates = (
        Submission.objects.filter(
            ministry_id=submission.ministry_id,
            form_type_code=submission.form_type_code,
            is_attachment=False,
            created_at__gte=timezone.now() - timedelta(days=days),
        )
        .exclude(pk=submission.pk)
        .exclude(current_stage__in=[WorkflowStage.DRAFT, WorkflowStage.RECALLED])
        .select_related("dynamic_form_response")
        .order_by("-created_at")[:200]
    )

    out = []
    for cand in candidates:
        matched = []
        if email and (cand.applicant_email or "").strip().lower() == email:
            matched.append("same officer email")
        if names:
            cand_names = officer_names(cand)
            if any(_names_match(n, c) for n in names for c in cand_names):
                matched.append("same officer name")
        if has_person:
            if not matched:
                continue
        else:
            matched = ["same form type, no officer named"]
        out.append({"submission": cand, "matched_on": matched})
        if len(out) >= (MAX_CASES if has_person else MAX_CASES_NO_OFFICER):
            break
    return out


def flag_level(submission) -> str:
    """How loudly to show the flag: "warn", "info" or "none".

    warn: possibly the same claim twice, or the AI could not tell / was unavailable.
    info: earlier papers exist but the AI judged them separate periods.
    """
    cases = submission.ai_duplicate_similar_cases or []
    if not submission.ai_duplicate_processed or not cases:
        return "none"
    verdicts = {c.get("verdict") or UNCLEAR for c in cases}
    if verdicts & {SAME_CLAIM, UNCLEAR}:
        return "warn"
    if DIFFERENT_PERIOD in verdicts:
        return "info"
    return "none"
