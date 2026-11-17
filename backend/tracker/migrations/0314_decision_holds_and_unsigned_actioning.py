import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0313_minutes_numbers_and_attendance"),
    ]

    operations = [
        migrations.AddField(
            model_name="minutes",
            name="unsigned_actioning_allowed_by",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="unsigned_actioning_minutes",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="minutes",
            name="unsigned_actioning_allowed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="minutes",
            name="unsigned_actioning_note",
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name="DecisionActioningHold",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.TextField()),
                ("held_at", models.DateTimeField(auto_now_add=True)),
                ("released_at", models.DateTimeField(blank=True, null=True)),
                ("agenda_item", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="actioning_holds", to="tracker.agendaitem")),
                ("held_by", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="agenda_holds_placed", to=settings.AUTH_USER_MODEL)),
                ("minutes", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="decision_holds", to="tracker.minutes")),
                ("released_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="agenda_holds_released", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-held_at"]},
        ),
        migrations.AddConstraint(
            model_name="decisionactioninghold",
            constraint=models.UniqueConstraint(
                condition=models.Q(("released_at__isnull", True)),
                fields=("agenda_item",),
                name="uniq_active_decision_hold_per_agenda_item",
            ),
        ),
    ]
