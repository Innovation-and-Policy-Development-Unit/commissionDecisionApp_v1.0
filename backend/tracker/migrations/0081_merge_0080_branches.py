"""Merge parallel 0080 migrations (travel forms + AI analysis)."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0080_travel_forms"),
        ("tracker", "0080_ai_analysis_webpush_docversion"),
    ]

    operations = []
