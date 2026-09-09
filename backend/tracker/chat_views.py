"""Instant chat — REST endpoints.

Real-time delivery happens over the WebSocket consumer in chat_consumers.py;
these REST views cover conversation/message history, starting conversations,
read receipts, edit/delete, reactions, and attachments. A message created,
edited, deleted, or reacted-to here is broadcast to the channel layer the
same way a WebSocket-originated send is, so every path stays in sync.
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .mentions import parse_mention_user_ids, render_plain
from .models import (
    Conversation, ConversationParticipant, Message, MessageAttachment,
    MessageReaction, Notification, Profile,
)
from .serializers import ChatUserSerializer, ConversationSerializer, MessageSerializer

_MENTION_SNIPPET = 240


def broadcast_to_conversation(conversation_id, event_type, payload):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"chat_conversation_{conversation_id}",
        {"type": event_type, **payload},
    )


def broadcast_to_user(user_id, event_type, payload):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"chat_user_{user_id}",
        {"type": event_type, **payload},
    )


def notify_chat_mentions(message, conversation):
    """@mentions in a chat message notify only users who are actually
    participants in this conversation — mentioning someone outside it is
    silently dropped rather than leaking a notification to them."""
    user_ids = parse_mention_user_ids(message.body)
    if not user_ids:
        return
    member_ids = set(
        ConversationParticipant.objects.filter(conversation=conversation, user_id__in=user_ids)
        .values_list("user_id", flat=True)
    )
    if not member_ids:
        return
    sender_name = (message.sender.get_full_name() or "").strip() or message.sender.username
    preview = render_plain(message.body).strip()
    if len(preview) > _MENTION_SNIPPET:
        preview = preview[:_MENTION_SNIPPET].rstrip() + "…"
    for uid in member_ids:
        if uid == message.sender_id:
            continue
        Notification.objects.create(
            recipient_id=uid,
            channel=Notification.Channel.IN_APP,
            title=f"{sender_name} mentioned you in chat",
            body=preview,
            link="/chat",
        )


class ConversationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/chat/conversations/                                  list, create
    /api/chat/conversations/<id>/messages/                    list (GET) / send (POST, multipart for attachments)
    /api/chat/conversations/<id>/messages/<msg_id>/            edit (PATCH) / soft-delete (DELETE)
    /api/chat/conversations/<id>/messages/<msg_id>/react/      set/toggle a reaction (POST)
    /api/chat/conversations/<id>/read/                         mark read (POST)
    """

    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Conversation.objects.filter(participants__user=self.request.user)
            .prefetch_related(
                "participants__user__psc_profile", "messages__sender",
                "messages__attachments", "messages__reactions",
            )
            .distinct()
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        participant_ids = request.data.get("participant_ids")
        name = (request.data.get("name") or "").strip()

        if not participant_ids or not isinstance(participant_ids, list):
            raise ValidationError({"participant_ids": "Provide at least one other user id."})

        others = list(
            User.objects.filter(id__in=participant_ids, is_active=True).exclude(id=request.user.id)
        )
        if not others:
            raise ValidationError({"participant_ids": "No valid participants found."})

        is_group = len(others) > 1 or bool(name)

        if not is_group:
            # Reuse an existing direct conversation between exactly these two
            # users instead of creating a duplicate thread every time someone
            # clicks "message" on the same colleague.
            other = others[0]
            existing = (
                Conversation.objects.filter(is_group=False, participants__user=request.user)
                .filter(participants__user=other)
                .distinct()
                .first()
            )
            if existing:
                ser = self.get_serializer(existing)
                return Response(ser.data, status=status.HTTP_200_OK)

        conversation = Conversation.objects.create(
            is_group=is_group, name=name if is_group else "", created_by=request.user,
        )
        all_members = [request.user] + others
        ConversationParticipant.objects.bulk_create(
            [ConversationParticipant(conversation=conversation, user=u) for u in all_members]
        )

        ser = self.get_serializer(conversation)
        for member in others:
            broadcast_to_user(member.id, "chat.conversation_new", {"conversation": ser.data})
        return Response(ser.data, status=status.HTTP_201_CREATED)

    def _get_membership(self, conversation):
        membership = ConversationParticipant.objects.filter(
            conversation=conversation, user=self.request.user
        ).first()
        if not membership:
            raise PermissionDenied("You are not a participant in this conversation.")
        return membership

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        self._get_membership(conversation)

        if request.method == "GET":
            qs = conversation.messages.select_related("sender").order_by("created_at")
            before_id = request.query_params.get("before")
            if before_id:
                qs = qs.filter(id__lt=before_id)
            page = list(qs.order_by("-created_at")[:50])
            page.reverse()
            return Response(MessageSerializer(page, many=True, context=self.get_serializer_context()).data)

        body = (request.data.get("body") or "").strip()
        files = request.FILES.getlist("files")
        if not body and not files:
            raise ValidationError({"body": "Message cannot be empty."})

        reply_to = None
        reply_to_id = request.data.get("reply_to")
        if reply_to_id:
            reply_to = conversation.messages.filter(pk=reply_to_id, is_deleted=False).first()
            if not reply_to:
                raise ValidationError({"reply_to": "Original message not found in this conversation."})

        from .file_validation import FileValidationError, validate_upload

        MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
        for f in files:
            if f.size > MAX_ATTACHMENT_SIZE:
                raise ValidationError({"files": f"'{f.name}' exceeds the 25 MB limit."})
            try:
                validate_upload(f, kind="document")
            except FileValidationError as exc:
                raise ValidationError({"files": str(exc)})

        message = Message.objects.create(
            conversation=conversation, sender=request.user, body=body, reply_to=reply_to,
        )
        for f in files:
            MessageAttachment.objects.create(
                message=message, file=f, original_name=f.name,
                content_type=f.content_type or "", size=f.size,
            )
        Conversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())
        notify_chat_mentions(message, conversation)

        data = MessageSerializer(message, context=self.get_serializer_context()).data
        broadcast_to_conversation(conversation.pk, "chat.message", {"message": data})
        return Response(data, status=status.HTTP_201_CREATED)

    def _get_own_message(self, conversation, message_id):
        message = conversation.messages.filter(pk=message_id).first()
        if not message:
            raise Http404
        if message.sender_id != self.request.user.id:
            raise PermissionDenied("You can only edit or delete your own messages.")
        if message.is_deleted:
            raise ValidationError("This message was already deleted.")
        return message

    @action(detail=True, methods=["patch", "delete"], url_path=r"messages/(?P<message_id>\d+)")
    def message_detail(self, request, pk=None, message_id=None):
        conversation = self.get_object()
        self._get_membership(conversation)
        message = self._get_own_message(conversation, message_id)

        if request.method == "DELETE":
            message.is_deleted = True
            message.deleted_at = timezone.now()
            message.body = ""
            message.save(update_fields=["is_deleted", "deleted_at", "body"])
            data = MessageSerializer(message, context=self.get_serializer_context()).data
            broadcast_to_conversation(conversation.pk, "chat.message_deleted", {"message": data})
            return Response(data)

        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "Message cannot be empty."})
        message.body = body
        message.edited_at = timezone.now()
        message.save(update_fields=["body", "edited_at"])
        notify_chat_mentions(message, conversation)
        data = MessageSerializer(message, context=self.get_serializer_context()).data
        broadcast_to_conversation(conversation.pk, "chat.message_edited", {"message": data})
        return Response(data)

    @action(detail=True, methods=["post"], url_path=r"messages/(?P<message_id>\d+)/react")
    def react(self, request, pk=None, message_id=None):
        conversation = self.get_object()
        self._get_membership(conversation)
        message = conversation.messages.filter(pk=message_id, is_deleted=False).first()
        if not message:
            raise Http404

        emoji = (request.data.get("emoji") or "").strip()
        if not emoji:
            raise ValidationError({"emoji": "Required."})

        existing = MessageReaction.objects.filter(message=message, user=request.user).first()
        if existing and existing.emoji == emoji:
            existing.delete()  # tap the same emoji again to remove it
        elif existing:
            existing.emoji = emoji
            existing.save(update_fields=["emoji"])
        else:
            MessageReaction.objects.create(message=message, user=request.user, emoji=emoji)

        reactions = MessageSerializer(message, context=self.get_serializer_context()).data["reactions"]
        broadcast_to_conversation(
            conversation.pk, "chat.reaction", {"message_id": message.id, "reactions": reactions},
        )
        return Response({"reactions": reactions})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conversation = self.get_object()
        membership = self._get_membership(conversation)
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_at"])
        broadcast_to_conversation(
            conversation.pk, "chat.read",
            {"user_id": request.user.id, "last_read_at": membership.last_read_at.isoformat()},
        )
        return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def chat_users(request):
    """
    GET /api/chat/users/?q=<text>

    Org directory for starting a conversation. Deliberately broader than
    mentions.suggest (which is submission-RBAC-scoped) — instant chat is
    general staff-to-staff messaging, so any active user may find any other.
    """
    from .media_urls import public_media_url

    q = (request.query_params.get("q") or "").strip()
    profiles = Profile.objects.select_related("user").filter(user__is_active=True)
    if q:
        profiles = profiles.filter(
            Q(user__username__icontains=q)
            | Q(user__first_name__icontains=q)
            | Q(user__last_name__icontains=q)
        )
    profiles = profiles.order_by("user__first_name", "user__username")[:50]

    results = []
    for p in profiles:
        u = p.user
        if u.pk == request.user.pk:
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

    return Response(ChatUserSerializer(results, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def attachment_download(request, attachment_id):
    """
    GET /api/chat/attachments/<id>/

    Never served directly via /media/ — chat attachments are private
    conversation content, so this checks the requester is actually a
    participant in the message's conversation before streaming the file
    (mirrors how submission documents are gated, per the nginx config's own
    /media/submission_documents/ deny-all comment on that exact class of bug).
    """
    attachment = (
        MessageAttachment.objects.select_related("message__conversation")
        .filter(pk=attachment_id).first()
    )
    if not attachment:
        raise Http404
    is_participant = ConversationParticipant.objects.filter(
        conversation=attachment.message.conversation_id, user=request.user,
    ).exists()
    if not is_participant:
        raise PermissionDenied("You do not have access to this file.")

    return FileResponse(
        attachment.file.open("rb"),
        as_attachment=False,
        filename=attachment.original_name,
        content_type=attachment.content_type or "application/octet-stream",
    )
