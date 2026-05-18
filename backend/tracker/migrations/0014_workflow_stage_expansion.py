"""Add Draft, Submitted, Returned for Clarification, Tabled, and Awaiting states to WorkflowStage."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0013_commission_task_update"),
    ]

    operations = [
        migrations.AlterField(
            model_name="submission",
            name="current_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                default="received_by_psc",
                max_length=48,
            ),
        ),
        migrations.AlterField(
            model_name="workflowevent",
            name="previous_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                max_length=48,
            ),
        ),
        migrations.AlterField(
            model_name="workflowevent",
            name="new_stage",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("submitted", "Submitted to PSC"),
                    ("received_by_psc", "Received by PSC"),
                    ("returned_for_clarification", "Returned for Clarification"),
                    ("registered_routed", "Registered and Routed"),
                    ("manager_checklist_review", "Manager Checklist Review"),
                    ("under_assessment", "Under Assessment"),
                    ("deferred", "Deferred"),
                    ("tabled", "Tabled"),
                    ("awaiting_legal_advice", "Awaiting Legal Advice"),
                    ("awaiting_cabinet_decision", "Awaiting Cabinet Decision"),
                    ("resubmitted", "Resubmitted"),
                    ("forwarded_to_commission", "Forwarded to Commission"),
                    ("commission_sitting", "Commission Sitting"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("returned", "Returned"),
                    ("minutes_drafted_signed", "Minutes Drafted and Signed"),
                    ("decision_entered_assigned", "Decision Entered and Assigned"),
                    ("under_implementation", "Under Implementation"),
                    ("implementation_report", "Implementation Report"),
                ],
                max_length=48,
            ),
        ),
    ]
