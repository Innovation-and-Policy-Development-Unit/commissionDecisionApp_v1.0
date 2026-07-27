"""Outcome letter for Allowances & Claims submissions.
Covers: Medical Claim.
"""
from __future__ import annotations
from .utils import today_str, signature_block, wrap_html, _form_data, _ministry_name


def medical_claim_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    address = data.get("address", "")
    amount = data.get("claim_amount_vt") or data.get("claim_amount", "[Amount]")
    ref = submission.reference_number or ""

    subject = f"Medical Expense Claim — {officer}"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\n"
        f"Date: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {officer}\n"
        + (f"    {address}\n" if address else "")
        + "\n"
        f"RE: {subject}\n\n"
        f"Dear {officer},\n\n"
        f"This is to inform you that approval is hereby granted to your medical "
        f"expenses claim for Vt. {amount}.\n\n"
        f"The Department of Finance is hereby authorised to make payments."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }
