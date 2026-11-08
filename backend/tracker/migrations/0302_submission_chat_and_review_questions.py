"""Commissioner AI: per-submission chat messages and the review card's questions."""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0301_annual_report_documents_and_checklist"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="ai_review_questions",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_review_questions_processed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="submission",
            name="ai_review_questions_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="SubmissionChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("user", "User"), ("assistant", "Assistant")], max_length=16)),
                ("content", models.TextField()),
                ("cleared_by_user", models.BooleanField(default=False, help_text="The asker cleared it from their own view; the Secretariat record keeps it.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("submission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chat_messages", to="tracker.submission")),
                ("user", models.ForeignKey(help_text="Whose thread this message belongs to (the asker, for both turns).", on_delete=django.db.models.deletion.CASCADE, related_name="submission_chat_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["created_at", "id"],
                "indexes": [models.Index(fields=["submission", "user", "created_at"], name="tracker_sub_submiss_2020c4_idx")],
            },
        ),
    ]
