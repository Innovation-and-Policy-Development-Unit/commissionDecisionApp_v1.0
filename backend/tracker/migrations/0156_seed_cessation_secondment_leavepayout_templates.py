"""
Migration 0156 — Priority 0: Seed form types, PSCFormFields, and RequiredDocuments
extracted from the physical .docx templates in:
  TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/

Categories added:
  CESSATION OF EMPLOYMENT
    - Age Retirement            (CESSATION-AGE)
    - Notice of Age Retirement  (CESSATION-NOTICE-AGE)
    - Medical Retirement        (CESSATION-MEDICAL)
    - Death in Service          (CESSATION-DEATH)
    - Redundancy                (CESSATION-REDUNDANCY)
    - Voluntary Resignation     (CESSATION-RESIGNATION)

  SECONDMENT
    - Secondment                (SECONDMENT)

  LEAVE PAYOUT
    - Leave Payout              (LEAVE-PAYOUT)

  RECRUITMENT — RequiredDocuments (checklists) for existing form types:
    - Appointment on Probation / Permanent Appointment  (PSC 3-6 area)
    - Confirmation of Appointment
    - Direct Appointment
    - Temporary Appointment     (PSC 3-7)
    - Contract Employment       (PSC 3-7 contract variant)
"""

from django.db import migrations

# ---------------------------------------------------------------------------
# 1.  New FormCategory codes we need
# ---------------------------------------------------------------------------
NEW_CATEGORIES = [
    {'code': 'CESSATION',    'name': 'Cessation of Employment',  'display_order': 40},
    {'code': 'SECONDMENT',   'name': 'Secondment',               'display_order': 50},
    {'code': 'LEAVE_PAYOUT', 'name': 'Leave Payout',             'display_order': 60},
]

# ---------------------------------------------------------------------------
# 2.  New PSCFormType records (one per submission template)
# ---------------------------------------------------------------------------
NEW_FORM_TYPES = [
    # ── Cessation ─────────────────────────────────────────────────────────
    {
        'code': 'CESSATION-AGE',
        'name': 'Age Retirement Submission',
        'description': 'Submission paper for retirement of an officer who has reached the normal retiring age (60 years).',
        'category_code': 'CESSATION',
        'display_order': 10,
        'is_digitized': True,
        'digitized_form_key': 'cessation_age',
    },
    {
        'code': 'CESSATION-NOTICE-AGE',
        'name': 'Notice of Age Retirement Submission',
        'description': 'Submission to issue formal retirement notice to officers approaching the mandatory retirement age.',
        'category_code': 'CESSATION',
        'display_order': 20,
        'is_digitized': True,
        'digitized_form_key': 'cessation_notice_age',
    },
    {
        'code': 'CESSATION-MEDICAL',
        'name': 'Medical Retirement Submission',
        'description': 'Submission paper for retirement of an officer on medical grounds (PSSM Chapter 7, Section 5.3).',
        'category_code': 'CESSATION',
        'display_order': 30,
        'is_digitized': True,
        'digitized_form_key': 'cessation_medical',
    },
    {
        'code': 'CESSATION-DEATH',
        'name': 'Death in Service Submission',
        'description': 'Submission paper for processing death-in-service benefits (PSSM Chapter 7, Section 5.13).',
        'category_code': 'CESSATION',
        'display_order': 40,
        'is_digitized': True,
        'digitized_form_key': 'cessation_death',
    },
    {
        'code': 'CESSATION-REDUNDANCY',
        'name': 'Redundancy Submission',
        'description': 'Submission paper for declaring a staff member redundant (PSSM Chapter 7, Section 5.12).',
        'category_code': 'CESSATION',
        'display_order': 50,
        'is_digitized': True,
        'digitized_form_key': 'cessation_redundancy',
    },
    {
        'code': 'CESSATION-RESIGNATION',
        'name': 'Voluntary Resignation Submission',
        'description': 'Submission paper to note and approve voluntary resignation (PSSM Chapter 7, Section 5.6).',
        'category_code': 'CESSATION',
        'display_order': 60,
        'is_digitized': True,
        'digitized_form_key': 'cessation_resignation',
    },
    # ── Secondment ────────────────────────────────────────────────────────
    {
        'code': 'SECONDMENT',
        'name': 'Secondment Submission',
        'description': 'Submission for approval to second a permanent officer to another department or organisation (PSSM Chapter 4, Section 6.3).',
        'category_code': 'SECONDMENT',
        'display_order': 10,
        'is_digitized': True,
        'digitized_form_key': 'secondment',
    },
    # ── Leave Payout ──────────────────────────────────────────────────────
    {
        'code': 'LEAVE-PAYOUT',
        'name': 'Leave Payout Authorization',
        'description': 'Authorization letter to the Department of Finance for outstanding annual leave payout.',
        'category_code': 'LEAVE_PAYOUT',
        'display_order': 10,
        'is_digitized': True,
        'digitized_form_key': 'leave_payout',
    },
]

