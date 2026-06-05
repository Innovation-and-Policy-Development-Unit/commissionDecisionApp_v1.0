"""
tracker/mentions.py
────────────────────
@mention parsing + RBAC/firewall-safe fan-out for A7 Collaboration (P2).

Comment bodies store mentions as Markdown-ish tokens:  @[Display Name](user:42)

  • parse_mention_user_ids(body)  → ordered, de-duped list of user ids
  • render_plain(body)            → human text with tokens collapsed to "@Display Name"
  • process_comment_mentions(...) → create Mention rows + Notifications for users who
                                    may actually see the comment (firewall-safe).
"""
import re

MENTION_RE = re.compile(r"@\[([^\]]+)\]\(user:(\d+)\)")

# Body snippet length for the notification preview.
_SNIPPET = 240


def parse_mention_user_ids(body: str) -> list[int]:
    if not body:
        return []
    seen, out = set(), []
    for _, uid in MENTION_RE.findall(body):
        try:
            i = int(uid)
        except (TypeError, ValueError):
            continue
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def render_plain(body: str) -> str:
    """Collapse @[Name](user:ID) → @Name for emails / notification previews."""
    if not body:
        return ""
    return MENTION_RE.sub(lambda m: f"@{m.group(1)}", body)


def process_comment_mentions(comment, *, actor, can_user_see_comment, request=None):
    """
    Create Mention rows for users referenced in ``comment.body`` and notify the
    newly-mentioned ones.

    ``can_user_see_comment(user)`` must return True only if that user passes the
    RBAC + ministry-firewall check for this comment's target (and may see internal
    notes when the comment is internal). Mentions that fail are dropped silently —
    no leak.

    Returns the number of new notifications created.
    """
    from django.contrib.auth.models import User

    from .audit import log_action
    from .models import Mention, Notification

    user_ids = parse_mention_user_ids(comment.body)
    if not user_ids:
        return 0

    target = comment.target
    submission = target if target.__class__.__name__ == "Submission" else None
    actor_name = (actor.get_full_name() or actor.username) if actor else "Someone"
    preview = render_plain(comment.body).strip()
    if len(preview) > _SNIPPET:
        preview = preview[:_SNIPPET].rstrip() + "…"

    ref = getattr(target, "reference_number", None) or str(getattr(target, "pk", ""))
    new_count = 0

    for user in User.objects.filter(pk__in=user_ids, is_active=True):
        if actor and user.pk == actor.pk:
            continue  # no self-notify
        if not can_user_see_comment(user):
            continue  # firewall — would-be leak, drop silently

        mention, created = Mention.objects.get_or_create(
            comment=comment, mentioned_user=user
        )
        if not created and mention.notified:
            continue  # already handled (e.g. unchanged on edit)

        Notification.objects.create(
            recipient=user,
            submission=submission,
            channel=Notification.Channel.BOTH,
            title=f"{actor_name} mentioned you on {ref}",
            body=preview or f"{actor_name} mentioned you in a comment.",
        )
        mention.notified = True
        mention.save(update_fields=["notified"])
        new_count += 1

        log_action(
            request, "CREATE",
            resource_type="Mention", resource_id=mention.pk,
            resource_label=f"comment:{comment.pk}",
            description=f"{actor_name} mentioned {user.username}",
        )

    return new_count
