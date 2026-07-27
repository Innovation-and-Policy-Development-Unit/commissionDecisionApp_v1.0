"""Routes a submission to the correct letter builder based on form_type_code."""
from __future__ import annotations

from .cessation import (
    age_retirement_letter,
    notice_age_retirement_letter,
    medical_retirement_letter,
    death_in_service_letter,
    redundancy_letter,
    voluntary_resignation_letter,
)
from .recruitment import (
    offer_of_employment_letter,
    confirmation_of_appointment_letter,
    direct_appointment_letter,
    temporary_appointment_letter,
    contract_employment_letter,
    acting_appointment_letter,
    eligible_candidate_letter,
    unsuccessful_candidate_letter,
)
from .secondment import secondment_letter
from .leave_payout import leave_payout_letter
from .allowances import medical_claim_letter

_DISPATCH = {
    # Cessation
    "CESSATION-AGE": age_retirement_letter,
    "CESSATION-NOTICE-AGE": notice_age_retirement_letter,
    "CESSATION-MEDICAL": medical_retirement_letter,
    "CESSATION-DEATH": death_in_service_letter,
    "CESSATION-REDUNDANCY": redundancy_letter,
    "CESSATION-RESIGNATION": voluntary_resignation_letter,
    # Recruitment submission papers
    "RECRUIT-PROBATION": offer_of_employment_letter,
    "RECRUIT-CONFIRM": confirmation_of_appointment_letter,
    "RECRUIT-DIRECT": direct_appointment_letter,
    "RECRUIT-TEMPORARY": temporary_appointment_letter,
    "RECRUIT-CONTRACT": contract_employment_letter,
    "RECRUIT-ACTING": acting_appointment_letter,
    "RECRUIT-ELIGIBLE": eligible_candidate_letter,
    "RECRUIT-UNSUCCESSFUL": unsuccessful_candidate_letter,
    # Secondment
    "SECONDMENT": secondment_letter,
    # Leave payout
    "LEAVE-PAYOUT": leave_payout_letter,
    # Allowances & claims
    "MEDICAL-CLAIM": medical_claim_letter,
}


def generate_letter(submission) -> dict:
    """
    Returns {'subject': str, 'body_text': str, 'body_html': str} or raises ValueError
    if the submission's form type does not have a letter builder.
    """
    code = (submission.form_type_code or "").upper()
    builder = _DISPATCH.get(code)
    if builder is None:
        raise ValueError(
            f"No letter builder registered for form type code '{code}'. "
            f"Supported codes: {', '.join(sorted(_DISPATCH.keys()))}"
        )
    return builder(submission)