# ---------------------------------------------------------------------------
# 3.  PSCFormFields per form type
#     Extracted from physical .docx submission templates.
# ---------------------------------------------------------------------------

# Helper: shared "meeting header" fields present in every submission paper
def _meeting_header_fields(start_order=10):
    o = start_order
    return [
        {'field_key': 'sec_meeting_header', 'label': 'Meeting / Reference', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'meeting_number', 'label': 'Meeting Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 10},
        {'field_key': 'item_number', 'label': 'Item Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 20},
        {'field_key': 'psc_file', 'label': 'PSC File Reference', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 30},
        {'field_key': 'prepared_by', 'label': 'Prepared By', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 40},
        {'field_key': 'date_prepared', 'label': 'Date Prepared', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 50},
        {'field_key': 'date_received', 'label': 'Date Received from Ministry', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 60},
    ]


# Helper: shared officer identification block
def _officer_block(start_order=100):
    o = start_order
    return [
        {'field_key': 'sec_officer', 'label': 'Officer Details', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'officer_name', 'label': 'Name of Officer', 'field_type': 'text',
         'placeholder': 'Full name', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 10},
        {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 20},
        {'field_key': 'post_number', 'label': 'Post Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 30},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 40},
        {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 50},
        {'field_key': 'salary_grade', 'label': 'Salary Grade / Scale', 'field_type': 'text',
         'placeholder': 'e.g. PS 7.1', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 60},
    ]


# Helper: shared employment history block
def _employment_history_block(start_order=200):
    o = start_order
    return [
        {'field_key': 'sec_employment_history', 'label': 'Employment History', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'employment_history', 'label': 'Employment History', 'field_type': 'textarea',
         'placeholder': 'List all positions held in the public service (title, department, dates)',
         'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 10},
    ]


# Helper: shared discussion + recommendation block
def _discussion_recommendation_block(start_order=300):
    o = start_order
    return [
        {'field_key': 'sec_discussion', 'label': 'Discussion', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'discussion', 'label': 'Discussion', 'field_type': 'textarea',
         'placeholder': 'Provide background, context, and analysis',
         'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 10},
        {'field_key': 'sec_recommendation', 'label': 'Recommendation', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o + 20},
        {'field_key': 'recommendation', 'label': 'Recommendation', 'field_type': 'textarea',
         'placeholder': 'State the specific recommendation(s) for the Commission',
         'help_text': '', 'choices': '', 'is_required': True, 'display_order': o + 30},
    ]


FORM_FIELDS = {

    # ── CESSATION-AGE ─────────────────────────────────────────────────────────
    'CESSATION-AGE': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + _employment_history_block(200)
        + [
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 280},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether the officer can be retired in accordance with PSSM Chapter 7, Section 5.2',
             'help_text': 'Normal retiring age is 60 years (PSSM Ch.7 s.5.2(1)). In exceptional circumstances 45–59 with Commission approval.',
             'choices': '', 'is_required': True, 'display_order': 290},
            {'field_key': 'date_of_birth', 'label': 'Date of Birth', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 295},
            {'field_key': 'retirement_date', 'label': 'Proposed Retirement Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 297},
        ]
        + _discussion_recommendation_block(300)
        + [
            {'field_key': 'sec_attachments', 'label': 'Attachments', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 400},
            {'field_key': 'attachments_notes', 'label': 'Attachment Notes', 'field_type': 'textarea',
             'placeholder': 'List any additional documents attached',
             'help_text': 'E.g. Letter from Director/DG, Finance Smartstream reports, other supporting documents.',
             'choices': '', 'is_required': False, 'display_order': 410},
        ]
    ),

    # ── CESSATION-NOTICE-AGE ──────────────────────────────────────────────────
    'CESSATION-NOTICE-AGE': (
        _meeting_header_fields(10)
        + [
            {'field_key': 'sec_background', 'label': 'Background', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 100},
            {'field_key': 'background', 'label': 'Background', 'field_type': 'textarea',
             'placeholder': 'Brief background on officers approaching retirement age',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 110},
            {'field_key': 'sec_officers_list', 'label': 'Officers Due for Retirement', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 120},
            {'field_key': 'officers_list', 'label': 'Officer(s) Name, Department, Period of Notice (Start–End)', 'field_type': 'textarea',
             'placeholder': 'e.g. John Smith, Finance Dept — Notice: 1 Jan 2026 to 31 Mar 2026',
             'help_text': 'List all officers with their notice start and end dates based on length of service.',
             'choices': '', 'is_required': True, 'display_order': 130},
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 140},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether this request falls within PSC law (legal retirement age 60 years)',
             'help_text': 'Cite PS Act s.44(m), PSSM Ch.3 s.2.11.1(iv), Employment Act s.54.',
             'choices': '', 'is_required': True, 'display_order': 150},
        ]
        + _discussion_recommendation_block(200)
    ),

    # ── CESSATION-MEDICAL ─────────────────────────────────────────────────────
    'CESSATION-MEDICAL': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + _employment_history_block(200)
        + [
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 240},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether this medical retirement complies with PSSM Ch.7 s.5.3',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 250},
            {'field_key': 'retirement_initiated_by', 'label': 'Medical Retirement Initiated By', 'field_type': 'radio',
             'placeholder': '', 'help_text': 'See PSSM 5.3.1 (officer-initiated) or 5.3.2 (Commission-initiated).',
             'choices': 'Staff Member\nThe Commission', 'is_required': True, 'display_order': 260},
            {'field_key': 'medical_practitioners', 'label': 'Registered Medical Practitioners (Names & Nominations)', 'field_type': 'textarea',
             'placeholder': 'Name — Nominated by (Staff Member / Commission)',
             'help_text': 'Two registered medical practitioners required; at least one nominated by the Commission.',
             'choices': '', 'is_required': True, 'display_order': 270},
            {'field_key': 'medical_certification_date', 'label': 'Date Certified Unfit', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 280},
            {'field_key': 'last_day_of_service', 'label': 'Last Day of Service (as specified by medical practitioner)', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 290},
        ]
        + _discussion_recommendation_block(300)
        + [
            {'field_key': 'sec_entitlements', 'label': 'Entitlements', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 380},
            {'field_key': 'entitlements_notes', 'label': 'Entitlements Notes', 'field_type': 'textarea',
             'placeholder': 'Severance (2 months/year of service), repatriation if applicable (PSSM 5.3.3)',
             'help_text': '', 'choices': '', 'is_required': False, 'display_order': 390},
        ]
    ),

    # ── CESSATION-DEATH ───────────────────────────────────────────────────────
    'CESSATION-DEATH': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + [
            {'field_key': 'sec_background', 'label': 'Background', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 180},
            {'field_key': 'background', 'label': 'Background', 'field_type': 'textarea',
             'placeholder': 'Brief background on the death and circumstances',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 190},
            {'field_key': 'date_of_death', 'label': 'Date of Death', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 200},
            {'field_key': 'next_of_kin', 'label': 'Next of Kin / Beneficiary', 'field_type': 'text',
             'placeholder': 'Name of next of kin or designated beneficiary',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 210},
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 220},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether this request falls within PSSM and PSC law',
             'help_text': 'Death-in-service benefits under PSSM Ch.7 s.5.2 and s.5.13.',
             'choices': '', 'is_required': True, 'display_order': 230},
            {'field_key': 'sec_entitlements', 'label': 'Death in Service Benefits', 'field_type': 'section_header',
             'placeholder': '', 'help_text': 'PSSM Ch.7 s.5.13: Severance (2 months/year), 6 months salary, leave payout, goodwill payment.',
             'choices': '', 'is_required': False, 'display_order': 240},
            {'field_key': 'years_of_service', 'label': 'Total Years of Service', 'field_type': 'text',
             'placeholder': 'e.g. 12 years 4 months', 'help_text': '',
             'choices': '', 'is_required': True, 'display_order': 250},
            {'field_key': 'severance_amount', 'label': 'Severance Amount (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': '2 months salary × years of service',
             'choices': '', 'is_required': False, 'display_order': 260},
            {'field_key': 'six_months_salary', 'label': '6 Months Salary (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 270},
            {'field_key': 'leave_payout_amount', 'label': 'Leave Payout (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 280},
            {'field_key': 'goodwill_payment', 'label': 'Goodwill Payment (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 290},
        ]
        + _discussion_recommendation_block(300)
    ),

    # ── CESSATION-REDUNDANCY ──────────────────────────────────────────────────
    'CESSATION-REDUNDANCY': (
        _meeting_header_fields(10)
        + [
            {'field_key': 'sec_background', 'label': 'Background', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 100},
            {'field_key': 'background', 'label': 'Background', 'field_type': 'textarea',
             'placeholder': 'Brief background including reasons for redundancy',
             'help_text': 'PSSM Ch.7 s.5.12: Commission may declare redundant if greater number of staff than necessary.',
             'choices': '', 'is_required': True, 'display_order': 110},
            {'field_key': 'sec_officers_list', 'label': 'Officers Declared Redundant', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 120},
            {'field_key': 'officers_list', 'label': 'Officer(s) Name, Department, Notice Period', 'field_type': 'textarea',
             'placeholder': 'Name — Department — Notice start to end date',
             'help_text': 'Two weeks to three months notice depending on length of service.',
             'choices': '', 'is_required': True, 'display_order': 130},
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 140},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether this request falls within PSSM and PSC law',
             'help_text': 'Cite PSSM Ch.7 s.5.12(1)(2)(3).',
             'choices': '', 'is_required': True, 'display_order': 150},
            {'field_key': 'redundancy_package_responsibility', 'label': 'Ministry Responsible for Package', 'field_type': 'text',
             'placeholder': 'Name of the ministry responsible for funding the redundancy package',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 160},
        ]
        + _discussion_recommendation_block(200)
    ),

    # ── CESSATION-RESIGNATION ─────────────────────────────────────────────────
    'CESSATION-RESIGNATION': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + _employment_history_block(200)
        + [
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 240},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether the resignation request is within the PSSM and PSC Act',
             'help_text': 'PS Act s.28, PSSM Ch.7 s.5.6 — voluntary resignation.',
             'choices': '', 'is_required': True, 'display_order': 250},
            {'field_key': 'resignation_date', 'label': 'Effective Date of Resignation', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 260},
            {'field_key': 'notice_period_complied', 'label': 'Notice Period Complied With?', 'field_type': 'radio',
             'placeholder': '', 'help_text': 'Per PS Act s.28 — 2 weeks to 3 months depending on length of service.',
             'choices': 'Yes\nNo\nPayment in lieu', 'is_required': True, 'display_order': 270},
            {'field_key': 'reason_for_resignation', 'label': 'Reason for Resignation', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 280},
            {'field_key': 'years_of_service', 'label': 'Total Years of Service', 'field_type': 'text',
             'placeholder': 'e.g. 6 years 2 months',
             'help_text': 'Severance applicable if 6 or more years of service (PSSM s.5.6).',
             'choices': '', 'is_required': True, 'display_order': 290},
            {'field_key': 'under_discipline', 'label': 'Under Discipline?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 295},
            {'field_key': 'bonding_agreement', 'label': 'Bonding Agreement?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 297},
        ]
        + _discussion_recommendation_block(300)
    ),

    # ── SECONDMENT ────────────────────────────────────────────────────────────
    'SECONDMENT': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + _employment_history_block(200)
        + [
            {'field_key': 'sec_secondment_details', 'label': 'Secondment Details', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 240},
            {'field_key': 'receiving_organisation', 'label': 'Receiving Organisation', 'field_type': 'text',
             'placeholder': 'Name of the organisation the officer is being seconded to',
             'help_text': 'PSSM Ch.4 s.6.3: Another Public Service Dept, Public Sector Organisation, or public institution.',
             'choices': '', 'is_required': True, 'display_order': 250},
            {'field_key': 'secondment_purpose', 'label': 'Purpose of Secondment', 'field_type': 'textarea',
             'placeholder': 'Government initiative or rationale for the secondment',
             'help_text': 'Must be a government-to-government initiative or Vanuatu Government initiative with regional/external organisation.',
             'choices': '', 'is_required': True, 'display_order': 260},
            {'field_key': 'secondment_from', 'label': 'Secondment Start Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 270},
            {'field_key': 'secondment_to', 'label': 'Secondment End Date', 'field_type': 'date',
             'placeholder': '',
             'help_text': 'Maximum period is five (5) years (PSSM s.6.3).',
             'choices': '', 'is_required': True, 'display_order': 280},
            {'field_key': 'salary_responsibility', 'label': 'Who Pays Salary During Secondment?', 'field_type': 'radio',
             'placeholder': '',
             'help_text': 'Unless otherwise determined by the Commission, the receiving organisation is responsible (PSSM s.6.3).',
             'choices': 'Receiving Organisation\nGovernment of Vanuatu\nShared', 'is_required': True, 'display_order': 290},
            {'field_key': 'position_backfill_plan', 'label': 'Plan to Fill Vacant Position', 'field_type': 'textarea',
             'placeholder': 'Transfer of employee or advertise the position',
             'help_text': 'Commission must ensure the vacant position is filled (PSSM s.6.3).',
             'choices': '', 'is_required': True, 'display_order': 295},
            {'field_key': 'sec_issue', 'label': 'Issue', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 300},
            {'field_key': 'issue', 'label': 'Issue', 'field_type': 'textarea',
             'placeholder': 'Whether the request for secondment complies with the PSSM',
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 310},
        ]
        + _discussion_recommendation_block(320)
    ),

    # ── LEAVE-PAYOUT ──────────────────────────────────────────────────────────
    'LEAVE-PAYOUT': (
        _meeting_header_fields(10)
        + _officer_block(100)
        + [
            {'field_key': 'sec_leave_details', 'label': 'Leave Payout Details', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 180},
            {'field_key': 'vnpf_number', 'label': 'VNPF Number', 'field_type': 'text',
             'placeholder': '', 'help_text': 'As shown on the leave payout authorization letter.',
             'choices': '', 'is_required': True, 'display_order': 190},
            {'field_key': 'outstanding_leave_days', 'label': 'Outstanding Annual Leave (Days)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 200},
            {'field_key': 'payout_amount_vt', 'label': 'Payout Amount (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': 'Total VT equivalent for outstanding leave days.',
             'choices': '', 'is_required': True, 'display_order': 210},
            {'field_key': 'reason_for_payout', 'label': 'Reason for Leave Payout', 'field_type': 'radio',
             'placeholder': '', 'help_text': '',
             'choices': 'Retirement\nResignation\nDeath in Service\nRedundancy\nMedical Retirement\nOther',
             'is_required': True, 'display_order': 220},
            {'field_key': 'director_name', 'label': 'Director (Receiving Department)', 'field_type': 'text',
             'placeholder': 'Director who will receive authorization', 'help_text': '',
             'choices': '', 'is_required': True, 'display_order': 230},
        ]
    ),
}

