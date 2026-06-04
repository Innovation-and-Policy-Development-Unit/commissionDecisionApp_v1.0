"""Backfill / validate statutory stage timelines for compliance cases.

The stage templates themselves live in code (``tracker.compliance_workflows``), so
there is no reference data to seed. This command:

  * prints a summary of each case family's stage count and total SLA, and
  * materialises stages for any existing ``ComplianceCase`` that has none
    (useful after importing legacy cases or adding the feature to live data).

Idempotent: cases that already have stages are left untouched.
"""

from django.core.management.base import BaseCommand

from tracker.compliance_models import ComplianceCase
from tracker.compliance_workflows import (
    WORKFLOW_STAGES,
    materialize_stages,
)


class Command(BaseCommand):
    help = "Summarise compliance stage templates and backfill stages on cases that have none."

    def add_arguments(self, parser):
        parser.add_argument(
            "--backfill", action="store_true",
            help="Materialise stages for existing cases that have no stages yet.",
        )

    def handle(self, *args, **opts):
        self.stdout.write(self.style.MIGRATE_HEADING("Compliance case families:"))
        for family, stages in WORKFLOW_STAGES.items():
            wd = sum(s["sla_days"] for s in stages if s["is_working_days"])
            cd = sum(s["sla_days"] for s in stages if not s["is_working_days"])
            self.stdout.write(
                f"  {family:<32} {len(stages):>2} stages · "
                f"{wd} working-day + {cd} calendar-day SLA"
            )

        if not opts["backfill"]:
            self.stdout.write("\nRun with --backfill to create stages on cases that have none.")
            return

        created_cases = 0
        created_stages = 0
        for case in ComplianceCase.objects.all():
            n = materialize_stages(case)
            if n:
                created_cases += 1
                created_stages += n
        self.stdout.write(self.style.SUCCESS(
            f"\nBackfilled {created_stages} stage(s) across {created_cases} case(s)."
        ))
