"""
Seed commission sittings eligible for Minute intake (chairman_approved / circulated + agenda items).

Usage:
    python manage.py seed_minute_intake
    python manage.py seed_minute_intake --with-sample-notes
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from tracker.minute_intake import ensure_intake_rows
from tracker.models import (
    AgendaCategory,
    AgendaItem,
    AgendaStatus,
    Meeting,
    Submission,
    WorkflowStage,
)

# (reference_number, agenda_status after seed)
MINUTE_INTAKE_SITTINGS = (
    ("MTG-2026-011", AgendaStatus.CIRCULATED),
    ("MTG-2026-012", AgendaStatus.CHAIRMAN_APPROVED),
)

SAMPLE_BLURBS = (
    "The Secretariat tabled the submission and briefed members on eligibility and documentation.",
    "Members discussed the proposal and sought clarification on implementation timelines.",
    "The Chair invited the responsible officer to respond to questions raised by members.",
)

SAMPLE_NOTES = (
    (
        "Members noted the submission. The responsible director confirmed all documentation is complete.",
        "APPROVED — appointment to proceed subject to standard HR clearance.",
        "Director General, Ministry of Health",
    ),
    (
        "Discussion covered merit, vacancy confirmation, and policy compliance.",
        "APPROVED — promotion effective from the first day of the month following the sitting.",
        "Human Resources Manager, MFEM",
    ),
    (
        "The item was stood down briefly while members reviewed the annex. No objections were raised on return.",
        "NOTED — Secretariat to circulate the implementation letter within five working days.",
        "Senior Admin Officer, PSC Secretariat",
    ),
)


class Command(BaseCommand):
    help = "Seed sittings with circulated/approved agendas for the Minute intake page."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-sample-notes",
            action="store_true",
            help="Pre-fill discussion/decision notes on intake rows (no Claude formatting).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        updated_meetings = 0
        created_items = 0

        for ref, agenda_status in MINUTE_INTAKE_SITTINGS:
            meeting = Meeting.objects.filter(reference_number=ref).first()
            if not meeting:
                self.stdout.write(self.style.WARNING(f"  [SKIP] Meeting {ref} not found."))
                continue

            if meeting.agenda_status != agenda_status:
                meeting.agenda_status = agenda_status
                meeting.save(update_fields=["agenda_status"])
                updated_meetings += 1

            created_items += self._ensure_agenda_items(meeting)

            rows = ensure_intake_rows(meeting)
            if options["with_sample_notes"]:
                self._apply_sample_notes(rows)

            self.stdout.write(
                f"  [OK] {ref}: agenda_status={agenda_status}, "
                f"agenda_items={meeting.agenda_items.count()}, intake_rows={len(rows)}"
            )

        # Any other meeting already circulated/approved but empty — top up agenda items
        for meeting in Meeting.objects.filter(
            agenda_status__in=[AgendaStatus.CHAIRMAN_APPROVED, AgendaStatus.CIRCULATED],
        ).exclude(reference_number__in=[r for r, _ in MINUTE_INTAKE_SITTINGS]):
            if meeting.agenda_items.exists():
                ensure_intake_rows(meeting)
                continue
            n = self._ensure_agenda_items(meeting)
            if n:
                ensure_intake_rows(meeting)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [OK] {meeting.reference_number}: added {n} agenda items"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[OK] Minute intake seed done "
                f"({updated_meetings} agenda statuses updated, {created_items} agenda items created)."
            )
        )
        self.stdout.write("  Open: Commission Decision → Minute intake")

    def _ensure_agenda_items(self, meeting: Meeting) -> int:
        if meeting.agenda_items.count() >= 3:
            self._fill_blurbs(meeting)
            return 0

        stages = [
            WorkflowStage.COMMISSION_SITTING,
            WorkflowStage.FORWARDED_TO_COMMISSION,
            WorkflowStage.APPROVED,
        ]
        subs = list(
            Submission.objects.filter(current_stage__in=stages).order_by("id")[:8]
        )
        if not subs:
            subs = list(Submission.objects.order_by("-id")[:5])
        if not subs:
            self.stdout.write(
                self.style.WARNING(
                    f"    [SKIP] No submissions in DB — run seed_tracker first for {meeting.reference_number}."
                )
            )
            return 0

        created = 0
        seq = 0
        for sub in subs:
            if meeting.agenda_items.filter(submission=sub).exists():
                continue
            seq += 1
            AgendaItem.objects.create(
                meeting=meeting,
                submission=sub,
                sequence=seq,
                category=AgendaCategory.APPOINTMENT if seq % 2 else AgendaCategory.OTHER,
                agenda_blurb=SAMPLE_BLURBS[(seq - 1) % len(SAMPLE_BLURBS)],
                agenda_blurb_processed=True,
            )
            created += 1
            if meeting.agenda_items.count() >= 5:
                break

        self._fill_blurbs(meeting)
        return created

    def _fill_blurbs(self, meeting: Meeting) -> None:
        for idx, item in enumerate(meeting.agenda_items.select_related("submission")):
            if (item.agenda_blurb or "").strip():
                continue
            title = item.submission.title if item.submission_id else "Agenda item"
            item.agenda_blurb = (
                f"{SAMPLE_BLURBS[idx % len(SAMPLE_BLURBS)]} ({title[:80]})"
            )
            item.agenda_blurb_processed = True
            item.save(update_fields=["agenda_blurb", "agenda_blurb_processed"])

    def _apply_sample_notes(self, rows) -> None:
        for idx, row in enumerate(rows[: len(SAMPLE_NOTES)]):
            discussion, decision, officer = SAMPLE_NOTES[idx]
            row.discussion_notes = discussion
            row.decision_text = decision
            row.action_officer = officer
            row.save(update_fields=["discussion_notes", "decision_text", "action_officer", "updated_at"])
