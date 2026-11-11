"""
Management command: seed_csu_minutes_practice

Builds a practice sitting so Manager CSU can test minute taking end to end:

  * "TRAIN-CSU-MTG-001" — a sitting that is already launched (In Progress)
    with a circulated agenda of eight practice items across the real agenda
    sections. Minute intake opens only once a sitting has begun, and Manager
    CSU cannot launch one, so it is seeded already launched;
  * one item is Discipline / Compliance business, so the Compliance Manager
    is one of the reviewers of the draft minutes;
  * one item is carried over from "TRAIN-CSU-MTG-000", a completed previous
    practice sitting, and one is a matter arising from it;
  * optionally, practice Commissioner accounts so the commissioners' comment
    round can be tried (production has no Commissioner accounts).

Nothing here touches real data or real people while seeding:
  * records carry TRAIN-CSU-... reference numbers, so the PSC-YYYY-nnnnn and
    MTG-YYYY-nnn counters are never consumed, and submissions are is_test;
  * the AI brief/quality fields are filled in directly (no AI call);
  * no email, notification or automation is fired.

What the *tester* does afterwards is real, though: "Format with AI" calls the
AI service, and submitting the draft for review notifies the real Secretary,
Chairperson and Compliance Manager in-app.

Usage:
    python manage.py seed_csu_minutes_practice
    python manage.py seed_csu_minutes_practice --commissioners 3 --facilitator-email me@example.org
    python manage.py seed_csu_minutes_practice --commissioners-only 3 --facilitator-email me@example.org
    python manage.py seed_csu_minutes_practice --cleanup
"""

import os
import secrets
from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ...models import (
    AgendaCategory,
    AgendaDeferral,
    AgendaItem,
    AgendaStatus,
    DeferralType,
    DocumentOcrStatus,
    Meeting,
    MeetingStatus,
    Ministry,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)
from .seed_training_sitting import _pdf

MINISTRY_CODE = "TRNC"
MINISTRY_NAME = "Training Ministry — CSU minutes practice (practice only)"
CURRENT_REF = "TRAIN-CSU-MTG-001"
PREVIOUS_REF = "TRAIN-CSU-MTG-000"
SUB_PREFIX = "TRAIN-CSU-"
COMMISSIONER_PREFIX = "practice.commissioner."

C = AgendaCategory
U = RoutedUnit

# (ref, title, agenda section, routed unit, form code, summary, documents[(name, description, pages)])
SUBMISSIONS = [
    (
        "TRAIN-CSU-001",
        "[TRAINING] Matter arising — appraisal report for Mr Practice Tari's conditional confirmation",
        C.MATTERS_ARISING, U.HR, "",
        "At the previous practice sitting the Commission confirmed Mr Practice Tari's appointment subject "
        "to a satisfactory appraisal. The Training Ministry has now lodged the appraisal report, rated "
        "'meets expectations'. The Commission is asked to note that the condition is met.",
        [("Appraisal report.pdf", "Appraisal report", 2)],
    ),
    (
        "TRAIN-CSU-002",
        "[TRAINING] Disciplinary matter — alleged unauthorised absence, Senior Clerk, Training Ministry",
        C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE, "",
        "The Training Ministry reports that a Senior Clerk was absent without leave for 14 working days. "
        "The officer's written response cites a family emergency. The Compliance Unit recommends a formal "
        "written warning and recovery of salary for the days not worked.",
        [("Investigation report.pdf", "Investigation report", 3),
         ("Officer's written response.pdf", "Officer's response", 1)],
    ),
    (
        "TRAIN-CSU-003",
        "[TRAINING] Appointment of Director of Policy — Training Ministry",
        C.APPOINTMENT, U.HR, "",
        "The Training Ministry requests approval to appoint a Director of Policy following open "
        "advertisement. Five applicants were shortlisted and one candidate is recommended after a panel "
        "interview. The selection report is attached.",
        [("Panel selection report.pdf", "Selection report", 3)],
    ),
    (
        "TRAIN-CSU-004",
        "[TRAINING] Acting appointment — Chief Accountant, Training Ministry (deferred from previous sitting)",
        C.APPOINTMENT, U.HR, "",
        "This item was deferred at the previous practice sitting so the ministry could confirm the "
        "officer's qualifications. The confirmation letter is now attached. The acting period sought is "
        "six months.",
        [("Qualification confirmation letter.pdf", "Confirmation letter", 1)],
    ),
    (
        "TRAIN-CSU-005",
        "[TRAINING] Confirmation of appointment — three Administration Officers, Training Ministry",
        C.DIRECT_APPOINTMENT, U.HR, "",
        "Three Administration Officers have completed their six-month probation. Two appraisals are "
        "satisfactory; the third notes attendance concerns and the Director recommends extending that "
        "officer's probation by three months.",
        [("Probation appraisals.pdf", "Probation appraisals", 3)],
    ),
    (
        "TRAIN-CSU-006",
        "[TRAINING] Corporate Services Division restructure — Training Ministry",
        "restructure", U.ODU, "",  # an AgendaSection code with no AgendaCategory member
        "The Training Ministry proposes merging two administrative units into one Corporate Services "
        "Division, abolishing one Clerk post and creating two Principal Analyst posts. Cost impact is "
        "neutral in year one. Before and after organisation charts are attached.",
        [("Restructure proposal.pdf", "Restructure proposal", 2),
         ("Organisation charts.pdf", "Organisation charts", 1)],
    ),
    (
        "TRAIN-CSU-007",
        "[TRAINING] Contract extension — IT Systems Adviser, Training Ministry",
        C.CONTRACT, U.HR, "",
        "The Training Ministry seeks a twelve-month extension of the IT Systems Adviser's contract while "
        "a permanent post is established. Funding is confirmed in the ministry's budget. The current "
        "contract ends next month.",
        [("Contract extension request.pdf", "Extension request", 2)],
    ),
    (
        "TRAIN-CSU-008",
        "[TRAINING] OPSC end-of-year office closure dates — Corporate Services Unit",
        C.OTHER, U.CSU, "",
        "The Corporate Services Unit proposes that the OPSC office close from 24 December to 4 January, "
        "with a skeleton staff on call for urgent Commission business. The Commission is asked to approve "
        "the dates and the on-call roster.",
        [("Closure proposal.pdf", "Closure proposal", 1)],
    ),
]
DEFERRED_REF = "TRAIN-CSU-004"
MATTERS_ARISING_REF = "TRAIN-CSU-001"


