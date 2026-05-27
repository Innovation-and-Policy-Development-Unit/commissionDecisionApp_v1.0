"""When the ODU Restructure Submission Checklist applies."""

from __future__ import annotations

from .models import Submission

# Organisation restructure / establishment variation (includes regrading via PSC 2-1)
ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = frozenset({"ORG-3.1", "PSC 2-1"})


def submission_uses_odu_restructure_checklist(submission: Submission) -> bool:
    return (submission.form_type_code or "") in ODU_RESTRUCTURE_CHECKLIST_FORM_CODES
