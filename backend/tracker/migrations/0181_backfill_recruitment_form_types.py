"""
Backfill/repair migration.

Migration 0157 seeded the RECRUIT-PROBATION / RECRUIT-CONFIRM / RECRUIT-DIRECT /
RECRUIT-TEMPORARY / RECRUIT-CONTRACT form types by looking up a FormCategory with
code='RECRUITMENT'. That category was deleted by migration 0051 (before 0157 ever
ran) and never recreated, so on any environment that applied migrations in order
from a clean database, 0157's seed_data() hit its guard clause and returned
immediately — none of those five form types, their fields, or their required-
document checklists were ever created.

0157 has since been fixed to self-heal (recreate the category instead of bailing
out), which is enough for brand-new databases. This migration repairs any
database where 0157 already ran and no-opped, by re-invoking the same seeding
logic idempotently (get_or_create throughout, safe to run whether or not any of
this already exists).
"""
from importlib import import_module

from django.db import migrations


def backfill(apps, schema_editor):
    src = import_module('tracker.migrations.0157_seed_recruitment_submission_paper_types')

    FormCategory     = apps.get_model('tracker', 'FormCategory')
    PSCFormType      = apps.get_model('tracker', 'PSCFormType')
    PSCFormField     = apps.get_model('tracker', 'PSCFormField')
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')

    recruitment_cat, _ = FormCategory.objects.get_or_create(
        code='RECRUITMENT',
        defaults={'name': 'Recruitment & Selection', 'display_order': 20},
    )

    ft_map = {}
    for ft in src.NEW_FORM_TYPES:
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

    for code, fields in src.FORM_FIELDS.items():
        ft_obj = ft_map.get(code)
        if not ft_obj:
            continue
        for fdata in fields:
            PSCFormField.objects.get_or_create(
                form_type=ft_obj,
                field_key=fdata['field_key'],
                defaults={k: v for k, v in fdata.items() if k != 'field_key'},
            )

    for code, docs in src.REQUIRED_DOCS.items():
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


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0180_documentsignature_auth_method_and_more'),
        ('tracker', '0157_seed_recruitment_submission_paper_types'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
