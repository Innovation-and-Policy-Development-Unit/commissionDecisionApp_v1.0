"""
Management command: seed_opsc_training

Builds the practice data for the OPSC staff SCDMS training (docs: the OPSC
Facilitator Guide, "Before the day"):

  * a "Ministry of Practice Services" (code PRAC) to lodge practice cases from;
  * practice role accounts so a case team can cover every role (PSC Officer,
    Senior Administration Officer, HR Unit Manager and Principal, Secretary,
    Chairperson, and a ministry HR officer to play the ministry);
  * one practice Confirmation of Appointment per team, already at
    "Submitted to PSC" with every required document attached;
  * one practice sitting for the Exercise 3 agenda.

Nothing here touches real data or real people:
  * records carry TRAIN-OPSC-... reference numbers, so the PSC-YYYY-nnnnn and
    MTG-YYYY-nnn counters are never consumed;
  * practice cases are flagged is_test=True, so they stay out of the reports,
    AI briefs and automatic agenda placement, and cannot be endorsed onto a
    Commissioner-facing agenda;
  * no email, notification, automation or AI call is made while seeding;
  * practice accounts get no email address unless --facilitator-email is given.
    Sign-in needs an emailed code, so an account without an address cannot sign
    in until one is set (Admin > Users).

Usage:
    python manage.py seed_opsc_training --teams 8
    python manage.py seed_opsc_training --teams 8 --facilitator-email me@example.org
    python manage.py seed_opsc_training --cleanup
"""

import secrets
from datetime import datetime, time, timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone

from ...models import (
    CommissionTask,
    DocumentOcrStatus,
    Meeting,
    MeetingStatus,
    Ministry,
    Profile,
    PSCFormType,
    Role,
    Submission,
    SubmissionChecklistItem,
    SubmissionDocument,
    Unit,
    WorkflowStage,
)
from ...submission_checklist import ensure_submission_checklist_items

MINISTRY_CODE = "PRAC"
MINISTRY_NAME = "Ministry of Practice Services (practice only)"
FORM_TYPE_CODE = "RECRUIT-CONFIRM"  # Confirmation of Appointment
REF_PREFIX = "TRAIN-OPSC-E1-"
MEETING_REF = "TRAIN-OPSC-MTG-001"
TRAINING_DATE = (2026, 10, 30)

# (username, first name, last name, role, OPSC unit code or None for the practice ministry)
ACCOUNTS = [
    ("practice.psc.officer", "Practice", "PSC Officer", Role.PSC_OFFICER, "CSU"),
    ("practice.senior.admin", "Practice", "Senior Admin Officer", Role.SENIOR_ADMIN_OFFICER, "CSU"),
    ("practice.hr.manager", "Practice", "HR Unit Manager", Role.HR_UNIT_MANAGER, "HR"),
    ("practice.hr.principal", "Practice", "HR Unit Principal", Role.HR_UNIT_PRINCIPAL, "HR"),
    ("practice.secretary", "Practice", "Secretary", Role.PSC_SECRETARY, "CSU"),
    ("practice.chairperson", "Practice", "Chairperson", Role.CHAIRPERSON, "CSU"),
    ("practice.ministry.hr", "Practice", "Ministry HR Officer", Role.MINISTRY_HR, None),
]


def _pdf(title, note):
    """A small real PDF so the document viewer has something to open."""
    from weasyprint import HTML

    return HTML(
        string=(
            "<html><body style='font-family:sans-serif'>"
            f"<h2>{title}</h2><p><em>TRAINING DOCUMENT — fictional, for practice only.</em></p>"
            f"<p>{note}</p></body></html>"
        )
    ).write_pdf()


