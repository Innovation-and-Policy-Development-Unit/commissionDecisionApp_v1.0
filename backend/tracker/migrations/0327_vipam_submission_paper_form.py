"""VIPAM Submission Paper: VIPAM's own paper to the Commission on an Internship, Training or
Education matter.

Digitised from the OPSC template ("VIPAM SUBMISSION PAPER"). It is an OPSC-internal paper,
written by VIPAM staff, who walk it up Senior -> Principal -> Manager to the Secretary. The
template's header and sign-off boxes (meeting number, date received, Manager VIPAM, submitted
by, SG-PSC endorsement, PSC Secretary) are not fields: the system fills those in as the paper
moves, as it does for the other internal papers.

The PSC form that applies (5-1 Training Registration Form or 5-2 Development Programs
Application) is the paper's required document, attached as a file before it can go up.

``update_or_create`` throughout so that an admin-made type of the same code is refreshed, not
duplicated. Reverse removes only what this created.
"""
from django.db import migrations

CODE = "VIPAM-SUBMISSION-PAPER"
FORM_KEY = "vipam_submission_paper"
REQUIRED_DOC = "Completed PSC form: 5-1 Training Registration Form or 5-2 Development Programs Application"


def S(key, label, order, new_page=False):
    return dict(field_key=key, label=label, field_type="section_header",
                display_order=order, start_new_page=new_page)


def T(key, label, order, ph="", req=False, help_text=""):
    return dict(field_key=key, label=label, field_type="text", placeholder=ph,
                is_required=req, display_order=order, help_text=help_text)


def A(key, label, order, ph="", req=False, help_text=""):
    return dict(field_key=key, label=label, field_type="textarea", placeholder=ph,
                is_required=req, display_order=order, help_text=help_text)


FIELDS = [
    S("sec_paper", "Paper Details", 100),
    dict(field_key="submission_type", label="Type of Submission", field_type="select",
         choices="Internship\nTraining\nEducation", is_required=True, display_order=110),
    T("prepared_by", "Prepared By", 120, "Name and title of the VIPAM officer who prepared the paper", True),
    T("reviewed_by", "Reviewed By", 130, "VIPAM staff member who reviewed the paper, if any"),
    dict(field_key="date_prepared", label="Date Prepared", field_type="date",
         is_required=True, display_order=140),

    S("sec_purpose", "Purpose", 200),
    A("purpose", "Purpose", 210, "What the paper asks the Commission to consider or decide", True),
    A("strategic_alignment", "Strategic Alignment", 220,
      "How this supports the Commission's and the Government's strategic priorities"),
    A("policy_and_sector", "Policy and Sector Alignment", 230,
      "The policy and sector priorities this matter responds to"),

    S("sec_background", "Background Information", 300),
    A("background_information", "Background Information", 310,
      "How the matter came to the Commission and what has happened so far", True),

    S("sec_discussion", "Discussion", 400),
    A("current_situation", "Context / What Happened / Current Situation", 410,
      "The context and the situation as it stands now", True),
    A("proposed_action", "Proposed Action", 420, "What VIPAM proposes to do", True),
    A("expected_outcome", "Expected Outcome", 430, "What the Commission can expect if the action is approved", True),

    S("sec_recommendation", "Recommendation", 500),
    A("recommendation", "Recommendation", 510,
      "What VIPAM recommends the Commission decides", True),
]


def seed(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")
    FormCategory = apps.get_model("tracker", "FormCategory")
    RequiredDocument = apps.get_model("tracker", "RequiredDocument")

    category = FormCategory.objects.filter(code="INTERNAL").first()
    ft, _ = PSCFormType.objects.get_or_create(
        code=CODE,
        defaults={
            "name": "VIPAM Submission Paper (Internship, Training, Education)",
            "description": (
                "VIPAM internal paper on an internship, training or education matter. Written by "
                "VIPAM staff in SCDMS, not lodged by ministries or ministry HR. Approved up the "
                "VIPAM unit, then sent to the Secretary for the Commission."
            ),
            "form_category": category,
            "is_active": True,
            "routed_unit": "vipam",
            "agenda_category": "training",
            "display_order": 40,
        },
    )
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
            "description": (
                "The PSC form that applies to this matter: 5-1 Training Registration Form, or "
                "5-2 Development Programs Application. Attach it as a file."
            ),
            "item_type": "document", "order": 10, "is_active": True,
        },
    )


def unseed(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    Submission = apps.get_model("tracker", "Submission")
    if Submission.objects.filter(form_type_code=CODE).exists():
        return  # papers exist: keep the type so they still open
    PSCFormType.objects.filter(code=CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0326_pending_senior_review_stage"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
