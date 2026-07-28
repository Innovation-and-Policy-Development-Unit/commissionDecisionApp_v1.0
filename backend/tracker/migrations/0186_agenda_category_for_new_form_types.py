"""
Ministry HR's "Submit for Commission" dialog (CommissionSubmissionForm) only
lets the user pick a broad agenda category (e.g. "14. Resignation / Retirement
/ Death") — it has no way to pick a specific PSCFormType. None of the 21 form
types added this session (recruitment submission papers, cessation, secondment,
leave payout, medical claim, acting appointment, eligible/unsuccessful candidate)
had PSCFormType.agenda_category set, so none of them were reachable from that
screen at all — the same field IS already populated on 66 of the pre-existing
form types (PSC 3-6 -> 'appointment', PSC 3-7 -> 'contract', etc.), confirming
it's the intended mechanism, just never wired up for these new types.

This migration sets agenda_category on those 21 types. The frontend is being
updated separately to add a second "specific submission type" dropdown, filtered
by /form-types/?agenda_category=<code>, once a category has more than one match.
"""
from django.db import migrations

AGENDA_CATEGORY_BY_CODE = {
    # ── Recruitment & appointment ──────────────────────────────────────────
    'RECRUIT-PROBATION': 'appointment',          # 5. Appointment / Acting Appointment (matches PSC 3-6 precedent)
    'RECRUIT-ACTING':    'appointment',          # 5. Appointment / Acting Appointment
    'RECRUIT-CONFIRM':   'direct_appointment',   # 6. Direct Appointment / Confirmation of Appointment
    'RECRUIT-DIRECT':    'direct_appointment',   # 6. Direct Appointment / Confirmation of Appointment
    'RECRUIT-TEMPORARY': 'temporary_salaried',   # 9. Temporary Salaried Appointment
    'RECRUIT-CONTRACT':  'contract',             # 8. Contract / Temporary Salaried Appointment (matches PSC 3-7 precedent)
    'RECRUIT-ELIGIBLE':      'appointment',
    'RECRUIT-UNSUCCESSFUL':  'appointment',
    # ── Cessation of employment ─────────────────────────────────────────────
    'CESSATION-AGE':          'resignation',     # 14. Resignation / Retirement / Death
    'CESSATION-NOTICE-AGE':   'resignation',
    'CESSATION-MEDICAL':      'resignation',
    'CESSATION-DEATH':        'resignation',
    'CESSATION-REDUNDANCY':   'resignation',
    'CESSATION-RESIGNATION':  'resignation',
    # ── No dedicated agenda category exists for these — 'other' ─────────────
    'SECONDMENT':    'other',
    'LEAVE-PAYOUT':  'other',
    # ── Direct match ─────────────────────────────────────────────────────────
    'MEDICAL-CLAIM': 'medical_claim',            # 12. Medical Claim
}


def set_agenda_category(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    for code, agenda_cat in AGENDA_CATEGORY_BY_CODE.items():
        PSCFormType.objects.filter(code=code).update(agenda_category=agenda_cat)


def unset_agenda_category(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code__in=AGENDA_CATEGORY_BY_CODE.keys()).update(agenda_category='')


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0185_mandatory_attachments_at_draft'),
    ]

    operations = [
        migrations.RunPython(set_agenda_category, unset_agenda_category),
    ]
