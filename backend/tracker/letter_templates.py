"""Render decision letters from database-editable LetterTemplate rows."""

from __future__ import annotations

import logging
from typing import Any

from .email_templates import render_template_string
from .letters.utils import wrap_html

logger = logging.getLogger(__name__)


def render_letter_template_record(tpl, context: dict[str, Any]) -> dict:
    """Render subject/body_text/body_html from a LetterTemplate instance."""
    subject = render_template_string(tpl.subject_template, context)
    body_text = render_template_string(tpl.body_text_template, context)
    return {
        "subject": subject,
        "body_text": body_text,
        "body_html": wrap_html(body_text),
    }


def render_letter_template(form_type_code: str, context: dict[str, Any]) -> dict:
    """
    Load an active LetterTemplate for `form_type_code` and render it.
    Raises LetterTemplate.DoesNotExist if missing/inactive.
    """
    from .models import LetterTemplate

    tpl = LetterTemplate.objects.get(form_type_code=form_type_code.upper(), is_active=True)
    return render_letter_template_record(tpl, context)


def reset_letter_template_to_default(form_type_code: str) -> bool:
    """Restore a system letter template's content from built-in defaults."""
    from .letter_template_defaults import DEFAULT_LETTER_TEMPLATES
    from .models import LetterTemplate

    code = form_type_code.upper()
    data = next((d for d in DEFAULT_LETTER_TEMPLATES if d["form_type_code"] == code), None)
    if not data:
        return False
    updated = LetterTemplate.objects.filter(form_type_code=code).update(
        name=data["name"],
        category=data["category"],
        description=data["description"],
        placeholders=data["placeholders"],
        subject_template=data["subject_template"],
        body_text_template=data["body_text_template"],
        is_active=True,
    )
    return updated > 0


def seed_default_letter_templates() -> int:
    """Upsert built-in letter templates; returns count created."""
    from .letter_template_defaults import DEFAULT_LETTER_TEMPLATES
    from .models import LetterTemplate

    count = 0
    for data in DEFAULT_LETTER_TEMPLATES:
        _, created = LetterTemplate.objects.update_or_create(
            form_type_code=data["form_type_code"],
            defaults={
                "name": data["name"],
                "category": data["category"],
                "description": data["description"],
                "placeholders": data["placeholders"],
                "subject_template": data["subject_template"],
                "body_text_template": data["body_text_template"],
                "is_active": True,
                "is_system": True,
            },
        )
        if created:
            count += 1
    return count


# ── Sample context for admin preview (no real submission needed) ───────────

SAMPLE_LETTER_CONTEXT_OVERRIDES = {
    "RECRUIT-PROBATION": {"candidate_name": "John Smith", "position_title": "Senior Officer", "salary": "2,400,000 VT"},
    "RECRUIT-CONFIRM": {"officer_name": "John Smith", "position_title": "Senior Officer"},
    "RECRUIT-DIRECT": {"officer_name": "John Smith", "position_title": "Senior Officer", "post_number": "MPM-014", "post_number_suffix": " (Post No. MPM-014)"},
    "RECRUIT-TEMPORARY": {"candidate_name": "John Smith", "position_title": "Senior Officer"},
    "RECRUIT-CONTRACT": {"officer_name": "John Smith", "position_title": "Senior Officer", "contract_type": "Fixed-Term"},
    "CESSATION-AGE": {"officer_name": "John Smith", "position_title": "Senior Officer"},
    "CESSATION-NOTICE-AGE": {},
    "CESSATION-MEDICAL": {"officer_name": "John Smith", "position_title": "Senior Officer"},
    "CESSATION-DEATH": {"officer_name": "John Smith", "position_title": "Senior Officer", "next_of_kin": "Jane Smith (spouse)"},
    "CESSATION-REDUNDANCY": {"ministry_responsible": "Ministry of Finance and Economic Management"},
    "CESSATION-RESIGNATION": {"officer_name": "John Smith", "position_title": "Senior Officer"},
    "SECONDMENT": {"officer_name": "John Smith", "position_title": "Senior Officer", "receiving_organisation": "Pacific Community (SPC)"},
    "LEAVE-PAYOUT": {"officer_name": "John Smith"},
    "MEDICAL-CLAIM": {"officer_name": "John Smith", "address_line": ""},
}

_COMMON_SAMPLE = {
    "today": "05 August 2026",
    "reference_number": "PSC-2026-0042",
    "ministry": "Ministry of the Prime Minister",
    "department": "Corporate Services Unit",
    "effective_date": "01 August 2026",
    "retirement_date": "31 December 2026",
    "resignation_date": "31 August 2026",
    "last_day_of_service": "31 August 2026",
    "years_of_service": "12 years",
    "salary": "2,400,000 VT",
    "salary_grade": "Grade 14",
    "start_date": "01 July 2026",
    "end_date": "30 June 2027",
    "date_from": "01 July 2026",
    "date_to": "30 June 2027",
    "acting_start_date": "01 July 2026",
    "probation_period": "3 months",
    "post_number": "",
    "post_number_suffix": "",
    "post_number_line": "",
    "eligibility_expiry": "31 December 2026",
    "officers_list": "1. John Smith, Senior Officer — 60th birthday 01 September 2026",
    "salary_responsibility": "Receiving Organisation",
    "vnpf_number": "VN123456",
    "outstanding_leave_days": "18",
    "amount": "45,000",
    "director_name": "Director, Department of Finance",
    "address": "",
    "address_line": "",
}


def sample_context_for_form_type(form_type_code: str) -> dict:
    ctx = {**_COMMON_SAMPLE, **SAMPLE_LETTER_CONTEXT_OVERRIDES.get(form_type_code.upper(), {})}
    return ctx