# ---------------------------------------------------------------------------
# 4.  RequiredDocuments (checklists) per form type
#     Extracted from physical .docx checklist templates.
# ---------------------------------------------------------------------------

REQUIRED_DOCS = {

    # ── Recruitment — Appointment on Probation (maps to RECRUITMENT category)
    # These supplement existing PSC form types for Permanent Appointment (PSC 3-6 area)
    'CESSATION-RESIGNATION': [
        {'order': 10,  'name': 'Original Resignation Letter', 'description': 'Signed resignation letter from the officer.'},
        {'order': 20,  'name': "DG's Acknowledgement Letter", 'description': "Director-General's acknowledgement of the resignation letter."},
        {'order': 30,  'name': 'Under Discipline Clearance', 'description': 'Confirmation that the officer is not under active disciplinary proceedings.'},
        {'order': 40,  'name': 'Bonding Agreement (if applicable)', 'description': 'Copy of bonding agreement, if the officer was bonded.'},
        {'order': 50,  'name': 'Latest Performance Appraisal', 'description': 'Most recent performance assessment report.'},
    ],
    'CESSATION-AGE': [
        {'order': 10,  'name': "Letter from Director/DG", 'description': 'Cover letter from the Director or Director-General recommending retirement.'},
        {'order': 20,  'name': 'Finance Smartstream Reports', 'description': 'Current Smartstream payroll/entitlements report from the Department of Finance.'},
        {'order': 30,  'name': 'Proof of Age (Birth Certificate or similar)', 'description': 'Documentary evidence of the officer\'s date of birth confirming retirement age.'},
        {'order': 40,  'name': 'Other Supporting Documents', 'description': 'Any other documents supporting the retirement request.'},
    ],
    'CESSATION-NOTICE-AGE': [
        {'order': 10,  'name': "Letter from Director/DG", 'description': 'Cover letter from the Director-General listing officers due for retirement.'},
        {'order': 20,  'name': 'Finance Smartstream Reports', 'description': 'Smartstream reports confirming service and salary details for each officer.'},
    ],
    'CESSATION-MEDICAL': [
        {'order': 10,  'name': "Letter from Director/DG", 'description': 'Recommendation letter from the Director-General.'},
        {'order': 20,  'name': 'Application for Medical Retirement', 'description': 'Formal application from the officer (if officer-initiated).'},
        {'order': 30,  'name': 'Medical Report — Doctor 1 (Commission-nominated)', 'description': 'Certified medical report from the Commission-nominated registered medical practitioner.'},
        {'order': 40,  'name': 'Medical Report — Doctor 2 (Staff-nominated)', 'description': 'Certified medical report from the staff-member-nominated registered medical practitioner.'},
        {'order': 50,  'name': 'Length of Service Certificate', 'description': 'Finance or OPSC-certified statement of length of service.'},
    ],
    'CESSATION-DEATH': [
        {'order': 10,  'name': "Letter from DG", 'description': 'Formal notification letter from the Director-General.'},
        {'order': 20,  'name': 'CRVS Death Certificate', 'description': 'Official death certificate from the Civil Registry and Vital Statistics (CRVS).'},
        {'order': 30,  'name': 'Next of Kin / Beneficiary Declaration', 'description': 'Signed declaration of next of kin or designated beneficiary.'},
        {'order': 40,  'name': 'Finance Smartstream Reports', 'description': 'Payroll report confirming salary, leave balance, and years of service.'},
    ],
    'CESSATION-REDUNDANCY': [
        {'order': 10,  'name': "Letter from DG / Ministry", 'description': 'Letter from Director-General or Ministry requesting redundancy.'},
        {'order': 20,  'name': 'Organisation Structure (Before & After)', 'description': 'Org charts showing the structure before and after redundancy.'},
        {'order': 30,  'name': 'Finance Smartstream Reports', 'description': 'Reports confirming entitlements for each officer declared redundant.'},
    ],
    'SECONDMENT': [
        {'order': 10,  'name': "Director's Recommendation Letter", 'description': "Director's letter recommending the officer for secondment (PSSM s.6.3)."},
        {'order': 20,  'name': "Director-General's Endorsement Letter", 'description': "Director-General's endorsement of the secondment request."},
        {'order': 30,  'name': 'Receiving Organisation Agreement / MOU', 'description': 'Letter or MOU from the receiving organisation confirming the secondment terms.'},
        {'order': 40,  'name': 'Secondment Terms (Salary, Leave, Duration)', 'description': 'Document specifying who pays salary, pension, and other benefits during secondment.'},
        {'order': 50,  'name': 'Position Backfill Plan', 'description': 'Plan for filling the vacated position by transfer or advertisement.'},
    ],
    'LEAVE-PAYOUT': [
        {'order': 10,  'name': 'Finance Leave Balance Report', 'description': 'Smartstream leave balance report from the Department of Finance confirming outstanding leave days.'},
        {'order': 20,  'name': 'Cessation / Separation Document', 'description': 'Copy of the relevant separation document (retirement letter, resignation letter, death certificate, etc.).'},
        {'order': 30,  'name': "Director's Cover Letter", 'description': "Director's letter requesting the leave payout."},
    ],

    # ── Recruitment checklists mapped to existing form types ─────────────────
    # These are keyed by the PSCFormType *code* that already exists in the DB.
    'PSC 3-6': [  # Permanent Appointment Report — Appointment on Probation checklist
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Signed endorsement from the Director-General.'},
        {'order': 20,  'name': 'Selection Outcome Report — PSC Form 3-5', 'description': 'Completed comparative selection outcome report.'},
        {'order': 30,  'name': 'Comparative Assessment — PSC Form 3-4', 'description': 'Completed comparative assessment of applicants form.'},
        {'order': 40,  'name': 'Interview Assessment Scores — PSC Form 3-3', 'description': 'Individual applicant first assessment forms.'},
        {'order': 50,  'name': 'Short-listing Scores — PSC Form 3-3', 'description': 'Short-listing assessment forms.'},
        {'order': 60,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Current-year financial visa confirming the appointment is within budget.'},
        {'order': 70,  'name': 'Job Description — PSC Form 2-2', 'description': 'Approved job description for the position.'},
        {'order': 80,  'name': 'Organisation Structure Chart', 'description': 'Current approved organisation structure chart.'},
        {'order': 90,  'name': 'Vacancy Notice / Advertisement', 'description': 'Copy of the published vacancy notice.'},
        {'order': 100, 'name': "Recommended Candidate's Application — PSC Form 3-2", 'description': 'Signed job application of the recommended candidate.'},
        {'order': 110, 'name': "Eligible Candidate's Application — PSC Form 3-2", 'description': 'Signed job application of the eligible (runner-up) candidate.'},
        {'order': 120, 'name': 'Academic Qualifications — Recommended Candidate', 'description': 'Copies of academic certificates and qualifications.'},
        {'order': 130, 'name': 'Evidence of Merit Process Followed', 'description': 'Documentation confirming prescribed merit selection procedures were used.'},
        {'order': 140, 'name': 'Essential Services Certification (if applicable)', 'description': 'Confirmation if position is in an essential/productive service.'},
    ],
    # Confirmation of Appointment — no single PSCFormType; maps to category
    # We create a special key for it and handle in the seeding function
    'RECRUIT-CONFIRM': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter confirming recommendation.'},
        {'order': 20,  'name': "Officer's Performance Appraisal Report", 'description': 'Completed performance appraisal meeting the required rating (3.5 and above per PSSM 3.5).'},
        {'order': 30,  'name': 'Supervisor Recommendation Letter', 'description': "Supervisor's written recommendation confirming satisfactory performance during probation."},
    ],
    # Direct Appointment
    'RECRUIT-DIRECT': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-6 — Permanent Appointment Report', 'description': 'Completed permanent appointment report (PSSM 2.9 requires this for direct appointments).'},
        {'order': 30,  'name': 'Performance Appraisal Report (PA Rating 3.2+)', 'description': 'Appraisal report meeting the minimum direct appointment rating (3.2 per PSSM 3.2).'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Current-year financial visa.'},
        {'order': 50,  'name': 'Academic Qualifications', 'description': 'Copies of certificates per the JD requirements.'},
        {'order': 60,  'name': 'Job Description — PSC Form 2-2', 'description': 'Approved job description for the position.'},
    ],
    # Temporary Recruitment — already has PSC 3-7 but checklist was not seeded
    'PSC 3-7-TEMP': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-7 — Completed and Signed', 'description': 'Fully completed Request to Employ Temporary/Daily Rated/Contract Staff form.'},
        {'order': 30,  'name': 'Job Description — PSC Form 2-2', 'description': 'Approved job description for the temporary position.'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Current-year financial visa confirming budget.'},
        {'order': 50,  'name': "Candidate's Job Application — PSC Form 3-2", 'description': "Candidate's completed job application form."},
        {'order': 60,  'name': 'Evidence of Merit Process (if applicable)', 'description': 'Documentation of how the candidate was selected.'},
        {'order': 70,  'name': 'Performance Appraisal (if extension)', 'description': 'For extensions: appraisal confirming satisfactory performance.'},
    ],
    # Contract Employment
    'PSC 3-7-CONTRACT': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-7 — Completed and Signed', 'description': 'Fully completed Request to Employ form.'},
        {'order': 30,  'name': 'Terms of Reference (TOR) / Job Description', 'description': 'Approved TOR or job description for the contract position.'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Current-year financial visa.'},
        {'order': 50,  'name': 'Evidence of Merit Process Followed', 'description': 'Documentation of selection process.'},
        {'order': 60,  'name': 'Unsigned Agreement of Service', 'description': 'Draft unsigned agreement of service for Commission review.'},
        {'order': 70,  'name': 'Employment History / Qualifications', 'description': 'Candidate CV, employment history, and relevant training certificates.'},
        {'order': 80,  'name': 'Break-in-Service Evidence (if extension)', 'description': 'Evidence that the required break-in-service has been observed before extension.'},
        {'order': 90,  'name': 'Performance Assessment (if extension)', 'description': 'Satisfactory performance assessment for contract extension requests.'},
    ],
}


