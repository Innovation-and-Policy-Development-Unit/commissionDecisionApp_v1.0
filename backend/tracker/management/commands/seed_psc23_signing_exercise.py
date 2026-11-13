"""
Management command: seed_psc23_signing_exercise

A practice sitting modelled on the real "PSC Meeting No. 23 of Friday 02 October
2026" minutes, so Manager CSU can rehearse the whole signing leg on realistic
content:

  1. download the minutes for signature (they are already "Awaiting signature");
  2. upload the signed scan (the real signed Minutes No. 23 PDF is handed to the
     tester separately; the file is NOT created here);
  3. a Secretary allocates the decisions to the unit managers;
  4. the managers assign officers and work the tasks.

What is created:

  * "TRAIN-PSC23-MTG-001" — a completed practice sitting dated 2 October 2026;
  * 16 test submissions ("TRAIN-PSC23-001" ...), each rebuilt from one real
    decision in the minutes, keeping its real decision number (for example
    "03(n)-23-2026") and its Action Officer, routed to HR, Compliance, VIPAM
    or CSU;
  * a short board-paper PDF per submission, written from the minute text;
  * the minutes themselves, status "Awaiting signature", with a decision on
    every item.

People are not named. Where the real minute names an officer, candidate or
disciplined employee, the practice record says "the officer" or "Officer A",
so no real person's case sits in practice data.

Like seed_decision_tasks_practice, nothing fires while seeding (no email,
notification, automation or AI call; submissions are is_test and carry
TRAIN-PSC23-... references, so the real reference counters are untouched).
What the testers do afterwards (allocate, assign) is real: it notifies and
emails the real unit managers and the officers they pick. Warn them first.

Usage:
    python manage.py seed_psc23_signing_exercise
    python manage.py seed_psc23_signing_exercise --cleanup
"""

import os
from datetime import date, timedelta
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

MINISTRY_CODE = "TRNP"
MINISTRY_NAME = "Training Ministry — PSC 23 signing exercise (practice only)"
MEETING_REF = "TRAIN-PSC23-MTG-001"
SITTING_DATE = date(2026, 10, 2)

C = AgendaCategory
U = RoutedUnit

# (decision no. in the real minutes, title, agenda section, routed unit,
#  Action Officer shown in the real minutes, background, discussion, decision,
#  decision_type)
ITEMS = [
    (
        "01-23-2026", "Adoption of the agenda", C.PRELIMINARIES, U.CSU, "Manager CSU",
        "The Secretariat tabled the agenda of the meeting, with additional agenda items added since it "
        "was first circulated.",
        "The Chairman welcomed the Commissioners back from their official trip and congratulated the "
        "Acting Secretary on his appointment. A Commissioner stressed the importance of strengthening "
        "performance management for all public servants, especially Senior Executive Officers.",
        "The Commission adopted the agenda with the additional items 03(o) and 03(p) and Agenda 65 to "
        "Agenda 113.",
        "approved",
    ),
    (
        "02-23-2026", "Confirmation of the minutes of earlier PSC meetings", C.PRELIMINARIES, U.CSU,
        "Manager CSU",
        "Minutes of the previous Commission meetings were tabled for endorsement as a true record.",
        "The Commission considered the minutes of the August meeting. The minutes of the September "
        "meeting were not yet ready for endorsement.",
        "The Commission approved in principle the endorsement of the August minutes as a true record "
        "and deferred the endorsement of the September minutes to the next Commission meeting.",
        "approved",
    ),
    (
        "03(i)-23-2026", "Re-engagement or cessation of contract — Director IPDU (matter arising)",
        C.MATTERS_ARISING, U.CSU, "Secretary and Manager CSU",
        "Re-submission on whether to re-engage the Director of the Innovation and Policy Development "
        "Unit (IPDU), who is also acting as Secretary of the Office of the Public Service Commission.",
        "The Commission reminded the Secretariat that IPDU was created to help it manage Senior "
        "Executive Officer performance and that funds are allocated to engage local consultants. The "
        "Chairman raised the incumbent's heavy acting duties and the need for someone to run the unit. "
        "The Commission was informed that all court claims owed to the officer were settled in full.",
        "The Commission approved in consensus not to renew the contract and agreed that the OPSC "
        "advertise the post of Director IPDU. The Secretary is to ensure IPDU performs its original "
        "functions.",
        "approved",
    ),
    (
        "03(j)-23-2026", "Appointment of Area Administrator — Northwest Santo (Post 24000728)",
        C.APPOINTMENT, U.HR, "Manager HRM",
        "The Department of Local Authorities recommends a qualified candidate for the Area "
        "Administrator, Northwest Santo post, Salary Grade 4.1, annual salary VT 1,400,000.",
        "The Commission considered the panel selection report and the recommended candidate.",
        "Approved in consensus: appoint the recommended candidate on standard terms and conditions, "
        "effective 2 October 2026, with a three-month probation. Post: Area Administrator — Northwest "
        "Santo, Department of Local Authorities, Ministry of Internal Affairs.",
        "approved",
    ),
    (
        "03(k)-23-2026", "Request to extend the PSC freelance Media Officer's contract", C.CONTRACT,
        U.HR, "Manager HRM",
        "The Secretariat asks to extend the freelance Media Officer's engagement to the end of the "
        "year.",
        "Members discussed controls over what the freelance officer publishes and when he is paid.",
        "The Commission agreed to engage the freelance Media Officer from 2 October to 31 December "
        "2026. All news items must be approved by the Chairman before publication and payment will be "
        "made only after approval.",
        "approved",
    ),
    (
        "03(l)-23-2026", "Preparations for Public Service Day 2026 (postponed by the Prime Minister)",
        C.MATTERS_ARISING, U.CSU, "Manager CSU",
        "Update on Public Service Day in Motalava, Torba Province, postponed by letter from the Prime "
        "Minister.",
        "Dates are confirmed for 6 to 9 December 2026. The charter vessel departed Port Vila on "
        "1 October with 134 public servants and stakeholders on board. OPSC officers are arranging the "
        "Commission members' return tickets.",
        "The Commission noted the preparations and the revised dates and agreed that a Commission "
        "meeting will be convened in Motalava, Torba Province.",
        "noted",
    ),
    (
        "03(n)-23-2026", "Discipline report — Ministry of Health v Officer A (Case 11 of 2026)",
        C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE, "Manager CIU",
        "The Ministry of Health submitted a discipline report against an officer for the Commission's "
        "determination.",
        "The Commission considered the report and the options open to it.",
        "The Commission by consensus approved that the matter be referred to the Public Service "
        "Disciplinary Board (PSDB) for further determination.",
        "approved",
    ),
    (
        "03(o)-23-2026", "Investigation report on allegations against a provincial government "
        "Secretary-General", C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE, "Manager CIU",
        "The Commission is asked to note the investigation report of the investigative panel on "
        "allegations raised against a provincial government council Secretary-General.",
        "Members asked for more time to study the report.",
        "The Commission by consensus decided to defer the agenda item.",
        "deferred",
    ),
    (
        "04-23-2026", "Response to the Commission's 14 days' notice — vehicle damage",
        C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE, "Manager CIU",
        "The Commission is asked to consider an officer's response to its 14 days' notice about the "
        "cost of damage to a Government vehicle.",
        "The Commission considered the officer's response before making a final determination of the "
        "disciplinary case.",
        "The Commission by consensus approved that the officer be given 14 days' notice to make "
        "arrangements to pay for the cost of the damage to the Government vehicle. This will assist "
        "the Commission in its final determination of the case.",
        "approved",
    ),
    (
        "10-23-2026", "Responses to the 14 days' notice to show cause — Officer B, Chief Protocol "
        "Officer", C.DISCIPLINE_COMPLIANCE, U.COMPLIANCE, "Manager CIU",
        "The Commission is asked to consider the officer's response to the notice to show cause why "
        "his employment should not be terminated.",
        "A Commissioner was excused for conflict of interest as a member of the PSDB that heard the "
        "case. While on this agenda the Commission also asked the CIU Manager to follow a court case "
        "closely, asked the Manager ODU to report on Senior Executive Officers who travel without the "
        "Commission's approval, and asked the CIU Manager to start work on annual leave payout for "
        "the Ministry of Finance.",
        "The Commission by consensus decided to defer the agenda.",
        "deferred",
    ),
    (
        "16-23-2026", "Organisational Performance Feedback Report 2025 — Annual Report assessment "
        "results and recommendations (IPDU-OPSC)", C.OTHER, U.HR, "Manager HRM",
        "IPDU presents the assessment results and recommendations from the 2025 annual reports.",
        "The Commission decided the report merits a fuller discussion.",
        "The Commission approved in consensus to defer this agenda for the meeting to be held in "
        "Motalava, Torba.",
        "deferred",
    ),
    (
        "18-23-2026", "Request to devolve administrative power to the Secretary to appoint Acting "
        "SEOs", C.OTHER, U.HR, "Secretary, Manager HRM and Manager CIU",
        "The Secretariat requests devolution to the Secretary of the power to appoint Senior Executive "
        "Officers (SEOs) on an acting basis.",
        "The Commission noted that the power to appoint SEOs on an acting basis had already been "
        "given to the PSC Chairman.",
        "The Commission in consensus noted the submission and approved in principle that the "
        "Chairman, who already holds the power, will give directions to the Acting Secretary to "
        "execute.",
        "noted",
    ),
    (
        "20-23-2026", "Proposed monetary awards for the 2026 Public Service Day best three "
        "performers", C.OTHER, U.HR, "Manager HRM",
        "Proposal for the value and form of awards for the top three performers among the 13 line "
        "ministries, based on the 2025 annual performance appraisal results.",
        "Members considered the proposed amounts and whether to pay in cash or by voucher.",
        "Approved in consensus: (1) awards of VT 200,000 for first place, VT 150,000 for second and "
        "VT 100,000 for third; (2) the form of award may be a cash payment or a voucher of equivalent "
        "value.",
        "approved",
    ),
    (
        "58-23-2026", "Long-term training for four officers (on-the-job and off-the-job)",
        C.TRAINING, U.VIPAM, "Manager VIPAM",
        "VIPAM asks the Commission to approve four officers for long-term training towards full "
        "qualifications, in seismology and tsunami mitigation, maritime safety, business "
        "administration and project management.",
        "The Commission considered each officer's field and period of study, bonding period and "
        "training allowance. Study periods are one or two years and bonding periods one or three "
        "years; salary is not deducted during study.",
        "The Commission approved the long-term training of the four officers, with salary not "
        "deducted. VIPAM will conduct bi-annual audits and give updates to the PSC Secretary.",
        "approved",
    ),
    (
        "59-23-2026", "Long-term training — MBA in Aviation Management, Airworthiness Officer",
        C.TRAINING, U.VIPAM, "Manager VIPAM",
        "An Airworthiness Officer at the Civil Aviation Authority asks to undertake a one-year Master "
        "of Business Administration (Aviation Management) by distance learning, from 7 December 2026, "
        "with a partial scholarship.",
        "Because the programme leads to a formal qualification, the officer must serve the "
        "prescribed bonding period of three years unless the Commission decides otherwise. Tuition "
        "and textbook costs may be claimed back on successful completion, with receipts and "
        "transcript.",
        "The Commission approved in consensus the long-term training, with a three-year bonding "
        "agreement.",
        "approved",
    ),
    (
        "62-23-2026", "Confirmation of risk allowances — budget availability, Ministry of Youth, "
        "Justice and Community Services", C.EXTRA_RESPONSIBILITY, U.HR, "Manager HRM",
        "The Ministry asks the Commission to confirm risk allowances against its budget.",
        "The Commission considered the request and the ministry's budget availability.",
        "The Commission in consensus disapproved the risk allowance request.",
        "not_approved",
    ),
]


class Command(BaseCommand):
    help = (
        "Create (or with --cleanup remove) the PSC Meeting No. 23 replica sitting used to practise "
        "downloading minutes for signature, uploading the signed scan and allocating decision tasks."
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
            f"PSC 23 signing exercise data removed ({task_n + sub_n + mtg_n} row(s), {len(files)} file(s))."))

    # ── seed ─────────────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        if options["cleanup"]:
            return self._cleanup()
        if Meeting._base_manager.filter(reference_number=MEETING_REF).exists():
            raise CommandError("PSC 23 signing exercise data already exists. Run with --cleanup first to rebuild it.")

        creator = self._creator(options["created_by"])
        chair = User.objects.filter(psc_profile__role=Role.CHAIRPERSON, is_active=True).first()
        secretary = User.objects.filter(psc_profile__role=Role.PSC_SECRETARY, is_active=True).first()
        now = timezone.now()

        # Stub the automation queues so no rule/notification/email can fire.
        with mock.patch("tracker.tasks.queue_automation_event"), \
                mock.patch("tracker.tasks.queue_dg_signature_check"), \
                transaction.atomic():
            ministry = Ministry.objects.create(code=MINISTRY_CODE, name=MINISTRY_NAME)
            meeting = Meeting.objects.create(
                reference_number=MEETING_REF,
                title="TRAINING SITTING — replica of PSC Meeting No. 23 of 2 October 2026 (practice, not the real record)",
                date=SITTING_DATE, time="09:36", venue="VIPAM Conference Room",
                status=MeetingStatus.COMPLETED, agenda_status=AgendaStatus.CIRCULATED,
                min_items=len(ITEMS),
                agenda_approved_by=chair, agenda_approved_at=now - timedelta(days=10),
                notes="Practice sitting for the PSC 23 signing exercise. Delete after use.",
            )

            blocks = []
            sequences = {}
            for number, row in enumerate(ITEMS, start=1):
                decision_no, title, category, _unit, officer, _bg, discussion, decision, decision_type = row
                ref = f"TRAIN-PSC23-{number:03d}"
                sequences[category] = sequences.get(category, 0) + 1
                item = self._paper(ref, sequences[category], row, ministry, creator, meeting, now)
                blocks.append({
                    "agenda_item_id": item.id,
                    "sequence": number,
                    "submission_ref": ref,
                    "title": f"{decision_no} — {title}",
                    "discussion": discussion,
                    "decision": f"{decision} (Action Officer: {officer})",
                    "decision_type": decision_type,
                    "action_items": [],
                })

            Minutes.objects.create(
                meeting=meeting,
                status=MinutesStatus.AWAITING_SIGNATURE,
                created_by=creator,
                content={
                    "opening": "PRACTICE REPLICA. The sitting opened at 9:36 am with a prayer. Present: the "
                               "Chairman, four Commissioners and the Acting Secretary.",
                    "confirmation_previous_minutes": "See item 02-23-2026.",
                    "agenda_items": blocks,
                    "any_other_business": "None.",
                    "closing": "The sitting closed.",
                },
                submitted_for_review_by=creator, submitted_for_review_at=now - timedelta(days=5),
                secretary_reviewed_by=secretary, secretary_reviewed_at=now - timedelta(days=4),
                chairman_reviewed_by=chair, chairman_reviewed_at=now - timedelta(days=4),
            )

        self.stdout.write(self.style.SUCCESS(
            f"Created {MEETING_REF} with {len(blocks)} test submissions and minutes awaiting signature. "
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

    def _paper(self, ref, seq, row, ministry, creator, meeting, now):
        decision_no, title, category, unit, officer, background, _discussion, _decision, _decision_type = row
        full_title = f"[TRAINING] {decision_no} — {title}"[:255]
        sub = Submission.objects.create(
            reference_number=ref, title=full_title, ministry=ministry, form_type_code="",
            agenda_category=category, routed_unit=unit, is_test=True, notes=background,
            # Still before the Commission: allocating the tasks is what moves
            # each paper on to its recorded outcome.
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=now - timedelta(days=20), created_by=creator,
            scheduled_meeting=meeting,
        )
        text = (f"{background} Rebuilt from decision {decision_no} of PSC Meeting No. 23 "
                f"(Action Officer: {officer}).")
        doc = SubmissionDocument(
            submission=sub, original_name="Board paper.pdf", description="Board paper", uploaded_by=creator,
            ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=f"Board paper. {text}",
            ocr_processed_at=now,
        )
        doc.file.save("Board paper.pdf", ContentFile(_pdf(f"Board paper — {decision_no}", text, 1)), save=False)
        doc.save()

        from ...tasks import compute_submission_ai_context_key
        key = compute_submission_ai_context_key(sub)
        Submission.objects.filter(pk=sub.pk).update(
            ai_brief_summary=background, ai_brief_processed=True, ai_brief_generated_at=now,
            ai_brief_context_key=key,
            ai_quality_score=75, ai_quality_processed=True, ai_quality_generated_at=now,
            ai_quality_context_key=key, ai_quality_review_effort="moderate",
            ai_quality_explanation="Practice data: pre-written for training, not an AI assessment.",
        )
        return AgendaItem.objects.create(
            meeting=meeting, submission=sub, sequence=seq, category=category,
            agenda_blurb=background.split(". ")[0].rstrip(".") + ".", agenda_blurb_processed=True,
        )
