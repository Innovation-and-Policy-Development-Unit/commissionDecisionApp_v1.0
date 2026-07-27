"""
Priority 0 follow-up: seed the remaining form types identified as missing from
TEMPLATES LETTERS,SUBMISSIONS&CHECK_LIST/ during the pre-pilot template audit.

Adds:
  ALLOWANCES
    - Medical Claim                          (MEDICAL-CLAIM)

  RECRUITMENT (existing category, recreated by 0157/0181 if missing)
    - Acting Appointment                     (RECRUIT-ACTING)
    - Eligible Candidate Notification        (RECRUIT-ELIGIBLE)
    - Unsuccessful Candidate Notification     (RECRUIT-UNSUCCESSFUL)

RECRUIT-UNSUCCESSFUL is new because the letter builder (unsuccessful_candidate_letter)
already existed in tracker/letters/recruitment.py but had no form type / dispatch
entry to reach it — a submission could never actually trigger it.
"""
from django.db import migrations

NEW_CATEGORIES = [
    {'code': 'ALLOWANCES', 'name': 'Allowances & Claims', 'display_order': 70},
]

NEW_FORM_TYPES = [
    {
        'code': 'MEDICAL-CLAIM',
        'name': 'Medical Expense Claim',
        'description': 'Authorization for payment of an officer\'s medical expenses claim.',
        'category_code': 'ALLOWANCES',
        'display_order': 10,
        'digitized_form_key': 'medical_claim',
    },
    {
        'code': 'RECRUIT-ACTING',
        'name': 'Acting Appointment',
        'description': 'Appointment of an officer to act in a post under PSSM section 4.2.2(1)&(2).',
        'category_code': 'RECRUITMENT',
        'display_order': 65,
        'digitized_form_key': 'recruit_acting',
    },
    {
        'code': 'RECRUIT-ELIGIBLE',
        'name': 'Eligible Candidate Notification',
        'description': 'Notification to a runner-up applicant that they have been placed on the eligibility list.',
        'category_code': 'RECRUITMENT',
        'display_order': 75,
        'digitized_form_key': 'recruit_eligible',
    },
    {
        'code': 'RECRUIT-UNSUCCESSFUL',
        'name': 'Unsuccessful Candidate Notification',
        'description': 'Notification to an applicant that they were not recommended for appointment.',
        'category_code': 'RECRUITMENT',
        'display_order': 76,
        'digitized_form_key': 'recruit_unsuccessful',
    },
]