class Command(BaseCommand):
    help = "Create (or with --cleanup remove) the practice data for OPSC staff training."

    def add_arguments(self, parser):
        parser.add_argument("--cleanup", action="store_true", help="Remove all practice data and exit.")
        parser.add_argument("--teams", type=int, default=8, help="Practice cases to create, one per team (default 8).")
        parser.add_argument(
            "--facilitator-email", default="",
            help="Give each practice account <local>+<username>@<domain> of this address so sign-in "
                 "codes reach a facilitator. Default: no email address.",
        )

    # ── cleanup ──────────────────────────────────────────────────────────────

    def _cleanup(self):
        import os

        from django.conf import settings

        usernames = [a[0] for a in ACCOUNTS]
        files = [
            d.file.name
            for d in SubmissionDocument.all_objects.filter(submission__ministry__code=MINISTRY_CODE)
            if d.file
        ]
        with transaction.atomic():
            # Tasks only SET_NULL their links, so delete them explicitly.
            n_tasks = CommissionTask._base_manager.filter(
                submission__ministry__code=MINISTRY_CODE
            ).delete()[0]
            n_subs = Submission._base_manager.filter(ministry__code=MINISTRY_CODE).delete()[0]
            n_mtgs = Meeting._base_manager.filter(reference_number=MEETING_REF).delete()[0]
            Ministry.objects.filter(code=MINISTRY_CODE).delete()
            kept = []
            for user in User.objects.filter(username__in=usernames):
                try:
                    with transaction.atomic():
                        user.delete()
                except ProtectedError:
                    user.is_active = False
                    user.save(update_fields=["is_active"])
                    kept.append(user.username)
        root = os.path.realpath(settings.MEDIA_ROOT or "")
        for name in files:
            path = os.path.realpath(os.path.join(root, name))
            if root and path.startswith(root + os.sep):
                try:
                    os.remove(path)
                except OSError:
                    pass
        self.stdout.write(self.style.SUCCESS(
            f"Practice data removed: {n_subs} case row(s), {n_tasks} task row(s), {n_mtgs} meeting row(s), "
            f"{len(files)} file(s); practice accounts deleted"
            + (f" (deactivated instead: {', '.join(kept)})." if kept else ".")
        ))
        start = timezone.make_aware(datetime(*TRAINING_DATE, 0, 0))
        left = Submission._base_manager.filter(is_internal=True, received_at__gte=start - timedelta(days=1))
        if left.exists():
            self.stdout.write(self.style.WARNING(
                "Review by hand — internal submissions created around the training day (Exercise 6 is "
                "created by staff under their own accounts and is not removed here):"
            ))
            for s in left.order_by("received_at"):
                self.stdout.write(f"  {s.reference_number}  {s.current_stage}  {s.title[:60]}")

    # ── seed ─────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        if options["cleanup"]:
            return self._cleanup()

        teams = options["teams"]
        if teams < 1 or teams > 30:
            raise CommandError("--teams must be between 1 and 30.")
        if (
            Ministry.objects.filter(code=MINISTRY_CODE).exists()
            or Meeting._base_manager.filter(reference_number=MEETING_REF).exists()
            or User.objects.filter(username__in=[a[0] for a in ACCOUNTS]).exists()
        ):
            raise CommandError("Practice data already exists. Run with --cleanup first to rebuild it.")
        form_type = PSCFormType.objects.filter(code=FORM_TYPE_CODE).first()
        if not form_type:
            raise CommandError(f"Form type {FORM_TYPE_CODE} (Confirmation of Appointment) not found.")
        units = {u.code: u for u in Unit.objects.filter(code__in=["CSU", "HR"]).select_related("department__ministry")}
        if set(units) != {"CSU", "HR"}:
            raise CommandError("OPSC units CSU and HR must exist.")

        now = timezone.now()
        passwords = {}
        with mock.patch("tracker.tasks.queue_automation_event"), \
                mock.patch("tracker.tasks.queue_dg_signature_check"), \
                transaction.atomic():
            ministry = Ministry.objects.create(code=MINISTRY_CODE, name=MINISTRY_NAME)
            accounts = {}
            for username, first, last, role, unit_code in ACCOUNTS:
                password = secrets.token_urlsafe(9)
                passwords[username] = password
                email = ""
                if options["facilitator_email"]:
                    local, _, domain = options["facilitator_email"].partition("@")
                    email = f"{local}+{username}@{domain}"
                user = User.objects.create_user(
                    username=username, password=password, email=email, first_name=first, last_name=last,
                )
                if unit_code:
                    unit = units[unit_code]
                    where = {"ministry": unit.department.ministry, "department": unit.department, "unit": unit}
                else:
                    where = {"ministry": ministry}
                Profile.objects.create(
                    user=user, role=role, force_password_change=False, password_changed_at=now, **where
                )
                accounts[username] = user

            lodger = accounts["practice.ministry.hr"]
            meeting_date = datetime(*TRAINING_DATE).date()
            Meeting.objects.create(
                reference_number=MEETING_REF,
                title="OPSC TRAINING SITTING — practice only, not real",
                date=meeting_date, time=time(9, 0), venue="OPSC training room",
                status=MeetingStatus.SCHEDULED,
                submission_cutoff=timezone.make_aware(datetime(2026, 10, 29, 17, 0)),  # the day before
                notes="Practice sitting for OPSC staff training. Delete after use.",
            )

            for n in range(1, teams + 1):
                self._case(n, form_type, ministry, lodger, now)

        self.stdout.write(self.style.SUCCESS(
            f"Created {teams} practice case(s) {REF_PREFIX}01..{teams:02d} at Submitted to PSC, "
            f"the practice sitting {MEETING_REF} ({meeting_date:%d %b %Y}), and {len(ACCOUNTS)} practice accounts. "
            "No emails, notifications or AI calls were made."
        ))
        self.stdout.write("")
        self.stdout.write("PRACTICE ACCOUNTS (shown once; give to facilitators only):")
        for username, first, last, role, _unit in ACCOUNTS:
            self.stdout.write(f"  {username:<24} {str(Role(role).label):<32} {passwords[username]}")
        if not options["facilitator_email"]:
            self.stdout.write(self.style.WARNING(
                "These accounts have no email address, so they cannot sign in until one is set "
                "(Admin > Users), because sign-in needs an emailed code."
            ))

    def _case(self, n, form_type, ministry, lodger, now):
        sub = Submission.objects.create(
            reference_number=f"{REF_PREFIX}{n:02d}",
            title=f"[TRAINING] Confirmation of appointment — Team {n} (practice only)",
            ministry=ministry, form_type_code=form_type.code,
            agenda_category=form_type.agenda_category or "",
            current_stage=WorkflowStage.SUBMITTED,
            received_at=now, created_by=lodger, is_test=True,
        )
        ensure_submission_checklist_items(sub)
        items = SubmissionChecklistItem.objects.filter(
            submission=sub, document__item_type="document"
        ).select_related("document")
        for item in items:
            name = f"{item.document.name}.pdf"
            note = f"Practice attachment for: {item.document.name}."
            doc = SubmissionDocument(
                submission=sub, required_document=item.document, original_name=name,
                description=f"[TRAINING] {item.document.name}", uploaded_by=lodger,
                ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=note, ocr_processed_at=now,
            )
            doc.file.save(name, ContentFile(_pdf(item.document.name, note)), save=False)
            doc.save()
            item.is_present = True
            item.checked_by = lodger
            item.checked_at = now
            item.notes = "[TRAINING] Practice document."
            item.save(update_fields=["is_present", "checked_by", "checked_at", "notes"])
        return sub
