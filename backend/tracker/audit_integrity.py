"""AuditLog hash-chain verification (P1-08), shared by the management command and
the Integrity & Access Attestation report so both always apply the same rule."""
from __future__ import annotations

from .models import AuditLog


def verify_audit_chain() -> tuple[int, list[tuple[int, str]]]:
    """Walk the chain in id order. Returns (rows_checked, [(audit_log_id, reason), ...])."""
    prev_hash = ""
    total = 0
    breaks: list[tuple[int, str]] = []

    first = True
    for entry in AuditLog.objects.order_by("id").iterator():
        total += 1
        # A legitimately-purged chain start (see purge_expired_data.py): its
        # prev_hash was deliberately overwritten with the marker, so neither
        # check can be recomputed for just this row — resume from the next one.
        is_truncation_point = first and entry.prev_hash == AuditLog.CHAIN_TRUNCATION_MARKER
        if not is_truncation_point:
            if entry.prev_hash != prev_hash:
                breaks.append((entry.id, "prev_hash does not match the preceding row's "
                                          "content_hash — a row before this one was likely "
                                          "altered or deleted"))
            elif entry.content_hash != entry.compute_content_hash():
                breaks.append((entry.id, "content_hash does not match this row's own "
                                          "content — this row was altered after being written"))
        prev_hash = entry.content_hash
        first = False

    return total, breaks
