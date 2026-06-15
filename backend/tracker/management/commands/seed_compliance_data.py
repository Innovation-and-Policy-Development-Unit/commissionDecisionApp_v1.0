"""Seed realistic compliance cases, complaints, litigation records, and case notes.

Usage:
    python manage.py seed_compliance_data              # skip if data already exists
    python manage.py seed_compliance_data --clear      # wipe compliance data first, then re-seed
    python manage.py seed_compliance_data --force      # add another set on top of existing data

Idempotent by default: does nothing if ComplianceCase or Complaint records already exist.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tracker.compliance_models import (
    CaseFamily,
    CaseNote,
    ComplianceCase,
    ComplianceCaseStage,
    Complaint,
    ComplaintStatus,
    LitigationRecord,
    SLAStatus,
    StageStatus,
)
from tracker.compliance_workflows import materialize_stages
from tracker.models import FormCategory, Ministry, Submission


# ── Sample data ───────────────────────────────────────────────────────────────

# (family, subject_name, position, ministry_code, is_senior, title, days_ago, sla_override)
# sla_override: None = on_track, 'at_risk' = some stages at risk, 'overdue' = some overdue
CASES = [
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "John Taroa", "Senior Administrative Officer", "MFEM", False,
        "Repeated unexplained absence from duty",
        45, "on_track",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Marie Kalsakau", "Finance Officer", "MOH", False,
        "Misuse of government vehicle",
        90, "at_risk",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Peter Vira", "IT Support Officer", "MIPU", False,
        "Alleged theft of office equipment",
        30, "overdue",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Roselyn Maki", "Accounts Clerk", "MFEM", False,
        "Falsification of travel claim records",
        120, "on_track",
    ),
    (
        CaseFamily.TEMPORARY_SUSPENSION,
        "Samuel Livo", "Senior Engineer", "MIPU", False,
        "Suspension pending investigation — workplace violence allegation",
        14, "at_risk",
    ),
    (
        CaseFamily.GRIEVANCE,
        "Grace Naupa", "Policy Analyst", "MPM", False,
        "Grievance against Director — unfair performance assessment",
        20, "on_track",
    ),
    (
        CaseFamily.GRIEVANCE,
        "Thomas Bong", "HR Officer", "MIA", False,
        "Grievance — denial of leave entitlement",
        60, "overdue",
    ),
    (
        CaseFamily.SENIOR_SERIOUS_MISCONDUCT,
        "Dr. Henry Siri", "Director General", "MOH", True,
        "Serious misconduct — financial mismanagement allegation",
        35, "overdue",
    ),
    (
        CaseFamily.SENIOR_SERIOUS_MISCONDUCT,
        "Margaret Tavoa", "Director of Finance", "MFEM", True,
        "Alleged improper procurement authorisation",
        18, "at_risk",
    ),
    (
        CaseFamily.SENIOR_POOR_PERFORMANCE,
        "Robert Aru", "Director General", "MET", True,
        "Persistent failure to meet performance targets — 2024/2025",
        70, "on_track",
    ),
    (
        CaseFamily.TEMPORARY_SUSPENSION,
        "Alice Tari", "Records Officer", "MJCS", False,
        "Suspension — breach of confidentiality obligation",
        7, "on_track",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Ben Lapi", "Customs Officer", "MTTCNB", False,
        "Insubordination and disrespectful conduct towards supervisor",
        55, "overdue",
    ),
]

# Complaints (family, title, subject_name, ministry_code, status, closed_reason)
COMPLAINTS = [
    ("employee_disciplinary", "Complaint — Officer refusing to carry out lawful instructions",
     "James Nako", "MALFB", ComplaintStatus.RECEIVED, ""),
    ("serious_misconduct_employee", "Complaint — Harassment of junior staff member",
     "Sarah Wai", "MOH", ComplaintStatus.UNDER_REVIEW, ""),
    ("grievance", "Complaint — Acting allowance not paid for 6 months",
     "Paul Tabi", "MFEM", ComplaintStatus.ACCEPTED, ""),
    ("employee_disciplinary", "Complaint — Abusive language in the workplace",
     "Lena Moli", "MCCA", ComplaintStatus.REJECTED,
     "Insufficient evidence provided to support the allegation. Complainant advised to resubmit with supporting documentation."),
    ("temporary_suspension", "Complaint — Officer absent without leave for 3 weeks",
     "David Karu", "MIA", ComplaintStatus.RECEIVED, ""),
    ("serious_misconduct_employee", "Complaint — Suspected fraud in subsistence claim",
     "Vera Paton", "MIPU", ComplaintStatus.CONVERTED, ""),
]

# Litigation records: (case_index, description, counsel, court_ref, status, est_cost, actual_cost)
LITIGATION = [
    (7, "Judicial review — DG challenging removal order",
     "State Law Office", "CC-2026-0041",
     LitigationRecord.LitigationStatus.ACTIVE, 850000, None),
    (2, "Employment tribunal — wrongful suspension claim",
     "Boulekone & Associates", "ET-2025-0178",
     LitigationRecord.LitigationStatus.SETTLED, 240000, 185000),
    (3, "Criminal referral — theft of equipment",
     "Police Prosecution Unit", "CR-2026-0012",
     LitigationRecord.LitigationStatus.ACTIVE, 120000, 45000),
    (8, "Supreme Court — challenge to misconduct finding",
     "State Law Office", "CC-2026-0055",
     LitigationRecord.LitigationStatus.ACTIVE, 1200000, None),
]

# Case notes: (case_index, text)
NOTES = [
    (0, "Notice of allegation served by hand on 14 April 2026. Subject acknowledged receipt."),
    (0, "Investigation committee constituted — three members appointed. First sitting scheduled for 28 April 2026."),
    (2, "HR Director confirmed laptop serial number matches the missing asset register entry."),
    (2, "Subject denies allegation. Submitted written response on 15 May 2026 with supporting witness statements."),
    (7, "Commission reviewed preliminary assessment. Panel of three appointed — chaired by retired public servant."),
    (7, "Panel has requested additional financial records from MFEM. 14-day extension approved by Secretary."),
    (8, "Director presented a written rebuttal to the investigation report. Legal counsel engaged."),
    (11, "First warning issued 3 February 2025 — on record. Second allegation within 12 months triggers SMDR pathway."),
]


class Command(BaseCommand):
    help = "Seed compliance cases, complaints, litigation records, and case notes for development."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Delete all compliance data before seeding.")
        parser.add_argument("--force", action="store_true", help="Seed even if data already exists.")

    def handle(self, *args, **opts):
        if opts["clear"]:
            self._clear()

        if not opts["force"] and not opts["clear"]:
            if ComplianceCase.objects.exists() or Complaint.objects.exists():
                self.stdout.write(
                    "  [SKIP] Compliance data already present. "
                    "Use --clear to wipe and re-seed, or --force to add more."
                )
                return

        self._seed_cases()
        self._seed_complaints()
        self.stdout.write(self.style.SUCCESS("\nCompliance seed complete."))

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _clear(self):
        LitigationRecord.objects.all().delete()
        CaseNote.objects.all().delete()
        ComplianceCaseStage.objects.all().delete()
        ComplianceCase.objects.all().delete()
        Complaint.objects.all().delete()
        # Remove compliance submissions (is_internal + COMP- form codes)
        Submission.objects.filter(form_type_code__startswith="COMP-").delete()
        self.stdout.write(self.style.WARNING("  [CLEAR] Compliance data wiped."))

    def _seed_cases(self):
        # Resolve helpers
        ministry_map = {m.code: m for m in Ministry.objects.all()}
        category = FormCategory.objects.filter(code="discipline_compliance").first()
        officer = (
            User.objects.filter(psc_profile__role__in=["compliance_manager", "compliance_principal", "psc_admin"])
            .select_related("psc_profile")
            .first()
        )
        if not officer:
            officer = User.objects.filter(is_staff=True).first()
        if not officer:
            self.stdout.write(self.style.ERROR("  No staff user found — run seed_tracker first."))
            return

        today = timezone.localdate()
        created = 0

        for i, (family, subject, position, min_code, is_senior, title, days_ago, sla_hint) in enumerate(CASES):
            ministry = ministry_map.get(min_code)
            date_received = today - timedelta(days=days_ago)

            with transaction.atomic():
                sub = Submission(
                    title=title,
                    form_category=category,
                    form_type_code="COMP-SMDR",
                    ministry=ministry,
                    current_stage="active",
                    received_at=timezone.make_aware(
                        timezone.datetime.combine(date_received, timezone.datetime.min.time())
                    ),
                    created_by=officer,
                    is_internal=True,
                    notes="",
                )
                sub.save()

                case = ComplianceCase.objects.create(
                    submission=sub,
                    case_family=family,
                    subject_name=subject,
                    subject_position=position,
                    subject_ministry=ministry.name if ministry else min_code,
                    is_senior_executive=is_senior,
                    description=title,
                    date_received=date_received,
                )

                # Materialise statutory stages
                materialize_stages(case)

                # Apply SLA hints to make the dashboard interesting
                self._apply_sla_hint(case, sla_hint)

            created += 1

        # Attach litigation and notes by case index
        cases_qs = list(ComplianceCase.objects.order_by("created_at"))

        for case_idx, desc, counsel, court_ref, status, est, actual in LITIGATION:
            if case_idx < len(cases_qs):
                LitigationRecord.objects.create(
                    case=cases_qs[case_idx],
                    description=desc,
                    legal_counsel=counsel,
                    court_reference=court_ref,
                    status=status,
                    estimated_cost=est,
                    actual_cost=actual,
                    date_initiated=today - timedelta(days=14),
                )

        for case_idx, text in NOTES:
            if case_idx < len(cases_qs):
                CaseNote.objects.create(
                    case=cases_qs[case_idx],
                    author=officer,
                    text=text,
                )

        self.stdout.write(f"  [OK] {created} compliance cases seeded")

    def _apply_sla_hint(self, case, hint):
        """Mark some stages as overdue/at_risk to make dashboard views non-trivial."""
        stages = list(case.stages.order_by("stage_order"))
        if not stages:
            return

        if hint == "overdue":
            # Mark first two stages completed, next one overdue
            for s in stages[:2]:
                s.status = StageStatus.COMPLETED
                s.sla_status = SLAStatus.COMPLETED
                s.completed_at = timezone.now() - timedelta(days=5)
            if len(stages) > 2:
                s = stages[2]
                s.status = StageStatus.IN_PROGRESS
                s.sla_status = SLAStatus.OVERDUE
                s.due_date = date.today() - timedelta(days=3)
            ComplianceCaseStage.objects.bulk_update(
                stages[:3], ["status", "sla_status", "completed_at", "due_date"]
            )

        elif hint == "at_risk":
            # Mark first stage completed, next one at risk
            if stages:
                s = stages[0]
                s.status = StageStatus.COMPLETED
                s.sla_status = SLAStatus.COMPLETED
                s.completed_at = timezone.now() - timedelta(days=2)
                s.save(update_fields=["status", "sla_status", "completed_at"])
            if len(stages) > 1:
                s = stages[1]
                s.status = StageStatus.IN_PROGRESS
                s.sla_status = SLAStatus.AT_RISK
                s.due_date = date.today() + timedelta(days=1)
                s.save(update_fields=["status", "sla_status", "due_date"])

    def _seed_complaints(self):
        ministry_map = {m.code: m for m in Ministry.objects.all()}
        officer = (
            User.objects.filter(psc_profile__role__in=["compliance_manager", "compliance_principal"])
            .first()
        )
        ministry_user = User.objects.filter(psc_profile__role__in=["head_of_agency", "ministry_hr"]).first()

        created = 0
        for family, title, subject_name, min_code, status, closed_reason in COMPLAINTS:
            ministry = ministry_map.get(min_code)
            c = Complaint.objects.create(
                title=title,
                description=f"Ministry referral: {title}",
                lodged_by=ministry_user,
                ministry=ministry,
                subject_name=subject_name,
                subject_position="Public Servant",
                subject_ministry=ministry.name if ministry else min_code,
                status=status,
                closed_reason=closed_reason,
            )
            if status in (ComplaintStatus.ACCEPTED, ComplaintStatus.CONVERTED) and officer:
                c.triaged_by = officer
                c.triaged_at = timezone.now() - timedelta(days=3)
                c.save(update_fields=["triaged_by", "triaged_at"])
            created += 1

        self.stdout.write(f"  [OK] {created} complaints seeded")
