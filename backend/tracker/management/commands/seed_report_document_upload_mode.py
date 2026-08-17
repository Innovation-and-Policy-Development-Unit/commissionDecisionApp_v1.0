"""
Switch the five ODU report submission types (Annual Report, Business Plan,
Corporate Plan, Half Yearly Report, Quarterly Report) from "fill in a
digitized form" to "attach your report as a document" — per stasombo's
(ODU Principal) feedback after reviewing the newly implemented checklists:
ministries shouldn't have to re-type their report into a web form section
by section, they should just upload the report they already wrote (e.g.
their Business Plan Word doc) and let the checklist check it.

This does NOT touch the digitized-form field definitions built by
seed_report_submission_forms.py / the pre-existing ANNUAL-REPORT etc. forms
— they're left in place (harmless, still describe what "sections" the
checklist cares about) but is_digitized=False hides the Digitized Form tab
in the UI, so ministries only see Required Documents.

Checklist prefill for these five is unaffected by this switch: the
deterministic field-presence prefill in submission_checklist_prefill.py
already degrades to "leave blank" when there's no dynamic form data (which
is now always the case going forward), so review correctly falls through
to AI autofill reading the attached document's OCR'd text instead — see
ai/checklist_autofill.py's PER_DOCUMENT_TEXT_CAP, already raised for this.
"""

from django.core.management.base import BaseCommand


REPORT_FORM_TYPES = [
    ("ANNUAL-REPORT", "Annual Report"),
    ("BUSINESS-PLAN", "Business Plan"),
    ("CORPORATE-PLAN", "Corporate Plan"),
    ("HALF-YEARLY-REPORT", "Half Yearly Report"),
    ("QUARTERLY-REPORT", "Quarterly Report"),
]


class Command(BaseCommand):
    help = "Switch the five ODU report submission types to document-upload mode (no digitized form tab)."

    def handle(self, *args, **options):
        from tracker.models import PSCFormType, RequiredDocument

        for code, label in REPORT_FORM_TYPES:
            ft = PSCFormType.objects.get(code=code)
            if ft.is_digitized:
                ft.is_digitized = False
                ft.save(update_fields=["is_digitized"])
            self.stdout.write(self.style.SUCCESS(f"  [{code}] Digitized Form tab disabled"))

            # Some of these already had an active "attach your signed report"
            # requirement from earlier work (e.g. BUSINESS-PLAN's "Signed
            # Ministry Business Plan Document") — don't add a second,
            # near-identical one asking for the same file under a different
            # name. Only fill a genuine gap (Half Yearly / Quarterly Report,
            # which had none).
            existing = ft.required_documents.filter(
                is_active=True, item_type=RequiredDocument.ItemType.DOCUMENT,
            ).first()
            if existing:
                self.stdout.write(f"      already covered by: {existing.name}")
                continue

            rd = RequiredDocument.objects.create(
                form_type=ft,
                name=f"{label} Document",
                description=f"Attach the Ministry's {label.lower()} as a single document "
                             "(Word or PDF). ODU's checklist reviews this document directly — "
                             "no need to re-enter its content into a form.",
                item_type=RequiredDocument.ItemType.DOCUMENT,
                mandatory_for_stage="manager_checklist_review",
                is_active=True,
                order=1,
            )
            self.stdout.write(self.style.SUCCESS(f"      [created] Required Document: {rd.name}"))

        self.stdout.write(self.style.SUCCESS("\n[OK] Report submission types switched to document-upload mode."))
