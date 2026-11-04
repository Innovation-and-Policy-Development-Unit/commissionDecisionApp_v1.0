"""Digitised form for the SEO Performance Agreement Progress Report.

Modelled on HRM's "SEOs Q3 2026 Performance Agreement Progress Report" board paper.
The form engine holds flat fields only, so the paper's tables become one-row-per-line
text areas ("column | column | column") and its headline figures become number fields
that the Commission can read at a glance. The meeting number and item number are left
out: they are allocated by the system when the paper is put on an agenda.

Fields are written with ``update_or_create`` on (form type, key), so running this on a
database where an admin has already built the form refreshes the labels and order
rather than failing. Reverse removes only the fields and documents it created.
"""
from django.db import migrations

CODE = "SEO-PA-REPORT"
FORM_KEY = "seo_pa_report"
REQUIRED_DOC = "SEO progress reports (Directors General; Directors; Secretaries General and Town Clerk)"


def S(key, label, order, new_page=True):
    return dict(field_key=key, label=label, field_type="section_header",
                display_order=order, start_new_page=new_page)


def T(key, label, order, ph="", req=False, help_text=""):
    return dict(field_key=key, label=label, field_type="text", placeholder=ph,
                is_required=req, display_order=order, help_text=help_text)


def A(key, label, order, ph="", req=False, help_text=""):
    return dict(field_key=key, label=label, field_type="textarea", placeholder=ph,
                is_required=req, display_order=order, help_text=help_text)


def N(key, label, order, req=False, help_text=""):
    return dict(field_key=key, label=label, field_type="number",
                is_required=req, display_order=order, help_text=help_text)


FIELDS = [
    S("sec_report", "Report Details", 100),
    T("performance_year", "Performance Year", 110, "e.g. 2026", True),
    dict(field_key="quarter", label="Quarter Reported", field_type="select",
         choices="Q1 (January to March)\nQ2 (April to June)\nQ3 (July to September)\nQ4 (October to December)",
         is_required=True, display_order=120),
    T("action_officer", "Action Officer", 130, "e.g. Manager HRM", True),
    T("prepared_by", "Prepared By", 140, "Name and title of the officer who prepared the paper", True),
    A("ministries_covered", "Ministries Covered", 150,
      "e.g. MALFB, MFEM, MFOMA, MIPU ... (13 ministries)", True),
    N("seos_reported", "SEOs Reported (total)", 160, True),
    N("dg_reported", "Directors General Reported", 170),
    N("director_reported", "Directors Reported", 180),
    N("sg_tc_reported", "Secretaries General and Town Clerk Reported", 190),

    S("sec_purpose", "Purpose and Background", 200),
    A("purpose", "Purpose", 210,
      "What the paper updates the Commission on, which quarter and year, and the decision sought", True),
    A("background", "Background", 220,
      "Basis for the reports (e.g. Schedule B, Clause 2.1 of the SEO Contracts and PSC Forms 10.2 (a), (b), (c)) "
      "and the progress reports HRM consolidated", True),

    S("sec_issue", "Issue", 300),
    A("issue", "Issue", 310,
      "Whether the Commission is satisfied with progress, and the direction it is asked to give on "
      "(a) compliance, (b) under-performance, (c) SEOs who have not submitted", True),

    S("sec_compliance", "Discussion (a): Submission Compliance", 400),
    N("seos_required", "SEOs Required to Submit", 410, True),
    N("seos_submitted", "Submitted", 420, True),
    N("late_submissions", "Late Submissions", 430),
    N("pending_submissions", "Pending (not yet submitted)", 440),
    N("exempt_positions", "Exempt Positions (not counted as required)", 450),
    N("compliance_rate", "Compliance Rate (%)", 460, True, "Submitted divided by required, e.g. 88.3"),
    A("outstanding_table", "Outstanding Submissions", 470,
      "One per line: Position | Ministry / Department | Name of SEO | Status / Comments"),
    A("exempt_table", "Exempt Positions", 480,
      "One per line: Position | Ministry / Department | Name of SEO | Reason for exemption"),

    S("sec_findings", "Discussion (b): Summary of Findings", 500),
    N("priorities_due", "Priorities Due by This Quarter", 510, True),
    N("priorities_achieved", "Achieved", 520, True),
    N("priorities_on_track", "On Track", 530, True),
    N("priorities_delayed", "Delayed", 540, True),
    N("priorities_not_achieved", "Not Achieved", 550, True),
    A("key_findings", "Key Findings for the Commission's Attention", 560,
      "One finding per line", True),

    S("sec_snapshot", "Discussion (c): Performance Snapshot", 600),
    A("result_by_level", "Result by Level", 610,
      "One per line: Level | SEOs Reported | Priorities Due | Achieved | On Track | Delayed | Not Achieved | % Achieved | % At Risk"),
    A("result_by_ministry", "Result by Ministry", 620,
      "One per line: Ministry | Priorities Due | Achieved | On Track | Delayed | Not Achieved | % Achieved | % At Risk"),

    S("sec_concerns", "Discussion (d): Achievements and Areas of Concern", 700),
    A("notable_achievements", "Notable Achievements", 710, "One per line"),
    A("areas_of_concern", "Areas of Concern", 720, "One per line", True),
    A("zero_priority_seos", "SEO Entries With No Priorities Due This Quarter", 730,
      "Positions and ministries, if any"),

    S("sec_recommendation", "Recommendation", 800),
    A("recommendation", "Recommendation", 810,
      "It is recommended that the Commission note the report and direct the follow-up actions below", True),
    A("follow_up_actions", "Recommended Follow-up Actions", 820,
      "One per line, e.g. reminders to outstanding SEOs, referral of under-performance to the responsible Minister"),
]


def seed(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    ft = PSCFormType.objects.filter(code=CODE).first()
    if ft is None:
        print(f"  {CODE} does not exist; form not seeded.")
        return
    ft.is_digitized = True
    ft.digitized_form_key = FORM_KEY
    ft.save(update_fields=["is_digitized", "digitized_form_key"])

    for spec in FIELDS:
        spec = dict(spec)
        key = spec.pop("field_key")
        PSCFormField.objects.update_or_create(form_type=ft, field_key=key, defaults=spec)

    RequiredDocument.objects.get_or_create(
        form_type=ft, name=REQUIRED_DOC,
        defaults={
            "description": "The consolidated progress reports this paper summarises.",
            "item_type": "document",
        },
    )
    print(f"  {CODE}: {len(FIELDS)} form fields seeded.")


def unseed(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")
    ft = PSCFormType.objects.filter(code=CODE).first()
    if ft is None:
        return
    PSCFormField.objects.filter(form_type=ft, field_key__in=[f["field_key"] for f in FIELDS]).delete()
    RequiredDocument.objects.filter(form_type=ft, name=REQUIRED_DOC).delete()
    ft.is_digitized = False
    ft.digitized_form_key = ""
    ft.save(update_fields=["is_digitized", "digitized_form_key"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0295_seo_progress_report_form_type"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
