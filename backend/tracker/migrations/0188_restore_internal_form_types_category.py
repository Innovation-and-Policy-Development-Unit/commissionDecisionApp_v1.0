"""
Verification finding: the CSU/ODU/VIPAM internal-submission form
(InternalSubmissionForm) filters its "Submission type" dropdown by matching
each form type's form_category against the 'INTERNAL' FormCategory:

    const internalFormTypesResolved = formTypes.filter(ft => {
      const cat = categories.find(c => String(c.id) === String(ft.form_category))
      return cat?.code === 'INTERNAL' || cat?.name === 'Internal Submissions'
    })

Migration 0046 created the 8 INT-1..INT-8 form types under that category —
but migration 0051's category reshuffle (unrelated to internal submissions;
it was reworking the agenda-category scheme) swept every form type not in
its own new 13-category list into a generic 'other' bucket, including these,
since 'INTERNAL' wasn't among the codes it preserved. The FormCategory row
itself survived (it's still there, id-stable), just orphaned of every form
type that used to point to it.

Net effect, confirmed live: the internal-submission dropdown resolves to
zero options for every CSU/ODU/VIPAM manager, and the form's own client-side
validation ("Please select a submission type.") blocks submission before a
request is ever sent — nothing to do with any digitized-form work this
session, just an unrelated, unnoticed side effect from 0051. Restoring the
form_category link is the correct, minimal fix — no frontend change needed.
"""
from django.db import migrations

INTERNAL_CODES = ['INT-1', 'INT-2', 'INT-3', 'INT-4', 'INT-5', 'INT-6', 'INT-7', 'INT-8']


def restore(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    internal_cat = FormCategory.objects.filter(code='INTERNAL').first()
    if not internal_cat:
        internal_cat = FormCategory.objects.create(
            code='INTERNAL', name='Internal Submissions',
            psc_forms_summary='OPSC internal submissions routed directly to the Secretary.',
            display_order=99,
        )
    PSCFormType.objects.filter(code__in=INTERNAL_CODES).update(form_category=internal_cat)


def unrestore(apps, schema_editor):
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    other_cat = FormCategory.objects.filter(code='other').first()
    if other_cat:
        PSCFormType.objects.filter(code__in=INTERNAL_CODES).update(form_category=other_cat)


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0187_retire_psc_4_9_superseded_by_medical_claim'),
    ]

    operations = [
        migrations.RunPython(restore, unrestore),
    ]
