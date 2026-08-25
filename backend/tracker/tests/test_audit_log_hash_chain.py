"""Tamper-evident audit log hash chain (P1-08, SCDMS Pre-Production Readiness
Audit — Findings Register). `AuditLog.content_hash`/`prev_hash` chain every
row to the one before it; `verify_audit_log_integrity` walks the chain and
detects any row altered after being written, or deleted outright."""

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from ..audit import log_action
from ..models import AuditLog


class AuditLogHashChainTests(TestCase):
    def test_first_row_has_empty_prev_hash(self):
        log_action(None, AuditLog.Action.LOGIN, description="first")
        entry = AuditLog.objects.get()
        self.assertEqual(entry.prev_hash, "")
        self.assertEqual(entry.content_hash, entry.compute_content_hash())

    def test_second_row_chains_from_first(self):
        log_action(None, AuditLog.Action.LOGIN, description="first")
        log_action(None, AuditLog.Action.LOGOUT, description="second")
        first, second = AuditLog.objects.order_by("id")
        self.assertEqual(second.prev_hash, first.content_hash)
        self.assertNotEqual(second.content_hash, first.content_hash)

    def test_content_hash_changes_if_description_changes(self):
        """Same row, different content → different hash. This is what makes
        an after-the-fact edit detectable."""
        log_action(None, AuditLog.Action.LOGIN, description="original")
        entry = AuditLog.objects.get()
        original_hash = entry.content_hash
        entry.description = "tampered"
        self.assertNotEqual(entry.compute_content_hash(), original_hash)


class VerifyAuditLogIntegrityTests(TestCase):
    def _seed(self, n=5):
        for i in range(n):
            log_action(None, AuditLog.Action.LOGIN, description=f"entry {i}")

    def test_passes_on_untouched_chain(self):
        self._seed()
        call_command("verify_audit_log_integrity")  # raises CommandError on failure

    def test_passes_on_empty_table(self):
        call_command("verify_audit_log_integrity")

    def test_detects_content_altered_after_write(self):
        self._seed()
        victim = AuditLog.objects.order_by("id")[2]
        victim.description = "altered after the fact"
        victim.save(update_fields=["description"])
        with self.assertRaises(CommandError):
            call_command("verify_audit_log_integrity")

    def test_detects_row_deleted_outright(self):
        self._seed()
        victim = AuditLog.objects.order_by("id")[2]
        victim.delete()
        with self.assertRaises(CommandError):
            call_command("verify_audit_log_integrity")

    def test_truncation_marker_is_not_flagged_as_a_break(self):
        """purge_expired_data.py's sanctioned exception: the new oldest row
        after a retention purge has a deliberately-overwritten prev_hash."""
        self._seed()
        oldest = AuditLog.objects.order_by("id").first()
        AuditLog.objects.filter(id=oldest.id).update(
            prev_hash=AuditLog.CHAIN_TRUNCATION_MARKER
        )
        call_command("verify_audit_log_integrity")  # must not raise

    def test_truncation_marker_elsewhere_in_chain_still_flagged(self):
        """The marker only exempts the very first row — anywhere else, it's
        just a corrupted prev_hash like any other."""
        self._seed()
        middle = AuditLog.objects.order_by("id")[2]
        middle.prev_hash = AuditLog.CHAIN_TRUNCATION_MARKER
        middle.save(update_fields=["prev_hash"])
        with self.assertRaises(CommandError):
            call_command("verify_audit_log_integrity")


class PurgeExpiredAuditLogsChainTests(TestCase):
    def test_purge_marks_new_oldest_row_and_logs_itself(self):
        from django.utils import timezone

        log_action(None, AuditLog.Action.LOGIN, description="old")
        old_entry = AuditLog.objects.get()
        AuditLog.objects.filter(id=old_entry.id).update(
            timestamp=timezone.now() - timezone.timedelta(days=365 * 8)
        )
        log_action(None, AuditLog.Action.LOGIN, description="recent")

        call_command("purge_expired_data", "--audit-retention-days=2555")  # ~7y

        self.assertFalse(AuditLog.objects.filter(id=old_entry.id).exists())
        remaining = AuditLog.objects.order_by("id").first()
        self.assertEqual(remaining.prev_hash, AuditLog.CHAIN_TRUNCATION_MARKER)
        # The purge itself left an audit trail (P1-08: "the purge itself is
        # unaudited" was part of the original finding).
        self.assertTrue(
            AuditLog.objects.filter(resource_type="RetentionPurge").exists()
        )
        call_command("verify_audit_log_integrity")  # chain still verifies clean
