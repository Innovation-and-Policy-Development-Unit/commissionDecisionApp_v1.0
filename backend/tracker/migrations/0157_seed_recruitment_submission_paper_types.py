"""
Migration 0157 — Priority 2: Seed recruitment *submission paper* form types.

Adds five digitized board-paper types for the RECRUITMENT category,
each with PSCFormFields extracted from the physical .docx submission templates.
Also migrates the RECRUIT-CONFIRM and RECRUIT-DIRECT RequiredDocument rows
that were added at category-level in 0156 to point to these specific form types.
"""

from django.db import migrations

# ---------------------------------------------------------------------------
# 1. New PSCFormType records for recruitment submission papers
# ---------------------------------------------------------------------------
NEW_FORM_TYPES = [
    {
        'code': 'RECRUIT-PROBATION',
        'name': 'Appointment on Probation Submission Paper',
        'description': 'Commission board submission paper for appointing a candidate on probation following a competitive merit selection process.',
        'display_order': 62,
        'is_digitized': True,
        'digitized_form_key': 'recruit_probation',
    },
    {
        'code': 'RECRUIT-CONFIRM',
        'name': 'Confirmation of Appointment Submission Paper',
        'description': 'Commission board submission paper to confirm a permanent appointment after a satisfactory probation period.',
        'display_order': 64,
        'is_digitized': True,
        'digitized_form_key': 'recruit_confirm',
    },
    {
        'code': 'RECRUIT-DIRECT',
        'name': 'Direct Appointment Submission Paper',
        'description': 'Commission board submission paper for direct appointment of an officer without competitive advertising (PSSM Ch.3 s.2.9).',
        'display_order': 66,
        'is_digitized': True,
        'digitized_form_key': 'recruit_direct',
    },
    {
        'code': 'RECRUIT-TEMPORARY',
        'name': 'Temporary Appointment Submission Paper',
        'description': 'Commission board submission paper for approval to employ a temporary salaried employee (PS Act s.30).',
        'display_order': 68,
        'is_digitized': True,
        'digitized_form_key': 'recruit_temporary',
    },
    {
        'code': 'RECRUIT-CONTRACT',
        'name': 'Contract Employment Submission Paper',
        'description': 'Commission board submission paper for approval to employ a person on a contract basis (PS Act s.30).',
        'display_order': 70,
        'is_digitized': True,
        'digitized_form_key': 'recruit_contract',
    },
]

# ---------------------------------------------------------------------------
# 2. Shared helper blocks
# ---------------------------------------------------------------------------

