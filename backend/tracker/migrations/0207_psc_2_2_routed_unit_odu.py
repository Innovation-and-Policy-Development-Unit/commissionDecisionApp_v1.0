"""
PSC 2-2 (Job Description Form) had no PSCFormType.routed_unit set, and isn't
in intake_routing.py's legacy fallback dict either (only ORG-3.1 / PSC 2-1
are) — so routed_unit_for_form_type("PSC 2-2") returned None, which made
_auto_advance_submitted_to_checklist_review() silently no-op. A DG-endorsed
PSC 2-2 submission would get stuck at SUBMITTED forever, never routed to
ODU for checklist review — the same "stuck submission" failure mode found
and fixed for ORG-3.1 earlier, here caused by missing routing config rather
than a crash.
"""
from django.db import migrations


def apply_routed_unit(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code='PSC 2-2').update(routed_unit='odu')


def revert(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code='PSC 2-2').update(routed_unit='')


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0206_psc_2_2_required_documents'),
    ]

    operations = [
        migrations.RunPython(apply_routed_unit, revert),
    ]
