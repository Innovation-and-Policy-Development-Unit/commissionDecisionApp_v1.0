"""Seed an initial nature-of-offence catalogue (admin-editable thereafter).

Minor/disciplinary offences and serious-misconduct offences (Appendix C). The
exact statutory Appendix C list can be refined by an administrator in-app.
"""

from django.db import migrations

MINOR = "minor"
SERIOUS = "serious_misconduct"

OFFENCES = [
    # code, label, category, display_order
    ("late_attendance",      "Late Attendance / Habitual Lateness",        MINOR,   10),
    ("minor_absence",        "Unauthorised Absence (minor)",               MINOR,   20),
    ("neglect_of_duty",      "Neglect of Duty",                            MINOR,   30),
    ("insubordination",      "Insubordination",                            MINOR,   40),
    ("misuse_property",      "Misuse of Public Property / Resources",      MINOR,   50),
    ("breach_conduct",       "Breach of Code of Conduct",                  MINOR,   60),
    ("poor_performance",     "Poor Performance / Inefficiency",            MINOR,   70),

    ("fraud",                "Fraud / Misappropriation of Funds",          SERIOUS, 110),
    ("theft",                "Theft",                                      SERIOUS, 120),
    ("corruption",           "Corruption / Bribery",                       SERIOUS, 130),
    ("assault",              "Assault / Violence in the Workplace",        SERIOUS, 140),
    ("sexual_harassment",    "Sexual Harassment",                          SERIOUS, 150),
    ("gross_negligence",     "Gross Negligence",                           SERIOUS, 160),
    ("abandonment",          "Abandonment of Post",                        SERIOUS, 170),
    ("falsification",        "Falsification of Official Records",          SERIOUS, 180),
    ("conflict_interest",    "Conflict of Interest",                       SERIOUS, 190),
    ("breach_confidence",    "Breach of Confidentiality",                  SERIOUS, 200),
    ("criminal_conviction",  "Conviction of a Criminal Offence",           SERIOUS, 210),
    ("intoxication",         "Intoxication / Substance Abuse on Duty",     SERIOUS, 220),
]


def seed(apps, schema_editor):
    OffenceType = apps.get_model("tracker", "OffenceType")
    for code, label, category, order in OFFENCES:
        OffenceType.objects.get_or_create(
            code=code,
            defaults={"label": label, "category": category, "display_order": order, "active": True},
        )


def unseed(apps, schema_editor):
    OffenceType = apps.get_model("tracker", "OffenceType")
    OffenceType.objects.filter(code__in=[c for c, *_ in OFFENCES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0165_offencetype_compliancecase_offence_detail_and_more"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
