import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

PERM_CODE = "manage_minute_access"


def seed_permission(apps, schema_editor):
    SystemPermission = apps.get_model("tracker", "SystemPermission")
    RoleDefinition = apps.get_model("tracker", "RoleDefinition")

    perm, _ = SystemPermission.objects.update_or_create(
        code=PERM_CODE,
        defaults={
            "label": "Restrict & Share Minute Agenda Items",
            "category": "secretariat",
            "description": (
                "Lock specific agenda items inside signed minutes, share them with "
                "specific users, and approve or deny access requests."
            ),
            "is_builtin": True,
        },
    )
    for role in ("psc_secretary", "psc_admin"):
        rd = RoleDefinition.objects.filter(role=role).first()
        if rd:
            rd.permissions.add(perm)


def unseed_permission(apps, schema_editor):
    apps.get_model("tracker", "SystemPermission").objects.filter(code=PERM_CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0152_submission_trash_bin"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AgendaItemRestriction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_key", models.CharField(help_text="Stable key of the agenda block in Minutes.content: 'ai-<agenda_item_id>' for intake-derived items, or a generated 'k-…' key for manual items.", max_length=64)),
                ("item_title", models.CharField(blank=True, help_text="Denormalised agenda title at restrict time (for lists and notifications).", max_length=512)),
                ("reason", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("minutes", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agenda_restrictions", to="tracker.minutes")),
                ("restricted_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="agenda_restrictions_created", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["minutes_id", "item_key"],
            },
        ),
        migrations.CreateModel(
            name="AgendaAccessGrant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("granted_at", models.DateTimeField(auto_now_add=True)),
                ("granted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="agenda_access_grants_given", to=settings.AUTH_USER_MODEL)),
                ("restriction", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="grants", to="tracker.agendaitemrestriction")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agenda_access_grants", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-granted_at"],
            },
        ),
        migrations.CreateModel(
            name="AgendaAccessRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("denied", "Denied")], default="pending", max_length=16)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("decision_note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="agenda_access_requests_decided", to=settings.AUTH_USER_MODEL)),
                ("requested_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agenda_access_requests", to=settings.AUTH_USER_MODEL)),
                ("restriction", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="access_requests", to="tracker.agendaitemrestriction")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="agendaitemrestriction",
            name="visible_to",
            field=models.ManyToManyField(blank=True, related_name="visible_agenda_restrictions", through="tracker.AgendaAccessGrant", through_fields=("restriction", "user"), to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name="agendaitemrestriction",
            constraint=models.UniqueConstraint(fields=("minutes", "item_key"), name="uniq_restriction_per_minutes_item"),
        ),
        migrations.AddConstraint(
            model_name="agendaaccessgrant",
            constraint=models.UniqueConstraint(fields=("restriction", "user"), name="uniq_agenda_grant_per_user"),
        ),
        migrations.AddConstraint(
            model_name="agendaaccessrequest",
            constraint=models.UniqueConstraint(condition=models.Q(("status", "pending")), fields=("restriction", "requested_by"), name="uniq_pending_agenda_request_per_user"),
        ),
        migrations.RunPython(seed_permission, unseed_permission),
    ]
