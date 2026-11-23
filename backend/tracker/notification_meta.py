"""What kind of notification this is, and when not to send one.

Every notification used to be a title and a body; the bell guessed its icon from words in the
title ("approv" turned "Approval required" green). The kind is now stored on the row
(``category`` + ``severity``), filled in here when a notification is created, so no creator
has to remember to set them and the translated title can change freely.

Also here: the two quiet-down rules for automated chasers.

* a chaser is not sent again for the same thing to the same person within a few days;
* chasers are not sent for practice material (test papers, TRAIN-/TEST- sittings), which
  otherwise fill real accounts with "overdue" alerts about exercises.
"""

from __future__ import annotations

import re
from datetime import timedelta

from django.utils import timezone

SEVERITY_INFO = "info"
SEVERITY_SUCCESS = "success"
SEVERITY_WARNING = "warning"
SEVERITY_ERROR = "error"
SEVERITIES = (SEVERITY_INFO, SEVERITY_SUCCESS, SEVERITY_WARNING, SEVERITY_ERROR)

# How long a chaser stays quiet after it was sent: overdue notices repeat every third day.
CHASER_COOLDOWN_DAYS = 3

_PRACTICE_PREFIXES = ("TRAIN-", "TEST-")

# Checked in order; the first match wins. "Needs the reader to do something or something is
# late" is a warning; refusals and failures are errors; completed good news is success.
_SEVERITY_RULES = (
    (SEVERITY_ERROR, re.compile(r"\b(fail\w*|error|reject\w*|denied|declin\w*)\b", re.I)),
    (SEVERITY_WARNING, re.compile(
        r"overdue|past due|after the due date|not served|reminder|needs resending|"
        r"possible repeat|required|awaiting|returned|to read back|please review", re.I)),
    (SEVERITY_SUCCESS, re.compile(r"\b(approved|signed|endorsed|completed?|accepted)\b", re.I)),
)

# Checked in order; the first match wins.
_CATEGORY_RULES = (
    ("minutes", re.compile(r"minutes", re.I)),
    ("agenda", re.compile(r"agenda|sitting", re.I)),
    ("decision", re.compile(r"decision", re.I)),
    ("ai", re.compile(r"\bai\b", re.I)),
    ("duplicate", re.compile(r"repeat submission|duplicate", re.I)),
    ("approval", re.compile(r"approv|endorse|dg approval", re.I)),
    ("task", re.compile(r"\btask|assigned", re.I)),
    ("submission", re.compile(r"submi|ready for|returned|resubmitted", re.I)),
)
DEFAULT_CATEGORY = "general"
CATEGORIES = tuple(c for c, _ in _CATEGORY_RULES) + (DEFAULT_CATEGORY,)


def classify(title: str) -> tuple[str, str]:
    """(category, severity) for a notification, from its title."""
    text = title or ""
    severity = SEVERITY_INFO
    for level, pattern in _SEVERITY_RULES:
        if pattern.search(text):
            severity = level
            break
    category = DEFAULT_CATEGORY
    for name, pattern in _CATEGORY_RULES:
        if pattern.search(text):
            category = name
            break
    return category, severity


def is_practice_reference(reference) -> bool:
    """A TRAIN-/TEST- reference marks practice material (sittings have no test flag)."""
    return str(reference or "").upper().startswith(_PRACTICE_PREFIXES)


def is_practice_submission(submission) -> bool:
    return bool(
        getattr(submission, "is_test", False)
        or is_practice_reference(getattr(submission, "reference_number", ""))
    )


def sent_recently(recipient, title: str, *, days: int = CHASER_COOLDOWN_DAYS) -> bool:
    """Whether this person already got a notification with this exact title lately.

    Titles carry the sitting or paper reference, so this is "the same chaser about the same
    thing". Read or unread makes no difference: a chaser they already dismissed is not repeated
    on the next run.
    """
    from .models import Notification

    return Notification.objects.filter(
        recipient=recipient, title=title,
        created_at__gte=timezone.now() - timedelta(days=days),
    ).exists()
