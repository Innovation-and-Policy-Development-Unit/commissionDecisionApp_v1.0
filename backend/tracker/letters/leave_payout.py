"""Authorization letter for Leave Payout submissions."""
from __future__ import annotations
from .utils import today_str, signature_block, wrap_html, _form_data, _ministry_name


def leave_payout_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    vnpf = data.get("vnpf_number", "[VNPF Number]")
    leave_days = data.get("outstanding_leave_days", "[Leave Days]")
    amount = data.get("payout_amount_vt", "[Amount]")
    director = data.get("director_name", "Director, Department of Finance")
    ref = submission.reference_number or ""

    subject = f"Outstanding Annual Leave Payout — {officer} — ID {vnpf}"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\n"
        f"Date: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {director}\n"
        f"    Department of Finance\n"
        f"    Port Vila\n\n"
        f"RE: {subject}\n\n"
        f"Dear {director},\n\n"
        f"This letter serves as authorisation for the payment of outstanding annual leave "
        f"for {officer} from the {dept}, {ministry}.\n\n"
        f"    Officer:                {officer}\n"
        f"    VNPF Number:            {vnpf}\n"
        f"    Department:             {dept}\n"
        f"    Ministry:               {ministry}\n"
        f"    Outstanding Leave:      {leave_days} days\n"
        f"    Amount Authorised:      VT {amount}\n\n"
        f"The Department of Finance is hereby authorised to process and make the above "
        f"payment accordingly.\n\n"
        f"Thank you for your cooperation."
        + signature_block()
        + f"\n\nCc:  Director — {dept}\n"
        f"     HRM — {ministry}\n"
        f"     Salary Section — MFE\n"
        f"     Chrono"
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }
