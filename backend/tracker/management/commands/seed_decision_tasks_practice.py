"""
Management command: seed_decision_tasks_practice

Builds a practice sitting whose minutes are already written, reviewed and out
for signature, so the last leg of the Commission process can be tried end to
end by the real people who do it:

  1. the Corporate Services Unit (or an Admin) uploads the signed scan;
  2. a Secretary presses "Allocate Decision Tasks to Managers";
  3. each unit manager assigns their task(s) to a Principal / Senior officer;
  4. the officer works the task through to completed.

What is created:

  * "TRAIN-TASK-MTG-001" — a completed practice sitting with six decided
    papers, at least one for each of ODU, VIPAM, HR, Compliance and CSU;
  * its minutes, status "Awaiting signature", with a decision on every item.

Nothing here touches real data or real people while seeding:
  * records carry TRAIN-TASK-... reference numbers, so the PSC-YYYY-nnnnn and
    MTG-YYYY-nnn counters are never consumed, and submissions are is_test;
  * the AI brief/quality fields are filled in directly (no AI call);
  * no email, notification or automation is fired.

What the *testers* do afterwards is real, though. Allocating the tasks sends
an in-app notification and an email to each real unit manager, tells Commission
members that signed minutes are on record, and queues AI-drafted outcome
letters for the approved papers. Assigning an officer emails that officer.

Usage:
    python manage.py seed_decision_tasks_practice
    python manage.py seed_decision_tasks_practice --cleanup
"""

import os
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
    AgendaItem,
    AgendaStatus,
    CommissionTask,
    DocumentOcrStatus,
    Meeting,
    MeetingStatus,
    Ministry,
    Minutes,
    MinutesStatus,
    Role,
    RoutedUnit,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)
from .seed_training_sitting import _pdf

MINISTRY_CODE = "TRNT"
MINISTRY_NAME = "Training Ministry — decision tasks practice (practice only)"
MEETING_REF = "TRAIN-TASK-MTG-001"
SUB_PREFIX = "TRAIN-TASK-"

C = AgendaCategory
U = RoutedUnit

# (ref, title, agenda section, routed unit, summary, discussion, decision, decision_type)
PAPERS = [
    (
        "TRAIN-TASK-001",
        "[TRAINING] Corporate Services Division restructure — Training Ministry",
        "restructure", U.ODU,
        "The Training Ministry proposes merging two administrative units into one Corporate Services "
        "Division, abolishing one Clerk post and creating two Principal Analyst posts.",
        "The Commission considered the ODU assessment and the before and after organisation charts. "
        "Members were satisfied the change is cost neutral in year one.",
        "Approved. ODU to issue the revised structure and update the establishment register.",
        "approved",
    ),
    (
        "TRAIN-TASK-002",
        "[TRAINING] Scholarship for a Master of Public Policy — Senior Policy Officer, Training Ministry",
        C.TRAINING, U.VIPAM,
        "The Training Ministry seeks approval for a Senior Policy Officer to take up a two-year "
        "scholarship, with study leave on full pay and a bond on return.",
        "The Commission noted VIPAM's advice that the course matches the ministry's training plan and "
        "that the bonding period is two years of service for each year of study.",
        "Approved subject to a signed bond. VIPAM to prepare the bond agreement and study leave letter.",
        "approved",
    ),
    (
        "TRAIN-TASK-003",
        "[TRAINING] Appointment of Director of Policy — Training Ministry",
        C.APPOINTMENT, U.HR,
        "The Training Ministry requests approval to appoint a Director of Policy following open "
        "advertisement. One candidate is recommended after a panel interview.",
        "The Commission reviewed the panel selection report and was satisfied the process followed "
        "the Staff Manual.",
        "Approved. HR Unit to issue the appointment letter with a six-month probation period.",
        "approved",
    ),
    (
        "TRAIN-TASK-004",
        "[TRAINING] Contract extension — IT Systems Adviser, Training Ministry",
        C.CONTRACT, U.HR,
        "The Training Ministry seeks a twelve-month extension of the IT Systems Adviser's contract "
        "while a permanent post is established.",
        "Members asked why the permanent post has not yet been created and wanted to see the "
        "ministry's timetable before agreeing to a further twelve months.",
        "Deferred back to the HR Unit. HR Unit to obtain the ministry's timetable for establishing "
        "the permanent post and resubmit.",
        "deferred_back_to_unit",
    ),
    (
        "TRAIN-TASK-005",
        "[TRAINING] Disciplinary matter — alleged unauthorised absence, Senior Clerk, Training Ministry",
        C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE,
        "The Training Ministry reports that a Senior Clerk was absent without leave for 14 working "
        "days. The Compliance Unit recommends a written warning and recovery of salary.",
        "The Commission considered the investigation report and the officer's written response "
        "citing a family emergency.",
        "Approved. Compliance Unit to issue a formal written warning and arrange recovery of salary "
        "for the days not worked.",
        "approved",
    ),
    (
        "TRAIN-TASK-006",
        "[TRAINING] OPSC end-of-year office closure dates — Corporate Services Unit",
        C.OTHER, U.CSU,
        "The Corporate Services Unit proposes that the OPSC office close from 24 December to "
        "4 January, with a skeleton staff on call for urgent Commission business.",
        "The Commission noted the proposed dates and the on-call roster.",
        "Noted. CSU to circulate the closure dates and on-call roster to all staff.",
        "noted",
    ),
]


