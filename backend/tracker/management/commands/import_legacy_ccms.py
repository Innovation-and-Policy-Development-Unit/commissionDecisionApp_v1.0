"""
Import cases from the standalone CCMS into SCDMS (one-off, Phase 6).

The standalone CCMS has been merged into SCDMS; this command migrates any *live*
cases it still holds. It reads a JSON export produced by the old CCMS
(``manage.py dumpdata cases`` style, or its ``/api/v1/cases/{id}/scdms-export/``
payloads collected into a list) and recreates each case natively in SCDMS:

  CCMS Case            → Submission (internal, Compliance) + ComplianceCase
  CCMS CaseStage       → ComplianceCaseStage
  CCMS Decision/notes  → CaseNote
  CCMS LitigationRecord→ LitigationRecord

Usage::

    python manage.py import_legacy_ccms /path/to/ccms_export.json          # dry-run
    python manage.py import_legacy_ccms /path/to/ccms_export.json --apply   # commit

Expected JSON: a list of objects, each like::

    {
      "reference_number": "CASE-2026-0001",
      "case_family": "employee_disciplinary",
      "subject_name": "...", "subject_position": "...", "subject_ministry": "...",
      "is_senior_executive": false,
      "status": "active", "description": "...", "date_received": "2026-02-01",
      "stages": [ {"stage_name": "...", "stage_order": 1, "stage_code": "...",
                   "responsible_role": "...", "statutory_ref": "...",
                   "sla_days": 5, "sla_working_days": true, "due_date": "2026-02-08",
                   "status": "completed", "sla_status": "completed",
                   "is_optional": false, "notes": "..."} ],
      "litigation_records": [ {"description": "...", "status": "active",
                   "estimated_cost": "150000.00", "date_initiated": "2026-03-01"} ],
      "notes": [ {"text": "...", "created_at": "2026-02-02T10:00:00Z"} ]
    }

Idempotent: a case whose subject + family already exists is skipped.
"""

import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from tracker.compliance_models import (
    CaseFamily,
    CaseNote,
    ComplianceCase,
    ComplianceCaseStage,
    LitigationRecord,
)
from tracker.compliance_actions import _opsc_ministry
from tracker.models import (
    FormCategory,
    PSCFormType,
    RoutedUnit,
    Submission,
    WorkflowStage,
)
from tracker.compliance_forms import COMPLIANCE_CATEGORY_CODE


class Command(BaseCommand):
    help = "Import legacy standalone-CCMS cases into SCDMS (dry-run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument("export_path", help="Path to the CCMS JSON export file.")
        parser.add_argument("--apply", action="store_true", help="Commit (default: dry-run).")

    def handle(self, *args, **opts):
        try:
            with open(opts["export_path"], encoding="utf-8") as fh:
                cases = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Could not read export: {exc}")

        if not isinstance(cases, list):
            raise CommandError("Export must be a JSON list of case objects.")

        ministry = _opsc_ministry()
        if not ministry:
            raise CommandError("OPSC ministry is not configured in SCDMS.")

        category = FormCategory.objects.filter(code=COMPLIANCE_CATEGORY_CODE).first()
        valid_families = set(CaseFamily.values)

        created, skipped = 0, 0
        apply = opts["apply"]

        for raw in cases:
            family = (raw.get("case_family") or "").strip()
            subject = (raw.get("subject_name") or "").strip()
            if family not in valid_families:
                self.stderr.write(f"  skip (unknown family {family!r}) — {subject}")
                skipped += 1
                continue
            if ComplianceCase.objects.filter(subject_name=subject, case_family=family).exists():
                skipped += 1
                continue

            self.stdout.write(f"  + {subject} [{family}] "
                              f"({len(raw.get('stages', []))} stages, "
                              f"{len(raw.get('litigation_records', []))} litigation, "
                              f"{len(raw.get('notes', []))} notes)")
            created += 1
            if not apply:
                continue

            with transaction.atomic():
                self._import_case(raw, ministry, category)

        verb = "Imported" if apply else "Would import"
        self.stdout.write(self.style.SUCCESS(
            f"\n{verb} {created} case(s); skipped {skipped}."
            + ("" if apply else "  Re-run with --apply to commit.")
        ))

    def _import_case(self, raw, ministry, category):
        form_code = raw.get("form_type_code") or "COMP-SMDR"
        ft = PSCFormType.objects.filter(code=form_code, is_active=True).first()
        sub = Submission.objects.create(
            title=(raw.get("title") or raw.get("subject_name") or "Compliance matter")[:255],
            form_type_code=form_code,
            form_category=(ft.form_category if ft else category),
            ministry=ministry,
            routed_unit=RoutedUnit.COMPLIANCE,
            is_internal=True,
            current_stage=WorkflowStage.SECRETARY_REVIEW,
            received_at=timezone.now(),
            notes=raw.get("description", ""),
            created_by=get_user_model().objects.filter(is_superuser=True).first(),
            agenda_category="discipline_compliance",
        )
        # Suppress the auto-materialise signal by pre-marking: create case then replace stages.
        case = ComplianceCase.objects.create(
            submission=sub,
            case_family=raw["case_family"],
            subject_name=raw.get("subject_name", ""),
            subject_position=raw.get("subject_position", ""),
            subject_ministry=raw.get("subject_ministry", ""),
            is_senior_executive=bool(raw.get("is_senior_executive")),
            status=raw.get("status", "active"),
            description=raw.get("description", ""),
            date_received=raw.get("date_received") or timezone.localdate(),
        )
        # Replace auto-generated stages with the imported ones if provided.
        imported_stages = raw.get("stages") or []
        if imported_stages:
            case.stages.all().delete()
            ComplianceCaseStage.objects.bulk_create([
                ComplianceCaseStage(
                    case=case,
                    stage_name=s.get("stage_name", ""),
                    stage_code=s.get("stage_code", ""),
                    stage_order=s.get("stage_order", i + 1),
                    responsible_role=s.get("responsible_role", ""),
                    statutory_ref=s.get("statutory_ref", ""),
                    sla_days=s.get("sla_days"),
                    sla_working_days=bool(s.get("sla_working_days", True)),
                    due_date=s.get("due_date"),
                    status=s.get("status", "pending"),
                    sla_status=s.get("sla_status", "on_track"),
                    is_optional=bool(s.get("is_optional")),
                    notes=s.get("notes", ""),
                )
                for i, s in enumerate(imported_stages)
            ])
        for lit in raw.get("litigation_records") or []:
            LitigationRecord.objects.create(
                case=case,
                description=lit.get("description", ""),
                legal_counsel=lit.get("legal_counsel", ""),
                court_reference=lit.get("court_reference", ""),
                status=lit.get("status", "active"),
                estimated_cost=lit.get("estimated_cost"),
                actual_cost=lit.get("actual_cost"),
                date_initiated=lit.get("date_initiated") or timezone.localdate(),
                date_resolved=lit.get("date_resolved"),
                notes=lit.get("notes", ""),
            )
        for note in raw.get("notes") or []:
            CaseNote.objects.create(case=case, text=note.get("text", ""))
