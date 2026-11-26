"""Add in-lieu days for public holidays that fall at a weekend.

Confirmed with the user on 2026-11-26: Vanuatu observes a weekday in lieu when a
public holiday falls on a Saturday or Sunday.

The in-lieu date is the next weekday that is not already a holiday, so two
holidays on consecutive weekend days do not collide. 2027 is the case that
forces this: Christmas Day falls on Saturday 25 December and Family Day on
Sunday 26, giving Monday 27 and Tuesday 28.

Derived from the rows already in the table rather than from a second copy of the
holiday list, so there is only one place where the holiday dates are stated
(migration 0330). Idempotent: keyed on date, and an in-lieu date that is already
a holiday is skipped.
"""
from datetime import timedelta

from django.db import migrations

SUFFIX = ' (observed)'


def add_in_lieu(apps, schema_editor):
    PublicHoliday = apps.get_model('tracker', 'PublicHoliday')
    rows = list(PublicHoliday.objects.order_by('date'))
    taken = {h.date for h in rows}

    for h in rows:
        if h.date.weekday() < 5:          # Mon-Fri, nothing to move
            continue
        if h.name.endswith(SUFFIX):       # never stack on an in-lieu day
            continue
        d = h.date + timedelta(days=1)
        while d.weekday() >= 5 or d in taken:
            d += timedelta(days=1)
        taken.add(d)
        PublicHoliday.objects.get_or_create(
            date=d, defaults={'name': h.name + SUFFIX, 'year': d.year}
        )


def remove_in_lieu(apps, schema_editor):
    """Remove only the rows this migration generated, by their name suffix."""
    PublicHoliday = apps.get_model('tracker', 'PublicHoliday')
    PublicHoliday.objects.filter(name__endswith=SUFFIX).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0330_seed_vanuatu_public_holidays'),
    ]

    operations = [
        migrations.RunPython(add_in_lieu, remove_in_lieu),
    ]
