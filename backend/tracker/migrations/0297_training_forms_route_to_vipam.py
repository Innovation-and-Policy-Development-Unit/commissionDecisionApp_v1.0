"""Training submissions lodged by a ministry's HR officer belong to VIPAM.

PSC Form 5-1 (Training Registration) and PSC Form 5-2 (Development Programs
Application) are ministry-facing, but had no responsible unit. A ministry HR officer
who lodged one reached "Submitted" and stopped: auto-routing only fires when the form
type names a unit, so it sat waiting for someone at OPSC to route it by hand and
VIPAM's Manager never received it.

Routes both types to VIPAM, only where nobody has chosen a unit already, and sets the
unit on papers of those types still waiting at intake (nobody has started work on
them) so they reach VIPAM's Manager when routed. Papers already with a unit are left
alone. Counts are printed so the deploy log records what moved.

Reversible for the form types only; the submissions' unit is derived data.
"""
from django.db import migrations

CODES = ["PSC 5-1", "PSC 5-2"]
INTAKE_STAGES = ["submitted", "received_by_psc", "registered_routed"]


def route_to_vipam(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    Submission = apps.get_model("tracker", "Submission")

    types = PSCFormType.objects.filter(code__in=CODES, routed_unit="")
    moved = types.update(routed_unit="vipam")
    waiting = Submission.objects.filter(
        form_type_code__in=CODES, routed_unit="", current_stage__in=INTAKE_STAGES,
    ).update(routed_unit="vipam")
    print(f"  Training form types routed to VIPAM: {moved}; papers at intake re-routed: {waiting}")


def unroute(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormType.objects.filter(code__in=CODES, routed_unit="vipam").update(routed_unit="")


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0296_seo_progress_report_form"),
    ]

    operations = [migrations.RunPython(route_to_vipam, unroute)]