def _meeting_header(start=10):
    o = start
    return [
        {'field_key': 'sec_meeting', 'label': 'Meeting / Reference', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'meeting_number', 'label': 'Meeting Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+10},
        {'field_key': 'item_number', 'label': 'Item Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+20},
        {'field_key': 'psc_file', 'label': 'PSC File Reference', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+30},
        {'field_key': 'prepared_by', 'label': 'Prepared By', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+40},
        {'field_key': 'date_prepared', 'label': 'Date Prepared', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+50},
        {'field_key': 'date_received', 'label': 'Date Received from Ministry', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+60},
        {'field_key': 'date_checked', 'label': 'Date Checked', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+70},
        {'field_key': 'checked_by', 'label': 'Checked By', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+80},
    ]


def _position_block(start=200):
    o = start
    return [
        {'field_key': 'sec_position', 'label': 'Position Details', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+10},
        {'field_key': 'post_number', 'label': 'Post Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+20},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+30},
        {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+40},
        {'field_key': 'location', 'label': 'Location of Position', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+50},
        {'field_key': 'salary_grade', 'label': 'Salary Grade / Scale', 'field_type': 'text',
         'placeholder': 'e.g. PS 7.1', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+60},
        {'field_key': 'annual_salary', 'label': 'Annual Salary (VT)', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+70},
        {'field_key': 'job_level', 'label': 'Job Level / Evaluated Level', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+80},
        {'field_key': 'is_essential_service', 'label': 'Essential/Productive Service?', 'field_type': 'radio',
         'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': False, 'display_order': o+90},
    ]


def _discussion_recommendation(start=400):
    o = start
    return [
        {'field_key': 'sec_discussion', 'label': 'Discussion', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o},
        {'field_key': 'discussion', 'label': 'Discussion', 'field_type': 'textarea',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+10},
        {'field_key': 'sec_recommendation', 'label': 'Recommendation', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': o+20},
        {'field_key': 'recommendation', 'label': 'Recommendation', 'field_type': 'textarea',
         'placeholder': 'State the specific recommendation for the Commission',
         'help_text': '', 'choices': '', 'is_required': True, 'display_order': o+30},
    ]


# ---------------------------------------------------------------------------
# 3. PSCFormFields per recruitment submission paper type
# ---------------------------------------------------------------------------

FORM_FIELDS = {

    # ── RECRUIT-PROBATION ─────────────────────────────────────────────────────
    'RECRUIT-PROBATION': (
        _meeting_header(10)
        + _position_block(100)
        + [
            {'field_key': 'sec_purpose', 'label': 'Purpose', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 210},
            {'field_key': 'purpose', 'label': 'Purpose (as per JD)', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 220},
            {'field_key': 'reasons_for_employment', 'label': 'Reasons Why this Position is Necessary', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 230},
            # Selection process
            {'field_key': 'sec_selection', 'label': 'Selection Process', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 300},
            {'field_key': 'advertisement_date', 'label': 'Approval to Advertise Date', 'field_type': 'date',
             'placeholder': '', 'help_text': 'Date DG approved the position for advertisement.', 'choices': '', 'is_required': False, 'display_order': 310},
            {'field_key': 'advertisement_medium', 'label': 'Advertised On (medium & date)', 'field_type': 'text',
             'placeholder': 'e.g. Vanuatu Daily Post and Government Email, 12 March 2026',
             'help_text': '', 'choices': '', 'is_required': False, 'display_order': 320},
            {'field_key': 'closing_date', 'label': 'Closing Date of Advertisement', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 330},
            {'field_key': 'panel_constitution', 'label': 'Panel Constitution', 'field_type': 'textarea',
             'placeholder': 'Convenor: [Name]\nPSC Member: [Name]\nIndependent Member: [Name]',
             'help_text': 'List names and roles of each panel member.', 'choices': '', 'is_required': False, 'display_order': 340},
            {'field_key': 'shortlisting_date', 'label': 'Short-listing Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 350},
            {'field_key': 'interview_date', 'label': 'Interview Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 360},
            {'field_key': 'shortlist_results', 'label': 'First Round Assessment (Short-listing) Results', 'field_type': 'textarea',
             'placeholder': 'Name | Score | Panel Comments',
             'help_text': 'List each applicant assessed with their short-listing score and panel comments.', 'choices': '', 'is_required': False, 'display_order': 370},
            {'field_key': 'interview_results', 'label': 'Second Round Assessment (Interview) Results', 'field_type': 'textarea',
             'placeholder': 'Name | Interview Score | Panel Comments',
             'help_text': '', 'choices': '', 'is_required': False, 'display_order': 380},
            # Recommended candidate
            {'field_key': 'sec_recommended', 'label': 'Recommended Candidate', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 390},
            {'field_key': 'recommended_name', 'label': 'Name of Recommended Candidate', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 400},
            {'field_key': 'recommended_qualification', 'label': 'Highest Qualification (Recommended)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 410},
            {'field_key': 'recommended_experience', 'label': 'Work Experience (Recommended)', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 420},
            # Eligible candidate
            {'field_key': 'sec_eligible', 'label': 'Eligible Candidate (Runner-up)', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 430},
            {'field_key': 'eligible_name', 'label': 'Name of Eligible Candidate', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 440},
            {'field_key': 'eligible_qualification', 'label': 'Highest Qualification (Eligible)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 450},
            {'field_key': 'eligible_experience', 'label': 'Work Experience (Eligible)', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 460},
            {'field_key': 'probation_period', 'label': 'Probation Period', 'field_type': 'text',
             'placeholder': 'e.g. 3 months', 'help_text': 'PSSM Ch.3 s.1: max 6 months including renewals.', 'choices': '', 'is_required': False, 'display_order': 470},
            {'field_key': 'financial_visa_attached', 'label': 'Approved Financial Visa Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 480},
        ]
        + _discussion_recommendation(500)
    ),

    # ── RECRUIT-CONFIRM ───────────────────────────────────────────────────────
    'RECRUIT-CONFIRM': (
        _meeting_header(10)
        + [
            {'field_key': 'sec_officer', 'label': 'Officer Details', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 100},
            {'field_key': 'officer_name', 'label': 'Name of Officer', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 110},
            {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 120},
            {'field_key': 'post_number', 'label': 'Position Number', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 130},
            {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 140},
            {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 150},
            {'field_key': 'salary_level', 'label': 'Salary Scale / Level', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 160},
            {'field_key': 'effective_date', 'label': 'Effective Date of Appointment', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 170},
            {'field_key': 'probation_end_date', 'label': 'Probation Period End Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 180},
            {'field_key': 'pa_rating', 'label': "Officer's Performance Appraisal Rating", 'field_type': 'text',
             'placeholder': 'e.g. 3.8', 'help_text': 'Required rating: 3.5 and above (PSSM 3.5).', 'choices': '', 'is_required': True, 'display_order': 190},
            {'field_key': 'pa_attached', 'label': 'Performance Assessment Attached & Meets Satisfactory Level?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 200},
            {'field_key': 'supervisor_recommendation', 'label': "Supervisor's Recommendation", 'field_type': 'textarea',
             'placeholder': "Summary of supervisor's recommendation for confirmation",
             'help_text': '', 'choices': '', 'is_required': True, 'display_order': 210},
        ]
        + _discussion_recommendation(300)
    ),

    # ── RECRUIT-DIRECT ────────────────────────────────────────────────────────
    'RECRUIT-DIRECT': (
        _meeting_header(10)
        + _position_block(100)
        + [
            {'field_key': 'sec_background', 'label': 'Background', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 210},
            {'field_key': 'background', 'label': 'Background / Reasons for Direct Appointment', 'field_type': 'textarea',
             'placeholder': '', 'help_text': 'PSSM Ch.3 s.2.9: officer must have acted in higher post for ≥6 months continuously.', 'choices': '', 'is_required': True, 'display_order': 220},
            {'field_key': 'temporary_period', 'label': 'Period on Temporary Basis (From – To)', 'field_type': 'text',
             'placeholder': 'e.g. 1 Jan 2025 – 30 Jun 2025', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 230},
            {'field_key': 'officer_name', 'label': 'Name of Officer', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 240},
            {'field_key': 'substantive_position', 'label': 'Substantive Position No. (Prior)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 250},
            {'field_key': 'pa_rating', 'label': 'Annual Performance Rating', 'field_type': 'text',
             'placeholder': 'e.g. 4.2', 'help_text': 'Minimum rating 3.2 (PSSM s.3.2).', 'choices': '', 'is_required': True, 'display_order': 260},
            {'field_key': 'pa_attached', 'label': 'Performance Appraisal Attached & Meets Satisfactory Level?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 270},
            {'field_key': 'financial_visa_attached', 'label': 'Approved Financial Visa Attached (Current Year)?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 280},
            {'field_key': 'psc_form_36_attached', 'label': 'PSC Form 3-6 (Permanent Appointment Report) Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 290},
            {'field_key': 'director_recommendation', 'label': "Director's Recommendation / Cover Letter", 'field_type': 'textarea',
             'placeholder': "Summary of Director's recommendation", 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 300},
        ]
        + _discussion_recommendation(400)
    ),

    # ── RECRUIT-TEMPORARY ─────────────────────────────────────────────────────
    'RECRUIT-TEMPORARY': (
        _meeting_header(10)
        + [
            {'field_key': 'sec_candidate', 'label': 'Candidate & Position Details', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 100},
            {'field_key': 'candidate_name', 'label': 'Name of Candidate', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 110},
            {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 120},
            {'field_key': 'post_number', 'label': 'Post / Position Number', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 130},
            {'field_key': 'evaluated_level', 'label': 'Evaluated Level', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 140},
            {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 150},
            {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 160},
            {'field_key': 'location', 'label': 'Location', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 170},
            {'field_key': 'purpose', 'label': 'Purpose (as per JD)', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 180},
            {'field_key': 'reasons_for_employment', 'label': 'Reasons Why Temporary Staff is Necessary', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 190},
            {'field_key': 'sec_appointment', 'label': 'Appointment Terms', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 200},
            {'field_key': 'effective_date', 'label': 'Effective Date of Appointment', 'field_type': 'date',
             'placeholder': '', 'help_text': 'Employee must NOT commence duty prior to Commission approval.', 'choices': '', 'is_required': True, 'display_order': 210},
            {'field_key': 'end_date', 'label': 'End Date', 'field_type': 'date',
             'placeholder': '', 'help_text': 'Maximum 6 months (PS Act s.30(2)).', 'choices': '', 'is_required': True, 'display_order': 220},
            {'field_key': 'salary_grade', 'label': 'Salary Grade / Scale', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 230},
            {'field_key': 'required_qualification', 'label': 'Required Qualification per JD', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 240},
            {'field_key': 'candidate_qualification', 'label': "Candidate's Highest Qualification", 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 250},
            {'field_key': 'candidate_experience', 'label': "Candidate's Work Experience & Relevant Trainings", 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 260},
            {'field_key': 'merit_evidence', 'label': 'Evidence of Merit Process Followed?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo\nNot required (formal advertisement not required for temporary)', 'is_required': False, 'display_order': 270},
            {'field_key': 'financial_visa_attached', 'label': 'Approved Financial Visa Attached (Current Year)?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 280},
            {'field_key': 'psc_form_37_attached', 'label': 'PSC Form 3-7 Completed & Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 290},
        ]
        + _discussion_recommendation(300)
    ),

    # ── RECRUIT-CONTRACT ──────────────────────────────────────────────────────
    'RECRUIT-CONTRACT': (
        _meeting_header(10)
        + [
            {'field_key': 'sec_candidate', 'label': 'Candidate & Contract Details', 'field_type': 'section_header',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 100},
            {'field_key': 'officer_name', 'label': 'Name of Officer / Candidate', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 110},
            {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 120},
            {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 130},
            {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 140},
            {'field_key': 'contract_type', 'label': 'Contract Type', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'New Contract\nExtension of Existing Contract', 'is_required': True, 'display_order': 150},
            {'field_key': 'start_date', 'label': 'Contract Start Date', 'field_type': 'date',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 160},
            {'field_key': 'end_date', 'label': 'Contract End Date', 'field_type': 'date',
             'placeholder': '', 'help_text': 'Maximum 6 months (PS Act s.30).', 'choices': '', 'is_required': True, 'display_order': 170},
            {'field_key': 'salary_level', 'label': 'Salary Level (VT)', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 180},
            {'field_key': 'purpose', 'label': 'Purpose (as per TOR/JD)', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 190},
            {'field_key': 'reasons_for_employment', 'label': 'Reasons Why Contract Employment is Necessary', 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 200},
            {'field_key': 'required_qualification', 'label': 'Required Qualification per TOR/JD', 'field_type': 'text',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 210},
            {'field_key': 'candidate_qualification', 'label': "Candidate's Employment History & Qualifications", 'field_type': 'textarea',
             'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 220},
            {'field_key': 'break_in_service_observed', 'label': 'Break-in-Service Observed? (for extensions)', 'field_type': 'radio',
             'placeholder': '', 'help_text': 'Required when extending a previous contract.', 'choices': 'Yes\nNo\nN/A (New Contract)', 'is_required': False, 'display_order': 230},
            {'field_key': 'pa_attached', 'label': 'Performance Assessment Attached & Meets Satisfactory Level? (extensions)', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo\nN/A (New Contract)', 'is_required': False, 'display_order': 240},
            {'field_key': 'merit_evidence', 'label': 'Evidence of Merit Process Followed?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 250},
            {'field_key': 'financial_visa_attached', 'label': 'Approved Financial Visa Attached (Current Year)?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 260},
            {'field_key': 'psc_form_37_attached', 'label': 'PSC Form 3-7 Completed & Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 270},
            {'field_key': 'tor_jd_attached', 'label': 'TOR / JD Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 280},
            {'field_key': 'unsigned_agreement_attached', 'label': 'Unsigned Agreement of Service Attached?', 'field_type': 'radio',
             'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 290},
        ]
        + _discussion_recommendation(300)
    ),
}

# ---------------------------------------------------------------------------
# 4. RequiredDocuments per new type
# ---------------------------------------------------------------------------
REQUIRED_DOCS = {
    'RECRUIT-PROBATION': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Signed letter from the Director-General endorsing the recommended candidate.'},
        {'order': 20,  'name': 'Selection Outcome Report — PSC Form 3-5', 'description': 'Completed Selection Outcome Report certifying merit selection procedures were followed.'},
        {'order': 30,  'name': 'Comparative Assessment — PSC Form 3-4', 'description': 'Comparative assessment of all applicants against selection criteria.'},
        {'order': 40,  'name': 'Interview Assessment Scores — PSC Form 3-3', 'description': 'Individual applicant interview assessment scores.'},
        {'order': 50,  'name': 'Short-listing Scores — PSC Form 3-3', 'description': 'Short-listing assessment scores for all applicants.'},
        {'order': 60,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Financial visa confirming the appointment is within the approved establishment.'},
        {'order': 70,  'name': 'Job Description — PSC Form 2-2', 'description': 'Current approved job description for the position.'},
        {'order': 80,  'name': 'Organisation Structure Chart', 'description': 'Current approved organisation structure showing where the position sits.'},
        {'order': 90,  'name': 'Vacancy Notice / Advertisement', 'description': 'Copy of the published vacancy notice.'},
        {'order': 100, 'name': "Recommended Candidate's Application — PSC Form 3-2", 'description': "Signed job application of the recommended candidate."},
        {'order': 110, 'name': "Eligible Candidate's Application — PSC Form 3-2", 'description': "Signed job application of the eligible (runner-up) candidate."},
        {'order': 120, 'name': 'Academic Qualifications — Recommended Candidate', 'description': 'Copies of academic certificates and qualifications.'},
        {'order': 130, 'name': 'Essential Services Certification (if applicable)', 'description': 'Confirmation if position is in an essential/productive service.'},
    ],
    'RECRUIT-CONFIRM': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement confirming recommendation for appointment.'},
        {'order': 20,  'name': "Officer's Performance Appraisal Report", 'description': 'Completed performance appraisal with rating of 3.5 or above (PSSM 3.5).'},
        {'order': 30,  'name': "Supervisor's Recommendation Letter", 'description': "Written recommendation from the officer's direct supervisor."},
    ],
    'RECRUIT-DIRECT': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-6 — Permanent Appointment Report', 'description': 'Completed Permanent Appointment Report (required by PSSM s.2.9).'},
        {'order': 30,  'name': 'Performance Appraisal Report (Rating 3.2+)', 'description': 'Appraisal meeting the minimum direct appointment rating (PSSM s.3.2).'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Financial visa for the current financial year.'},
        {'order': 50,  'name': 'Academic Qualifications', 'description': "Copies of the officer's certificates per JD requirements."},
        {'order': 60,  'name': 'Job Description — PSC Form 2-2', 'description': 'Approved job description for the position.'},
        {'order': 70,  'name': "Director's Cover Letter", 'description': "Director's letter recommending the direct appointment."},
    ],
    'RECRUIT-TEMPORARY': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-7 — Completed and Signed', 'description': 'Fully completed Request to Employ Temporary/Daily Rated/Contract Staff form.'},
        {'order': 30,  'name': 'Job Description — PSC Form 2-2', 'description': 'Approved job description for the temporary position.'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Financial visa confirming the position is within the approved budget.'},
        {'order': 50,  'name': "Candidate's Job Application — PSC Form 3-2", 'description': "Candidate's completed and signed job application."},
        {'order': 60,  'name': 'Evidence of Merit Process (if applicable)', 'description': 'Documentation of how the candidate was selected.'},
    ],
    'RECRUIT-CONTRACT': [
        {'order': 10,  'name': "DG's Endorsement Letter", 'description': 'Director-General endorsement letter.'},
        {'order': 20,  'name': 'PSC Form 3-7 — Completed and Signed', 'description': 'Fully completed Request to Employ form.'},
        {'order': 30,  'name': 'Terms of Reference (TOR) / Job Description', 'description': 'Approved TOR or job description for the contract position.'},
        {'order': 40,  'name': 'Approved Financial Visa (Current Year)', 'description': 'Financial visa for the current financial year.'},
        {'order': 50,  'name': 'Evidence of Merit Process Followed', 'description': 'Documentation of the selection process.'},
        {'order': 60,  'name': 'Unsigned Agreement of Service', 'description': 'Draft unsigned agreement of service for Commission review.'},
        {'order': 70,  'name': "Candidate's Employment History & Qualifications", 'description': "CV, employment history, and training certificates."},
        {'order': 80,  'name': 'Break-in-Service Evidence (extensions only)', 'description': 'Proof that the required break-in-service was observed.'},
        {'order': 90,  'name': 'Performance Assessment (extensions only)', 'description': 'Satisfactory performance appraisal for contract extension requests.'},
    ],
}


# ---------------------------------------------------------------------------
# 5. Migration functions
# ---------------------------------------------------------------------------

def seed_data(apps, schema_editor):
    FormCategory     = apps.get_model('tracker', 'FormCategory')
    PSCFormType      = apps.get_model('tracker', 'PSCFormType')
    PSCFormField     = apps.get_model('tracker', 'PSCFormField')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    recruitment_cat = FormCategory.objects.filter(code='RECRUITMENT').first()
    if not recruitment_cat:
        return  # Guard: should always exist from 0038

    # ── 5a. Seed form type records ────────────────────────────────────────────
    ft_map = {}
    for ft in NEW_FORM_TYPES:
        obj, _ = PSCFormType.objects.get_or_create(
            code=ft['code'],
            defaults={
                'name': ft['name'],
                'description': ft['description'],
                'form_category': recruitment_cat,
                'display_order': ft['display_order'],
                'is_digitized': True,
                'digitized_form_key': ft['digitized_form_key'],
            },
        )
        ft_map[ft['code']] = obj

    # ── 5b. Seed form fields ──────────────────────────────────────────────────
    for code, fields in FORM_FIELDS.items():
        ft_obj = ft_map.get(code)
        if not ft_obj:
            continue
        for fdata in fields:
            PSCFormField.objects.get_or_create(
                form_type=ft_obj,
                field_key=fdata['field_key'],
                defaults={k: v for k, v in fdata.items() if k != 'field_key'},
            )

    # ── 5c. Seed RequiredDocuments ────────────────────────────────────────────
    for code, docs in REQUIRED_DOCS.items():
        ft_obj = ft_map.get(code)
        if not ft_obj:
            continue
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

    # ── 5d. Migrate category-level RECRUIT-CONFIRM / RECRUIT-DIRECT docs ─────
    # These were added at category-level in 0156 with name prefixes.
    # Now that we have specific form types, move them to form_type-scoped entries.
    # (They are already replaced above; remove the old category-level rows.)
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


def unseed_data(apps, schema_editor):
    PSCFormType      = apps.get_model('tracker', 'PSCFormType')
    PSCFormField     = apps.get_model('tracker', 'PSCFormField')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    codes = [ft['code'] for ft in NEW_FORM_TYPES]
    fts = PSCFormType.objects.filter(code__in=codes)
    RequiredDocument.objects.filter(form_type__in=fts).delete()
    PSCFormField.objects.filter(form_type__in=fts).delete()
    fts.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0156_seed_cessation_secondment_leavepayout_templates'),
    ]

    operations = [
        migrations.RunPython(seed_data, unseed_data),
    ]
