"""
Management command: rematerialize_compliance_stages

Drops and rebuilds ComplianceCaseStage rows for all (or specified) cases
from the current workflow templates. Use this after updating SLA values or
adding/removing stages in compliance_workflows.py.

Usage:
    manage.py rematerialize_compliance_stages           # all cases
    manage.py rematerialize_compliance_stages --dry-run # preview only
    manage.py rematerialize_compliance_stages --family employee_disciplinary
"""
from django.core.management.base import BaseCommand

from tracker.compliance_models import CaseFamily, ComplianceCase, ComplianceCaseStage
from tracker.compliance_workflows import materialize_stages, recompute_case_sla


class Command(BaseCommand):
    help = "Rebuild statutory stages for compliance cases from current workflow templates."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing.")
        parser.add_argument("--family", choices=[f.value for f in CaseFamily], help="Limit to one case family.")

    def handle(self, *args, **options):
        dry = options["dry_run"]
        qs = ComplianceCase.objects.all()
        if options["family"]:
            qs = qs.filter(case_family=options["family"])

        total = qs.count()
        self.stdout.write(f"{'[DRY RUN] ' if dry else ''}Processing {total} case(s)…")

        rebuilt = 0
        for case in qs.iterator():
            old_count = case.stages.count()
            if not dry:
                ComplianceCaseStage.objects.filter(case=case).delete()
                created = materialize_stages(case)
                recompute_case_sla(case)
            else:
                from tracker.compliance_workflows import get_stages_for_family
                created = len(get_stages_for_family(case.case_family))

            self.stdout.write(
                f"  {case.submission.reference_number} | {case.case_family} | "
                f"old={old_count} stages → new={created} stages"
            )
            rebuilt += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n{'[DRY RUN] Would rebuild' if dry else 'Rebuilt'} stages for {rebuilt}/{total} case(s)."
        ))
