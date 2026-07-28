"""
Outcome letters for Recruitment submission papers.
Covers: Offer of Employment, Confirmation of Appointment, Direct Appointment,
        Temporary Appointment, Contract Employment, Acting Appointment,
        Eligible Candidate, Unsuccessful Candidate.
"""
from __future__ import annotations
from .utils import today_str, letterhead, signature_block, wrap_html, _form_data, _ministry_name


def _recruit_letter(submission, subject_line: str, body_paragraphs: list[str]) -> dict:
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


def offer_of_employment_letter(submission) -> dict:
    data = _form_data(submission)
    candidate = data.get("recommended_name") or data.get("candidate_name") or data.get("officer_name", "[Candidate Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    salary = data.get("annual_salary") or data.get("salary_level") or data.get("salary_grade", "[Salary]")
    effective_date = data.get("effective_date", "[Effective Date]")
    probation = data.get("probation_period", "3 months")
    ref = submission.reference_number or ""

    subject = f"Offer of Employment — {position}, {dept}"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {candidate}\n\n"
        f"RE: {subject}\n\n"
        f"Dear {candidate},\n\n"
        f"On behalf of the Public Service Commission, I am pleased to offer you appointment "
        f"to the position of {position} within the {dept}, {ministry}, "
        f"on the following terms and conditions:\n\n"
        f"    Position Title:       {position}\n"
        f"    Department:           {dept}\n"
        f"    Ministry:             {ministry}\n"
        f"    Salary:               {salary} per annum\n"
        f"    Effective Date:       {effective_date}\n"
        f"    Employment Status:    Permanent (subject to probation)\n"
        f"    Probation Period:     {probation}\n\n"
        f"This offer is subject to the terms and conditions of employment prescribed under "
        f"the Public Service Act and the Public Service Staff Manual. A copy of the Code of "
        f"Conduct is enclosed and must be signed and returned prior to commencement of duty.\n\n"
        f"Please sign and return the duplicate copy of this letter to the relevant Ministry "
        f"Human Resources Officer to acknowledge acceptance of this offer.\n\n"
        f"Congratulations on your appointment."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }


def confirmation_of_appointment_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    effective_date = data.get("effective_date", "[Effective Date]")

    subject = f"Confirmation of Appointment — {officer} — {position}"
    paras = [
        f"I am pleased to advise that the Public Service Commission has confirmed "
        f"the appointment of {officer} to the position of {position}, {dept}, {ministry}, "
        f"effective {effective_date}.",
        (
            "This confirmation follows a satisfactory probationary assessment in accordance "
            "with the Employment Act Section 14 and PSSM Chapter 3, Section 5. "
            "The officer is now a permanent employee of the Public Service subject to the "
            "terms and conditions of the Public Service Act and Staff Manual."
        ),
        "Please update the officer's personal file accordingly.",
    ]
    return _recruit_letter(submission, subject, paras)


def direct_appointment_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    post_number = data.get("post_number", "")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    salary = data.get("annual_salary") or data.get("salary_grade", "[Salary]")

    subject = f"Direct Appointment — {officer} — {position}"
    paras = [
        (
            f"The Public Service Commission has approved the direct appointment of "
            f"{officer} to the position of {position}"
            + (f" (Post No. {post_number})" if post_number else "")
            + f" within {dept}, {ministry}, pursuant to the Public Service Act "
            f"Section 25 and PSSM Chapter 3, Section 2.9."
        ),
        (
            f"The appointment will be on a permanent basis with an annual salary of {salary}. "
            f"Terms and conditions of employment are as prescribed under the Public Service Act "
            f"and the Public Service Staff Manual."
        ),
        "The Ministry is requested to advise the officer and confirm the appointment in the officer's personal file.",
    ]
    return _recruit_letter(submission, subject, paras)


def temporary_appointment_letter(submission) -> dict:
    data = _form_data(submission)
    candidate = data.get("candidate_name") or data.get("officer_name", "[Candidate Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    salary = data.get("salary_grade", "[Salary]")
    effective_date = data.get("effective_date", "[Effective Date]")
    end_date = data.get("end_date", "[End Date]")
    ref = submission.reference_number or ""

    subject = f"Temporary Appointment — {position}, {dept}"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {candidate}\n\n"
        f"RE: {subject}\n\n"
        f"Dear {candidate},\n\n"
        f"I am pleased to advise that the Public Service Commission has approved "
        f"your temporary appointment to the position of {position} within {dept}, "
        f"{ministry}, on the following terms:\n\n"
        f"    Position Title:       {position}\n"
        f"    Department:           {dept}\n"
        f"    Ministry:             {ministry}\n"
        f"    Salary:               {salary}\n"
        f"    Effective Date:       {effective_date}\n"
        f"    End Date:             {end_date}\n"
        f"    Employment Status:    Temporary Salaried Employee\n\n"
        f"This appointment is made pursuant to Public Service Act Section 30 and "
        f"PSSM Chapter 3, Section 7. You must not commence duty prior to receiving "
        f"this approval letter. A copy of the terms and conditions of employment "
        f"and the Code of Conduct is enclosed.\n\n"
        f"Please sign and return the duplicate copy of this letter to the Ministry "
        f"Human Resources Officer."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }


