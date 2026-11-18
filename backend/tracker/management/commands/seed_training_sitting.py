"""
Management command: seed_training_sitting

Builds the practice data used in the Commissioner training session
(docs/training/commissioner-training-program.md):

  * a "TRAINING SITTING" with an endorsed/circulated agenda of four items;
  * four practice submissions under a "Training Ministry", each with real
    PDF attachments and a pre-written AI brief and quality score;
  * a completed previous practice sitting whose minutes are circulated to
    Commissioners for comment, plus a deferral that carries one item over.

Nothing here touches real data or real people:
  * records carry TRAIN-... reference numbers, so the PSC-YYYY-nnnnn and
    MTG-YYYY-nnn counters are never consumed;
  * the AI brief/quality fields are filled in directly, so no AI API call is
    made now or when a Commissioner opens an item;
  * no email, notification or automation is fired (queue_automation_event is
    stubbed while seeding, and the agenda-circulated email is never sent).

Usage:
    python manage.py seed_training_sitting              # create (agenda already circulated)
    python manage.py seed_training_sitting --stage draft --date 2026-11-20
                                                        # agenda starts as a draft: Secretary submits,
                                                        # Chairperson endorses live (sends real emails)
    python manage.py seed_training_sitting --cleanup    # remove all of it
"""

import datetime
from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from ...models import (
    AgendaDeferral,
    AgendaItem,
    AgendaSection,
    AgendaStatus,
    DeferralType,
    DocumentOcrStatus,
    Meeting,
    MeetingStatus,
    Minutes,
    MinutesComment,
    MinutesStatus,
    Ministry,
    Role,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)

MINISTRY_CODE = "TRN"
# The agenda heading takes its number from the trailing digits of the reference ("PSC MEETING NO. 99").
CURRENT_REF = "TRAIN-MTG-099"
LEGACY_CURRENT_REF = "TRAIN-MTG-001"  # used before 2026-11-19; still removed by --cleanup
PREVIOUS_REF = "TRAIN-MTG-000"
SIGNING_REF = "TRAIN-MTG-002"

# (ref, title, section hints, form code, summary, quality, documents[(name, description, pages)])
SUBMISSIONS = [
    (
        "TRAIN-2026-001",
        "[TRAINING] Corporate Services Division restructure — Training Ministry",
        ("structure", "organ", "restruct"), "PSC 2-1",
        "The Training Ministry proposes merging two administrative units into one Corporate Services "
        "Division, abolishing one Clerk III post and creating two Principal Analyst posts. Cost impact is "
        "neutral in year 1. Union consultation is planned before the sitting. Before/after organisation "
        "charts and draft job descriptions are attached.",
        82,
        [("Restructure proposal letter.pdf", "Proposal letter", 2),
         ("Organisation chart before and after.pdf", "Organisation charts", 1)],
    ),
    (
        "TRAIN-2026-002",
        "[TRAINING] Appointment of Director of Policy — Training Ministry",
        ("appointment",), "PSC 3-1",
        "The Training Ministry requests approval to appoint a Director of Policy following open "
        "advertisement. One candidate is recommended after a panel interview. The Director-General's "
        "approval was obtained on paper; the signed copy is attached and the signing date is recorded.",
        74,
        [("Signed DG approval letter.pdf", "DG approval (paper, signed copy)", 1),
         ("Panel selection report.pdf", "Selection report", 3)],
    ),
    (
        "TRAIN-2026-003",
        "[TRAINING] Request to employ contract staff — Training Ministry",
        ("contract",), "PSC 3-7",
        "The Training Ministry requests approval to employ two contract staff for the 2027 statistics "
        "programme. The 12-page draft contract terms are attached. Main points: a 12-month term, the "
        "salary scale used, and a review clause after six months.",
        68,
        [("Draft contract terms.pdf", "Draft contract terms, 12 pages", 12)],
    ),
    (
        "TRAIN-2026-004",
        "[TRAINING] Acting appointment — Chief Accountant, Training Ministry (deferred from previous sitting)",
        ("appointment",), "PSC 3-4",
        "This item was deferred at the previous sitting so the ministry could confirm the officer's "
        "qualifications. The confirmation letter is now attached. It shows in the Deferred agenda with its "
        "history.",
        71,
        [("Qualification confirmation letter.pdf", "Confirmation letter", 1)],
    ),
]

PREVIOUS_MINUTES = {
    "opening": "The Chairperson opened the practice sitting at 9:05 am and welcomed all members.",
    "confirmation_previous_minutes": "Minutes of the earlier practice sitting were confirmed without amendment.",
    "agenda_items": [
        {
            "submission_ref": "TRAIN-2026-P01",
            "title": "[TRAINING] Transfer of Senior Officer — Training Ministry",
            "discussion": "The Commission noted the ministry's reasons and the officer's consent.",
            "decision": "Approved as submitted.",
            "decision_type": "approved",
            "action_items": [{"action": "Notify the ministry of the decision",
                              "responsible": "Secretary", "deadline": "within 5 working days"}],
        },
        {
            "submission_ref": "TRAIN-2026-004",
            "title": "[TRAINING] Acting appointment — Chief Accountant, Training Ministry",
            "discussion": "The Commission asked for confirmation of the officer's qualifications.",
            "decision": "Deferred to the next sitting.",
            "decision_type": "deferred",
        },
    ],
    "any_other_business": "None raised.",
    "closing": "The practice sitting closed at 11:30 am.",
}


SIGNING_MINUTES = {
    "opening": "The Chairperson opened the practice sitting at 9:00 am and welcomed all members.",
    "confirmation_previous_minutes": "Minutes of the earlier practice sitting were confirmed without amendment.",
    "agenda_items": [
        {
            "submission_ref": "TRAIN-2026-S01",
            "title": "[TRAINING] Appointment of Principal Analyst — Training Ministry",
            "discussion": "The Commission considered the panel's selection report and the Director-General's paper approval.",
            "decision": "Approved as submitted.",
            "decision_type": "approved",
            "action_items": [{"action": "Notify the ministry of the decision",
                              "responsible": "Secretary", "deadline": "within 5 working days"}],
        },
        {
            "submission_ref": "TRAIN-2026-S02",
            "title": "[TRAINING] Revised acting allowance rates — Training Ministry",
            "discussion": "The Commission asked for costings against the current budget.",
            "decision": "Deferred to the next sitting.",
            "decision_type": "deferred",
        },
        {
            "submission_ref": "TRAIN-2026-S03",
            "title": "[TRAINING] Quarterly staffing report — Training Ministry",
            "discussion": "The Commission noted the report.",
            "decision": "Noted.",
            "decision_type": "noted",
        },
    ],
    "any_other_business": "None raised.",
    "closing": "The practice sitting closed at 11:00 am.",
}


def _pdf(title, text, pages):
    """A small real PDF so the document viewer has something to open."""
    from weasyprint import HTML

    body = "".join(
        f"<section style='page-break-after:always'><h2>{title}</h2>"
        f"<p><em>TRAINING DOCUMENT — fictional, for practice only. Page {i} of {pages}.</em></p>"
        f"<p>{text}</p></section>"
        for i in range(1, pages + 1)
    )
    return HTML(string=f"<html><body style='font-family:sans-serif'>{body}</body></html>").write_pdf()


class Command(BaseCommand):
    help = "Create (or with --cleanup remove) the practice sitting data for Commissioner training."

    def add_arguments(self, parser):
        parser.add_argument("--cleanup", action="store_true", help="Remove all training data and exit.")
        parser.add_argument(
            "--stage", choices=["circulated", "draft"], default="circulated",
            help="Where the training agenda starts. 'circulated' (default): already endorsed and "
                 "circulated. 'draft': the Secretary submits it to the Chairperson and the Chairperson "
                 "endorses it live, which sends the real agenda-circulated email to Commission members.")
        parser.add_argument(
            "--signing-sitting", action="store_true",
            help="Also create TRAIN-MTG-002: a completed practice sitting whose reviewed minutes are "
                 "awaiting signature, for the Manager CSU 'download for signature / upload signed "
                 "scan' session.")
        parser.add_argument("--date", default="",
                            help="Sitting date, YYYY-MM-DD (default: one week from today).")
        parser.add_argument("--created-by", default="",
                            help="Username recorded as creator (default: first PSC Admin / Senior Admin Officer).")

    # ── cleanup ──────────────────────────────────────────────────────────────

    def _cleanup(self):
        refs = [CURRENT_REF, LEGACY_CURRENT_REF, PREVIOUS_REF, SIGNING_REF]
        files = [d.file.name for d in SubmissionDocument.all_objects.filter(
            submission__ministry__code=MINISTRY_CODE) if d.file]
        with transaction.atomic():
            sub_n = Submission._base_manager.filter(ministry__code=MINISTRY_CODE).delete()[0]
            mtg_n = Meeting._base_manager.filter(reference_number__in=refs).delete()[0]
            Ministry.objects.filter(code=MINISTRY_CODE).delete()
        import os
        from django.conf import settings
        root = os.path.realpath(settings.MEDIA_ROOT or "")
        for name in files:
            path = os.path.realpath(os.path.join(root, name))
            if root and path.startswith(root + os.sep):
                try:
                    os.remove(path)
                except OSError:
                    pass
        self.stdout.write(self.style.SUCCESS(
            f"Training data removed ({sub_n + mtg_n} row(s), {len(files)} file(s)). Users untouched."))

    # ── seed ─────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        if options["cleanup"]:
            return self._cleanup()

        if Meeting._base_manager.filter(reference_number__in=[CURRENT_REF, LEGACY_CURRENT_REF, PREVIOUS_REF, SIGNING_REF]).exists():
            raise CommandError("Training data already exists. Run with --cleanup first to rebuild it.")

        try:
            sitting_date = (datetime.date.fromisoformat(options["date"]) if options["date"]
                            else timezone.now().date() + timedelta(days=7))
        except ValueError:
            raise CommandError("--date must be YYYY-MM-DD.")
        draft = options["stage"] == "draft"
        creator = self._creator(options["created_by"])
        chair = User.objects.filter(psc_profile__role=Role.CHAIRPERSON, is_active=True).first()
        now = timezone.now()

        # Stub the automation queue so no rule/notification/email can fire.
        with mock.patch("tracker.tasks.queue_automation_event"), transaction.atomic():
            ministry, _ = Ministry.objects.get_or_create(
                code=MINISTRY_CODE, defaults={"name": "Training Ministry (practice only)"})

            previous = Meeting.objects.create(
                reference_number=PREVIOUS_REF, title="TRAINING SITTING — previous (practice only)",
                date=now.date() - timedelta(days=14), time="09:00", venue="OPSC Boardroom",
                status=MeetingStatus.COMPLETED, agenda_status=AgendaStatus.CIRCULATED,
            )
            current = Meeting.objects.create(
                reference_number=CURRENT_REF, title="TRAINING SITTING — practice only, not real",
                date=sitting_date, time="09:00", venue="OPSC Boardroom",
                psc_meeting_number="99", status=MeetingStatus.SCHEDULED,
                show_live_outcomes=True,
                agenda_status=AgendaStatus.DRAFT if draft else AgendaStatus.CIRCULATED, min_items=4,
                agenda_approved_by=None if draft else chair,
                agenda_approved_at=None if draft else now - timedelta(days=1),
                notes="Practice sitting for Commissioner training. Delete after use.",
            )

            items = []
            for seq, row in enumerate(SUBMISSIONS, start=1):
                items.append(self._submission(seq, row, ministry, creator, current, now))

            # The deferred item: carried from the previous sitting.
            deferred_sub, deferred_item = items[3]
            AgendaDeferral.objects.create(
                submission=deferred_sub, agenda_item=deferred_item, from_meeting=previous,
                to_meeting=current, deferral_type=DeferralType.TO_NEXT_MEETING,
                reason="Ministry to confirm the officer's qualifications.", deferred_by=creator,
            )

            if options["signing_sitting"]:
                signing = Meeting.objects.create(
                    reference_number=SIGNING_REF,
                    title="TRAINING SITTING — minutes awaiting signature (practice only)",
                    date=now.date() - timedelta(days=7), time="09:00", venue="OPSC Boardroom",
                    status=MeetingStatus.COMPLETED, agenda_status=AgendaStatus.CIRCULATED,
                )
                Minutes.objects.create(
                    meeting=signing, status=MinutesStatus.AWAITING_SIGNATURE,
                    content=SIGNING_MINUTES, created_by=creator,
                )

            minutes = Minutes.objects.create(
                meeting=previous, status=MinutesStatus.CIRCULATED_TO_COMMISSIONERS,
                content=PREVIOUS_MINUTES, created_by=creator,
                commissioner_circulated_at=now,
                commissioner_review_due_at=now + timedelta(days=2),
            )
            MinutesComment.objects.create(
                minutes=minutes, author=creator,
                body="Example comment: please add the officer's grade to item 1.",
            )

        self.stdout.write(self.style.SUCCESS(
            f"Created {CURRENT_REF} (agenda {options['stage']}, {len(items)} items, sitting {sitting_date}) "
            f"and {PREVIOUS_REF} "
            f"(minutes circulated to Commissioners, due {minutes.commissioner_review_due_at:%d %b %Y}). "
            "No emails or AI calls were made. Other Matters is deliberately left empty."))

    def _creator(self, username):
        qs = User.objects.filter(is_active=True)
        if username:
            user = qs.filter(username=username).first()
            if not user:
                raise CommandError(f"No active user '{username}'.")
            return user
        user = qs.filter(psc_profile__role__in=[Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER]).first()
        if not user:
            raise CommandError("No PSC Admin / Senior Admin Officer found; pass --created-by.")
        return user

    def _section(self, hints):
        sections = list(AgendaSection.objects.filter(is_active=True, is_special=False))
        for hint in hints:
            for s in sections:
                if hint in s.code.lower():
                    return s.code
        return sections[0].code if sections else ""

    def _submission(self, seq, row, ministry, creator, meeting, now):
        ref, title, hints, form_code, summary, quality, docs = row
        category = self._section(hints)
        sub = Submission.objects.create(
            reference_number=ref, title=title, ministry=ministry, form_type_code=form_code,
            agenda_category=category, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=now - timedelta(days=10), created_by=creator,
            scheduled_meeting=meeting,
        )
        for name, description, pages in docs:
            text = f"{description}. {summary}"
            doc = SubmissionDocument(
                submission=sub, original_name=name, description=description, uploaded_by=creator,
                ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=text, ocr_processed_at=now,
            )
            doc.file.save(name, ContentFile(_pdf(description, summary, pages)), save=False)
            doc.save()

        from ...tasks import compute_submission_ai_context_key
        key = compute_submission_ai_context_key(sub)
        Submission.objects.filter(pk=sub.pk).update(
            ai_brief_summary=summary, ai_brief_processed=True, ai_brief_generated_at=now,
            ai_brief_context_key=key,
            ai_quality_score=quality, ai_quality_processed=True, ai_quality_generated_at=now,
            ai_quality_context_key=key, ai_quality_review_effort="moderate",
            ai_quality_explanation="Practice data: pre-written for training, not an AI assessment.",
        )
        item = AgendaItem.objects.create(
            meeting=meeting, submission=sub, sequence=seq, category=category,
            form_type_code=form_code, agenda_blurb=summary.split(". ")[0] + ".",
            agenda_blurb_processed=True,
        )
        return sub, item
