"""Seed compliance data from real PSC disciplinary case files (2023-2026).

Sources:
  - 004 Summary Report (DOCX) — case statuses and allegation types
  - Disciplinary Cases updated.xlsx — active/ongoing cases with updates
  - NSDP PSDB progress review (DOCX) — trend analysis 2021-2025

Usage:
    python manage.py seed_compliance_real              # skip if data exists
    python manage.py seed_compliance_real --clear      # wipe all compliance data first
    python manage.py seed_compliance_real --force      # add on top of existing data
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


# ── Real case data extracted from PSC source files ────────────────────────────
#
# Format: (case_family, subject_name, subject_position, ministry_code,
#           is_senior_executive, description, days_ago, sla_hint, year_group)
#
# sla_hint: 'on_track' | 'at_risk' | 'overdue'
# year_group: used only for case notes / context labelling

CASES = [
    # ── 2026 Active Cases — Ministry of Justice & Community Services (MJYCS) ──
    # All 4 MJYCS cases pending PSDB appointment of chairperson
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Jack Iata", "Public Servant", "MJYCS", False,
        "Serious misconduct — PSDB hearing pending (chairperson appointment awaited). Scheduled June 2026.",
        60, "at_risk", "2026",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Daniel Nakou", "Public Servant", "MJYCS", False,
        "Serious misconduct — PSDB hearing pending (chairperson appointment awaited). Scheduled June 2026.",
        58, "at_risk", "2026",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Jimmy Pakoa", "Public Servant", "MJYCS", False,
        "Serious misconduct — PSDB hearing pending (chairperson appointment awaited). Scheduled June 2026.",
        55, "at_risk", "2026",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Roy Willie Makal", "Public Servant", "MJYCS", False,
        "Serious misconduct — PSDB hearing pending (chairperson appointment awaited). Scheduled June 2026.",
        52, "at_risk", "2026",
    ),
    # ── 2026 — MoFA ──
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Esrom Mark Vano", "Public Servant", "MOFA", False,
        "Disciplinary matter — Order of Determination served 11 June 2026.",
        45, "on_track", "2026",
    ),
    # ── 2026 — MoIA ──
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Tousil Mael Basil", "Public Servant", "MIA", False,
        "Disciplinary matter — PSDB hearing scheduled 16 June 2026.",
        50, "at_risk", "2026",
    ),
    # ── 2026 — MJYCS continued ──
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Louis George", "Public Servant", "MJYCS", False,
        "Serious misconduct — PSDB hearing scheduled 16 June 2026.",
        48, "at_risk", "2026",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Trevor Jivi", "Public Servant", "MJYCS", False,
        "14-day notice of termination of employment issued — due date 26 May 2026. Response not yet received.",
        25, "overdue", "2026",
    ),
    # ── 2026 — MOH (financial audit / investigation panel) ──
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Rexton Rono", "Senior Officer", "MOH", False,
        "Audit into financial spending and step-down of Vanuatu National Referral Hospital staff (2025). Panel of investigation in progress.",
        90, "on_track", "2026",
    ),
    # ── 2026 — MIPU (suspension) ──
    (
        CaseFamily.TEMPORARY_SUSPENSION,
        "Reggie Kaising", "Public Servant", "MIPU", False,
        "Suspended on half salary — SMDR not yet complete, missing information from CIU.",
        180, "overdue", "2026",
    ),

    # ── 2025 Ongoing Cases ──
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Cynthia Woleg", "Public Servant", "MOH", False,
        "Pending submission of SMDR to Commission.",
        300, "at_risk", "2025",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "John Anmath", "Public Servant", "MTTCNB", False,
        "Pending Commission decision on disciplinary file.",
        280, "on_track", "2025",
    ),
    (
        CaseFamily.SENIOR_SERIOUS_MISCONDUCT,
        "Mr. Dimitri Buletare", "Senior Officer", "MFEM", True,
        "Pending Commission decision — submission on Order of Determination.",
        270, "on_track", "2025",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Mr. Jonas Loughman", "Public Servant", "MOH", False,
        "Pending Commission decision — submission on Order of Determination.",
        265, "on_track", "2025",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Mr. Max Philemon", "Public Servant", "MPM", False,
        "Invited to appear before the Commission — 11 June 2026.",
        260, "at_risk", "2025",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Mrs. Lolina Martin", "Public Servant", "MJYCS", False,
        "Case referred to PSDB — hearing scheduled 2 July 2026.",
        255, "at_risk", "2025",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Mrs. Diana Leo", "Public Servant", "MJYCS", False,
        "Pending Commission decision — submission on Order of Determination.",
        250, "on_track", "2025",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Mr. Albert Nalpini", "Public Servant", "MJYCS", False,
        "Pending Commission decision — submission on Order of Determination.",
        248, "on_track", "2025",
    ),
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "James Melteres", "Public Servant", "MPM", False,
        "Court hearing 23 June 2026 — amendment of sworn statement of Jean Yves Bibi and defence sworn statement. Active litigation.",
        245, "overdue", "2025",
    ),
    (
        CaseFamily.SENIOR_SERIOUS_MISCONDUCT,
        "Esrom Loughmani", "Senior Officer", "MIA", True,
        "Pending Commission decision on claim of lawyer regarding employment entitlement. Case deferred (PSC Minute No. 6, 10 March 2026).",
        240, "on_track", "2025",
    ),

    # ── 2024 Ongoing Cases ──
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Kaltamat Takaua", "Public Servant", "MOH", False,
        "PSDB hearing scheduled 25 June 2026.",
        400, "at_risk", "2024",
    ),
    (
        CaseFamily.SENIOR_POOR_PERFORMANCE,
        "Mr. Robert Thimothy", "Senior Officer", "MIPU", True,
        "Pending submission to next Commission meeting — unavailability of vacant position.",
        390, "on_track", "2024",
    ),
    (
        CaseFamily.EMPLOYEE_DISCIPLINARY,
        "Mrs. Laurie Wobelak", "Public Servant", "MPM", False,
        "Case deferred from Commission (PSC Minute No. 6, 10 March 2026 — continued 13 March 2026).",
        380, "on_track", "2024",
    ),

    # ── 2023 Active Case ──
    (
        CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
        "Andrina Woi", "Public Servant", "MPM", False,
        "Pre-Trial Conference 12 June 2026 — Supreme Court matter, active litigation.",
        500, "overdue", "2023",
    ),
]


# Litigation records: (case_index, description, counsel, court_ref, status, est_cost, actual_cost)
LITIGATION = [
    (
        18,  # James Melteres
        "Court hearing — amendment of sworn statement (Jean Yves Bibi & Defence), 23 June 2026",
        "State Law Office",
        "SC-2026-0087",
        LitigationRecord.LitigationStatus.ACTIVE,
        350000, None,
    ),
    (
        23,  # Andrina Woi
        "Supreme Court — Pre-Trial Conference 12 June 2026",
        "State Law Office",
        "SC-2023-0142",
        LitigationRecord.LitigationStatus.ACTIVE,
        280000, 95000,
    ),
]


# Case notes: (case_index, text)
NOTES = [
    # Jack Iata (0)
    (0, "Advice requested from Attorney General's Office on appointment of PSDB Chairperson. Hearing scheduled for June 2026."),
    # Daniel Nakou (1)
    (1, "Case awaiting PSDB Chairperson appointment. Advice to AG's office requested. Hearing rescheduled to June 2026."),
    # Esrom Mark Vano (4)
    (4, "Order on Determination served to Mr Esrom Mark Vano on 11 June 2026."),
    # Trevor Jivi (7)
    (7, "14-day notice of termination of employment issued. Due date 26 May 2026. No response received to date."),
    # Rexton Rono (8)
    (8, "Panel of Investigation constituted. Members: Mrs Merelyne Temakon, Mrs Alexandra Mastea, Mrs Jenny Tevi. Investigation in progress."),
    # Reggie Kaising (9)
    (9, "Officer suspended on half salary. SMDR not yet complete — missing information from CIU. Follow-up required."),
    # James Melteres (18)
    (18, "Court hearing scheduled 23 June 2026 at 1:00PM. Amendment of sworn statement of Jean Yves Bibi and sworn statement of amendment of Defence to be filed before hearing."),
    # Esrom Loughmani (19)
    (19, "Case deferred from Commission — PSC Minute No. 6 of 10 March 2026, continued on 13 March 2026. Pending Commission decision on lawyer's claim regarding entitlement."),
    # Laurie Wobelak (22)
    (22, "Case deferred from Commission at sitting of 10 March 2026 (continued 13 March 2026). Next steps to be confirmed."),
    # Andrina Woi (23)
    (23, "Pre-Trial Conference held 12 June 2026 at 08:30AM before the court. Matter ongoing."),
]


# Complaints from real ministry referrals
COMPLAINTS = [
    (
        "serious_misconduct_employee",
        "Complaint — Financial mismanagement at Vanuatu National Referral Hospital (MoTTNVB)",
        "Staff Member (anonymous)", "MTTCNB",
        ComplaintStatus.ACCEPTED, "",
    ),
    (
        "employee_disciplinary",
        "Complaint — Absenteeism and failure to comply with lawful instructions",
        "Supervisory Officer", "MJYCS",
        ComplaintStatus.UNDER_REVIEW, "",
    ),
    (
        "employee_disciplinary",
        "Complaint — Improper conduct and insubordination",
        "Head of Agency Referral", "MOH",
        ComplaintStatus.RECEIVED, "",
    ),
    (
        "grievance",
        "Grievance — Acting allowance unpaid for extended period",
        "Ministry Officer", "MFEM",
        ComplaintStatus.ACCEPTED, "",
    ),
    (
        "temporary_suspension",
        "Complaint — Substance abuse in workplace, Correctional Services",
        "Ministry HR", "MJYCS",
        ComplaintStatus.CONVERTED, "",
    ),
    (
        "serious_misconduct_employee",
        "Complaint — Forgery of official documents",
        "Director (referral)", "MJYCS",
        ComplaintStatus.ACCEPTED, "",
    ),
]


class Command(BaseCommand):
    help = "Seed compliance data from real PSC disciplinary case files (2023-2026)."

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
        self.stdout.write(self.style.SUCCESS("\nCompliance real-data seed complete."))

    def _clear(self):
        LitigationRecord.objects.all().delete()
        CaseNote.objects.all().delete()
        ComplianceCaseStage.objects.all().delete()
        ComplianceCase.objects.all().delete()
        Complaint.objects.all().delete()
        Submission.objects.filter(form_type_code__startswith="COMP-").delete()
        self.stdout.write(self.style.WARNING("  [CLEAR] All compliance data wiped."))

    def _seed_cases(self):
        ministry_map = {m.code: m for m in Ministry.objects.all()}
        # Try common code aliases
        alias_map = {
            "MJYCS": ministry_map.get("MJYCS") or ministry_map.get("MJCS"),
            "MOFA":  ministry_map.get("MOFA")  or ministry_map.get("MFA"),
            "MIA":   ministry_map.get("MIA")   or ministry_map.get("MOIA"),
            "MTTCNB": ministry_map.get("MTTCNB") or ministry_map.get("MTT"),
            "MFEM":  ministry_map.get("MFEM"),
            "MIPU":  ministry_map.get("MIPU"),
            "MOH":   ministry_map.get("MOH"),
            "MPM":   ministry_map.get("MPM"),
            "MALFB": ministry_map.get("MALFB"),
        }

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

        # Fallback: any ministry in the DB (Submission.ministry is NOT NULL)
        fallback_ministry = Ministry.objects.first()
        if not fallback_ministry:
            self.stdout.write(self.style.ERROR("  No ministries found — run seed_tracker first."))
            return

        today = timezone.localdate()
        created = 0

        for i, (family, subject, position, min_code, is_senior, title, days_ago, sla_hint, year_group) in enumerate(CASES):
            ministry = alias_map.get(min_code) or ministry_map.get(min_code) or fallback_ministry
            date_received = today - timedelta(days=days_ago)

            with transaction.atomic():
                sub = Submission(
                    title=title[:200],
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

                ministry_name = ministry.name if ministry else min_code
                case = ComplianceCase.objects.create(
                    submission=sub,
                    case_family=family,
                    subject_name=subject,
                    subject_position=position,
                    subject_ministry=ministry_name,
                    is_senior_executive=is_senior,
                    description=title,
                    date_received=date_received,
                )

                materialize_stages(case)
                self._apply_sla_hint(case, sla_hint)

            created += 1

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
        stages = list(case.stages.order_by("stage_order"))
        if not stages:
            return

        if hint == "overdue":
            for s in stages[:2]:
                s.status = StageStatus.COMPLETED
                s.sla_status = SLAStatus.COMPLETED
                s.completed_at = timezone.now() - timedelta(days=5)
            if len(stages) > 2:
                s = stages[2]
                s.status = StageStatus.IN_PROGRESS
                s.sla_status = SLAStatus.OVERDUE
                s.due_date = date.today() - timedelta(days=7)
            ComplianceCaseStage.objects.bulk_update(
                stages[:3], ["status", "sla_status", "completed_at", "due_date"]
            )

        elif hint == "at_risk":
            if stages:
                s = stages[0]
                s.status = StageStatus.COMPLETED
                s.sla_status = SLAStatus.COMPLETED
                s.completed_at = timezone.now() - timedelta(days=3)
                s.save(update_fields=["status", "sla_status", "completed_at"])
            if len(stages) > 1:
                s = stages[1]
                s.status = StageStatus.IN_PROGRESS
                s.sla_status = SLAStatus.AT_RISK
                s.due_date = date.today() + timedelta(days=2)
                s.save(update_fields=["status", "sla_status", "due_date"])

    def _seed_complaints(self):
        ministry_map = {m.code: m for m in Ministry.objects.all()}
        officer = (
            User.objects.filter(psc_profile__role__in=["compliance_manager", "compliance_principal"]).first()
        )
        ministry_user = User.objects.filter(psc_profile__role__in=["head_of_agency", "ministry_hr"]).first()

        alias_map = {
            "MJYCS": ministry_map.get("MJYCS") or ministry_map.get("MJCS"),
            "MTTCNB": ministry_map.get("MTTCNB") or ministry_map.get("MTT"),
            "MFEM": ministry_map.get("MFEM"),
            "MOH": ministry_map.get("MOH"),
        }

        fallback_ministry = Ministry.objects.first()
        created = 0
        for family, title, subject_name, min_code, status, closed_reason in COMPLAINTS:
            ministry = alias_map.get(min_code) or ministry_map.get(min_code) or fallback_ministry
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
                c.triaged_at = timezone.now() - timedelta(days=5)
                c.save(update_fields=["triaged_by", "triaged_at"])
            created += 1

        self.stdout.write(f"  [OK] {created} complaints seeded")
