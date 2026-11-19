"""Who has read the circulated draft minutes.

When the Secretary circulates minutes, every active Commissioner gets a row
here. A Commissioner has *responded* once they post a comment or confirm
"read, no comments"; merely opening the minutes shows they looked, not that
they finished. The Secretary watches the list and the daily sweep reminds only
the Commissioners who have not responded. Nothing here blocks signing: the
Secretary decides whether to go ahead with anyone outstanding.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import MinutesComment, MinutesCommissionerReview, MinutesStatus, Role

User = get_user_model()

NOT_OPENED = "not_opened"
OPENED = "opened"
COMMENTED = "commented"
NO_COMMENTS = "no_comments"
RESPONDED = {COMMENTED, NO_COMMENTS}

STATUS_LABELS = {
    NOT_OPENED: "Not opened",
    OPENED: "Opened, not yet confirmed",
    COMMENTED: "Commented",
    NO_COMMENTS: "Read, no comments",
}


def commissioners():
    return User.objects.filter(is_active=True, psc_profile__role=Role.PSC_COMMISSIONER)


def ensure_reviews(minutes):
    """One row per active Commissioner; safe to call again (late joiners get a row)."""
    existing = set(minutes.commissioner_reviews.values_list("user_id", flat=True))
    new = [MinutesCommissionerReview(minutes=minutes, user=u)
           for u in commissioners() if u.id not in existing]
    if new:
        MinutesCommissionerReview.objects.bulk_create(new)
    return minutes.commissioner_reviews.select_related("user")


def _commenter_ids(minutes) -> set[int]:
    return set(MinutesComment.objects.filter(minutes=minutes).values_list("author_id", flat=True))


def review_status(review, commenters: set[int]) -> str:
    if review.confirmed_no_comments_at:
        return NO_COMMENTS
    if review.user_id in commenters:
        return COMMENTED
    if review.opened_at:
        return OPENED
    return NOT_OPENED


def mark_opened(minutes, user):
    """Record the first time a Commissioner opens the circulated minutes."""
    if minutes.status != MinutesStatus.CIRCULATED_TO_COMMISSIONERS:
        return None
    review = ensure_reviews(minutes).filter(user=user).first()
    if review and not review.opened_at:
        review.opened_at = timezone.now()
        review.save(update_fields=["opened_at"])
    return review


def confirm_no_comments(minutes, user):
    review = ensure_reviews(minutes).filter(user=user).first()
    if review is None:
        return None
    now = timezone.now()
    review.confirmed_no_comments_at = now
    if not review.opened_at:
        review.opened_at = now
    review.save(update_fields=["confirmed_no_comments_at", "opened_at"])
    return review


def tracker_payload(minutes) -> dict:
    commenters = _commenter_ids(minutes)
    rows = []
    for r in ensure_reviews(minutes):
        st = review_status(r, commenters)
        rows.append({
            "user_id": r.user_id,
            "name": (r.user.get_full_name() or r.user.username),
            "status": st,
            "status_label": STATUS_LABELS[st],
            "opened_at": r.opened_at,
            "confirmed_at": r.confirmed_no_comments_at,
            "last_reminded_at": r.last_reminded_at,
        })
    outstanding = sum(1 for x in rows if x["status"] not in RESPONDED)
    due = minutes.commissioner_review_due_at
    return {
        "minutes_id": minutes.id,
        "status": minutes.status,
        "due_at": due,
        "overdue": bool(due and due < timezone.now() and outstanding),
        "total": len(rows),
        "responded": len(rows) - outstanding,
        "outstanding": outstanding,
        "rows": rows,
    }


def outstanding_reviews(minutes):
    commenters = _commenter_ids(minutes)
    return [r for r in ensure_reviews(minutes) if review_status(r, commenters) not in RESPONDED]
