from django.db import migrations

CATEGORIES = [
    {'code': 'ORG_STRUCTURE',       'name': 'Organizational Structure & Job Evaluation',  'display_order': 10},
    {'code': 'RECRUITMENT',         'name': 'Recruitment & Selection',                    'display_order': 20},
    {'code': 'TERMS_CONDITIONS',    'name': 'Terms & Conditions / Allowances & Claims',   'display_order': 30},
    {'code': 'EDUCATION_TRAINING',  'name': 'Education, Training & Development',           'display_order': 40},
    {'code': 'DISCIPLINE',          'name': 'Discipline & Grievance Management',           'display_order': 50},
    {'code': 'HOUSING',             'name': 'Housing Management',                          'display_order': 60},
    {'code': 'FLEET_VEHICLE',       'name': 'Government Fleet / Vehicle Management',       'display_order': 70},
    {'code': 'PERFORMANCE',         'name': 'Performance Management',                      'display_order': 80},
]

# (code, name, description, category_code, display_order)
FORM_TYPES = [
    # ── Organizational Structure & Job Evaluation ─────────────────────────────
    (
        'PSC 2-1',
        'PSC Form 2-1: Organization Restructure and/or Establishment Variation Submission – Standard Format',
        'Used for proposing new/revised structures, including background, proposal, costing table, implementation plan, '
        'and recommendations. Must be on Ministry letterhead with attachments (structures, job descriptions). (pp. 18–20)',
        'ORG_STRUCTURE', 10,
    ),
    (
        'PSC 2-2',
        'PSC Form 2-2: Public Service Commission – Job Description Form',
        'Competency-based form covering position title, purpose, reporting lines, contacts, contribution to NSDP, '
        'special conditions, and detailed selection criteria. (p. 21)',
        'ORG_STRUCTURE', 20,
    ),

    # ── Recruitment & Selection ───────────────────────────────────────────────
    (
        'PSC 3-1',
        'PSC Form 3-1: Approval to Advertise a Vacancy Form',
        'Approval request with job details and selection criteria. (p. 42)',
        'RECRUITMENT', 10,
    ),
    (
        'PSC 3-2',
        'PSC Form 3-2: Public Service Job Application Form',
        'Standard application with personal details, education, training, employment history, etc. (pp. 43–45)',
        'RECRUITMENT', 20,
    ),
    (
        'PSC 3-3',
        'PSC Form 3-3: Individual Applicant First Assessment Form',
        'Assesses each applicant against criteria. (pp. 46–47)',
        'RECRUITMENT', 30,
    ),
    (
        'PSC 3-4',
        'PSC Form 3-4: Comparative Assessment of Applicants Form',
        'Ranks shortlisted candidates. (p. 48)',
        'RECRUITMENT', 40,
    ),
    (
        'PSC 3-5',
        'PSC Form 3-5: Selection Outcome Report',
        'Recommends successful candidate(s). (p. 49)',
        'RECRUITMENT', 50,
    ),
    (
        'PSC 3-6',
        'PSC Form 3-6: Permanent Appointment Report',
        'For permanent appointments. (pp. 50–51)',
        'RECRUITMENT', 60,
    ),
    (
        'PSC 3-7',
        'PSC Form 3-7: Request to Employ Temporary Salaried, Daily Rated, or Contract Staff',
        'For non-permanent hires — temporary salaried employee, daily rated worker, or contract employee. (pp. 52–53)',
        'RECRUITMENT', 70,
    ),
    (
        'PSC 3-8',
        'PSC Form 3-8: Non-Disclosure Agreement',
        'Non-disclosure agreement for public service employees. (p. 54)',
        'RECRUITMENT', 80,
    ),
    (
        'PSC 3-9',
        'PSC Form 3-9: Code of Conduct',
        'Code of conduct acknowledgement form. (pp. 55–56)',
        'RECRUITMENT', 90,
    ),

    # ── Terms & Conditions / Allowances & Claims ──────────────────────────────
    (
        'PSC 4-1',
        'PSC Form 4-1: Overtime and Unsocial Hours Claim Form',
        '(p. 98)',
        'TERMS_CONDITIONS', 10,
    ),
    (
        'PSC 4-2',
        'PSC Form 4-2: Acting Allowance Application Form',
        '(pp. 100–101)',
        'TERMS_CONDITIONS', 20,
    ),
    (
        'PSC 4-3',
        'PSC Form 4-3: Domestic Travel Allowance Form',
        '(pp. 102–103)',
        'TERMS_CONDITIONS', 30,
    ),
    (
        'PSC 4-4',
        'PSC Form 4-4: Individual Overseas Travel Approval Form',
        '(pp. 104–106)',
        'TERMS_CONDITIONS', 40,
    ),
    (
        'PSC 4-5',
        'PSC Form 4-5: Mission Group Overseas Travel Approval Form',
        '(pp. 107–109)',
        'TERMS_CONDITIONS', 50,
    ),
    (
        'PSC 4-6',
        'PSC Form 4-6: Child Allowance Claim Form',
        '(pp. 110–111)',
        'TERMS_CONDITIONS', 60,
    ),
    (
        'PSC 4-7',
        'PSC Form 4-7: Application for Leave Form',
        '(p. 112)',
        'TERMS_CONDITIONS', 70,
    ),
    (
        'PSC 4-8',
        'PSC Form 4-8: Annual Leave Travel Claim',
        '(pp. 113–114)',
        'TERMS_CONDITIONS', 80,
    ),
    (
        'PSC 4-9',
        'PSC Form 4-9: Medical Expenses Claim Form',
        '(pp. 115–116)',
        'TERMS_CONDITIONS', 90,
    ),
    (
        'PSC 4-10',
        'PSC Form 4-10: Risk Allowance',
        '(pp. 117–118)',
        'TERMS_CONDITIONS', 100,
    ),

    # ── Education, Training & Development ────────────────────────────────────
    (
        'PSC 5-1',
        'PSC Form 5-1: Training Registration Form',
        'Employee details and course preferences. (pp. 143–144)',
        'EDUCATION_TRAINING', 10,
    ),
    (
        'PSC 5-2',
        'PSC Form 5-2: Development Programs Application',
        '(p. 145)',
        'EDUCATION_TRAINING', 20,
    ),

    # ── Discipline & Grievance Management ────────────────────────────────────
    (
        'PSC 6-1',
        'PSC Form 6-1: Staff Member Discipline Report',
        'Detailed misconduct report. (pp. 172–177)',
        'DISCIPLINE', 10,
    ),
    (
        'PSC 6-2',
        'PSC Form 6-2: Witness Form',
        '(pp. 178–179)',
        'DISCIPLINE', 20,
    ),
    (
        'PSC 6-3',
        'PSC Template 6-3: Notice of Allegations',
        'Template notice of allegations letter.',
        'DISCIPLINE', 30,
    ),
    (
        'PSC 6-4',
        'PSC Form 6-4: Progressive Disciplinary Action Form',
        '(pp. 181–182)',
        'DISCIPLINE', 40,
    ),
    (
        'PSC 6-5',
        'PSC Template 6-5: First Warning Letter',
        'Template first warning letter.',
        'DISCIPLINE', 50,
    ),
    (
        'PSC 6-6',
        'PSC Template 6-6: Second and Final Warning',
        'Template second and final warning letter.',
        'DISCIPLINE', 60,
    ),
    (
        'PSC 6-7',
        'PSC Template 6-7: Suspension Letter',
        'Template suspension letter.',
        'DISCIPLINE', 70,
    ),
    (
        'PSC 6-8',
        'PSC Form 6-8: Memorandum of Mediation',
        '(pp. 186–187)',
        'DISCIPLINE', 80,
    ),

    # ── Housing Management ────────────────────────────────────────────────────
    (
        'PSC 8-1',
        'PSC Form 8-1: Rented Housing Allowance Application Form',
        '(p. 210)',
        'HOUSING', 10,
    ),
    (
        'PSC 8-2',
        'PSC Form 8-2: Owned Housing Allowance Application Form',
        '(pp. 212–213)',
        'HOUSING', 20,
    ),
    (
        'PSC 8-3',
        'PSC Form 8-3: General Tenancy Agreement',
        '(pp. 214–216)',
        'HOUSING', 30,
    ),
    (
        'PSC 8-4',
        'PSC Form 8-4: Furniture Inventory Form',
        '(p. 217)',
        'HOUSING', 40,
    ),

    # ── Government Fleet / Vehicle Management ─────────────────────────────────
    (
        'PSC 9-1',
        'PSC Form 9-1: Use of Government Vehicle During Non-Official Hours',
        '(pp. 230–231)',
        'FLEET_VEHICLE', 10,
    ),
    (
        'PSC 9-2',
        'PSC Form 9-2: Unauthorised Use of Government Vehicles',
        '(p. 232)',
        'FLEET_VEHICLE', 20,
    ),
    (
        'PSC 9-3',
        'PSC Form 9-3: Vehicle Purchase Application Form',
        '(pp. 233–234)',
        'FLEET_VEHICLE', 30,
    ),
    (
        'PSC 9-4',
        'PSC Form 9-4: Vehicle Usage Agreement Form',
        '(p. 235)',
        'FLEET_VEHICLE', 40,
    ),
    (
        'PSC 9-5',
        'PSC Form 9-5: Incident Report',
        '(p. 237)',
        'FLEET_VEHICLE', 50,
    ),

    # ── Performance Management ────────────────────────────────────────────────
    (
        'PSC 10-1',
        'PSC Form 10-1: 3-Month Probationary Staff Member Performance Appraisal Form',
        '(pp. 263–266)',
        'PERFORMANCE', 10,
    ),
    (
        'PSC 10-2',
        'PSC Form 10-2: Staff Performance Appraisal Form',
        '(pp. 267–278)',
        'PERFORMANCE', 20,
    ),
    (
        'PSC 10-2abc',
        'PSC Form 10-2(a/b/c): Senior Executive Officer Performance Agreement',
        'Multiple variants for different levels. (pp. 279–329)',
        'PERFORMANCE', 30,
    ),
    (
        'PSC 10-3',
        'PSC Form 10-3: Public Service Award of Excellence (Nomination Form)',
        '(pp. 330–337)',
        'PERFORMANCE', 40,
    ),
    (
        'PSC 10-4a',
        'PSC Form 10-4(a): Performance Improvement Plan (PIP)',
        '(pp. 338–340)',
        'PERFORMANCE', 50,
    ),
    (
        'PSC 10-4b',
        'PSC Form 10-4(b): PIP Feedback Form',
        '(pp. 341–342)',
        'PERFORMANCE', 60,
    ),
    (
        'PSC 10-5',
        'PSC Form 10-5: 360-Degree Performance Evaluation Sample Form',
        '(pp. 343–345)',
        'PERFORMANCE', 70,
    ),
    (
        'PSC 10-6',
        'PSC Form 10-6: Audit of Performance Summary Form',
        '(pp. 346–347)',
        'PERFORMANCE', 80,
    ),
]


