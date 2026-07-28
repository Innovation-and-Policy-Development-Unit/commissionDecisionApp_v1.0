"""
Enforce required attachments on the HR submission side: ministry HR should not
be able to submit a Cessation / Secondment / Leave Payout / Recruitment
submission paper without the documents OPSC actually needs to process it.

RequiredDocument already has a `mandatory_for_stage` field, and the transition
endpoint already blocks advancing past a stage while a mandatory item for that
stage is unchecked (views.py, "Mandatory Checklist/Task Gate"). That gate has
never been wired to WorkflowStage.DRAFT before, so ministry submissions were
never actually blocked by it.

Deliberately excluded from the DRAFT gate (kept as informational / OPSC-side
checklist items instead, so they don't block submission):
  - "DG's Endorsement/Acknowledgement Letter" items — already enforced by the
    DG endorsement workflow stage itself (PENDING_DG_ENDORSEMENT -> DG_APPROVED),
    not a separate uploadable file.
  - Conditional items ("if applicable", "if extension", "extensions only",
    "if officer-initiated") — don't always apply, so requiring them unconditionally
    would wrongly block valid submissions.
  - "Under Discipline Clearance" — an internal OPSC check, not something the
    ministry supplies.
  - "Other Supporting Documents" — a vague catch-all, not a specific document.
"""
from django.db import migrations

TARGET_FORM_TYPE_CODES = [
    'CESSATION-AGE', 'CESSATION-NOTICE-AGE', 'CESSATION-MEDICAL',
    'CESSATION-DEATH', 'CESSATION-REDUNDANCY', 'CESSATION-RESIGNATION',
    'SECONDMENT', 'LEAVE-PAYOUT',
    'RECRUIT-PROBATION', 'RECRUIT-CONFIRM', 'RECRUIT-DIRECT',
    'RECRUIT-TEMPORARY', 'RECRUIT-CONTRACT',
]

# (form_type_code, exact RequiredDocument.name) pairs to leave non-mandatory.
EXCLUDED = {
    ('CESSATION-RESIGNATION', "DG's Acknowledgement Letter"),
    ('CESSATION-RESIGNATION', 'Under Discipline Clearance'),
    ('CESSATION-RESIGNATION', 'Bonding Agreement (if applicable)'),
    ('CESSATION-AGE', 'Other Supporting Documents'),
    ('CESSATION-MEDICAL', 'Application for Medical Retirement'),
    ('SECONDMENT', "Director-General's Endorsement Letter"),
    ('RECRUIT-PROBATION', "DG's Endorsement Letter"),
    ('RECRUIT-PROBATION', "Eligible Candidate's Application — PSC Form 3-2"),
    ('RECRUIT-PROBATION', 'Essential Services Certification (if applicable)'),
    ('RECRUIT-CONFIRM', "DG's Endorsement Letter"),
    ('RECRUIT-DIRECT', "DG's Endorsement Letter"),
    ('RECRUIT-TEMPORARY', "DG's Endorsement Letter"),
    ('RECRUIT-TEMPORARY', 'Evidence of Merit Process (if applicable)'),
    ('RECRUIT-CONTRACT', "DG's Endorsement Letter"),
    ('RECRUIT-CONTRACT', 'Evidence of Merit Process Followed'),
    ('RECRUIT-CONTRACT', 'Break-in-Service Evidence (extensions only)'),
    ('RECRUIT-CONTRACT', 'Performance Assessment (extensions only)'),
}


def set_mandatory(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    for code in TARGET_FORM_TYPE_CODES:
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        for doc in RequiredDocument.objects.filter(form_type=ft, is_active=True):
            if (code, doc.name) in EXCLUDED:
                continue
            doc.mandatory_for_stage = 'draft'
            doc.save(update_fields=['mandatory_for_stage'])


def unset_mandatory(apps, schema_editor):
    RequiredDocument = apps.get_model('tracker', 'RequiredDocument')
    PSCFormType = apps.get_model('tracker', 'PSCFormType')

    for code in TARGET_FORM_TYPE_CODES:
        ft = PSCFormType.objects.filter(code=code).first()
        if not ft:
            continue
        RequiredDocument.objects.filter(form_type=ft, mandatory_for_stage='draft').update(
            mandatory_for_stage=None
        )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0184_submission_document_required_document_link'),
    ]

    operations = [
        migrations.RunPython(set_mandatory, unset_mandatory),
    ]
