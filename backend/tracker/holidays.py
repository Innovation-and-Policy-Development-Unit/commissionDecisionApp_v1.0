"""Canonical Vanuatu public holiday rules.

One place that states which days are public holidays and how weekend holidays
are observed. Use `manage.py seed_public_holidays <year>` to put a year into the
`PublicHoliday` table.

Migrations 0330 and 0331 deliberately carry their own frozen copies of this
logic. A data migration must keep doing what it did when it was written, so it
must not import this module — if the rules change here, that is a new migration
or a fresh run of the command, never a silent change to history.
"""
from datetime import date, timedelta

OBSERVED_SUFFIX = ' (observed)'

# The gazetted fixed-date holidays: (month, day, name).
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


def easter(year):
    """Easter Sunday by the anonymous Gregorian computus."""
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


def gazetted(year):
    """The year's holidays before any weekend observance, date-ordered."""
    rows = [(date(year, m, d), name) for m, d, name in FIXED]
    e = easter(year)
    rows += [
        (e - timedelta(days=2), 'Good Friday'),
        (e + timedelta(days=1), 'Easter Monday'),
        (e + timedelta(days=39), 'Ascension Day'),
    ]
    return sorted(rows)


def in_lieu(rows, taken=()):
    """Observance days for any of `rows` that fall at a weekend.

    Vanuatu grants a weekday in lieu when a holiday falls on a Saturday or
    Sunday. The day given is the next weekday that is not already a holiday —
    not simply the following Monday, because holidays can fall on consecutive
    weekend days. December 2027 is the case that matters: Christmas Day is a
    Saturday and Family Day the Sunday, so they take the Monday and the Tuesday.

    `taken` lets callers pass dates already spoken for, e.g. rows already in the
    database, so a second run does not stack observances on top of each other.
    """
    claimed = set(taken) | {d for d, _ in rows}
    out = []
    for day, name in sorted(rows):
        if day.weekday() < 5 or name.endswith(OBSERVED_SUFFIX):
            continue
        d = day + timedelta(days=1)
        while d.weekday() >= 5 or d in claimed:
            d += timedelta(days=1)
        claimed.add(d)
        out.append((d, name + OBSERVED_SUFFIX))
    return out


def holidays_for(year, taken=()):
    """Every holiday row for `year`, observance days included, date-ordered."""
    rows = gazetted(year)
    return sorted(rows + in_lieu(rows, taken=taken))
