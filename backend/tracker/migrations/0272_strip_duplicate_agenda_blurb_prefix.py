"""Strip the '[AI draft — verify]' prefix baked into existing agenda_blurb text.

The blurb generator used to instruct the model to prefix its own output with
"[AI draft — verify]", then defensively re-prepend that same prefix if it
didn't detect one already there — but the detection check compared a
mixed-case literal against an all-lowercased string, so it never matched and
every blurb ended up with the prefix duplicated (visible on the agenda page
as "[AI draft — verify] [AI draft — verify] ..."). The generator no longer
embeds this prefix into the text at all (the UI already shows a separate
"Draft — verify" label alongside it) — this one-off cleans up rows that
already got the duplicated (or single) prefix baked in before that fix.
"""
import re

from django.db import migrations

_PREFIX_RE = re.compile(r"^(\[ai draft[^\]]*\]\s*)+", re.IGNORECASE)


def strip_prefix(apps, schema_editor):
    AgendaItem = apps.get_model("tracker", "AgendaItem")
    for item in AgendaItem.objects.filter(agenda_blurb__iregex=r"^\[ai draft"):
        cleaned = _PREFIX_RE.sub("", item.agenda_blurb or "").strip()
        if cleaned != item.agenda_blurb:
            item.agenda_blurb = cleaned
            item.save(update_fields=["agenda_blurb"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0271_conversationparticipant_deleted_at"),
    ]

    operations = [
        migrations.RunPython(strip_prefix, migrations.RunPython.noop),
    ]
