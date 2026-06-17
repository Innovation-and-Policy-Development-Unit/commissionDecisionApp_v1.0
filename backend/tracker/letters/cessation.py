"""
Outcome letters for Cessation of Employment submissions.
Covers: Age Retirement, Notice of Age Retirement, Medical Retirement,
        Death in Service, Redundancy, Voluntary Resignation.
"""
from __future__ import annotations
from .utils import today_str, letterhead, signature_block, wrap_html, _form_data, _ministry_name


def _cessation_letter(submission, subject_line: str, body_paragraphs: list[str]) -> dict:
    ref = submission.reference_number or ""
    ministry = _ministry_name(submission)
    data = _form_data(submission)
    dept = data.get("department", "")

    head = letterhead(ref, ministry, dept)
    body = "\n\n".join(body_paragraphs)
    sig = signature_block()
    full_text = f"{head}RE: {subject_line}\n\n{body}{sig}"
    return {
        "subject": subject_line,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }


def age_retirement_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    retirement_date = data.get("retirement_date", "[Retirement Date]")

    subject = f"Age Retirement — {officer} — {position}, {dept}"
    paras = [
        f"I refer to the above submission presented to the Public Service Commission.",
        (
            f"The Commission has approved the retirement of {officer}, {position}, "
            f"{dept} on grounds of age pursuant to the Public Service Staff Manual "
            f"Chapter 7, Section 5.2."
        ),
        (
            f"The effective date of retirement is {retirement_date}. "
            f"The relevant Ministry is requested to ensure that the officer's "
            f"full entitlements — including severance payment of two (2) months' "
            f"salary per year of service and repatriation payments where applicable — "
            f"are processed promptly in accordance with PSSM Chapter 7, Section 3.1."
        ),
        "Please acknowledge receipt of this letter and confirm implementation.",
    ]
    return _cessation_letter(submission, subject, paras)


def notice_age_retirement_letter(submission) -> dict:
    data = _form_data(submission)
    officers_list = data.get("officers_list", "[Officers and notice periods to be inserted]")

    subject = "Notice of Age Retirement — Public Service Officers"
    paras = [
        "The Public Service Commission has approved the issuance of retirement notices to the following officers who have reached or are approaching the mandatory retirement age of 60 years.",
        f"Officers and Notice Periods:\n{officers_list}",
        (
            "Each officer listed above is entitled to the standard entitlements "
            "specified in PSSM Chapter 7, Section 5.2(1)(2)(a)(b), including "
            "severance payment and repatriation if applicable, upon completion "
            "of the notice period."
        ),
        "The relevant ministries and departments are requested to acknowledge and implement accordingly.",
    ]
    return _cessation_letter(submission, subject, paras)


def medical_retirement_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    last_day = data.get("last_day_of_service", "[Last Day of Service]")

    subject = f"Medical Retirement — {officer} — {position}"
    paras = [
        f"I refer to the medical retirement of {officer}, {position}.",
        (
            f"Following medical certification by two (2) registered medical practitioners "
            f"in accordance with PSSM Chapter 7, Section 5.3, the Public Service Commission "
            f"has approved the medical retirement of {officer}."
        ),
        (
            f"The last day of service is {last_day} as specified by the attending medical practitioners. "
            f"The officer's full entitlements under PSSM Chapter 7, Section 5.3.3 — including "
            f"severance payment of two (2) months' salary per year of service and repatriation "
            f"if applicable — are to be processed by the Ministry concerned."
        ),
        (
            "All medical documentation relating to this retirement must be treated with "
            "utmost confidentiality in accordance with PSSM Section 5.3.3(2)."
        ),
    ]
    return _cessation_letter(submission, subject, paras)


def death_in_service_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    next_of_kin = data.get("next_of_kin", "[Next of Kin / Beneficiary]")
    years_service = data.get("years_of_service", "[Years of Service]")

    subject = f"Death in Service — Benefits for {officer}"
    paras = [
        (
            f"The Public Service Commission acknowledges with regret the passing of "
            f"{officer}, {position}, and extends its condolences to the family and loved ones."
        ),
        (
            f"Having served for {years_service}, the Commission approves the payment "
            f"of full death-in-service entitlements to the designated beneficiary, "
            f"{next_of_kin}, pursuant to PSSM Chapter 7, Sections 5.2 and 5.13. "
            f"These entitlements include:"
        ),
        (
            "    •  Severance payment: two (2) months' salary per year of service\n"
            "    •  Six (6) months' salary\n"
            "    •  Leave payout (outstanding annual leave)\n"
            "    •  Goodwill payment (as determined by the Commission)"
        ),
        "The Department of Finance is authorized to process these payments upon receipt of the required documentation from the relevant Ministry.",
    ]
    return _cessation_letter(submission, subject, paras)


def redundancy_letter(submission) -> dict:
    data = _form_data(submission)
    officers_list = data.get("officers_list", "[Officers to be inserted]")
    ministry_responsible = data.get("redundancy_package_responsibility", "[Ministry]")

    subject = "Redundancy — Termination of Employment"
    paras = [
        (
            "The Public Service Commission has determined, pursuant to PSSM Chapter 7, "
            "Section 5.12, that the following officer(s) are declared redundant and their "
            "employment is hereby terminated accordingly:"
        ),
        officers_list,
        (
            "Each officer declared redundant is entitled to the standard entitlements, "
            "severance payment, notice period (or payment in lieu), and repatriation "
            "if applicable, as prescribed in PSSM Chapter 7, Section 3.1."
        ),
        (
            f"{ministry_responsible} is responsible for funding and processing the "
            f"redundancy packages of the above officers. The Commission requests confirmation "
            f"of implementation within thirty (30) days."
        ),
    ]
    return _cessation_letter(submission, subject, paras)


def voluntary_resignation_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    resignation_date = data.get("resignation_date", "[Date]")
    years_service = data.get("years_of_service", "[Years]")

    subject = f"Voluntary Resignation — {officer} — {position}, {dept}"
    paras = [
        (
            f"The Public Service Commission acknowledges the voluntary resignation of "
            f"{officer}, {position}, {dept}, effective {resignation_date}."
        ),
        (
            f"Having served for {years_service}, the Commission approves the resignation "
            f"in accordance with the Public Service Act Section 28 and PSSM Chapter 7, "
            f"Section 5.6, and authorises the processing of the officer's standard entitlements "
            f"including severance payment (where applicable — six or more years of service) "
            f"and any outstanding leave."
        ),
        "The relevant Ministry is requested to ensure all clearance procedures are completed and entitlements processed promptly.",
    ]
    return _cessation_letter(submission, subject, paras)