class Command(BaseCommand):
    help = "Create (or with --cleanup remove) the practice sitting Manager CSU uses to test minute taking."

    def add_arguments(self, parser):
        parser.add_argument("--cleanup", action="store_true", help="Remove all of this practice data and exit.")
        parser.add_argument("--created-by", default="",
                            help="Username recorded as creator (default: first PSC Admin).")
        parser.add_argument("--commissioners", type=int, default=0,
                            help="Also create this many practice Commissioner accounts.")
        parser.add_argument("--commissioners-only", type=int, default=0,
                            help="Only add this many practice Commissioner accounts to an existing seed.")
        parser.add_argument("--facilitator-email", default="",
                            help="Practice accounts get plus-addresses under this mailbox (me+username@…) so "
                                 "sign-in codes reach a facilitator. Required when creating accounts.")

    # ── cleanup ──────────────────────────────────────────────────────────────

    def _cleanup(self):
        refs = [CURRENT_REF, PREVIOUS_REF]
        # Everything the practice sitting touched: the seeded papers plus
        # anything added to the sitting during the test (e.g. flying items,
        # which are created under the adder's own ministry).
        subs = Submission._base_manager.filter(
            Q(ministry__code=MINISTRY_CODE)
            | Q(scheduled_meeting__reference_number__in=refs)
            | Q(agenda_placements__meeting__reference_number__in=refs)
        ).distinct()
        extra = sorted(
            s.reference_number for s in subs if not s.reference_number.startswith(SUB_PREFIX)
        )
        sub_ids = list(subs.values_list("id", flat=True))
        files = [d.file.name for d in SubmissionDocument.all_objects.filter(submission_id__in=sub_ids) if d.file]
        with transaction.atomic():
            sub_n = Submission._base_manager.filter(id__in=sub_ids).delete()[0]
            mtg_n = Meeting._base_manager.filter(reference_number__in=refs).delete()[0]
            usr_n = User.objects.filter(username__startswith=COMMISSIONER_PREFIX).delete()[0]
            Ministry.objects.filter(code=MINISTRY_CODE).delete()
        root = os.path.realpath(settings.MEDIA_ROOT or "")
        for name in files:
            path = os.path.realpath(os.path.join(root, name))
            if root and path.startswith(root + os.sep):
                try:
                    os.remove(path)
                except OSError:
                    pass
        self.stdout.write(self.style.SUCCESS(
            f"CSU minutes practice data removed ({sub_n + mtg_n + usr_n} row(s), {len(files)} file(s))."))
        if extra:
            self.stdout.write(self.style.WARNING(
                "Also removed papers added to the practice sitting during the test: " + ", ".join(extra)))

    # ── practice commissioners ───────────────────────────────────────────────

    def _commissioners(self, count, facilitator_email):
        if count <= 0:
            return {}
        if "@" not in facilitator_email:
            raise CommandError(
                "Practice accounts need --facilitator-email: sign-in sends an emailed code, so an "
                "account without an address cannot be used.")
        local, _, domain = facilitator_email.partition("@")
        now = timezone.now()
        passwords = {}
        existing = User.objects.filter(username__startswith=COMMISSIONER_PREFIX).count()
        for n in range(existing + 1, existing + count + 1):
            username = f"{COMMISSIONER_PREFIX}{n}"
            password = secrets.token_urlsafe(9)
            user = User.objects.create_user(
                username=username, password=password, email=f"{local}+{username}@{domain}",
                first_name="Practice", last_name=f"Commissioner {n}",
            )
            Profile.objects.create(
                user=user, role=Role.PSC_COMMISSIONER, force_password_change=False, password_changed_at=now,
            )
            passwords[username] = password
        return passwords

    def _print_accounts(self, passwords):
        if not passwords:
            return
        self.stdout.write("Practice Commissioner accounts (passwords shown once):")
        for username, password in passwords.items():
            self.stdout.write(f"  {username:<28} {password}")

    # ── seed ─────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        if options["cleanup"]:
            return self._cleanup()

        exists = Meeting._base_manager.filter(reference_number__in=[CURRENT_REF, PREVIOUS_REF]).exists()
        if options["commissioners_only"]:
            if not exists:
                raise CommandError("No practice sitting yet. Seed it first.")
            with transaction.atomic():
                passwords = self._commissioners(options["commissioners_only"], options["facilitator_email"])
            return self._print_accounts(passwords)
        if exists:
            raise CommandError("CSU minutes practice data already exists. Run with --cleanup first to rebuild it.")

        creator = self._creator(options["created_by"])
        chair = User.objects.filter(psc_profile__role=Role.CHAIRPERSON, is_active=True).first()
        now = timezone.now()
        today = timezone.localdate()

        # Stub the automation queues so no rule/notification/email can fire.
        with mock.patch("tracker.tasks.queue_automation_event"), \
                mock.patch("tracker.tasks.queue_dg_signature_check"), \
                transaction.atomic():
            ministry = Ministry.objects.create(code=MINISTRY_CODE, name=MINISTRY_NAME)

            previous = Meeting.objects.create(
                reference_number=PREVIOUS_REF, title="TRAINING SITTING — previous (practice only)",
                date=today - timedelta(days=14), time="09:00", venue="OPSC Boardroom",
                status=MeetingStatus.COMPLETED, agenda_status=AgendaStatus.CIRCULATED,
                notes="Practice data for the Manager CSU minute-taking test. Delete after use.",
            )
            current = Meeting.objects.create(
                reference_number=CURRENT_REF,
                title="TRAINING SITTING — minute-taking practice, not real",
                date=today, time="09:00", venue="OPSC Boardroom",
                # Already launched: minute intake needs a sitting in progress.
                status=MeetingStatus.IN_PROGRESS, agenda_status=AgendaStatus.CIRCULATED,
                min_items=len(SUBMISSIONS),
                agenda_approved_by=chair, agenda_approved_at=now - timedelta(days=3),
                notes="Practice sitting for the Manager CSU minute-taking test. Delete after use.",
            )

            placed = {}
            sequences = {}
            for row in SUBMISSIONS:
                category = row[2]
                sequences[category] = sequences.get(category, 0) + 1
                placed[row[0]] = self._submission(sequences[category], row, ministry, creator, current, now)

            deferred_sub, deferred_item = placed[DEFERRED_REF]
            AgendaDeferral.objects.create(
                submission=deferred_sub, agenda_item=deferred_item, from_meeting=previous,
                to_meeting=current, deferral_type=DeferralType.TO_NEXT_MEETING,
                reason="Ministry to confirm the officer's qualifications.", deferred_by=creator,
            )
            _, arising_item = placed[MATTERS_ARISING_REF]
            arising_item.matters_arising_meeting_ref = PREVIOUS_REF
            arising_item.matters_arising_agenda_no = "6.1"
            arising_item.save(update_fields=["matters_arising_meeting_ref", "matters_arising_agenda_no"])

            passwords = self._commissioners(options["commissioners"], options["facilitator_email"])

        self.stdout.write(self.style.SUCCESS(
            f"Created {CURRENT_REF} (in progress, agenda circulated, {len(placed)} items) and {PREVIOUS_REF}. "
            "No emails, notifications or AI calls were made."))
        self._print_accounts(passwords)

    def _creator(self, username):
        qs = User.objects.filter(is_active=True)
        if username:
            user = qs.filter(username=username).first()
            if not user:
                raise CommandError(f"No active user '{username}'.")
            return user
        user = qs.filter(psc_profile__role=Role.PSC_ADMIN).first()
        if not user:
            raise CommandError("No PSC Admin found; pass --created-by.")
        return user

    def _submission(self, seq, row, ministry, creator, meeting, now):
        ref, title, category, unit, form_code, summary, docs = row
        sub = Submission.objects.create(
            reference_number=ref, title=title, ministry=ministry, form_type_code=form_code,
            agenda_category=category, routed_unit=unit, is_test=True, notes=summary,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=now - timedelta(days=10), created_by=creator,
            scheduled_meeting=meeting,
        )
        for name, description, pages in docs:
            doc = SubmissionDocument(
                submission=sub, original_name=name, description=description, uploaded_by=creator,
                ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=f"{description}. {summary}",
                ocr_processed_at=now,
            )
            doc.file.save(name, ContentFile(_pdf(description, summary, pages)), save=False)
            doc.save()

        from ...tasks import compute_submission_ai_context_key
        key = compute_submission_ai_context_key(sub)
        Submission.objects.filter(pk=sub.pk).update(
            ai_brief_summary=summary, ai_brief_processed=True, ai_brief_generated_at=now,
            ai_brief_context_key=key,
            ai_quality_score=75, ai_quality_processed=True, ai_quality_generated_at=now,
            ai_quality_context_key=key, ai_quality_review_effort="moderate",
            ai_quality_explanation="Practice data: pre-written for training, not an AI assessment.",
        )
        item = AgendaItem.objects.create(
            meeting=meeting, submission=sub, sequence=seq, category=category,
            form_type_code=form_code, agenda_blurb=summary.split(". ")[0] + ".",
            agenda_blurb_processed=True,
        )
        return sub, item
