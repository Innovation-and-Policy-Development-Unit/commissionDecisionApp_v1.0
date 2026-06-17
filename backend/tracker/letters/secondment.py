"""Outcome letter for Secondment submissions."""
from __future__ import annotations
from .utils import letterhead, signature_block, wrap_html, _form_data, _ministry_name


def secondment_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    receiving_org = data.get("receiving_organisation", "[Receiving Organisation]")
    date_from = data.get("secondment_from", "[Start Date]")
    date_to = data.get("secondment_to", "[End Date]")
    salary_resp = data.get("salary_responsibility", "Receiving Organisation")
    ref = submission.reference_number or ""

    subject = f"Approval of Secondment — {officer} — {position}"
    head = letterhead(ref, ministry, dept)
    body = "\n\n".join([
        (
            f"The Public Service Commission has approved the secondment of {officer}, "
            f"{position}, {dept}, {ministry}, to {receiving_org}, pursuant to the "
            f"Public Service Staff Manual Chapter 4, Section 6.3."
        ),
        (
            f"Secondment Period: {date_from} to {date_to}\n"
            f"Receiving Organisation: {receiving_org}\n"
            f"Salary Responsibility: {salary_resp}"
        ),
        (
            f"{officer} will continue as a public servant during the secondment period "
            f"and is required to return to the Public Service at the end of the approved "
            f"period. Failure to return will be deemed a voluntary resignation from the "
            f"Public Service."
        ),
        (
            "All leave entitlements will continue to accrue during the secondment period "
            "at the normal rate, in accordance with PSSM Section 6.3. The Commission will "
            "ensure the vacated position is filled during the secondment period."
        ),
        "Please acknowledge receipt of this letter and arrange for the officer to be briefed on the terms of the secondment.",
    ])
    sig = signature_block()
    full_text = f"{head}RE: {subject}\n\n{body}{sig}"
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }
