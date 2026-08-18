"""
Backfill dummy required documents on HR-unit test submissions.

The pilot/demo submissions routed to the HR unit (routed_unit='hr') were
created by walkthrough/demo accounts (htevilili, m.csu, hr.health,
hr.finance) to exercise the manager checklist review screen, but several
were never given the attachments their required-document checklist calls
for — so the checklist shows items outstanding that will never actually be
filled in by a real ministry.

This command attaches a small dummy PDF against every outstanding DOCUMENT
checklist slot on every routed_unit='hr' submission, and ticks the slot
present — same effect as the "attach for this requirement" upload flow,
just run in bulk. Idempotent: only touches items that are not already
is_present.

Usage:
    python manage.py seed_hr_test_documents
    python manage.py seed_hr_test_documents --dry-run
"""
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from tracker.models import Submission, SubmissionChecklistItem, SubmissionDocument
from tracker.submission_checklist import ensure_submission_checklist_items

_DUMMY_PDF = b"%PDF-1.4\n% Dummy test document generated for HR unit demo/test submissions.\n"


class Command(BaseCommand):
    help = "Attach dummy files for every outstanding required-document checklist slot on HR-unit test submissions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be created without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        now = timezone.now()

        submissions = Submission.objects.filter(routed_unit="hr").order_by("reference_number")
        subs_touched = 0
        docs_created = 0

        for submission in submissions:
            ensure_submission_checklist_items(submission)
            items = list(
                SubmissionChecklistItem.objects.filter(
                    submission=submission,
                    is_present=False,
                    document__item_type="document",
                ).select_related("document")
            )
            if not items:
                continue

            subs_touched += 1
            self.stdout.write(f"{submission.reference_number} — {submission.title[:60]}")
            for item in items:
                self.stdout.write(f"    + {item.document.name}")
                docs_created += 1
                if dry_run:
                    continue

                filename = f"TEST - {item.document.name}.pdf"
                SubmissionDocument.objects.create(
                    submission=submission,
                    required_document=item.document,
                    file=SimpleUploadedFile(filename, _DUMMY_PDF, content_type="application/pdf"),
                    original_name=filename,
                    description=f"[TEST] Dummy attachment for {item.document.name}",
                    uploaded_by=submission.created_by,
                )
                item.is_present = True
                item.checked_by = submission.created_by
                item.checked_at = now
                item.notes = "[TEST] Dummy document auto-attached for demo/testing."
                item.save(update_fields=["is_present", "checked_by", "checked_at", "notes"])

        verb = "Would attach" if dry_run else "Attached"
        self.stdout.write(self.style.SUCCESS(
            f"\n[OK] {verb} {docs_created} dummy document(s) across {subs_touched} HR-unit test submission(s)."
        ))
