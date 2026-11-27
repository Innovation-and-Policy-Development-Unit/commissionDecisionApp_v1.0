"""Public holiday generation: the computus, the weekend-in-lieu rule, the command.

Guards the regression that prompted this code: an unseeded year makes every
holiday in it count as a working day, silently.
"""
from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from tracker.holidays import (
    FALLBACK_KEY,
    easter,
    gazetted,
    holidays_for,
    in_lieu,
    is_observed,
    key_for,
)
from tracker.models import PublicHoliday, add_working_days, working_days_elapsed


class EasterTests(TestCase):
    def test_matches_known_dates(self):
        # These are the dates that were hardcoded in models.py before the fix,
        # so they double as a check that the computus reproduces production.
        self.assertEqual(easter(2025), date(2025, 4, 20))
        self.assertEqual(easter(2026), date(2026, 4, 5))
        self.assertEqual(easter(2027), date(2027, 3, 28))
        self.assertEqual(easter(2028), date(2028, 4, 16))

    def test_derived_days(self):
        rows = dict(gazetted(2026))
        self.assertEqual(rows[date(2026, 4, 3)], 'Good Friday')
        self.assertEqual(rows[date(2026, 4, 6)], 'Easter Monday')
        self.assertEqual(rows[date(2026, 5, 14)], 'Ascension Day')


class InLieuTests(TestCase):
    def test_consecutive_weekend_holidays_do_not_collide(self):
        """Christmas 2027 is a Saturday and Family Day the Sunday after it."""
        rows = dict(holidays_for(2027))
        self.assertEqual(rows[date(2027, 12, 27)], 'Christmas Day (observed)')
        self.assertEqual(rows[date(2027, 12, 28)], 'Family Day (observed)')

    def test_weekday_holidays_get_no_observance(self):
        # 2026-12-25 is a Friday; only Family Day on the Saturday moves.
        names = dict(holidays_for(2026))
        self.assertNotIn('Christmas Day (observed)', names.values())
        self.assertEqual(names[date(2026, 12, 28)], 'Family Day (observed)')

    def test_respects_dates_already_taken(self):
        rows = [(date(2027, 5, 1), 'Labour Day')]            # a Saturday
        self.assertEqual(in_lieu(rows)[0][0], date(2027, 5, 3))
        # If that Monday is already spoken for, move to the Tuesday.
        self.assertEqual(
            in_lieu(rows, taken={date(2027, 5, 3)})[0][0], date(2027, 5, 4)
        )

    def test_never_stacks_on_an_observance(self):
        rows = [(date(2027, 5, 2), 'Labour Day (observed)')]  # a Sunday
        self.assertEqual(in_lieu(rows), [])


class SeedCommandTests(TestCase):
    def _run(self, *args):
        out = StringIO()
        call_command('seed_public_holidays', *args, stdout=out)
        return out.getvalue()

    def test_migrations_seeded_the_known_years(self):
        """0330/0331 run against the test DB too; this is the guard that the
        table is never empty again, which is the bug that started all this."""
        for year in (2025, 2026, 2027, 2028):
            self.assertTrue(
                PublicHoliday.objects.filter(year=year).exists(), f'{year} unseeded'
            )
        self.assertEqual(
            PublicHoliday.objects.filter(name__endswith='(observed)').count(), 15
        )

    def test_dry_run_writes_nothing(self):
        before = PublicHoliday.objects.count()
        self._run('2029')
        self.assertEqual(PublicHoliday.objects.count(), before)
        self.assertFalse(PublicHoliday.objects.filter(year=2029).exists())

    def test_execute_seeds_and_is_idempotent(self):
        self.assertFalse(PublicHoliday.objects.filter(year=2029).exists())
        self._run('2029', '--execute')
        seeded = {h.date for h in PublicHoliday.objects.filter(year=2029)}
        self.assertEqual(seeded, {d for d, _ in holidays_for(2029) if d.year == 2029})
        total = PublicHoliday.objects.count()
        self._run('2029', '--execute')
        self.assertEqual(PublicHoliday.objects.count(), total)

    def test_range_requires_both_ends(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            self._run('--from', '2029')

    def test_seeded_year_changes_working_day_maths(self):
        """The regression itself: an unseeded year counts holidays as working days."""
        # Christmas 2029 is a Tuesday, Family Day the Wednesday.
        before = add_working_days(date(2029, 12, 24), 3)
        self._run('2029', '--execute')
        after = add_working_days(date(2029, 12, 24), 3)
        self.assertNotEqual(before, after)
        self.assertEqual(after, date(2029, 12, 31))

    def test_elapsed_uses_the_same_table(self):
        from django.utils import timezone
        from datetime import datetime
        self._run('2029', '--execute')
        s = timezone.make_aware(datetime(2029, 12, 24, 9, 0))
        e = timezone.make_aware(datetime(2029, 12, 28, 17, 0))
        # Mon 24, Tue 25 Christmas, Wed 26 Family Day, Thu 27, Fri 28 -> 3 working days.
        self.assertEqual(working_days_elapsed(s, e), 3)


class PaletteKeyTests(TestCase):
    """The frontend colours and icons key off these slugs."""

    def test_every_generated_holiday_has_a_key(self):
        # Guards the case where someone adds a holiday to FIXED but forgets the
        # KEYS entry: it would silently render in the neutral tone.
        for year in (2026, 2027, 2028):
            for day, name in holidays_for(year):
                self.assertNotEqual(
                    key_for(name), FALLBACK_KEY, f'{name} on {day} has no palette key'
                )

    def test_observed_day_shares_the_base_key(self):
        self.assertEqual(key_for('Christmas Day (observed)'), key_for('Christmas Day'))
        self.assertEqual(key_for('Christmas Day'), 'christmas')

    def test_is_observed(self):
        self.assertTrue(is_observed('Family Day (observed)'))
        self.assertFalse(is_observed('Family Day'))

    def test_unknown_name_falls_back(self):
        self.assertEqual(key_for('Cyclone Recovery Day'), FALLBACK_KEY)
        self.assertEqual(key_for(''), FALLBACK_KEY)
        self.assertEqual(key_for(None), FALLBACK_KEY)

    def test_keys_are_unique_per_holiday(self):
        keys = [key_for(n) for _, n in gazetted(2027)]
        self.assertEqual(len(keys), len(set(keys)), 'two holidays share a palette key')
