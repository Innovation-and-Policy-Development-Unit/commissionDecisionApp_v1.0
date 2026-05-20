"""
Migration 0052 — Demo / development seed data.

Seeds realistic data drawn from actual PSC Meeting No. 12 agenda:
  • 3 Commission meetings (past, current, upcoming)
  • 15 submissions spanning all agenda categories and various workflow stages
  • 14 agenda items attached to Meeting No. 12
  • A handful of ministries / departments (if not already present)

Designed for development and demonstration purposes only.
All reference numbers are auto-assigned via allocate_reference_number().
"""

from django.db import migrations, transaction
from django.utils import timezone
from datetime import datetime, date, time, timedelta


# ─────────────────────────────────────────────────────────────────────────────
# Static seed data
# ─────────────────────────────────────────────────────────────────────────────

MINISTRIES = [
    ("MOF",   "Ministry of Finance and Economic Management",          "MFEM"),
    ("MOH",   "Ministry of Health",                                   "MOH"),
    ("MOET",  "Ministry of Education and Training",                   "MOET"),
    ("MIPU",  "Ministry of Infrastructure and Public Utilities",      "MIPU"),
    ("MLNR",  "Ministry of Lands and Natural Resources",              "MLNR"),
    ("MJYCS", "Ministry of Justice, Youth and Community Services",    "MJYCS"),
    ("MALFB", "Ministry of Agriculture, Livestock, Forestry & Biosecurity", "MALFB"),
    ("MFOMA", "Ministry of Fisheries, Oceans and Marine Affairs",     "MFOMA"),
    ("MPM",   "Ministry of the Prime Minister",                       "MPM"),
    ("MOCCA", "Ministry of Climate Change Adaptation",                "MOCCA"),
    ("MOIA",  "Ministry of Internal Affairs",                         "MOIA"),
]

# (ministry_code, dept_code, dept_name)
DEPARTMENTS = [
    ("MOF",   "DCIR",    "Department of Customs and Inland Revenue"),
    ("MOF",   "DFT",     "Department of Finance and Treasury"),
    ("MOH",   "DCHS",    "Department of Curative and Hospital Services"),
    ("MOH",   "NCD",     "National NCD Clinic"),
    ("MOET",  "DFA",     "Department of Finance and Administration"),
    ("MIPU",  "PHD",     "Ports and Harbour Department"),
    ("MIPU",  "PWD",     "Public Works Department"),
    ("MLNR",  "DWR",     "Department of Water Resources"),
    ("MLNR",  "DLSR",    "Department of Lands, Survey and Records"),
    ("MJYCS", "CLMO",    "Court and Legal Matters Office"),
    ("MALFB", "DBIO",    "Department of Biosecurity"),
    ("MFOMA", "VFD",     "Vanuatu Fisheries Department"),
    ("MPM",   "OPSC-CS", "OPSC - Corporate Services"),
    ("MOCCA", "DEPC",    "Department of Environment Protection and Conservation"),
]

