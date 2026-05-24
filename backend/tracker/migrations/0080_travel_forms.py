"""Travel forms 4.4–4.6: secretary-only workflow, signatures, and form fields."""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

from tracker.travel_forms import (
    TRAVEL_CATEGORY_CODE,
    TRAVEL_FORM_TYPES,
    fields_for_form_type,
)


def seed_travel_forms(apps, schema_editor):
    FormCategory = apps.get_model("tracker", "FormCategory")
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    PSCFormField = apps.get_model("tracker", "PSCFormField")

    category, _ = FormCategory.objects.get_or_create(
        code=TRAVEL_CATEGORY_CODE,
        defaults={
            "name": "Travel & allowances",
            "psc_forms_summary": "PSC Forms 4.4–4.6 — secretary-only travel approvals.",
            "display_order": 15,
        },
    )

    for code, name in TRAVEL_FORM_TYPES:
        ft, _ = PSCFormType.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "form_category": category,
                "is_digitized": True,
                "digitized_form_key": code.replace(" ", "_").lower().replace(".", "_"),
                "is_active": True,
                "display_order": {"PSC 4.4": 44, "PSC 4.5": 45, "PSC 4.6": 46}.get(code, 0),
                "agenda_category": "other",
            },
        )
        PSCFormField.objects.filter(form_type=ft).delete()
        for row in fields_for_form_type(code):
            extra = {}
            if row.get("choices"):
                extra["choices"] = row["choices"]
            if row.get("help_text"):
                extra["help_text"] = row["help_text"]
            if row.get("start_new_page"):
                extra["start_new_page"] = True
            PSCFormField.objects.create(
                form_type=ft,
                label=row["label"],
                field_key=row["field_key"],
                field_type=row.get("field_type", "text"),
                is_required=row.get("is_required", False),
                display_order=row.get("display_order", 0),
                **extra,
            )


def unseed_travel_forms(apps, schema_editor):
    PSCFormType = apps.get_model("tracker", "PSCFormType")
    FormCategory = apps.get_model("tracker", "FormCategory")
    codes = [c for c, _ in TRAVEL_FORM_TYPES]
    PSCFormType.objects.filter(code__in=codes).delete()
    FormCategory.objects.filter(code=TRAVEL_CATEGORY_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0079_daily_brief"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="submission",
            name="secretary_only",
            field=models.BooleanField(
                default=False,
                help_text="True for travel forms 4.4–4.6: Secretary decides; never forwarded to Commission.",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="requires_travel_letter",
            field=models.BooleanField(
                default=False,
                help_text="True when Secretary approval must generate an official letter (Forms 4.5 & 4.6).",
            ),
        ),
        migrations.AddField(
            model_name="submission",
            name="travel_endorsers",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="User IDs for ministry endorsement signers: hod, director, dg, minister.",
            ),
        ),
        migrations.CreateModel(
            name="FormSectionSignature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("section_key", models.CharField(max_length=64)),
                ("signer_name", models.CharField(blank=True, max_length=255)),
                ("signed_at", models.DateTimeField(auto_now_add=True)),
                ("approved", models.BooleanField(blank=True, help_text="For secretary_decision: True=approved, False=not approved.", null=True)),
                ("remarks", models.TextField(blank=True)),
                ("signature_image", models.ImageField(blank=True, null=True, upload_to="form_section_signatures/%Y/%m/")),
                ("signed_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="form_section_signatures", to=settings.AUTH_USER_MODEL)),
                ("submission", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="section_signatures", to="tracker.submission")),
            ],
            options={
                "ordering": ["signed_at"],
                "unique_together": {("submission", "section_key")},
            },
        ),
        migrations.CreateModel(
            name="TravelApprovalLetter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=500)),
                ("body_text", models.TextField()),
                ("body_html", models.TextField(blank=True)),
                ("issued_at", models.DateTimeField(auto_now_add=True)),
                ("issued_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="travel_letters_issued", to=settings.AUTH_USER_MODEL)),
                ("submission", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="travel_approval_letter", to="tracker.submission")),
            ],
            options={
                "ordering": ["-issued_at"],
            },
        ),
        migrations.RunPython(seed_travel_forms, unseed_travel_forms),
    ]
