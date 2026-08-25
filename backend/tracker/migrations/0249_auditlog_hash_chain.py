import hashlib
import json

from django.db import migrations, models
from django.utils import timezone


def _canonical_content(row):
    """Mirrors AuditLog.canonical_content() — duplicated here rather than
    imported since data migrations must not depend on the live model, which
    can change after this migration is written. Keep in sync if that method
    ever changes, or old rows' hashes stop verifying."""
    payload = {
        "actor_id": row.actor_id,
        "actor_username": row.actor_username,
        "action": row.action,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "resource_label": row.resource_label,
        "description": row.description,
        "ip_address": row.ip_address,
        "user_agent": row.user_agent,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "extra_data": row.extra_data,
    }
    return json.dumps(payload, sort_keys=True, default=str)


def backfill_hash_chain(apps, schema_editor):
    """Retroactively chain every existing AuditLog row in id (creation) order.
    This establishes a genesis point and makes tampering detectable from this
    migration forward — it can't prove pre-existing rows weren't already
    altered before this ran, only that they haven't been since."""
    AuditLog = apps.get_model("tracker", "AuditLog")
    prev_hash = ""
    batch = []
    for row in AuditLog.objects.order_by("id").iterator():
        row.prev_hash = prev_hash
        row.content_hash = hashlib.sha256(
            (prev_hash + _canonical_content(row)).encode("utf-8")
        ).hexdigest()
        prev_hash = row.content_hash
        batch.append(row)
        if len(batch) >= 1000:
            AuditLog.objects.bulk_update(batch, ["prev_hash", "content_hash"])
            batch = []
    if batch:
        AuditLog.objects.bulk_update(batch, ["prev_hash", "content_hash"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0248_submission_assessment_html'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='timestamp',
            field=models.DateTimeField(default=timezone.now, db_index=True),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='prev_hash',
            field=models.CharField(
                blank=True, max_length=64,
                help_text="content_hash of the immediately-preceding AuditLog row (by id) "
                          "at the time this row was written, forming a hash chain — see "
                          "content_hash. Empty for the very first row in the chain.",
            ),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='content_hash',
            field=models.CharField(
                blank=True, db_index=True, max_length=64,
                help_text="SHA-256 of prev_hash + this row's canonical content (see "
                          "canonical_content()), computed once at write time by "
                          "log_action() and never modified after. Re-walking the chain "
                          "in id order and recomputing each hash (the "
                          "verify_audit_log_integrity management command) detects any "
                          "row whose content was altered after the fact, or any row "
                          "deleted outright — the next surviving row's prev_hash won't "
                          "match. Rows predating this field were backfilled retroactively "
                          "by migration 0249, establishing a genesis point: that proves "
                          "no tampering *since* the backfill, not that those older rows "
                          "were untouched *before* it.",
            ),
        ),
        migrations.RunPython(backfill_hash_chain, noop_reverse),
    ]
