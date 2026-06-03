"""Reconcile duplicate Ministry rows into a single canonical row.

Two seeders create ministries with different code schemes — migration
``0052_seed_demo_data`` uses codes like ``MOET``/``MOF`` while
``seed_tracker`` uses ``MET``/``MFEM`` — so a fresh deploy can end up with two
rows for the same ministry (submissions on one, user profiles on the other).
This collapses each same/near-same-named group onto one canonical row.

Used by both the ``merge_duplicate_ministries`` management command and the tail
of ``seed_tracker`` (so every seed run leaves a single row per ministry).
"""
import re

from django.db import transaction


def normalized_name(name: str) -> str:
    """Lowercase, drop punctuation and the standalone word 'and', collapse spaces.
    Groups 'Climate Change Adaptation' with 'Climate Change and Adaptation'."""
    s = (name or "").strip().lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\band\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _plan():
    """Return [(canonical, [others...])] for each duplicate-named group."""
    from .models import Ministry, Submission, Profile, Department

    groups = {}
    for mn in Ministry.objects.all():
        groups.setdefault(normalized_name(mn.name), []).append(mn)

    def score(mn):
        # Keep the row the users sit on and that has the richer department
        # structure; moved submissions lose their (old) department via SET_NULL.
        return (
            Profile.objects.filter(ministry=mn).count(),
            Department.objects.filter(ministry=mn).count(),
            Submission.objects.filter(ministry=mn).count(),
            -mn.id,
        )

    plan = []
    for rows in groups.values():
        if len(rows) < 2:
            continue
        canonical = max(rows, key=score)
        others = [m for m in rows if m.id != canonical.id]
        plan.append((canonical, others))
    return plan


def merge_duplicate_ministries(log=None):
    """Merge duplicate ministries in a single transaction. Idempotent.

    ``log`` is an optional callable (e.g. ``self.stdout.write``) for progress.
    Returns the number of redundant ministry rows removed.
    """
    from .models import Submission, Profile, DeadlineReminderDraft

    plan = _plan()
    if not plan:
        if log:
            log("  [OK] no duplicate ministries")
        return 0

    deleted = 0
    with transaction.atomic():
        for canonical, others in plan:
            for o in others:
                Submission.objects.filter(ministry=o).update(ministry=canonical)
                Profile.objects.filter(ministry=o).update(ministry=canonical)
                DeadlineReminderDraft.objects.filter(ministry=o).update(ministry=canonical)
                if log:
                    log(f"  [merge] {o.code} ({o.name}) → {canonical.code}")
                o.delete()  # cascades departments/units; SET_NULL clears moved dept links
                deleted += 1
    if log:
        log(f"  [OK] merged {deleted} duplicate ministry row(s)")
    return deleted