def seed(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    # 1. Seed categories
    cat_map = {}
    for cat_data in CATEGORIES:
        cat, _ = FormCategory.objects.get_or_create(
            code=cat_data['code'],
            defaults={'name': cat_data['name'], 'display_order': cat_data['display_order']},
        )
        # Update name/order if already existed with different values
        changed = False
        if cat.name != cat_data['name']:
            cat.name = cat_data['name']
            changed = True
        if cat.display_order != cat_data['display_order']:
            cat.display_order = cat_data['display_order']
            changed = True
        if changed:
            cat.save()
        cat_map[cat_data['code']] = cat

    # 2. Seed form types
    for (code, name, description, cat_code, display_order) in FORM_TYPES:
        category = cat_map[cat_code]
        ft, created = PSCFormType.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'description': description,
                'form_category': category,
                'is_digitized': code == 'PSC 3-7',
                'digitized_form_key': 'psc_3_7' if code == 'PSC 3-7' else '',
                'is_active': True,
                'display_order': display_order,
            },
        )
        if not created:
            # Update name, description, category, and display_order on existing records
            changed = False
            if ft.name != name:
                ft.name = name
                changed = True
            if ft.description != description:
                ft.description = description
                changed = True
            if ft.form_category_id != category.id:
                ft.form_category = category
                changed = True
            if ft.display_order != display_order:
                ft.display_order = display_order
                changed = True
            if changed:
                ft.save()


def unseed(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    codes = [row[0] for row in FORM_TYPES]
    # Don't delete PSC 3-7 — it has field definitions attached
    PSCFormType.objects.filter(code__in=codes).exclude(code='PSC 3-7').delete()

    cat_codes = [c['code'] for c in CATEGORIES]
    FormCategory.objects.filter(code__in=cat_codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0037_seed_psc_3_7_fields'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
