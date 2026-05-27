"""Re-apply OPSC unit role permissions from seed_tracker (no submissions/users)."""

from django.core.management.base import BaseCommand

from tracker.management.commands.seed_tracker import Command as SeedCommand


class Command(BaseCommand):
    help = "Sync system permissions and OPSC role definitions from seed_tracker (idempotent)."

    def handle(self, *args, **options):
        seed = SeedCommand()
        seed.stdout = self.stdout
        seed.style = self.style
        seed._seed_permissions()
        seed._seed_role_definitions()
        self.stdout.write(self.style.SUCCESS("OPSC role permissions synced."))