# ---------------------------------------------------------------------------
# 5.  Migration functions
# ---------------------------------------------------------------------------

def seed_data(apps, schema_editor):
    FormCategory   = apps.get_model('tracker', 'FormCategory')
    PSCFormType    = apps.get_model('tracker', 'PSCFormType')
    PSCFormField   = apps.get_model('tracker', 'PSCFormField')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    # ── 5a. Ensure FormCategory rows exist ───────────────────────────────────
    cat_map = {}
    for cat in NEW_CATEGORIES:
        obj, _ = FormCategory.objects.get_or_create(
            code=cat['code'],
            defaults={
                'name': cat['name'],
                'display_order': cat['display_order'],
            },
        )
        cat_map[cat['code']] = obj

    # ── 5b. Seed PSCFormType rows ────────────────────────────────────────────
    ft_map = {}
    for ft in NEW_FORM_TYPES:
        cat_obj = cat_map.get(ft['category_code'])
        obj, _ = PSCFormType.objects.get_or_create(
            code=ft['code'],
            defaults={
                'name': ft['name'],
                'description': ft['description'],
                'form_category': cat_obj,
                'display_order': ft['display_order'],
                'is_digitized': ft.get('is_digitized', False),
                'digitized_form_key': ft.get('digitized_form_key', ''),
            },
        )
        ft_map[ft['code']] = obj

    # ── 5c. Seed PSCFormField rows ───────────────────────────────────────────
    for form_code, fields in FORM_FIELDS.items():
        ft_obj = ft_map.get(form_code)
        if not ft_obj:
            continue
        for fdata in fields:
            PSCFormField.objects.get_or_create(
                form_type=ft_obj,
                field_key=fdata['field_key'],
                defaults={k: v for k, v in fdata.items() if k != 'field_key'},
            )

    # ── 5d. Seed RequiredDocument rows ───────────────────────────────────────
    # Resolve special mapping keys to form type objects
    special_map = {
        'PSC 3-6': PSCFormType.objects.filter(code='PSC 3-6').first(),
        'PSC 3-7-TEMP': PSCFormType.objects.filter(code='PSC 3-7').first(),
        'PSC 3-7-CONTRACT': PSCFormType.objects.filter(code='PSC 3-7').first(),
    }
    # RECRUIT-CONFIRM and RECRUIT-DIRECT don't map to a single PSCFormType —
    # they use form_category RECRUITMENT with a name prefix so they're distinct
    recruitment_cat = FormCategory.objects.filter(code='RECRUITMENT').first()

    for doc_key, docs in REQUIRED_DOCS.items():
        ft_obj = ft_map.get(doc_key) or special_map.get(doc_key)

        if doc_key in ('RECRUIT-CONFIRM', 'RECRUIT-DIRECT'):
            # Attach to category only (no specific form type)
            prefix = 'Confirmation: ' if doc_key == 'RECRUIT-CONFIRM' else 'Direct Appointment: '
            for doc in docs:
                RequiredDocument.objects.get_or_create(
                    form_type=None,
                    form_category=recruitment_cat,
                    name=prefix + doc['name'],
                    defaults={
                        'description': doc['description'],
                        'order': doc['order'],
                        'is_active': True,
                    },
                )
        elif ft_obj:
            for doc in docs:
                RequiredDocument.objects.get_or_create(
                    form_type=ft_obj,
                    name=doc['name'],
                    defaults={
                        'description': doc['description'],
                        'order': doc['order'],
                        'is_active': True,
                    },
                )


