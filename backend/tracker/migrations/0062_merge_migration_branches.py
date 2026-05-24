"""Merge parallel migration branches (CMS/compliance vs AI/email/meeting)."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0059_alter_field_choices_sync"),
        ("tracker", "0061_workflow_choice_field_sync"),
    ]

    operations = []
