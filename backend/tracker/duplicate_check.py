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
    "acting", "subject", "eligible", "claimant",
)
_NOT_A_PERSON = (
    "department", "ministry", "position", "title", "unit", "school", "supervisor", "head",
    "director", "agency", "organi", "approving", "recommending", "witness", "signed",
)
_EXPLICIT_KEYS = {
    "officer_name", "candidate_name", "recommended_name", "employee_name", "full_name",
    "subject_employee", "acting_officer",
}
# Words that mean a name from a letter is an organisation or a body, not the officer.
_ORG_WORDS = {
    "ministry", "department", "commission", "government", "office", "unit", "division",
    "republic", "vanuatu", "psc", "opsc", "board", "council", "committee", "authority",
    "services", "service", "corporation", "agency", "school", "hospital", "province",
}
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
        return len(a) >= 2   # a single shared word (a surname alone) is too loose
    small, big = (a, b) if len(a) <= len(b) else (b, a)
    return len(small) >= 2 and small <= big


def _signer_stoplist(submission) -> list[frozenset]:
    """Names that appear on every paper (the DG who signs, HR who lodges, the Secretary, the
    Chairperson) and so say nothing about which officer a letter is about."""
    from django.contrib.auth.models import User

    from .models import Role

    people = set()
    roles = [
        Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER, Role.CHAIRPERSON, Role.PSC_COMMISSIONER,
        Role.HEAD_OF_AGENCY, Role.MINISTRY_HR, Role.DEPT_ADMIN,
    ]
    for user in User.objects.filter(psc_profile__role__in=roles).only("first_name", "last_name"):
        people.add(_name_tokens(user.get_full_name()))
    if submission.created_by_id:
        people.add(_name_tokens(submission.created_by.get_full_name()))
    people.add(_name_tokens(submission.dg_approval_name))
    return [p for p in people if p]


def document_names(submission, stoplist) -> list[frozenset]:
    """Person names the OCR found in the paper's uploaded letters, minus the signers and any
    organisation. Only used when the form itself names no officer (e.g. a scanned paper)."""
    found = []
    for doc in submission.documents.all():
        facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
        for raw in facts.get("names") or []:
            if not isinstance(raw, str) or len(raw) > 80:
                continue
            tokens = _name_tokens(raw)
            if len(tokens) < 2 or tokens & _ORG_WORDS:
                continue
            if any(_names_match(tokens, sig) for sig in stoplist):
                continue
            if tokens not in found:
                found.append(tokens)
    return found


def shortlist(submission) -> list[dict]:
    """Earlier papers worth comparing: [{"submission": Submission, "matched_on": [str, ...]}]."""
    from .models import Submission, WorkflowStage

    if not submission.ministry_id or not submission.form_type_code:
        return []

    stoplist = None
    names = officer_names(submission)
    from_letter = False
    if not names:
        stoplist = _signer_stoplist(submission)
        names = document_names(submission, stoplist)
        from_letter = bool(names)
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
        .prefetch_related("documents")
        .order_by("-created_at")[:200]
    )

    out = []
    for cand in candidates:
        matched = []
        if email and (cand.applicant_email or "").strip().lower() == email:
            matched.append("same officer email")
        if names:
            cand_names = officer_names(cand)
            via_letter = from_letter
            if not cand_names:
                # An older paper with no digitized form (e.g. scanned): read its letters.
                stoplist = stoplist if stoplist is not None else _signer_stoplist(submission)
                cand_names = document_names(cand, stoplist)
                via_letter = True
            if any(_names_match(n, c) for n in names for c in cand_names):
                matched.append("same officer name" + (" (in the letter)" if via_letter else ""))
        if has_person:
            if not matched:
                continue
        else:
            matched = ["same form type, no officer named"]
        out.append({"submission": cand, "matched_on": matched})
        if len(out) >= (MAX_CASES if has_person else MAX_CASES_NO_OFFICER):
            break
    return out


# Letters that most often carry the officer, the period and the post.
_LETTER_TYPES = ("dg_endorsement", "correspondence", "appointment_letter", "other", "unclassified")
_LETTER_CHARS = 1500
_MAX_LETTERS = 3


def comparison_context(submission) -> str:
    """The paper as the AI should read it: the form, plus what its uploaded letters say.

    A signed cover letter often states the officer, post and period that the form leaves out
    (or that a scanned paper has no form for), so a short extract of the first few letters
    is appended to the usual summary.
    """
    from .tasks import _build_submission_context

    text = _build_submission_context(submission)
    docs = [d for d in submission.documents.all() if (d.extracted_text or "").strip()]
    docs.sort(key=lambda d: _LETTER_TYPES.index(d.document_type) if d.document_type in _LETTER_TYPES else 99)
    letters = []
    for doc in docs[:_MAX_LETTERS]:
        facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
        bits = []
        for key in ("names", "positions", "dates"):
            vals = [str(v) for v in (facts.get(key) or [])[:6]]
            if vals:
                bits.append(f"{key}: {'; '.join(vals)}")
        body = " ".join(doc.extracted_text.split())[:_LETTER_CHARS]
        letters.append(f"  - {doc.original_name}" + (f" ({' | '.join(bits)})" if bits else "") + f"\n    {body}")
    if letters:
        text += "\nLetters and documents (extract):\n" + "\n".join(letters)
    return text


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