# 15 demo submissions
# (title, ministry_code, dept_name_or_None, form_type_code, category_code, stage)
SUBMISSIONS = [
    # ── Appointment ──────────────────────────────────────────────────────────
    (
        "Appointment of potential candidate to the post of Director General — Ministry of Infrastructure and Public Utilities, Post No. 6000",
        "MIPU", "Public Works Department", "PSC 3-6", "appointment", "forwarded_to_commission",
    ),
    (
        "Appointment of potential candidate as Water Account Clerk — Malampa, Post No. 5348 — DWR — MLNR",
        "MLNR", "Department of Water Resources", "PSC 3-6", "appointment", "under_assessment",
    ),
    (
        "Acting Appointment for Ms. Cyndia Albert as Ag. DG-MLNR",
        "MLNR", None, "PSC 3-5", "appointment", "registered_routed",
    ),
    # ── Direct Appointment ────────────────────────────────────────────────────
    (
        "Direct Appointment of John Nasak as Harbour Master — Ports and Harbour Department, Post No. 6803 — MIPU",
        "MIPU", "Ports and Harbour Department", "PSC 3-6", "direct_appointment", "forwarded_to_commission",
    ),
    (
        "Request for Commission to approve the Direct Appointment for Mr. Franko Lakone as Desktop Support Officer — PN. 8628 — MOH",
        "MOH", "Department of Curative and Hospital Services", "PSC 3-6", "direct_appointment", "manager_checklist_review",
    ),
    # ── Contract ─────────────────────────────────────────────────────────────
    (
        "New Contract for Mr. Ernesto Styles Nakou Lauha as Support Officer — CLMO — MJYCS",
        "MJYCS", "Court and Legal Matters Office", "PSC 3-7", "contract", "forwarded_to_commission",
    ),
    (
        "Request to employ Contract Groundsman for the Public Works Department — MIPU (Sam Semenou)",
        "MIPU", "Public Works Department", "PSC 3-7", "contract", "submitted",
    ),
    # ── Temporary Salaried ────────────────────────────────────────────────────
    (
        "Temporary Salaried for Mr. George Imbert as Fisheries Development Officer, Sanma — Fisheries — MFOMA",
        "MFOMA", "Vanuatu Fisheries Department", "PSC 3-7", "temporary_salaried", "under_assessment",
    ),
    (
        "Request to employ a Temporary Salaried employee, Mr. Timothy Morobun as Assistant Payment Officer — MFEM",
        "MOF", "Department of Finance and Treasury", "PSC 3-7", "temporary_salaried", "registered_routed",
    ),
    # ── Extra Responsibility ──────────────────────────────────────────────────
    (
        "Application of Extra Responsibility and Overtime Allowance under the new GRT Salary structure — OPSC — MPM",
        "MPM", "OPSC - Corporate Services", "PSC 4-1", "extra_responsibility", "forwarded_to_commission",
    ),
    # ── Training ─────────────────────────────────────────────────────────────
    (
        "Request for Commission to approve Fully Funded, Full Time, Long-Term Training for William I. Nasak — MOET",
        "MOET", "Department of Finance and Administration", "PSC 5-1", "training", "under_assessment",
    ),
    (
        "Request for Commission to approve of one (1) new internship for Abigail Kalontano — Dept. of Curative and Hospital — MOH",
        "MOH", "Department of Curative and Hospital Services", "PSC 5-2", "training", "submitted",
    ),
    # ── Medical Claim ─────────────────────────────────────────────────────────
    (
        "Request for approval of Additional Medical Leave and Guidance on Fitness for Duty — Mrs. Roslyn Bue — MOCCA",
        "MOCCA", "Department of Environment Protection and Conservation", "PSC 4-9", "medical_claim", "registered_routed",
    ),
    # ── Resignation ──────────────────────────────────────────────────────────
    (
        "Resignation for Mr. Edwin Frank — MOIA",
        "MOIA", None, "INT-2", "resignation", "received_by_psc",
    ),
    # ── Organisation Restructure ──────────────────────────────────────────────
    (
        "Proposal to Revise the Organisation Structure for the Department of Biosecurity — MALFB",
        "MALFB", "Department of Biosecurity", "ORG-3.1", "other", "under_assessment",
    ),
]

# Agenda items (index into SUBMISSIONS list above, category, sequence)
# These go on Meeting No. 12 (the current/upcoming meeting)
AGENDA_ITEMS = [
    (0,  "appointment",        7),
    (3,  "direct_appointment", 24),
    (4,  "direct_appointment", 27),
    (5,  "contract",           32),
    (9,  "extra_responsibility", 30),
    (10, "training",           64),
    (11, "training",           57),
    (12, "medical_claim",      68),
]


# ─────────────────────────────────────────────────────────────────────────────
# Forward migration
# ─────────────────────────────────────────────────────────────────────────────

