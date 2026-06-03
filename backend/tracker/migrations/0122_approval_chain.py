from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add approval_chain to AgendaSection and add the two new WorkflowStage choices.
    Also seeds the VIPAM training section with its approval chain.
    """

    dependencies = [
        ('tracker', '0121_vipam_internal_workflow'),
    ]

    operations = [
        migrations.AddField(
            model_name='agendasection',
            name='approval_chain',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'Ordered list of approval steps required before the submission reaches the '
                    'Secretary / PSC. Each step: {"stage": "pending_manager_approval", '
                    '"roles": ["vipam_manager"], "label": "VIPAM Manager"}. '
                    'Stages: pending_manager_approval, pending_second_approval.'
                ),
            ),
        ),
        # Seed VIPAM training section with a Manager Approval step
        migrations.RunSQL(
            sql="""
                UPDATE tracker_agendasection
                SET approval_chain = '[{"stage": "pending_manager_approval", "roles": ["vipam_manager"], "label": "VIPAM Manager Approval"}]'::jsonb
                WHERE code = 'training';
            """,
            reverse_sql="""
                UPDATE tracker_agendasection SET approval_chain = '[]'::jsonb WHERE code = 'training';
            """,
        ),
    ]
