from django.db import migrations

PSC_3_7_FIELDS = [
    # ── 1. Proposed Employee ──────────────────────────────────────────────────
    {
        'field_key': 'sec_proposed_employee',
        'label': '1. Proposed Employee',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 10,
    },
    {
        'field_key': 'proposed_employee_name',
        'label': 'Name of Proposed Employee',
        'field_type': 'text',
        'placeholder': 'Full name',
        'help_text': 'Person is to complete a Job Application (PSC Form 3-2), which is to be attached.',
        'choices': '', 'is_required': True, 'display_order': 20,
    },

    # ── 2. Established Post ───────────────────────────────────────────────────
    {
        'field_key': 'sec_established_post',
        'label': '2. Established Post',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 30,
    },
    {
        'field_key': 'is_established_post',
        'label': 'Is the person to be employed in an established post?',
        'field_type': 'radio',
        'placeholder': '', 'help_text': '',
        'choices': 'Yes\nNo',
        'is_required': True, 'display_order': 40,
    },
    {
        'field_key': 'post_title',
        'label': 'Post Title',
        'field_type': 'text',
        'placeholder': '',
        'help_text': 'Attach a copy of the approved job description form.',
        'choices': '', 'is_required': False, 'display_order': 50,
    },
    {
        'field_key': 'post_number',
        'label': 'Post Number',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 60,
    },
    {
        'field_key': 'post_level',
        'label': 'Post Level',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 70,
    },

    # ── 3. Reasons for Employment ─────────────────────────────────────────────
    {
        'field_key': 'sec_reasons',
        'label': '3. Reasons for Employment',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 80,
    },
    {
        'field_key': 'reasons_for_employment',
        'label': 'Reasons why it is necessary to employ this additional staff member',
        'field_type': 'textarea',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 90,
    },

    # ── 4. Selection ──────────────────────────────────────────────────────────
    {
        'field_key': 'sec_selection',
        'label': '4. Selection',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 100,
    },
    {
        'field_key': 'how_selected',
        'label': 'How was the proposed employee selected?',
        'field_type': 'textarea',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 110,
    },

    # ── 5. Employment Type ────────────────────────────────────────────────────
    {
        'field_key': 'sec_employment_type',
        'label': '5. Employment Type',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 120,
    },
    {
        'field_key': 'employment_type',
        'label': 'Type of Employment',
        'field_type': 'radio',
        'placeholder': '',
        'help_text': (
            'Temporary Salaried: max 6 months, cover absence/temporary vacancy. '
            'Daily Rated: no established post, temporary/fluctuating work, max 3 years. '
            'Contract: short-term specialist, max 6 months.'
        ),
        'choices': 'Temporary Salaried Employee\nDaily Rated Worker\nContract Employee',
        'is_required': True, 'display_order': 130,
    },

    # ── 6. Proposed Period of Employment ──────────────────────────────────────
    {
        'field_key': 'sec_period',
        'label': '6. Proposed Period of Employment',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 140,
    },
    {
        'field_key': 'period_from',
        'label': 'From',
        'field_type': 'date',
        'placeholder': '',
        'help_text': 'Employee must not commence duty prior to obtaining OPSC approval.',
        'choices': '', 'is_required': True, 'display_order': 150,
    },
    {
        'field_key': 'period_to',
        'label': 'To',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 160,
    },

    # ── 7. Proposed Salary ────────────────────────────────────────────────────
    {
        'field_key': 'sec_salary',
        'label': '7. Proposed Salary',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 170,
    },
    {
        'field_key': 'salary_vt',
        'label': 'Salary Level (VT)',
        'field_type': 'text',
        'placeholder': 'e.g. 25,000',
        'help_text': 'Enter the VT amount.',
        'choices': '', 'is_required': True, 'display_order': 180,
    },
    {
        'field_key': 'salary_scale',
        'label': 'Salary Scale',
        'field_type': 'text',
        'placeholder': 'e.g. P12.1 or C2.2',
        'help_text': 'Insert relevant salary scale e.g. P12.1 or C2.2.',
        'choices': '', 'is_required': False, 'display_order': 190,
    },

    # ── 8. Director Certification ─────────────────────────────────────────────
    {
        'field_key': 'sec_director',
        'label': '8. Director Certification',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 200,
    },
    {
        'field_key': 'director_name',
        'label': 'Name of Director',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 210,
    },
    {
        'field_key': 'director_department',
        'label': 'Name of Department',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 220,
    },
    {
        'field_key': 'director_date',
        'label': 'Director Certification Date',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 230,
    },

    # ── 9. Director-General Endorsement ──────────────────────────────────────
    {
        'field_key': 'sec_dg',
        'label': '9. Director-General Endorsement',
        'field_type': 'section_header',
        'placeholder': '',
        'help_text': 'I support the Director\'s request.',
        'choices': '', 'is_required': False, 'display_order': 240,
    },
    {
        'field_key': 'dg_name',
        'label': 'Name of Director-General',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 250,
    },
    {
        'field_key': 'dg_ministry',
        'label': 'Name of Ministry',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 260,
    },
    {
        'field_key': 'dg_date',
        'label': 'Director-General Endorsement Date',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': True, 'display_order': 270,
    },

    # ── OPSC Office Use Only ──────────────────────────────────────────────────
    {
        'field_key': 'sec_opsc',
        'label': 'To be completed by the Secretary, OPSC',
        'field_type': 'section_header',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 280,
    },
    {
        'field_key': 'approved',
        'label': 'Approved?',
        'field_type': 'radio',
        'placeholder': '', 'help_text': '',
        'choices': 'Yes\nNo',
        'is_required': False, 'display_order': 290,
    },
    {
        'field_key': 'secretary_name',
        'label': 'Secretary Name',
        'field_type': 'text',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 300,
    },
    {
        'field_key': 'secretary_date',
        'label': 'Secretary Date',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 310,
    },
    {
        'field_key': 'ministry_advised_date',
        'label': 'Ministry Advised of Decision On',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 320,
    },
    {
        'field_key': 'job_offer_letter_date',
        'label': 'Job Offer Letter Issued & Copy Forwarded On',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 330,
    },
    {
        'field_key': 'agreement_service_date',
        'label': 'Signed Agreement of Service Forwarded to Ministry On',
        'field_type': 'date',
        'placeholder': '', 'help_text': '', 'choices': '',
        'is_required': False, 'display_order': 340,
    },
]


def seed_fields(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')
    try:
        form_type = PSCFormType.objects.get(code='PSC 3-7')
    except PSCFormType.DoesNotExist:
        return  # Nothing to seed if the form type doesn't exist yet

    for field_data in PSC_3_7_FIELDS:
        PSCFormField.objects.get_or_create(
            form_type=form_type,
            field_key=field_data['field_key'],
            defaults=field_data,
        )


def remove_fields(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')
    try:
        form_type = PSCFormType.objects.get(code='PSC 3-7')
    except PSCFormType.DoesNotExist:
        return
    PSCFormField.objects.filter(form_type=form_type).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0036_psc_form_builder'),
    ]

    operations = [
        migrations.RunPython(seed_fields, remove_fields),
    ]
