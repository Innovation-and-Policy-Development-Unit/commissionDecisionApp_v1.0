from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0069_document_classification_meeting_briefing"),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_transition_guidance",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="F1 transition helper: suggestions, blockers, rationales.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_clarification_bilingual",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="English + Bislama clarification text for ministry.",
            ),
        ),
        migrations.AddField(
            model_name="agendaitem",
            name="agenda_blurb",
            field=models.TextField(
                blank=True,
                help_text="AI-generated 2–3 sentence agenda blurb for the sitting pack.",
            ),
        ),
        migrations.AddField(
            model_name="agendaitem",
            name="agenda_blurb_processed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="deadlinereminderdraft",
            name="subject_bi",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="deadlinereminderdraft",
            name="body_bi",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="commissiontask",
            name="ai_subtask_drafts",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="AI-drafted subtask suggestions (verify before creating).",
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="ai_annotation_suggestions",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="AI-suggested PDF review highlights.",
            ),
        ),
        migrations.AddField(
            model_name="submissiondocument",
            name="ai_redaction_spans",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="E3 suggested redaction spans.",
            ),
        ),
    ]
