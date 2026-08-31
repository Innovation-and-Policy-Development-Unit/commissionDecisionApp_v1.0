"""
tracker/comment_views.py
─────────────────────────
A7 Collaboration (P1) — polymorphic discussion comments.

Comments attach to any object via contenttypes. For P1 the only wired target is
``submission`` (the core collaboration object). The TARGET_RESOLVERS registry makes
adding Meeting / CommissionTask targets in later phases a one-line change.

Government-record rules enforced here:
  • Ministry firewall — access is gated by _submission_queryset_for; internal comments
    are never returned to (nor created by) ministry-side users.
  • Soft-delete only — DELETE tombstones the row; the record is retained.
  • Edit history — edits bump edit_count and stamp edited_at.
  • Every write is mirrored to the AuditLog.
"""
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AuditLog, Comment, Profile, Submission, Role
from .serializers import CommentSerializer
from .audit import log_action
from .mentions import process_comment_mentions, render_plain

# Ministry-side roles never see / create internal (PSC-only) comments.
_MINISTRY_SIDE_ROLES = {
    Role.MINISTRY_HR,
    Role.HEAD_OF_AGENCY,
    Role.TRAVELLER,
    Role.DEPT_ADMIN,
}


def _is_ministry_side(user):
    if user.is_superuser or user.is_staff:
        return False
    profile = getattr(user, "psc_profile", None)
    return bool(profile and profile.role in _MINISTRY_SIDE_ROLES)


# Compliance self-submissions still being drafted are visible to the whole
# Compliance team (see _submission_queryset_for), but only the creator and
# their explicitly-invited SubmissionCollaborators may actually post a
# comment — everyone else can still read the thread once posted.
_COMPLIANCE_FORM_CATEGORY_CODES = ("COMPLIANCE", "discipline_compliance")


def _assert_can_comment(user, target):
    """Raise PermissionDenied if `user` may not post a comment on `target`."""
    from .models import WorkflowStage

    if not isinstance(target, Submission):
        return
    if user.is_superuser or user.is_staff:
        return
    is_compliance_submission = (
        target.is_internal
        and getattr(target.form_category, "code", None) in _COMPLIANCE_FORM_CATEGORY_CODES
    )
    still_drafting = target.current_stage in (
        WorkflowStage.DRAFT, WorkflowStage.RETURNED_FOR_CLARIFICATION,
    )
    if not (is_compliance_submission and still_drafting):
        return
    if user.id == target.created_by_id:
        return
    if target.collaborators.filter(user_id=user.id).exists():
        return
    raise PermissionDenied(
        "Only the submission's creator and invited collaborators can comment "
        "while it's still a draft."
    )


def _resolve_submission_target(user, object_id):
    """Return the Submission if the user may access it, else None (RBAC + firewall)."""
    from .views import _submission_queryset_for

    return _submission_queryset_for(user).filter(pk=object_id).first()


# target_key → (Model, resolver). Extend here for meetings/tasks in later phases.
TARGET_RESOLVERS = {
    "submission": (Submission, _resolve_submission_target),
}


def parse_target(raw):
    if not raw or ":" not in raw:
        raise ValidationError({"target": "Expected '<type>:<id>', e.g. 'submission:123'."})
    key, _, ident = raw.partition(":")
    key = key.strip().lower()
    if key not in TARGET_RESOLVERS:
        raise ValidationError({"target": f"Unsupported target type '{key}'."})
    try:
        object_id = int(ident)
    except (TypeError, ValueError):
        raise ValidationError({"target": "Target id must be an integer."})
    return key, object_id


def authorize_target(user, raw):
    """Parse + authorize a target string → (ContentType, obj, key). Raises on failure."""
    key, object_id = parse_target(raw)
    model, resolver = TARGET_RESOLVERS[key]
    obj = resolver(user, object_id)
    if obj is None:
        raise NotFound("Target not found or not accessible.")
    ct = ContentType.objects.get_for_model(model)
    return ct, obj, key


def _can_see_comment(target_obj, is_internal):
    """Predicate: may a given user see this comment? (RBAC + firewall + internal flag)."""
    from .views import _submission_queryset_for

    def can_see(user):
        if is_internal and _is_ministry_side(user):
            return False
        return _submission_queryset_for(user).filter(pk=target_obj.pk).exists()

    return can_see


