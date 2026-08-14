"""Set routed_unit='compliance' on the six COMP-* form types.

These were digitized (0056_compliance_unit_submissions.py) with proper
PSCFormField schemas, but routed_unit was never set, so a submission created
with one of these form types would never actually route to the Compliance
unit's checklist-review queue.
"""

from django.db import migrations

COMP_FORM_CODES = [
    "COMP-SMDR", "COMP-PAR", "COMP-PSDB", "COMP-14D", "COMP-OMB", "COMP-PSA",
]


def set_routed_unit(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.filter(code__in=COMP_FORM_CODES).update(routed_unit="compliance")


def unset_routed_unit(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.filter(code__in=COMP_FORM_CODES).update(routed_unit="")


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0234_disable_session_pin"),
    ]

    operations = [
        migrations.RunPython(set_routed_unit, unset_routed_unit),
    ]
