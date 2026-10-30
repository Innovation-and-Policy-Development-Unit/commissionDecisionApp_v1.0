"""Direct Appointment is an HR Unit submission type, not a VIPAM one.

VIPAM staff reported in the OPSC training that a Direct Appointment they
raised stayed in VIPAM's own queue. Two things kept it there:

1. The create path for VIPAM hardcoded ``routed_unit='vipam'`` whatever the
   form type said, and the auto-routing on entering Manager Checklist Review
   only fills that field when it is blank. Fixed in views.py, not here.

2. A Direct Appointment form type may have been configured in the admin with
   ``routed_unit='vipam'``. This migration moves any such type to 'hr'. It is
   scoped to form types in the Direct Appointment agenda section so it cannot
   touch VIPAM's other work, and it is a no-op when there are none —
   ``RECRUIT-DIRECT`` itself has been routed to 'hr' since migration 0183.

It then re-routes the submissions the old create path stranded with VIPAM,
but only while nobody has started on them: still before assessment and with
no officer assigned. A submission a VIPAM principal is actively assessing is
left where it is, because moving it would take the work out of their queue
mid-assessment — those are for the two unit Managers to hand over between
themselves. The counts are printed so the deploy log records what moved and
what did not.

Not reversible: the per-type routing that was in place beforehand is not
recorded anywhere, and ``RECRUIT-DIRECT`` was already 'hr', so inverting the
move would send it somewhere it has never belonged. To undo, set
``routed_unit`` back on the individual form types in the admin.
"""
from django.db import migrations

DIRECT_APPOINTMENT_SECTION = "direct_appointment"

# Before the responsible unit has begun work: nobody is mid-assessment.
PRE_ASSESSMENT_STAGES = [
    "draft",
    "pending_manager_approval",
    "pending_principal_review",
    "pending_second_approval",
    "submitted",
    "received_by_psc",
    "registered_routed",
    "manager_checklist_review",
]


def direct_appointment_to_hr(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    Submission = apps.get_model("tracker", "Submission")

    moved_types = list(
        PSCFormType.objects.filter(
            routed_unit="vipam", agenda_category=DIRECT_APPOINTMENT_SECTION,
        ).values_list("code", flat=True)
    )
    if moved_types:
        PSCFormType.objects.filter(code__in=moved_types).update(routed_unit="hr")
        print(f"  Direct Appointment form types moved vipam -> hr: {', '.join(moved_types)}")
    else:
        print("  No Direct Appointment form types were routed to vipam.")

    # Every HR-routed form type in the Direct Appointment section, RECRUIT-DIRECT
    # included — its submissions may carry the wrong unit from the old path.
    hr_codes = list(
        PSCFormType.objects.filter(
            routed_unit="hr", agenda_category=DIRECT_APPOINTMENT_SECTION,
        ).values_list("code", flat=True)
    )
    if not hr_codes:
        print("  No HR-routed Direct Appointment form types — nothing to re-route.")
        return

    stranded = Submission.objects.filter(routed_unit="vipam", form_type_code__in=hr_codes)
    moved = stranded.filter(
        current_stage__in=PRE_ASSESSMENT_STAGES, assigned_to__isnull=True,
    ).update(routed_unit="hr")
    left = Submission.objects.filter(
        routed_unit="vipam", form_type_code__in=hr_codes,
    ).count()

    print(f"  Direct Appointment submissions re-routed vipam -> hr: {moved}")
    if left:
        print(
            f"  Left with VIPAM ({left}) — already assigned or past checklist review; "
            "the unit Managers hand those over by agreement."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0289_flying_agenda"),
    ]

    operations = [
        migrations.RunPython(direct_appointment_to_hr, migrations.RunPython.noop),
    ]
