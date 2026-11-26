"""Seed Vanuatu public holidays into PublicHoliday.

The table was created by 0112 but never populated, so `add_working_days()` —
which drives the DG SLA date, escalation date, minutes-review deadline and the
assessment/checklist deadlines — has been skipping weekends only and counting
every public holiday as a working day.

Easter-derived dates (Good Friday, Easter Monday, Ascension) are computed with
the anonymous Gregorian computus, validated against the dates previously
hardcoded in models.working_days_elapsed() for 2025 and 2026.

Seeding is idempotent and keyed on date. The reverse is a no-op on purpose:
these rows are admin-editable, and a rollback must not delete a holiday someone
corrected or a one-off holiday the government gazetted.
"""
from datetime import date, timedelta

from django.db import migrations


def _easter(year):
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


# (month, day, name) — the gazetted fixed-date holidays.
FIXED = [
    (1, 1, "New Year's Day"),
    (2, 21, 'Father Walter Lini Day'),
    (3, 5, 'Custom Chiefs’ Day'),
    (5, 1, 'Labour Day'),
    (7, 24, "Children's Day"),
    (7, 30, 'Independence Day'),
    (8, 15, 'Assumption Day'),
    (10, 5, 'Constitution Day'),
    (11, 29, 'Unity Day'),
    (12, 25, 'Christmas Day'),
    (12, 26, 'Family Day'),
]

YEARS = (2025, 2026, 2027, 2028)


def holidays_for(year):
    rows = [(date(year, m, d), name) for m, d, name in FIXED]
    e = _easter(year)
    rows += [
        (e - timedelta(days=2), 'Good Friday'),
        (e + timedelta(days=1), 'Easter Monday'),
        (e + timedelta(days=39), 'Ascension Day'),
    ]
    return sorted(rows)


def seed(apps, schema_editor):
    PublicHoliday = apps.get_model('tracker', 'PublicHoliday')
    for year in YEARS:
        for day, name in holidays_for(year):
            # The model's save() sets `year`, but data migrations use the
            # historical model, so set it explicitly.
            PublicHoliday.objects.get_or_create(
                date=day, defaults={'name': name, 'year': day.year}
            )


def unseed(apps, schema_editor):
    """Deliberately does nothing — see the module docstring."""


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0329_feedbackcomment_image'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