def seed_demo_data(apps, schema_editor):
    Ministry   = apps.get_model('tracker', 'Ministry')
    Department = apps.get_model('tracker', 'Department')
    Meeting    = apps.get_model('tracker', 'Meeting')
    AgendaItem = apps.get_model('tracker', 'AgendaItem')
    Submission = apps.get_model('tracker', 'Submission')
    FormCategory = apps.get_model('tracker', 'FormCategory')
    PSCFormType  = apps.get_model('tracker', 'PSCFormType')
    User         = apps.get_model('auth', 'User')
    ReferenceCounter = apps.get_model('tracker', 'ReferenceCounter')

    # Get or create a system user for created_by
    admin_user, _ = User.objects.get_or_create(
        username='admin',
        defaults={'is_staff': True, 'is_superuser': True, 'first_name': 'System', 'last_name': 'Admin'},
    )

    # ── Ministries ────────────────────────────────────────────────────────────
    min_objs = {}
    for code, name, short in MINISTRIES:
        obj, _ = Ministry.objects.get_or_create(
            code=code,
            defaults={'name': name},
        )
        min_objs[code] = obj

    # ── Departments ───────────────────────────────────────────────────────────
    dept_objs = {}
    for mcode, dcode, dname in DEPARTMENTS:
        min_obj = min_objs.get(mcode)
        if not min_obj:
            continue
        obj, _ = Department.objects.get_or_create(
            ministry=min_obj,
            code=dcode,
            defaults={'name': dname},
        )
        dept_objs[(mcode, dname)] = obj

    # ── Meetings ──────────────────────────────────────────────────────────────
    today = date.today()

    meeting_past, _ = Meeting.objects.get_or_create(
        reference_number='MTG-2026-010',
        defaults={
            'title': 'PSC Commission Meeting No. 10 of 2026',
            'date': date(2026, 3, 31),
            'time': time(9, 0),
            'status': 'completed',
            'venue': 'OPSC Boardroom, Port Vila',
            'max_items': 30,
        },
    )

    meeting_recent, _ = Meeting.objects.get_or_create(
        reference_number='MTG-2026-011',
        defaults={
            'title': 'PSC Commission Meeting No. 11 of 2026',
            'date': date(2026, 4, 28),
            'time': time(9, 0),
            'status': 'completed',
            'venue': 'OPSC Boardroom, Port Vila',
            'max_items': 30,
        },
    )

    meeting_current, _ = Meeting.objects.get_or_create(
        reference_number='MTG-2026-012',
        defaults={
            'title': 'PSC Commission Meeting No. 12 of 2026',
            'date': date(2026, 5, 26),
            'time': time(9, 0),
            'status': 'scheduled',
            'venue': 'OPSC Boardroom, Port Vila',
            'max_items': 30,
        },
    )

    # ── Helper: allocate reference number ─────────────────────────────────────
    def next_ref():
        year = today.year
        counter, _ = ReferenceCounter.objects.select_for_update().get_or_create(
            year=year, defaults={'last_seq': 0}
        )
        counter.last_seq += 1
        counter.save(update_fields=['last_seq'])
        return f'PSC-{year}-{counter.last_seq:05d}'

    # ── Submissions ───────────────────────────────────────────────────────────
    sub_objs = []
    for title, mcode, dept_name, ft_code, cat_code, stage in SUBMISSIONS:
        ministry = min_objs.get(mcode)
        if not ministry:
            continue

        dept = None
        if dept_name:
            dept = dept_objs.get((mcode, dept_name))

        # form_category
        try:
            category = FormCategory.objects.get(code=cat_code)
        except FormCategory.DoesNotExist:
            try:
                category = FormCategory.objects.get(code='other')
            except FormCategory.DoesNotExist:
                category = None

        # Skip if already seeded (match by title + ministry to avoid duplicates)
        if Submission.objects.filter(title=title, ministry=ministry).exists():
            sub_objs.append(Submission.objects.get(title=title, ministry=ministry))
            continue

        with transaction.atomic():
            ref = next_ref()
            sub = Submission.objects.create(
                reference_number=ref,
                title=title,
                form_type_code=ft_code,
                form_category=category,
                ministry=ministry,
                department=dept,
                current_stage=stage,
                received_at=timezone.now() - timedelta(days=14),
                created_by=admin_user,
            )
        sub_objs.append(sub)

    # ── Agenda items on Meeting No. 12 ────────────────────────────────────────
    for sub_idx, category, sequence in AGENDA_ITEMS:
        if sub_idx >= len(sub_objs):
            continue
        sub = sub_objs[sub_idx]
        AgendaItem.objects.get_or_create(
            meeting=meeting_current,
            submission=sub,
            defaults={
                'category': category,
                'sequence': sequence,
            },
        )


def reverse_seed(apps, schema_editor):
    """Remove only the seeded submissions by matching titles."""
    Submission = apps.get_model('tracker', 'Submission')
    titles = [s[0] for s in SUBMISSIONS]
    Submission.objects.filter(title__in=titles).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0051_update_submission_categories'),
        ('tracker', '0053_meeting_max_items'),
    ]

    operations = [
        migrations.RunPython(seed_demo_data, reverse_code=reverse_seed),
    ]
