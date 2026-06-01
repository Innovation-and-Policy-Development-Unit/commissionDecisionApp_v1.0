from django.db import migrations, models

# Workflow stage choices after inserting PENDING_DG_ENDORSEMENT between
# DRAFT and SUBMITTED. Kept inline so the migration is self-contained.
WORKFLOW_STAGE_CHOICES = [
    ('draft', 'Draft'),
    ('pending_dg_endorsement', 'Submitted to DG (Pending Endorsement)'),
    ('submitted', 'Submitted to PSC'),
    ('received_by_psc', 'Received by PSC'),
    ('returned_for_clarification', 'Returned for Clarification'),
    ('registered_routed', 'Registered and Routed'),
    ('manager_checklist_review', 'Manager Checklist Review'),
    ('under_assessment', 'Under Assessment'),
    ('compliance_under_review', 'Compliance Under Review (CMS)'),
    ('deferred', 'Deferred'),
    ('tabled', 'Tabled'),
    ('awaiting_legal_advice', 'Awaiting Legal Advice'),
    ('awaiting_cabinet_decision', 'Awaiting Cabinet Decision'),
    ('resubmitted', 'Resubmitted'),
    ('forwarded_to_commission', 'Forwarded to Commission'),
    ('commission_sitting', 'Commission Sitting'),
    ('matters_arising', 'Matters Arising'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('returned', 'Returned'),
    ('deferred_back_to_hr', 'Deferred Back to HR'),
    ('secretary_review', 'Secretary Review'),
    ('minutes_drafted_signed', 'Minutes Drafted and Signed'),
    ('decision_entered_assigned', 'Decision Entered and Assigned'),
    ('under_implementation', 'Under Implementation'),
    ('implementation_report', 'Implementation Report'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0104_refresh_new_user_welcome_email'),
    ]

    operations = [
        migrations.AlterField(
            model_name='submission',
            name='current_stage',
            field=models.CharField(
                choices=WORKFLOW_STAGE_CHOICES, default='draft', max_length=48
            ),
        ),
        migrations.AlterField(
            model_name='workflowevent',
            name='new_stage',
            field=models.CharField(choices=WORKFLOW_STAGE_CHOICES, max_length=48),
        ),
        migrations.AlterField(
            model_name='workflowevent',
            name='previous_stage',
            field=models.CharField(choices=WORKFLOW_STAGE_CHOICES, max_length=48),
        ),
        migrations.AlterField(
            model_name='requireddocument',
            name='mandatory_for_stage',
            field=models.CharField(
                blank=True,
                choices=WORKFLOW_STAGE_CHOICES,
                help_text='Block transition FROM this stage if this item is incomplete.',
                max_length=50,
                null=True,
            ),
        ),
    ]
