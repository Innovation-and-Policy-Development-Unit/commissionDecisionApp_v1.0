"""Give every agenda item its number (Adoption 1, Minute 2, Matters Arising 3, submissions from 4).

Agendas that are still being built are renumbered in full; circulated ones keep the numbers they have
and only items without a number get the next one. Safe to run any time.

    python manage.py renumber_agendas
"""
from django.core.management.base import BaseCommand

from tracker.agenda_document import renumber_agenda
from tracker.models import Meeting


class Command(BaseCommand):
    help = "Number agenda items on every sitting (frozen agendas keep their numbers)."

    def handle(self, *args, **opts):
        n = 0
        for m in Meeting.objects.all():
            renumber_agenda(m)
            n += 1
        self.stdout.write(self.style.SUCCESS(f"Checked {n} sitting(s)."))
