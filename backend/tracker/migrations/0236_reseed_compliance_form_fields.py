"""Reseed COMP-* digitized form fields to match the actual PSC Submission Paper
templates supplied by the Compliance unit (structured Issue/Law/Discussion/
Recommendation/Endorsement sections, per-type background/allegations/findings
fields), replacing the earlier placeholder field schema.

No live submissions exist yet against COMP-* form types as of this migration
(the forward migration is a no-op guard against ever running destructively
against real response data — see seed_reverse in 0056 for the same pattern).
"""

from django.db import migrations


def reseed_forward(apps, schema_editor):
    from tracker.compliance_forms import seed_compliance_form_types

    seed_compliance_form_types(apps)


def reseed_reverse(apps, schema_editor):
    # Field-content-only change; nothing to revert beyond what 0056 already
    # governs (its reverse migration removes the form types entirely, if unused).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0235_compliance_form_types_routed_unit"),
    ]

    operations = [
        migrations.RunPython(reseed_forward, reseed_reverse),
    ]