def contract_employment_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer/Candidate Name]")
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    salary = data.get("salary_level", "[Salary]")
    start_date = data.get("start_date", "[Start Date]")
    end_date = data.get("end_date", "[End Date]")
    contract_type = data.get("contract_type", "Contract")

    subject = f"Contract Employment ({contract_type}) — {position}, {dept}"
    paras = [
        (
            f"The Public Service Commission has approved the employment of {officer} "
            f"as {position} within {dept}, {ministry}, on a contract basis pursuant "
            f"to Public Service Act Section 30 and PSSM Chapter 3, Section 7."
        ),
        (
            f"Contract Period: {start_date} to {end_date}\n"
            f"Salary: {salary}\n"
            f"Department: {dept}\n"
            f"Ministry: {ministry}"
        ),
        (
            "A formal Agreement of Service will be issued under separate cover. "
            "The officer must sign and return the Agreement to the Ministry Human "
            "Resources Officer prior to commencement of duty."
        ),
    ]
    return _recruit_letter(submission, subject, paras)


def acting_appointment_letter(submission) -> dict:
    data = _form_data(submission)
    officer = data.get("officer_name", "[Officer Name]")
    position = data.get("position_title", "[Position Title]")
    post_number = data.get("post_number", "")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    salary_grade = data.get("salary_grade", "[Salary Grade]")
    start_date = data.get("acting_start_date", "[Start Date]")
    end_date = data.get("acting_end_date", "")
    ref = submission.reference_number or ""

    subject = f"Approval of Acting Appointment as {position} — {dept}"
    period = f"{start_date} to {end_date}" if end_date else f"{start_date} until further decision by the Commission"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {officer}\n\n"
        f"RE: {subject}\n\n"
        f"Dear {officer},\n\n"
        f"I am pleased to inform you that, with the powers vested under section "
        f"4.2.2(1) & (2) of the PSSM, I hereby appoint you on an acting basis to "
        f"the following post as stated below:\n\n"
        f"    Post Title:       {position}\n"
        + (f"    Post No.:         {post_number}\n" if post_number else "")
        + f"    Salary Grade:     {salary_grade}\n"
        f"    Department:       {dept}\n"
        f"    Ministry:         {ministry}\n\n"
        f"Your acting appointment is effective from {period}. You are expected "
        f"to carry out the full duties and responsibilities of {position}. The "
        f"terms and conditions of service contained in your letter of appointment "
        f"remain unchanged.\n\n"
        f"On behalf of the Commission, I congratulate you and wish you all the "
        f"best in your acting capacity as {position}."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }


def eligible_candidate_letter(submission) -> dict:
    data = _form_data(submission)
    applicant = data.get("applicant_name", "[Applicant Name]")
    position = data.get("position_title", "[Position Title]")
    post_number = data.get("post_number", "")
    dept = data.get("department", "[Department]")
    ministry = _ministry_name(submission) or data.get("ministry", "[Ministry]")
    expiry = data.get("eligibility_expiry", "[Expiry Date]")
    ref = submission.reference_number or ""

    subject = f"Application Outcome — {position}, {dept}"
    post_ref = f"{position} - Post No. {post_number}" if post_number else position
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"TO: {applicant}\n\n"
        f"RE: {subject}\n\n"
        f"Dear {applicant},\n\n"
        f"I refer to your application for the post of {post_ref} within the "
        f"{dept}, {ministry}.\n\n"
        f"Thank you for your interest in applying for this post and for making "
        f"yourself available for interview by the Selection Panel. The Commission "
        f"carefully considered all applicants for the post and, on this occasion, "
        f"you were recommended as an eligible candidate for the position.\n\n"
        f"The current policy states that the eligibility list is active until "
        f"{expiry}. Within this period, if the successful applicant withdraws "
        f"the offer of appointment or ceases office, the Director-General of "
        f"{ministry} shall consult with the Commission to appoint you to the "
        f"position, or alternatively request approval to re-advertise the "
        f"position.\n\n"
        f"We encourage you to apply for future vacancies in the Public Service "
        f"for which you believe your skills and qualifications make you suitable."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }


def unsuccessful_candidate_letter(submission) -> dict:
    data = _form_data(submission)
    position = data.get("position_title", "[Position Title]")
    dept = data.get("department", "[Department]")
    ref = submission.reference_number or ""

    subject = f"Application Outcome — {position}, {dept}"
    full_text = (
        f"PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {today_str()}\n\n"
        f"Reference: {ref}\n\n"
        f"RE: {subject}\n\n"
        f"Dear Applicant,\n\n"
        f"Thank you for your application for the position of {position} within "
        f"{dept}.\n\n"
        f"Following a competitive merit selection process, the Public Service Commission "
        f"has appointed another candidate to this position. We regret to advise that "
        f"your application has been unsuccessful on this occasion.\n\n"
        f"We encourage you to apply for future vacancies in the Public Service "
        f"and thank you for your interest in serving the people of Vanuatu."
        + signature_block()
    )
    return {
        "subject": subject,
        "body_text": full_text,
        "body_html": wrap_html(full_text),
    }
