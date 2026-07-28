"""
Two fixes surfaced while reviewing the ministry-HR submission path:

1. None of the HR-unit form types added in 0156/0157/0182 (recruitment
   submission papers, cessation, secondment, leave payout, medical claim) had
   PSCFormType.routed_unit set. The auto-routing logic in views.py (entering
   MANAGER_CHECKLIST_REVIEW) reads exactly this field — without it, these
   submissions would land with routed_unit='' and be invisible to every unit
   manager's queue, including HR's.

2. Auto-cascade straight past the "PSC Officer clicks to route" step for the
   ministry HR -> DG -> PSC path: once a submission both (a) reaches
   MANAGER_CHECKLIST_REVIEW-ready via that path and (b) has a routed_unit
   resolvable from its form type, no human action should be required to get
   it into the unit manager's queue. This migration only does (1); (2) is a
   behavioural change in views.py, not a schema/data change.
"""
from django.db import migrations

HR_ROUTED_FORM_TYPE_CODES = [
    'RECRUIT-PROBATION', 'RECRUIT-CONFIRM', 'RECRUIT-DIRECT',
    'RECRUIT-TEMPORARY', 'RECRUIT-CONTRACT', 'RECRUIT-ACTING',
    'RECRUIT-ELIGIBLE', 'RECRUIT-UNSUCCESSFUL',
    'CESSATION-AGE', 'CESSATION-NOTICE-AGE', 'CESSATION-MEDICAL',
    'CESSATION-DEATH', 'CESSATION-REDUNDANCY', 'CESSATION-RESIGNATION',
    'SECONDMENT', 'LEAVE-PAYOUT', 'MEDICAL-CLAIM',
]


def set_routed_unit(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code__in=HR_ROUTED_FORM_TYPE_CODES).update(routed_unit='hr')


def unset_routed_unit(apps, schema_editor):
    PSCFormType = apps.get_model('tracker', 'PSCFormType')
    PSCFormType.objects.filter(code__in=HR_ROUTED_FORM_TYPE_CODES).update(routed_unit='')


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0182_seed_medical_claim_acting_eligible_templates'),
    ]

    operations = [
        migrations.RunPython(set_routed_unit, unset_routed_unit),
    ]
