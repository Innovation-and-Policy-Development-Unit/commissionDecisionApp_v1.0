"""
PSC 2-1 and PSC 2-2 were seeded with is_digitized=False by
0038_seed_psc_form_types_full.py, even though both already have complete,
working dedicated wizard components (PSCForm21Fields.jsx/PSCForm22Fields.jsx,
matched purely by form_type_code in SubmissionDetail.jsx's isDedicatedForm
check — no dependency on this flag or on digitized_form_key).

SubmissionDetail.jsx's dynamic-form fetch effect gates on
`form_type_detail.is_digitized` before ever loading/rendering the digitized
form block, so with is_digitized=False these wizards have never actually
been reachable for a real submission — confirmed zero PSC 2-1/PSC 2-2
submissions and zero saved dynamic_form_response rows exist in the database.

Flipping this is a pure visibility fix: it doesn't touch PSCFormField rows
(there are none, same as ORG-3.1 — validate_dynamic_form_data() was fixed
in 0203's sibling migration to permit that) or digitized_form_key (left
blank; SubmissionDetail.jsx only special-cases it for the legacy 'psc_3_7'
key, irrelevant here).
"""
from django.db import migrations

FORM_TYPE_CODES = ["PSC 2-1", "PSC 2-2"]


def set_is_digitized(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code__in=FORM_TYPE_CODES).update(is_digitized=True)


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code__in=FORM_TYPE_CODES).update(is_digitized=False)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0204_add_restructure_agenda_section'),
    ]

    operations = [
        migrations.RunPython(set_is_digitized, revert),
    ]
