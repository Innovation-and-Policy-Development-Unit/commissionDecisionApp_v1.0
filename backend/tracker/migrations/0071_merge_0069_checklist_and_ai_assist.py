"""Merge parallel 0069 branches (checklist notes vs classification + 0070 AI assist)."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0069_checklistitem_notes"),
        ("tracker", "0070_ai_assist_features"),
    ]

    operations = []