def unseed_data(apps, schema_editor):
    FormCategory     = apps.get_model('tracker', 'FormCategory')
    PSCFormType      = apps.get_model('tracker', 'PSCFormType')
    PSCFormField     = apps.get_model('tracker', 'PSCFormField')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    codes = [ft['code'] for ft in NEW_FORM_TYPES]
    fts = PSCFormType.objects.filter(code__in=codes)
    RequiredDocument.objects.filter(form_type__in=fts).delete()
    PSCFormField.objects.filter(form_type__in=fts).delete()
    fts.delete()

    cat_codes = [c['code'] for c in NEW_CATEGORIES]
    FormCategory.objects.filter(code__in=cat_codes).delete()

    # Remove RECRUIT-CONFIRM / RECRUIT-DIRECT category-level docs
    recruitment_cat = FormCategory.objects.filter(code='RECRUITMENT').first()
    if recruitment_cat:
        RequiredDocument.objects.filter(
            form_type=None,
            form_category=recruitment_cat,
            name__startswith='Confirmation: ',
        ).delete()
        RequiredDocument.objects.filter(
            form_type=None,
            form_category=recruitment_cat,
            name__startswith='Direct Appointment: ',
        ).delete()

    # Remove PSC 3-6 and PSC 3-7 RequiredDocuments added by this migration
    for code in ('PSC 3-6', 'PSC 3-7'):
        ft = PSCFormType.objects.filter(code=code).first()
        if ft:
            RequiredDocument.objects.filter(form_type=ft).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0155_unit_scoped_minutes'),
    ]

    operations = [
        migrations.RunPython(seed_data, unseed_data),
    ]
