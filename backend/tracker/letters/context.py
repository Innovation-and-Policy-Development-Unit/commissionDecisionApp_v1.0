"""
Per-form-type context builders for decision letters.

Each function resolves the placeholder values a letter template needs from
the submission's dynamic form data — including the same fallback chains and
bracketed defaults ("[Officer Name]") the original hardcoded letters used —
so LetterTemplate.body_text_template can reference them as {{officer_name}},
{{position_title}}, etc. Common keys (today, reference_number, ministry,
department) are added by build_letter_context() for every letter type.
"""
from __future__ import annotations
from .utils import today_str, _form_data, _ministry_name


def _common(submission) -> dict:
    data = _form_data(submission)
    return {
        "today": today_str(),
        "reference_number": submission.reference_number or "",
        "ministry": _ministry_name(submission) or data.get("ministry", "[Ministry]"),
        "department": data.get("department", "[Department]"),
    }


def _cessation_common(submission) -> dict:
    # Cessation letters historically used the raw ministry name (no bracket
    # fallback) and dept from form data only — kept distinct from _common()
    # to preserve exact prior behaviour.
    data = _form_data(submission)
    return {
        "today": today_str(),
        "reference_number": submission.reference_number or "",
        "ministry": _ministry_name(submission),
        "department": data.get("department", ""),
    }


def offer_of_employment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "candidate_name": data.get("recommended_name") or data.get("candidate_name") or data.get("officer_name", "[Candidate Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "salary": data.get("annual_salary") or data.get("salary_level") or data.get("salary_grade", "[Salary]"),
        "effective_date": data.get("effective_date", "[Effective Date]"),
        "probation_period": data.get("probation_period", "3 months"),
    })
    return ctx


def confirmation_of_appointment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "effective_date": data.get("effective_date", "[Effective Date]"),
    })
    return ctx


def direct_appointment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    post_number = data.get("post_number", "")
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "post_number": post_number,
        "post_number_suffix": f" (Post No. {post_number})" if post_number else "",
        "salary": data.get("annual_salary") or data.get("salary_grade", "[Salary]"),
    })
    return ctx


def temporary_appointment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "candidate_name": data.get("candidate_name") or data.get("officer_name", "[Candidate Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "salary": data.get("salary_grade", "[Salary]"),
        "effective_date": data.get("effective_date", "[Effective Date]"),
        "end_date": data.get("end_date", "[End Date]"),
    })
    return ctx


def contract_employment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer/Candidate Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "salary": data.get("salary_level", "[Salary]"),
        "start_date": data.get("start_date", "[Start Date]"),
        "end_date": data.get("end_date", "[End Date]"),
        "contract_type": data.get("contract_type", "Contract"),
    })
    return ctx


def acting_appointment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    post_number = data.get("post_number", "")
    start_date = data.get("acting_start_date", "[Start Date]")
    end_date = data.get("acting_end_date", "")
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "post_number": post_number,
        "post_number_line": f"    Post No.:         {post_number}\n" if post_number else "",
        "salary_grade": data.get("salary_grade", "[Salary Grade]"),
        "period": f"{start_date} to {end_date}" if end_date else f"{start_date} until further decision by the Commission",
    })
    return ctx


def eligible_candidate_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    position = data.get("position_title", "[Position Title]")
    post_number = data.get("post_number", "")
    ctx.update({
        "applicant_name": data.get("applicant_name", "[Applicant Name]"),
        "position_title": position,
        "post_number": post_number,
        "post_ref": f"{position} - Post No. {post_number}" if post_number else position,
        "eligibility_expiry": data.get("eligibility_expiry", "[Expiry Date]"),
    })
    return ctx


def unsuccessful_candidate_context(submission) -> dict:
    ctx = _common(submission)
    data = _form_data(submission)
    ctx.update({
        "position_title": data.get("position_title", "[Position Title]"),
    })
    return ctx


def age_retirement_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "department": data.get("department", "[Department]"),
        "retirement_date": data.get("retirement_date", "[Retirement Date]"),
    })
    return ctx


def notice_age_retirement_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officers_list": data.get("officers_list", "[Officers and notice periods to be inserted]"),
    })
    return ctx


def medical_retirement_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "last_day_of_service": data.get("last_day_of_service", "[Last Day of Service]"),
    })
    return ctx


def death_in_service_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "next_of_kin": data.get("next_of_kin", "[Next of Kin / Beneficiary]"),
        "years_of_service": data.get("years_of_service", "[Years of Service]"),
    })
    return ctx


def redundancy_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officers_list": data.get("officers_list", "[Officers to be inserted]"),
        "ministry_responsible": data.get("redundancy_package_responsibility", "[Ministry]"),
    })
    return ctx


def voluntary_resignation_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _cessation_common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "department": data.get("department", "[Department]"),
        "resignation_date": data.get("resignation_date", "[Date]"),
        "years_of_service": data.get("years_of_service", "[Years]"),
    })
    return ctx


def secondment_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "position_title": data.get("position_title", "[Position Title]"),
        "receiving_organisation": data.get("receiving_organisation", "[Receiving Organisation]"),
        "date_from": data.get("secondment_from", "[Start Date]"),
        "date_to": data.get("secondment_to", "[End Date]"),
        "salary_responsibility": data.get("salary_responsibility", "Receiving Organisation"),
    })
    return ctx


def leave_payout_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "vnpf_number": data.get("vnpf_number", "[VNPF Number]"),
        "outstanding_leave_days": data.get("outstanding_leave_days", "[Leave Days]"),
        "amount": data.get("payout_amount_vt", "[Amount]"),
        "director_name": data.get("director_name", "Director, Department of Finance"),
    })
    return ctx


def medical_claim_context(submission) -> dict:
    data = _form_data(submission)
    ctx = _common(submission)
    address = data.get("address", "")
    ctx.update({
        "officer_name": data.get("officer_name", "[Officer Name]"),
        "address": address,
        "address_line": f"    {address}\n" if address else "",
        "amount": data.get("claim_amount_vt") or data.get("claim_amount", "[Amount]"),
    })
    return ctx


CONTEXT_BUILDERS = {
    "CESSATION-AGE": age_retirement_context,
    "CESSATION-NOTICE-AGE": notice_age_retirement_context,
    "CESSATION-MEDICAL": medical_retirement_context,
    "CESSATION-DEATH": death_in_service_context,
    "CESSATION-REDUNDANCY": redundancy_context,
    "CESSATION-RESIGNATION": voluntary_resignation_context,
    "RECRUIT-PROBATION": offer_of_employment_context,
    "RECRUIT-CONFIRM": confirmation_of_appointment_context,
    "RECRUIT-DIRECT": direct_appointment_context,
    "RECRUIT-TEMPORARY": temporary_appointment_context,
    "RECRUIT-CONTRACT": contract_employment_context,
    "RECRUIT-ACTING": acting_appointment_context,
    "RECRUIT-ELIGIBLE": eligible_candidate_context,
    "RECRUIT-UNSUCCESSFUL": unsuccessful_candidate_context,
    "SECONDMENT": secondment_context,
    "LEAVE-PAYOUT": leave_payout_context,
    "MEDICAL-CLAIM": medical_claim_context,
}


def build_letter_context(form_type_code: str, submission) -> dict:
    code = (form_type_code or "").upper()
    builder = CONTEXT_BUILDERS.get(code)
    if builder is None:
        raise ValueError(
            f"No letter context builder registered for form type code '{code}'. "
            f"Supported codes: {', '.join(sorted(CONTEXT_BUILDERS.keys()))}"
        )
    return builder(submission)