class CommentViewSet(viewsets.ModelViewSet):
    """
    /api/comments/?target=submission:<id>   (list, create)
    /api/comments/<id>/                       (partial_update=edit, destroy=soft-delete)
    """

    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def _authorize_target(self, raw):
        return authorize_target(self.request.user, raw)

    # ── queryset ──────────────────────────────────────────────────────────────
    def get_queryset(self):
        # Detail actions (edit/delete) operate by pk; object-level access is checked
        # in the action methods against the comment's own target.
        if self.action in {"partial_update", "update", "destroy", "retrieve"}:
            return Comment.objects.select_related("author").all()

        raw = self.request.query_params.get("target")
        ct, obj, _ = self._authorize_target(raw)
        qs = (
            Comment.objects.filter(content_type=ct, object_id=obj.pk)
            .select_related("author")
            .order_by("created_at")
        )
        if _is_ministry_side(self.request.user):
            qs = qs.exclude(is_internal=True)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    # ── create ──────────────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        raw = request.data.get("target")
        ct, obj, key = self._authorize_target(raw)
        _assert_can_comment(request.user, obj)

        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "Comment cannot be empty."})

        # Ministry-side users cannot create internal (PSC-only) comments.
        is_internal = bool(request.data.get("is_internal"))
        if is_internal and _is_ministry_side(request.user):
            is_internal = False

        # Optional one-level reply; parent must belong to the same target.
        parent = None
        parent_id = request.data.get("parent")
        if parent_id:
            parent = Comment.objects.filter(
                pk=parent_id, content_type=ct, object_id=obj.pk, is_deleted=False
            ).first()
            if parent is None:
                raise ValidationError({"parent": "Parent comment not found on this target."})
            if parent.parent_id:  # keep threading to a single level
                parent = parent.parent

        comment = Comment.objects.create(
            content_type=ct,
            object_id=obj.pk,
            author=request.user,
            body=body,
            is_internal=is_internal,
            parent=parent,
        )
        log_action(
            request, "CREATE",
            resource_type="Comment", resource_id=comment.pk,
            resource_label=f"{key}:{obj.pk}",
            description=f"Comment posted on {key} {getattr(obj, 'reference_number', obj.pk)}",
            extra_data={"target": f"{key}:{obj.pk}", "is_internal": is_internal},
        )
        # @mentions → notify users who may actually see this comment.
        process_comment_mentions(
            comment, actor=request.user,
            can_user_see_comment=_can_see_comment(obj, is_internal),
            request=request,
        )
        ser = self.get_serializer(comment)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    # ── edit (body only; history retained) ────────────────────────────────────
    def partial_update(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment, pk=kwargs["pk"])
        if comment.author_id != request.user.id:
            raise PermissionDenied("You can only edit your own comments.")
        if comment.is_deleted:
            raise ValidationError("Cannot edit a deleted comment.")

        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "Comment cannot be empty."})

        comment.body = body
        comment.edited_at = timezone.now()
        comment.edit_count = (comment.edit_count or 0) + 1
        comment.save(update_fields=["body", "edited_at", "edit_count", "updated_at"])
        log_action(
            request, "UPDATE",
            resource_type="Comment", resource_id=comment.pk,
            description=f"Comment edited (edit #{comment.edit_count})",
        )
        # Notify any newly-added mentions (existing ones are already notified).
        process_comment_mentions(
            comment, actor=request.user,
            can_user_see_comment=_can_see_comment(comment.target, comment.is_internal),
            request=request,
        )
        return Response(self.get_serializer(comment).data)

    # ── soft delete (record retained) ─────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        comment = get_object_or_404(Comment, pk=kwargs["pk"])
        if not (comment.author_id == request.user.id or request.user.is_superuser or request.user.is_staff):
            raise PermissionDenied("You can only delete your own comments.")
        if not comment.is_deleted:
            comment.is_deleted = True
            comment.deleted_by = request.user
            comment.deleted_at = timezone.now()
            comment.save(update_fields=["is_deleted", "deleted_by", "deleted_at", "updated_at"])
            log_action(
                request, "DELETE",
                resource_type="Comment", resource_id=comment.pk,
                description="Comment soft-deleted",
            )
        return Response(self.get_serializer(comment).data, status=status.HTTP_200_OK)


