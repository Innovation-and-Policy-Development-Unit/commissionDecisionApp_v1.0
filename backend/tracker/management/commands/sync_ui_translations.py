"""Import UI strings from frontend locale JSON into the database."""
from django.core.management.base import BaseCommand

from tracker.ui_translation_views import _sync_from_locale_files


class Command(BaseCommand):
    help = "Sync UI translation keys from frontend/src/i18n/locales/*.json into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite rows even when marked customized in the admin UI.",
        )

    def handle(self, *args, **options):
        stats = _sync_from_locale_files(force=options["force"])
        self.stdout.write(
            self.style.SUCCESS(
                f"UI translations: {stats['total_keys']} keys, "
                f"{stats['created']} created, {stats['updated']} updated, "
                f"{stats['skipped']} skipped (customized)."
            )
        )
