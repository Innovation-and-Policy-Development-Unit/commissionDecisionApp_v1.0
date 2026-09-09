"""Instant chat (Phase 1) — REST endpoints.

Real-time delivery happens over the WebSocket consumer in chat_consumers.py;
these REST views cover conversation/message history, starting conversations,
and read receipts. A message created here is broadcast to the channel layer
the same way a WebSocket-originated one is, so both paths stay in sync.
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Conversation, ConversationParticipant, Message, Profile
from .serializers import ChatUserSerializer, ConversationSerializer, MessageSerializer


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


class ConversationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/chat/conversations/                 list, create
    /api/chat/conversations/<id>/messages/   list (GET) / send (POST)
    /api/chat/conversations/<id>/read/       mark read (POST)
    """

    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Conversation.objects.filter(participants__user=self.request.user)
            .prefetch_related("participants__user__psc_profile", "messages__sender")
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
            return Response(MessageSerializer(page, many=True).data)

        body = (request.data.get("body") or "").strip()
        if not body:
            raise ValidationError({"body": "Message cannot be empty."})
        message = Message.objects.create(conversation=conversation, sender=request.user, body=body)
        Conversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())

        data = MessageSerializer(message).data
        broadcast_to_conversation(conversation.pk, "chat.message", {"message": data})
        return Response(data, status=status.HTTP_201_CREATED)

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