# ── @mention autocomplete ──────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mention_suggest(request):
    """
    GET /api/mentions/suggest/?target=submission:<id>&q=<text>

    Returns users who may be @mentioned on the target — i.e. who can actually access
    it (RBAC + ministry firewall). Never a global user list.
    """
    from .views import _submission_queryset_for
    from .media_urls import public_media_url

    raw = request.query_params.get("target")
    _ct, obj, _key = authorize_target(request.user, raw)  # raises 400/404

    q = (request.query_params.get("q") or "").strip()
    profiles = Profile.objects.select_related("user").filter(user__is_active=True)
    if q:
        profiles = profiles.filter(
            Q(user__username__icontains=q)
            | Q(user__first_name__icontains=q)
            | Q(user__last_name__icontains=q)
        )
    profiles = profiles.order_by("user__first_name", "user__username")[:40]

    results = []
    for p in profiles:
        u = p.user
        if u.pk == request.user.pk:
            continue
        if not _submission_queryset_for(u).filter(pk=obj.pk).exists():
            continue
        try:
            role_label = p.get_role_display()
        except Exception:
            role_label = p.role or ""
        results.append({
            "id": u.pk,
            "username": u.username,
            "name": (u.get_full_name() or "").strip() or u.username,
            "role_label": role_label,
            "picture": public_media_url(p.profile_picture, request) if p.profile_picture else None,
        })
        if len(results) >= 10:
            break

    return Response(results)


# ── Unified Activity Timeline (P3) ──────────────────────────────────────────────

def _actor_name(user, fallback="System"):
    if not user:
        return fallback
    return (user.get_full_name() or "").strip() or user.username


# Audit actions excluded from the timeline: READ is noise; DECISION is already shown
# as a stage transition (with proof); comment/mention writes are surfaced natively.
_AUDIT_SKIP_ACTIONS = {"READ", "DECISION"}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_timeline(request):
    """
    GET /api/activity/?target=submission:<id>&kind=all|discussion|activity

    A merged, firewall-filtered "story of this submission": comments, workflow stage
    transitions, and audit events — one chronological feed (newest first). Reuses the
    existing AuditLog / WorkflowEvent / Comment data; stores nothing new.
    """
    raw = request.query_params.get("target")
    ct, obj, key = authorize_target(request.user, raw)  # raises 400/404
    kind = (request.query_params.get("kind") or "all").lower()
    ministry_side = _is_ministry_side(request.user)

    entries = []

    # 1) Comments (+ replies), respecting the internal firewall.
    if kind in ("all", "comment", "discussion"):
        cqs = Comment.objects.filter(content_type=ct, object_id=obj.pk).select_related("author")
        if ministry_side:
            cqs = cqs.exclude(is_internal=True)
        for c in cqs:
            if c.is_deleted:
                summary, body = "deleted a comment", ""
            else:
                summary = "replied" if c.parent_id else "commented"
                body = render_plain(c.body)
            entries.append({
                "id": f"comment-{c.id}",
                "kind": "comment",
                "actor": _actor_name(c.author),
                "summary": summary,
                "body": body,
                "is_internal": c.is_internal,
                "at": c.created_at,
            })

    # 2) Workflow stage transitions (submission targets).
    if kind in ("all", "stage", "activity") and key == "submission":
        from .email_notify import stage_label

        for e in obj.events.select_related("actor").all():
            new = stage_label(e.new_stage)
            if e.previous_stage:
                summary = f"moved to {new}"
            else:
                summary = f"created at {new}"
            entries.append({
                "id": f"stage-{e.id}",
                "kind": "stage",
                "actor": _actor_name(e.actor, fallback=(e.actor_label or "System")),
                "summary": summary,
                "body": e.remarks or "",
                "body_html": e.remarks_html or "",
                "is_internal": False,
                "at": e.created_at,
                "has_proof": bool(e.content_hash),
            })

    # 3) Audit events scoped to this resource (downloads, edits, etc.).
    if kind in ("all", "activity"):
        aqs = (
            AuditLog.objects.filter(resource_type="Submission", resource_id=str(obj.pk))
            .exclude(action__in=_AUDIT_SKIP_ACTIONS)
            .select_related("actor")
        )
        for a in aqs:
            entries.append({
                "id": f"audit-{a.id}",
                "kind": "activity",
                "actor": a.actor_username or "System",
                "summary": a.get_action_display().lower(),
                "body": a.description or "",
                "is_internal": False,
                "at": a.timestamp,
            })

    entries.sort(key=lambda x: x["at"], reverse=True)

    try:
        limit = min(max(int(request.query_params.get("limit", 50)), 1), 200)
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except (TypeError, ValueError):
        offset = 0

    total = len(entries)
    page = entries[offset:offset + limit]
    for e in page:
        e["at"] = e["at"].isoformat()

    return Response({"count": total, "results": page})
