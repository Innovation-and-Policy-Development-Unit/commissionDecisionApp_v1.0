from django.db import migrations

CATEGORIES = [
    {'code': 'OEM',  'name': 'Organizational Establishment and Management', 'display_order': 1},
    {'code': 'REC',  'name': 'Recruitment',                                 'display_order': 2},
    {'code': 'TCE',  'name': 'Terms and Conditions of Employment',          'display_order': 3},
    {'code': 'MET',  'name': 'Management of Education and Training',        'display_order': 4},
    {'code': 'MSD',  'name': 'Managing Staff Discipline',                   'display_order': 5},
    {'code': 'MGRH', 'name': 'Managing Government Residential Housing',     'display_order': 6},
    {'code': 'MGF',  'name': 'Managing Government Fleet',                   'display_order': 7},
    {'code': 'PM',   'name': 'Performance Management',                      'display_order': 8},
]

# Maps PSCFormType.code → category code
FORM_TYPE_CATEGORY = {
    'PSC 2-1':      'OEM',
    'PSC 2-2':      'OEM',
    'PSC 3-1':      'REC',
    'PSC 3-2':      'REC',
    'PSC 3-3':      'REC',
    'PSC 3-4':      'REC',
    'PSC 3-5':      'REC',
    'PSC 3-6':      'REC',
    'PSC 3-7':      'REC',
    'PSC 3-8':      'REC',
    'PSC 3-9':      'REC',
    'PSC 4-1':      'TCE',
    'PSC 4-2':      'TCE',
    'PSC 4-3':      'TCE',
    'PSC 4-4':      'TCE',
    'PSC 4-5':      'TCE',
    'PSC 4-6':      'TCE',
    'PSC 4-7':      'TCE',
    'PSC 4-8':      'TCE',
    'PSC 4-9':      'TCE',
    'PSC 4-10':     'TCE',
    'PSC 5-1':      'MET',
    'PSC 5-2':      'MET',
    'PSC 6-1':      'MSD',
    'PSC 6-2':      'MSD',
    'PSC 6-3':      'MSD',
    'PSC 6-4':      'MSD',
    'PSC 6-5':      'MSD',
    'PSC 6-6':      'MSD',
    'PSC 6-7':      'MSD',
    'PSC 6-8':      'MSD',
    'PSC 8-1':      'MGRH',
    'PSC 8-2':      'MGRH',
    'PSC 8-3':      'MGRH',
    'PSC 8-4':      'MGRH',
    'PSC 9-1':      'MGF',
    'PSC 9-2':      'MGF',
    'PSC 9-3':      'MGF',
    'PSC 9-4':      'MGF',
    'PSC 9-5':      'MGF',
    'PSC 10-1':     'PM',
    'PSC 10-2':     'PM',
    'PSC 10-2(a)':  'PM',
    'PSC 10-2(b)':  'PM',
    'PSC 10-2(c)':  'PM',
    'PSC 10-3':     'PM',
    'PSC 10-4(a)':  'PM',
    'PSC 10-4(b)':  'PM',
    'PSC 10-5':     'PM',
    'PSC 10-6':     'PM',
}


def reset_categories(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    Submission = apps.get_model('tracker', 'Submission')

    # 1. Upsert the canonical categories (create if missing, update if already present).
    #    We do NOT delete first — submissions have a NOT NULL FK so we must always have
    #    a valid category for every row.
    cat_map = {}
    for cat in CATEGORIES:
        obj, _ = FormCategory.objects.update_or_create(
            code=cat['code'],
            defaults={'name': cat['name'], 'display_order': cat['display_order']},
        )
        cat_map[cat['code']] = obj

    # 2. Re-link PSCFormType rows to their correct canonical category
    PSCFormType.objects.all().update(form_category=None)
    for form_code, cat_code in FORM_TYPE_CATEGORY.items():
        PSCFormType.objects.filter(code=form_code).update(
            form_category=cat_map[cat_code]
        )

    # 3. Re-link submissions via their form_type_code
    for submission in Submission.objects.exclude(form_type_code=''):
        cat_code = FORM_TYPE_CATEGORY.get(submission.form_type_code)
        if cat_code and cat_code in cat_map:
            Submission.objects.filter(pk=submission.pk).update(form_category=cat_map[cat_code])

    # 4. Delete old categories that have no submissions still referencing them.
    #    Submissions with unrecognised form_type_codes (e.g. dot-notation legacy codes)
    #    may still point to old category rows, so we only remove truly orphaned ones.
    canonical_codes = {c['code'] for c in CATEGORIES}
    for old_cat in FormCategory.objects.exclude(code__in=canonical_codes):
        if not Submission.objects.filter(form_category=old_cat).exists():
            old_cat.delete()


def reverse_reset(apps, schema_editor):
    # Non-destructive reverse: just clear categories (data already gone)
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.all().update(form_category=None)
    FormCategory.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0038_seed_psc_form_types_full'),
    ]

    operations = [
        migrations.RunPython(reset_categories, reverse_reset),
    ]
