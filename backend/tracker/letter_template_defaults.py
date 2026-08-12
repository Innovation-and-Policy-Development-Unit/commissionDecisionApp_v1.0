"""
Built-in default content for LetterTemplate rows — one per form_type_code
with a registered decision letter. Seeded by seed_default_letter_templates()
and used by reset_letter_template_to_default(). This is a straight
{{placeholder}}-ised transcription of the wording that used to be hardcoded
in backend/tracker/letters/*.py — the exact legal/procedural text is
unchanged, only now editable through the admin UI.
"""

SIGNATURE_BLOCK = (
    "Yours faithfully,\n\n\n"
    "_________________________\n"
    "Secretary to the Public Service Commission\n"
    "Office of the Public Service Commission"
)

DEFAULT_LETTER_TEMPLATES = [
    {
        "form_type_code": "RECRUIT-PROBATION",
        "name": "Offer of Employment",
        "category": "recruitment",
        "description": "Sent when the Commission approves an initial appointment on probation.",
        "placeholders": "candidate_name, position_title, department, ministry, salary, effective_date, probation_period, today, reference_number",
        "subject_template": "Offer of Employment — {{position_title}}, {{department}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{candidate_name}}\n\n"
            "RE: Offer of Employment — {{position_title}}, {{department}}\n\n"
            "Dear {{candidate_name}},\n\n"
            "On behalf of the Public Service Commission, I am pleased to offer you appointment "
            "to the position of {{position_title}} within the {{department}}, {{ministry}}, "
            "on the following terms and conditions:\n\n"
            "    Position Title:       {{position_title}}\n"
            "    Department:           {{department}}\n"
            "    Ministry:             {{ministry}}\n"
            "    Salary:               {{salary}} per annum\n"
            "    Effective Date:       {{effective_date}}\n"
            "    Employment Status:    Permanent (subject to probation)\n"
            "    Probation Period:     {{probation_period}}\n\n"
            "This offer is subject to the terms and conditions of employment prescribed under "
            "the Public Service Act and the Public Service Staff Manual. A copy of the Code of "
            "Conduct is enclosed and must be signed and returned prior to commencement of duty.\n\n"
            "Please sign and return the duplicate copy of this letter to the relevant Ministry "
            "Human Resources Officer to acknowledge acceptance of this offer.\n\n"
            "Congratulations on your appointment.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "RECRUIT-CONFIRM",
        "name": "Confirmation of Appointment",
        "category": "recruitment",
        "description": "Sent when the Commission confirms a permanent appointment following a satisfactory probationary assessment.",
        "placeholders": "officer_name, position_title, department, ministry, effective_date, today, reference_number",
        "subject_template": "Confirmation of Appointment — {{officer_name}} — {{position_title}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Confirmation of Appointment — {{officer_name}} — {{position_title}}\n\n"
            "I am pleased to advise that the Public Service Commission has confirmed "
            "the appointment of {{officer_name}} to the position of {{position_title}}, {{department}}, {{ministry}}, "
            "effective {{effective_date}}.\n\n"
            "This confirmation follows a satisfactory probationary assessment in accordance "
            "with the Employment Act Section 14 and PSSM Chapter 3, Section 5. "
            "The officer is now a permanent employee of the Public Service subject to the "
            "terms and conditions of the Public Service Act and Staff Manual.\n\n"
            "Please update the officer's personal file accordingly.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "RECRUIT-DIRECT",
        "name": "Direct Appointment",
        "category": "recruitment",
        "description": "Sent when the Commission approves a direct appointment.",
        "placeholders": "officer_name, position_title, post_number, post_number_suffix, department, ministry, salary, today, reference_number",
        "subject_template": "Direct Appointment — {{officer_name}} — {{position_title}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Direct Appointment — {{officer_name}} — {{position_title}}\n\n"
            "The Public Service Commission has approved the direct appointment of "
            "{{officer_name}} to the position of {{position_title}}{{post_number_suffix}} "
            "within {{department}}, {{ministry}}, pursuant to the Public Service Act "
            "Section 25 and PSSM Chapter 3, Section 2.9.\n\n"
            "The appointment will be on a permanent basis with an annual salary of {{salary}}. "
            "Terms and conditions of employment are as prescribed under the Public Service Act "
            "and the Public Service Staff Manual.\n\n"
            "The Ministry is requested to advise the officer and confirm the appointment in the officer's personal file.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "RECRUIT-TEMPORARY",
        "name": "Temporary Appointment",
        "category": "recruitment",
        "description": "Sent when the Commission approves a temporary salaried appointment.",
        "placeholders": "candidate_name, position_title, department, ministry, salary, effective_date, end_date, today, reference_number",
        "subject_template": "Temporary Appointment — {{position_title}}, {{department}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{candidate_name}}\n\n"
            "RE: Temporary Appointment — {{position_title}}, {{department}}\n\n"
            "Dear {{candidate_name}},\n\n"
            "I am pleased to advise that the Public Service Commission has approved "
            "your temporary appointment to the position of {{position_title}} within {{department}}, "
            "{{ministry}}, on the following terms:\n\n"
            "    Position Title:       {{position_title}}\n"
            "    Department:           {{department}}\n"
            "    Ministry:             {{ministry}}\n"
            "    Salary:               {{salary}}\n"
            "    Effective Date:       {{effective_date}}\n"
            "    End Date:             {{end_date}}\n"
            "    Employment Status:    Temporary Salaried Employee\n\n"
            "This appointment is made pursuant to Public Service Act Section 30 and "
            "PSSM Chapter 3, Section 7. You must not commence duty prior to receiving "
            "this approval letter. A copy of the terms and conditions of employment "
            "and the Code of Conduct is enclosed.\n\n"
            "Please sign and return the duplicate copy of this letter to the Ministry "
            "Human Resources Officer.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "RECRUIT-CONTRACT",
        "name": "Contract Employment",
        "category": "recruitment",
        "description": "Sent when the Commission approves a contract appointment.",
        "placeholders": "officer_name, position_title, department, ministry, salary, start_date, end_date, contract_type, today, reference_number",
        "subject_template": "Contract Employment ({{contract_type}}) — {{position_title}}, {{department}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Contract Employment ({{contract_type}}) — {{position_title}}, {{department}}\n\n"
            "The Public Service Commission has approved the employment of {{officer_name}} "
            "as {{position_title}} within {{department}}, {{ministry}}, on a contract basis pursuant "
            "to Public Service Act Section 30 and PSSM Chapter 3, Section 7.\n\n"
            "Contract Period: {{start_date}} to {{end_date}}\n"
            "Salary: {{salary}}\n"
            "Department: {{department}}\n"
            "Ministry: {{ministry}}\n\n"
            "A formal Agreement of Service will be issued under separate cover. "
            "The officer must sign and return the Agreement to the Ministry Human "
            "Resources Officer prior to commencement of duty.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-AGE",
        "name": "Age Retirement",
        "category": "cessation",
        "description": "Sent when the Commission approves a retirement on grounds of age.",
        "placeholders": "officer_name, position_title, department, retirement_date, today, reference_number",
        "subject_template": "Age Retirement — {{officer_name}} — {{position_title}}, {{department}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Age Retirement — {{officer_name}} — {{position_title}}, {{department}}\n\n"
            "I refer to the above submission presented to the Public Service Commission.\n\n"
            "The Commission has approved the retirement of {{officer_name}}, {{position_title}}, "
            "{{department}} on grounds of age pursuant to the Public Service Staff Manual "
            "Chapter 7, Section 5.2.\n\n"
            "The effective date of retirement is {{retirement_date}}. "
            "The relevant Ministry is requested to ensure that the officer's "
            "full entitlements — including severance payment of two (2) months' "
            "salary per year of service and repatriation payments where applicable — "
            "are processed promptly in accordance with PSSM Chapter 7, Section 3.1.\n\n"
            "Please acknowledge receipt of this letter and confirm implementation.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-NOTICE-AGE",
        "name": "Notice of Age Retirement",
        "category": "cessation",
        "description": "Sent to notify ministries of officers approaching mandatory retirement age.",
        "placeholders": "officers_list, today, reference_number",
        "subject_template": "Notice of Age Retirement — Public Service Officers",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Notice of Age Retirement — Public Service Officers\n\n"
            "The Public Service Commission has approved the issuance of retirement notices to the "
            "following officers who have reached or are approaching the mandatory retirement age of "
            "60 years.\n\n"
            "Officers and Notice Periods:\n{{officers_list}}\n\n"
            "Each officer listed above is entitled to the standard entitlements "
            "specified in PSSM Chapter 7, Section 5.2(1)(2)(a)(b), including "
            "severance payment and repatriation if applicable, upon completion "
            "of the notice period.\n\n"
            "The relevant ministries and departments are requested to acknowledge and implement accordingly.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-MEDICAL",
        "name": "Medical Retirement",
        "category": "cessation",
        "description": "Sent when the Commission approves a retirement on medical grounds.",
        "placeholders": "officer_name, position_title, last_day_of_service, today, reference_number",
        "subject_template": "Medical Retirement — {{officer_name}} — {{position_title}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Medical Retirement — {{officer_name}} — {{position_title}}\n\n"
            "I refer to the medical retirement of {{officer_name}}, {{position_title}}.\n\n"
            "Following medical certification by two (2) registered medical practitioners "
            "in accordance with PSSM Chapter 7, Section 5.3, the Public Service Commission "
            "has approved the medical retirement of {{officer_name}}.\n\n"
            "The last day of service is {{last_day_of_service}} as specified by the attending medical practitioners. "
            "The officer's full entitlements under PSSM Chapter 7, Section 5.3.3 — including "
            "severance payment of two (2) months' salary per year of service and repatriation "
            "if applicable — are to be processed by the Ministry concerned.\n\n"
            "All medical documentation relating to this retirement must be treated with "
            "utmost confidentiality in accordance with PSSM Section 5.3.3(2).\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-DEATH",
        "name": "Death in Service",
        "category": "cessation",
        "description": "Sent to approve death-in-service benefits to a designated beneficiary.",
        "placeholders": "officer_name, position_title, next_of_kin, years_of_service, today, reference_number",
        "subject_template": "Death in Service — Benefits for {{officer_name}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Death in Service — Benefits for {{officer_name}}\n\n"
            "The Public Service Commission acknowledges with regret the passing of "
            "{{officer_name}}, {{position_title}}, and extends its condolences to the family and loved ones.\n\n"
            "Having served for {{years_of_service}}, the Commission approves the payment "
            "of full death-in-service entitlements to the designated beneficiary, "
            "{{next_of_kin}}, pursuant to PSSM Chapter 7, Sections 5.2 and 5.13. "
            "These entitlements include:\n\n"
            "    •  Severance payment: two (2) months' salary per year of service\n"
            "    •  Six (6) months' salary\n"
            "    •  Leave payout (outstanding annual leave)\n"
            "    •  Goodwill payment (as determined by the Commission)\n\n"
            "The Department of Finance is authorized to process these payments upon receipt of the "
            "required documentation from the relevant Ministry.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-REDUNDANCY",
        "name": "Redundancy",
        "category": "cessation",
        "description": "Sent when the Commission declares officer(s) redundant and terminates their employment.",
        "placeholders": "officers_list, ministry_responsible, today, reference_number",
        "subject_template": "Redundancy — Termination of Employment",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Redundancy — Termination of Employment\n\n"
            "The Public Service Commission has determined, pursuant to PSSM Chapter 7, "
            "Section 5.12, that the following officer(s) are declared redundant and their "
            "employment is hereby terminated accordingly:\n\n"
            "{{officers_list}}\n\n"
            "Each officer declared redundant is entitled to the standard entitlements, "
            "severance payment, notice period (or payment in lieu), and repatriation "
            "if applicable, as prescribed in PSSM Chapter 7, Section 3.1.\n\n"
            "{{ministry_responsible}} is responsible for funding and processing the "
            "redundancy packages of the above officers. The Commission requests confirmation "
            "of implementation within thirty (30) days.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "CESSATION-RESIGNATION",
        "name": "Voluntary Resignation",
        "category": "cessation",
        "description": "Sent to acknowledge a voluntary resignation and authorise entitlements.",
        "placeholders": "officer_name, position_title, department, resignation_date, years_of_service, today, reference_number",
        "subject_template": "Voluntary Resignation — {{officer_name}} — {{position_title}}, {{department}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Voluntary Resignation — {{officer_name}} — {{position_title}}, {{department}}\n\n"
            "The Public Service Commission acknowledges the voluntary resignation of "
            "{{officer_name}}, {{position_title}}, {{department}}, effective {{resignation_date}}.\n\n"
            "Having served for {{years_of_service}}, the Commission approves the resignation "
            "in accordance with the Public Service Act Section 28 and PSSM Chapter 7, "
            "Section 5.6, and authorises the processing of the officer's standard entitlements "
            "including severance payment (where applicable — six or more years of service) "
            "and any outstanding leave.\n\n"
            "The relevant Ministry is requested to ensure all clearance procedures are completed and "
            "entitlements processed promptly.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "SECONDMENT",
        "name": "Secondment",
        "category": "secondment",
        "description": "Sent when the Commission approves a secondment to another organisation.",
        "placeholders": "officer_name, position_title, department, ministry, receiving_organisation, date_from, date_to, salary_responsibility, today, reference_number",
        "subject_template": "Approval of Secondment — {{officer_name}} — {{position_title}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\nDate: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{ministry}}\n    {{department}}\n\n"
            "RE: Approval of Secondment — {{officer_name}} — {{position_title}}\n\n"
            "The Public Service Commission has approved the secondment of {{officer_name}}, "
            "{{position_title}}, {{department}}, {{ministry}}, to {{receiving_organisation}}, pursuant to the "
            "Public Service Staff Manual Chapter 4, Section 6.3.\n\n"
            "Secondment Period: {{date_from}} to {{date_to}}\n"
            "Receiving Organisation: {{receiving_organisation}}\n"
            "Salary Responsibility: {{salary_responsibility}}\n\n"
            "{{officer_name}} will continue as a public servant during the secondment period "
            "and is required to return to the Public Service at the end of the approved "
            "period. Failure to return will be deemed a voluntary resignation from the "
            "Public Service.\n\n"
            "All leave entitlements will continue to accrue during the secondment period "
            "at the normal rate, in accordance with PSSM Section 6.3. The Commission will "
            "ensure the vacated position is filled during the secondment period.\n\n"
            "Please acknowledge receipt of this letter and arrange for the officer to be briefed on the terms "
            "of the secondment.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
    {
        "form_type_code": "LEAVE-PAYOUT",
        "name": "Outstanding Annual Leave Payout",
        "category": "leave_payout",
        "description": "Authorises the Department of Finance to pay out an officer's outstanding annual leave.",
        "placeholders": "officer_name, department, ministry, vnpf_number, outstanding_leave_days, amount, director_name, today, reference_number",
        "subject_template": "Outstanding Annual Leave Payout — {{officer_name}} — ID {{vnpf_number}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\n"
            "Date: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{director_name}}\n"
            "    Department of Finance\n"
            "    Port Vila\n\n"
            "RE: Outstanding Annual Leave Payout — {{officer_name}} — ID {{vnpf_number}}\n\n"
            "Dear {{director_name}},\n\n"
            "This letter serves as authorisation for the payment of outstanding annual leave "
            "for {{officer_name}} from the {{department}}, {{ministry}}.\n\n"
            "    Officer:                {{officer_name}}\n"
            "    VNPF Number:            {{vnpf_number}}\n"
            "    Department:             {{department}}\n"
            "    Ministry:               {{ministry}}\n"
            "    Outstanding Leave:      {{outstanding_leave_days}} days\n"
            "    Amount Authorised:      VT {{amount}}\n\n"
            "The Department of Finance is hereby authorised to process and make the above "
            "payment accordingly.\n\n"
            "Thank you for your cooperation.\n\n"
            + SIGNATURE_BLOCK
            + "\n\nCc:  Director — {{department}}\n"
            "     HRM — {{ministry}}\n"
            "     Salary Section — MFE\n"
            "     Chrono"
        ),
    },
    {
        "form_type_code": "MEDICAL-CLAIM",
        "name": "Medical Expense Claim",
        "category": "allowances",
        "description": "Approves payment of an officer's medical expense claim.",
        "placeholders": "officer_name, address, address_line, amount, today, reference_number",
        "subject_template": "Medical Expense Claim — {{officer_name}}",
        "body_text_template": (
            "PUBLIC SERVICE COMMISSION\nPort Vila, Vanuatu\n"
            "Date: {{today}}\n\n"
            "Reference: {{reference_number}}\n\n"
            "TO: {{officer_name}}\n"
            "{{address_line}}\n"
            "RE: Medical Expense Claim — {{officer_name}}\n\n"
            "Dear {{officer_name}},\n\n"
            "This is to inform you that approval is hereby granted to your medical "
            "expenses claim for Vt. {{amount}}.\n\n"
            "The Department of Finance is hereby authorised to make payments.\n\n"
            + SIGNATURE_BLOCK
        ),
    },
]
