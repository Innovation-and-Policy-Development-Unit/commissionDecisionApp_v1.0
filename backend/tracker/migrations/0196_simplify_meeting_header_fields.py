"""
Drop the "Meeting Number" / "Item Number" / "PSC File Reference" fields from the
drafting-time "Meeting / Reference" header — they duplicate the real Meeting/
AgendaItem allocation that happens later in the workflow (allocate_meeting_reference())
and just sit there unfillable (or guessed) at draft time.

Also drop "Date Checked" / "Checked By" — these are never read by any backend
logic and are editable by the same drafting-stage roles as the rest of the form,
so they don't actually capture an independent OPSC checklist review. The real
checklist review is SubmissionChecklistResponse (Manager Checklist Review stage).

Rename "Date Received from Ministry" -> "Date Submission Received": the old
label is wrong for OPSC-internal submissions (no ministry origin) and this field
is otherwise a manually-editable duplicate of Submission.received_at.

Applies to every submission paper type that shares this header: all RECRUIT-*
types (RECRUIT-CONFIRM already had meeting_number/item_number/psc_file removed
by hand; this migration makes that state explicit and consistent across the
rest) and the CESSATION-*/SECONDMENT/LEAVE-PAYOUT types seeded by migration 0156.
"""
from django.db import migrations

FORM_TYPE_CODES = [
    'RECRUIT-PROBATION', 'RECRUIT-CONFIRM', 'RECRUIT-DIRECT',
    'RECRUIT-TEMPORARY', 'RECRUIT-CONTRACT',
    'CESSATION-AGE', 'CESSATION-NOTICE-AGE', 'CESSATION-MEDICAL',
    'CESSATION-DEATH', 'CESSATION-REDUNDANCY', 'CESSATION-RESIGNATION',
    'SECONDMENT', 'LEAVE-PAYOUT',
]

REMOVED_FIELD_KEYS = ['meeting_number', 'item_number', 'psc_file', 'date_checked', 'checked_by']

OLD_DATE_RECEIVED_LABEL = 'Date Received from Ministry'
NEW_DATE_RECEIVED_LABEL = 'Date Submission Received'

# Original definitions, keyed by field_key, so the reverse migration can recreate
# exactly what it deleted (display_order matches the 0156/0157 seed helpers).
REMOVED_FIELD_DEFS = {
    'meeting_number': {'label': 'Meeting Number', 'field_type': 'text', 'is_required': True, 'order_offset': 10},
    'item_number': {'label': 'Item Number', 'field_type': 'text', 'is_required': False, 'order_offset': 20},
    'psc_file': {'label': 'PSC File Reference', 'field_type': 'text', 'is_required': False, 'order_offset': 30},
    'date_checked': {'label': 'Date Checked', 'field_type': 'date', 'is_required': False, 'order_offset': 70},
    'checked_by': {'label': 'Checked By', 'field_type': 'text', 'is_required': False, 'order_offset': 80},
}


def simplify_meeting_header(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    form_types = PSCFormType.objects.filter(code__in=FORM_TYPE_CODES)

    PSCFormField.objects.filter(
        form_type__in=form_types, field_key__in=REMOVED_FIELD_KEYS
    ).delete()

    PSCFormField.objects.filter(
        form_type__in=form_types, field_key='date_received', label=OLD_DATE_RECEIVED_LABEL
    ).update(label=NEW_DATE_RECEIVED_LABEL)


def restore_meeting_header(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormField = apps.get_model('tracker', 'PSCFormField')

    PSCFormField.objects.filter(
        form_type__code__in=FORM_TYPE_CODES,
        field_key='date_received',
        label=NEW_DATE_RECEIVED_LABEL,
    ).update(label=OLD_DATE_RECEIVED_LABEL)

    for form_type in PSCFormType.objects.filter(code__in=FORM_TYPE_CODES):
        sec_field = PSCFormField.objects.filter(
            form_type=form_type, field_key__in=['sec_meeting', 'sec_meeting_header']
        ).first()
        if not sec_field:
            continue
        base_order = sec_field.display_order
        for field_key, meta in REMOVED_FIELD_DEFS.items():
            if field_key in ('date_checked', 'checked_by'):
                # Only RECRUIT-* originally had these two.
                if not form_type.code.startswith('RECRUIT-'):
                    continue
            PSCFormField.objects.get_or_create(
                form_type=form_type,
                field_key=field_key,
                defaults={
                    'label': meta['label'],
                    'field_type': meta['field_type'],
                    'placeholder': '',
                    'help_text': '',
                    'choices': '',
                    'is_required': meta['is_required'],
                    'display_order': base_order + meta['order_offset'],
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0195_required_document_ministry_only'),
    ]

    operations = [
        migrations.RunPython(simplify_meeting_header, restore_meeting_header),
    ]
