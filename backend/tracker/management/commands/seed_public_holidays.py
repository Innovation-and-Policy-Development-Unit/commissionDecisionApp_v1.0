"""
Management command: seed_public_holidays

Puts Vanuatu public holidays for one or more years into the PublicHoliday
table, including the weekday-in-lieu observances for holidays that fall at a
weekend. The rules live in tracker/holidays.py.

Holidays drive add_working_days() and working_days_elapsed(), which set the DG
SLA date, the escalation date, the minutes-review deadline and the assessment
and checklist deadlines. An unseeded year means every holiday in it silently
counts as a working day, so seed ahead of time.

Safe by default: without --execute this only reports what would be written.
Existing dates are never overwritten, so a second run is a no-op.

Usage:
    python manage.py seed_public_holidays 2029              # dry run
    python manage.py seed_public_holidays 2029 2030 --execute
    python manage.py seed_public_holidays --from 2029 --to 2035 --execute
    python manage.py seed_public_holidays --missing --execute   # unseeded years ahead
"""

from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tracker.holidays import holidays_for
from tracker.models import PublicHoliday

LOOKAHEAD_YEARS = 5


class Command(BaseCommand):
    help = 'Seed Vanuatu public holidays (with weekend observances) for given years.'

    def add_arguments(self, parser):
        parser.add_argument('years', nargs='*', type=int, help='Years to seed.')
        parser.add_argument('--from', dest='year_from', type=int, help='Start of a year range.')
        parser.add_argument('--to', dest='year_to', type=int, help='End of a year range, inclusive.')
        parser.add_argument(
            '--missing', action='store_true',
            help=f'Seed any unseeded year from this one to this one + {LOOKAHEAD_YEARS}.',
        )
        parser.add_argument('--execute', action='store_true', help='Write to the database.')

    def _years(self, opts):
        if opts['missing']:
            this = date.today().year
            seeded = set(
                PublicHoliday.objects.values_list('year', flat=True).distinct()
            )
            return [y for y in range(this, this + LOOKAHEAD_YEARS + 1) if y not in seeded]
        if opts['year_from'] or opts['year_to']:
            lo, hi = opts['year_from'], opts['year_to']
            if not (lo and hi):
                raise CommandError('--from and --to must be given together.')
            if hi < lo:
                raise CommandError('--to must not be before --from.')
            return list(range(lo, hi + 1))
        if opts['years']:
            return sorted(set(opts['years']))
        raise CommandError('Give one or more years, or --from/--to, or --missing.')

    def handle(self, *args, **opts):
        years = self._years(opts)
        if not years:
            self.stdout.write('Nothing to do: every year in range is already seeded.')
            return

        execute = opts['execute']
        created = skipped = 0

        with transaction.atomic():
            for year in years:
                # Rows outside this year can own an observance date that lands
                # inside it (a 31 December holiday observed on 2 January), so
                # resolve collisions against everything already stored.
                taken = set(PublicHoliday.objects.values_list('date', flat=True))
                rows = holidays_for(year, taken=taken)
                self.stdout.write(self.style.MIGRATE_HEADING(f'{year}'))
                for day, name in rows:
                    if day in taken:
                        skipped += 1
                        self.stdout.write(f'  = {day}  {name}  (already present)')
                        continue
                    created += 1
                    self.stdout.write(f'  + {day}  {day.strftime("%a")}  {name}')
                    if execute:
                        PublicHoliday.objects.get_or_create(
                            date=day, defaults={'name': name, 'year': day.year}
                        )
            if not execute:
                transaction.set_rollback(True)

        tail = '' if execute else '  (dry run — nothing written; pass --execute)'
        self.stdout.write(
            self.style.SUCCESS(f'{created} to add, {skipped} already present.{tail}')
        )