FORM_FIELDS = {

    # ── MEDICAL-CLAIM ──────────────────────────────────────────────────────────
    'MEDICAL-CLAIM': [
        {'field_key': 'sec_officer', 'label': 'Officer Details', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 10},
        {'field_key': 'officer_name', 'label': 'Name of Officer', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 20},
        {'field_key': 'address', 'label': 'Address', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 30},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 40},
        {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 50},
        {'field_key': 'sec_claim', 'label': 'Claim Details', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 60},
        {'field_key': 'claim_amount_vt', 'label': 'Claim Amount (VT)', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 70},
        {'field_key': 'claim_description', 'label': 'Description of Medical Expense', 'field_type': 'textarea',
         'placeholder': 'What the claim covers (treatment, prescription, referral, etc.)',
         'help_text': '', 'choices': '', 'is_required': True, 'display_order': 80},
        {'field_key': 'receipts_attached', 'label': 'Original Receipts / Invoices Attached?', 'field_type': 'radio',
         'placeholder': '', 'help_text': '', 'choices': 'Yes\nNo', 'is_required': True, 'display_order': 90},
    ],

    # ── RECRUIT-ACTING ──────────────────────────────────────────────────────────
    'RECRUIT-ACTING': [
        {'field_key': 'sec_officer', 'label': 'Officer & Position', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 10},
        {'field_key': 'officer_name', 'label': 'Name of Officer', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 20},
        {'field_key': 'position_title', 'label': 'Acting Post Title', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 30},
        {'field_key': 'post_number', 'label': 'Post Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 40},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 50},
        {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 60},
        {'field_key': 'salary_grade', 'label': 'Salary Grade (VT)', 'field_type': 'text',
         'placeholder': 'e.g. PSL 5.3 (Vt. 3,509,000)', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 70},
        {'field_key': 'sec_period', 'label': 'Acting Period', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 80},
        {'field_key': 'acting_start_date', 'label': 'Acting Appointment — Start Date', 'field_type': 'date',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 90},
        {'field_key': 'acting_end_date', 'label': 'Acting Appointment — End Date', 'field_type': 'date',
         'placeholder': '', 'help_text': 'Leave blank if open-ended, pending further Commission decision.',
         'choices': '', 'is_required': False, 'display_order': 100},
        {'field_key': 'authority_basis', 'label': 'Approving Authority', 'field_type': 'radio',
         'placeholder': '', 'help_text': 'PSSM section 4.2.2(1)&(2): Secretary may approve acting appointments directly; longer/senior appointments go to the Commission.',
         'choices': 'Approved by Secretary\nApproved by Commission', 'is_required': True, 'display_order': 110},
    ],

    # ── RECRUIT-ELIGIBLE ──────────────────────────────────────────────────────────
    'RECRUIT-ELIGIBLE': [
        {'field_key': 'sec_applicant', 'label': 'Applicant & Position', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 10},
        {'field_key': 'applicant_name', 'label': 'Name of Applicant', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 20},
        {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 30},
        {'field_key': 'post_number', 'label': 'Post Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 40},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 50},
        {'field_key': 'ministry', 'label': 'Ministry', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 60},
        {'field_key': 'eligibility_expiry', 'label': 'Eligibility List Expiry Date', 'field_type': 'date',
         'placeholder': '', 'help_text': 'Current policy: eligibility list stays active for three (3) months from this notification.',
         'choices': '', 'is_required': True, 'display_order': 70},
    ],

    # ── RECRUIT-UNSUCCESSFUL ──────────────────────────────────────────────────────
    'RECRUIT-UNSUCCESSFUL': [
        {'field_key': 'sec_applicant', 'label': 'Applicant & Position', 'field_type': 'section_header',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 10},
        {'field_key': 'applicant_name', 'label': 'Name of Applicant', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 20},
        {'field_key': 'position_title', 'label': 'Position Title', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 30},
        {'field_key': 'post_number', 'label': 'Post Number', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': False, 'display_order': 40},
        {'field_key': 'department', 'label': 'Department', 'field_type': 'text',
         'placeholder': '', 'help_text': '', 'choices': '', 'is_required': True, 'display_order': 50},
    ],
}


def seed_data(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType  = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    cat_map = {}
    for cat in NEW_CATEGORIES:
        obj, _ = FormCategory.objects.get_or_create(
            code=cat['code'],
            defaults={'name': cat['name'], 'display_order': cat['display_order']},
        )
        cat_map[cat['code']] = obj

    # RECRUITMENT should already exist (0038 / self-healed by 0157 & 0181), but
    # get_or_create defensively in case this migration ever runs before those.
    recruitment_cat, _ = FormCategory.objects.get_or_create(
        code='RECRUITMENT',
        defaults={'name': 'Recruitment & Selection', 'display_order': 20},
    )
    cat_map['RECRUITMENT'] = recruitment_cat

    ft_map = {}
    for ft in NEW_FORM_TYPES:
        cat_obj = cat_map[ft['category_code']]
        obj, _ = PSCFormType.objects.get_or_create(
            code=ft['code'],
            defaults={
                'name': ft['name'],
                'description': ft['description'],
                'form_category': cat_obj,
                'display_order': ft['display_order'],
                'is_digitized': True,
                'digitized_form_key': ft['digitized_form_key'],
            },
        )
        ft_map[ft['code']] = obj

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


def unseed_data(apps, schema_editor):
    PSCFormType  = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')
    FormCategory = apps.get_model('tracker', 'FormCategory')

    codes = [ft['code'] for ft in NEW_FORM_TYPES]
    fts = PSCFormType.objects.filter(code__in=codes)
    PSCFormField.objects.filter(form_type__in=fts).delete()
    fts.delete()

    cat_codes = [c['code'] for c in NEW_CATEGORIES]
    FormCategory.objects.filter(code__in=cat_codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0181_backfill_recruitment_form_types'),
    ]

    operations = [
        migrations.RunPython(seed_data, unseed_data),
    ]
