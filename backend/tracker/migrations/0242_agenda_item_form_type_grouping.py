from itertools import groupby

from django.db import migrations, models


def backfill_and_group(apps, schema_editor):
    AgendaItem = apps.get_model("tracker", "AgendaItem")

    items = list(
        AgendaItem.objects.select_related("submission")
        .order_by("meeting_id", "category", "sequence", "added_at")
    )
    for item in items:
        item.form_type_code = item.submission.form_type_code or ""
    if items:
        AgendaItem.objects.bulk_update(items, ["form_type_code"])

    # Re-group existing items so items of the same submission type are
    # contiguous within each meeting's category, preserving each type's
    # first-appearance order (stable — matches the prior linear order for
    # already-grouped data, and only reshuffles interleaved categories).
    to_update = []
    for (meeting_id, category), group in groupby(
        items, key=lambda it: (it.meeting_id, it.category)
    ):
        group = list(group)
        seen_types = []
        buckets = {}
        for item in group:
            key = item.form_type_code
            if key not in buckets:
                buckets[key] = []
                seen_types.append(key)
            buckets[key].append(item)

        seq = 1
        for key in seen_types:
            for item in buckets[key]:
                if item.sequence != seq:
                    item.sequence = seq
                    to_update.append(item)
                seq += 1

    if to_update:
        AgendaItem.objects.bulk_update(to_update, ["sequence"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0241_seed_ipdu_form_types"),
    ]

    operations = [
        migrations.AddField(
            model_name="agendaitem",
            name="form_type_code",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Denormalized from submission.form_type_code at placement time. "
                    "Items of the same type are kept contiguous within a category's "
                    "sequence so the agenda groups e.g. all Voluntary Resignations together."
                ),
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_and_group, noop_reverse),
    ]
