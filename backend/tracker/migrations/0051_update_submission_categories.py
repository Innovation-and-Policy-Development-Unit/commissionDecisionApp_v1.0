from django.db import migrations

NEW_CATEGORIES = [
    ("discipline_compliance", "3. Discipline / Compliance",                         30),
    ("health_commission",     "4. Health Commission",                               40),
    ("appointment",           "5. Appointment / Acting Appointment",                50),
    ("direct_appointment",    "6. Direct Appointment / Confirmation of Appointment", 60),
    ("extra_responsibility",  "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance", 70),
    ("contract",              "8. Contract / Temporary Salaried Appointment",       80),
    ("temporary_salaried",    "9. Temporary Salaried Appointment",                  90),
    ("salary_adjustment",     "10. Salary Adjustment",                             100),
    ("training",              "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment", 110),
    ("medical_claim",         "12. Medical Claim",                                 120),
    ("partial_severance",     "13. Partial Severance",                             130),
    ("resignation",           "14. Resignation / Retirement / Death",               140),
    ("other",                 "15. Other Matters",                                 999),
]

CATEGORY_MAPPING = {
    'discipline':             'discipline_compliance',
    'recruitment':            'appointment',
    'training_development':   'training',
    'organisation_structure': 'appointment',
    'leave_travel':           'other',
    'allowances_claims':      'extra_responsibility',
    'housing_vehicles':       'other',
    'performance':            'other',
    'OEM':                    'appointment',
    'REC':                    'appointment',
    'TCE':                    'extra_responsibility',
    'MET':                    'training',
    'MSD':                    'discipline_compliance',
    'MGRH':                   'other',
    'MGF':                    'other',
    'PM':                     'other',
}

def update_categories(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    Submission = apps.get_model('tracker', 'Submission')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    # 1. Create new categories
    cat_objs = {}
    new_codes = [c[0] for c in NEW_CATEGORIES]
    for code, name, order in NEW_CATEGORIES:
        obj, _ = FormCategory.objects.update_or_create(
            code=code,
            defaults={'name': name, 'display_order': order}
        )
        cat_objs[code] = obj

    # 2. Map existing submissions to new categories using explicit mapping
    for old_code, new_code in CATEGORY_MAPPING.items():
        try:
            old_cat = FormCategory.objects.get(code=old_code)
            new_cat = cat_objs[new_code]
            Submission.objects.filter(form_category=old_cat).update(form_category=new_cat)
            PSCFormType.objects.filter(form_category=old_cat).update(form_category=new_cat)
        except FormCategory.DoesNotExist:
            continue

    # 3. Safety fallback: map ANY remaining submissions/types to 'other' before deletion
    other_cat = cat_objs['other']
    Submission.objects.exclude(form_category__code__in=new_codes).update(form_category=other_cat)
    PSCFormType.objects.exclude(form_category__code__in=new_codes).update(form_category=other_cat)

    # 4. Cleanup old categories
    FormCategory.objects.exclude(code__in=new_codes).delete()

def reverse_categories(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('tracker', '0050_restructure_submission_data'),
    ]
    operations = [
        migrations.RunPython(update_categories, reverse_categories),
    ]