class Command(BaseCommand):
    help = (
        "Create (or with --cleanup remove) the practice sitting used to test uploading signed "
        "minutes, allocating decision tasks and assigning them to officers."
    )

    def add_arguments(self, parser):
        parser.add_argument("--cleanup", action="store_true", help="Remove all of this practice data and exit.")
        parser.add_argument("--created-by", default="",
                            help="Username recorded as creator (default: first PSC Admin).")

    # ── cleanup ──────────────────────────────────────────────────────────────

    def _cleanup(self):
        subs = Submission._base_manager.filter(
            Q(ministry__code=MINISTRY_CODE)
            | Q(scheduled_meeting__reference_number=MEETING_REF)
            | Q(agenda_placements__meeting__reference_number=MEETING_REF)
        ).distinct()
        sub_ids = list(subs.values_list("id", flat=True))
        files = [d.file.name for d in SubmissionDocument.all_objects.filter(submission_id__in=sub_ids) if d.file]
        minutes = Minutes.objects.filter(meeting__reference_number=MEETING_REF).first()
        scan = minutes.signed_document if minutes and minutes.signed_document else None
        with transaction.atomic():
            # Tasks only SET_NULL their sitting and paper, so they would
            # otherwise be left behind in the real task register.
            task_n = CommissionTask.objects.filter(
                Q(meeting__reference_number=MEETING_REF)
                | Q(meeting_reference=MEETING_REF)
                | Q(submission_id__in=sub_ids)
            ).delete()[0]
            sub_n = Submission._base_manager.filter(id__in=sub_ids).delete()[0]
            mtg_n = Meeting._base_manager.filter(reference_number=MEETING_REF).delete()[0]
            Ministry.objects.filter(code=MINISTRY_CODE).delete()
        if scan:
            # Every scan ever uploaded for this sitting, including replaced ones.
            storage = scan.storage
            folder = os.path.dirname(scan.name)
            try:
                for name in storage.listdir(folder)[1]:
                    if name.startswith(f"minutes_{MEETING_REF}_signed_scan"):
                        storage.delete(f"{folder}/{name}")
                        files.append(None)
            except OSError:
                pass
        root = os.path.realpath(settings.MEDIA_ROOT or "")
        for name in filter(None, files):
            path = os.path.realpath(os.path.join(root, name))
            if root and path.startswith(root + os.sep):
                try:
                    os.remove(path)
                except OSError:
                    pass
        self.stdout.write(self.style.SUCCESS(
            f"Decision tasks practice data removed ({task_n + sub_n + mtg_n} row(s), {len(files)} file(s))."))

    # ── seed ─────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        if options["cleanup"]:
            return self._cleanup()
        if Meeting._base_manager.filter(reference_number=MEETING_REF).exists():
            raise CommandError("Decision tasks practice data already exists. Run with --cleanup first to rebuild it.")

        creator = self._creator(options["created_by"])
        chair = User.objects.filter(psc_profile__role=Role.CHAIRPERSON, is_active=True).first()
        secretary = User.objects.filter(psc_profile__role=Role.PSC_SECRETARY, is_active=True).first()
        now = timezone.now()
        today = timezone.localdate()

        # Stub the automation queues so no rule/notification/email can fire.
        with mock.patch("tracker.tasks.queue_automation_event"), \
                mock.patch("tracker.tasks.queue_dg_signature_check"), \
                transaction.atomic():
            ministry = Ministry.objects.create(code=MINISTRY_CODE, name=MINISTRY_NAME)
            meeting = Meeting.objects.create(
                reference_number=MEETING_REF,
                title="TRAINING SITTING — decision tasks practice, not real",
                date=today - timedelta(days=7), time="09:00", venue="OPSC Boardroom",
                status=MeetingStatus.COMPLETED, agenda_status=AgendaStatus.CIRCULATED,
                min_items=len(PAPERS),
                agenda_approved_by=chair, agenda_approved_at=now - timedelta(days=10),
                notes="Practice sitting for the signed-minutes-to-tasks test. Delete after use.",
            )

            blocks = []
            sequences = {}
            for number, row in enumerate(PAPERS, start=1):
                ref, title, category, unit, summary, discussion, decision, decision_type = row
                sequences[category] = sequences.get(category, 0) + 1
                item = self._paper(sequences[category], row, ministry, creator, meeting, now)
                blocks.append({
                    "agenda_item_id": item.id,
                    "sequence": number,
                    "submission_ref": ref,
                    "title": title,
                    "discussion": discussion,
                    "decision": decision,
                    "decision_type": decision_type,
                    "action_items": [],
                })

            Minutes.objects.create(
                meeting=meeting,
                status=MinutesStatus.AWAITING_SIGNATURE,
                created_by=creator,
                content={
                    "opening": "PRACTICE ONLY. The practice sitting opened at 9:00 am with a prayer.",
                    "confirmation_previous_minutes": "Not applicable — practice sitting.",
                    "agenda_items": blocks,
                    "any_other_business": "None.",
                    "closing": "The practice sitting closed at 11:30 am.",
                },
                submitted_for_review_by=creator, submitted_for_review_at=now - timedelta(days=5),
                secretary_reviewed_by=secretary, secretary_reviewed_at=now - timedelta(days=4),
                chairman_reviewed_by=chair, chairman_reviewed_at=now - timedelta(days=4),
            )

        self.stdout.write(self.style.SUCCESS(
            f"Created {MEETING_REF} with {len(blocks)} decided papers and minutes awaiting signature. "
            "No emails, notifications or AI calls were made."))

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

    def _paper(self, seq, row, ministry, creator, meeting, now):
        ref, title, category, unit, summary, _discussion, _decision, _decision_type = row
        sub = Submission.objects.create(
            reference_number=ref, title=title, ministry=ministry, form_type_code="",
            agenda_category=category, routed_unit=unit, is_test=True, notes=summary,
            # Still before the Commission: allocating the tasks is what moves
            # each paper on to its recorded outcome.
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=now - timedelta(days=20), created_by=creator,
            scheduled_meeting=meeting,
        )
        doc = SubmissionDocument(
            submission=sub, original_name="Board paper.pdf", description="Board paper", uploaded_by=creator,
            ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=f"Board paper. {summary}",
            ocr_processed_at=now,
        )
        doc.file.save("Board paper.pdf", ContentFile(_pdf("Board paper", summary, 1)), save=False)
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
        return AgendaItem.objects.create(
            meeting=meeting, submission=sub, sequence=seq, category=category,
            agenda_blurb=summary.split(". ")[0] + ".", agenda_blurb_processed=True,
        )
