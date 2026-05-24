"""REST API for PSC Staff Assistant chatbot."""

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .ai.staff_chat import generate_staff_chat_reply
from .models import StaffChatMessage, StaffChatSession, SystemSetting
from .serializers import (
    StaffChatMessageSerializer,
    StaffChatSendSerializer,
    StaffChatSessionDetailSerializer,
    StaffChatSessionListSerializer,
)


class StaffChatSessionViewSet(viewsets.ModelViewSet):
    """Staff Assistant — sessions and messaging for authenticated users."""

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_throttles(self):
        if self.action == "send":
            from .throttles import StaffChatThrottle

            return [StaffChatThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return StaffChatSession.objects.filter(user=self.request.user).prefetch_related("messages")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return StaffChatSessionDetailSerializer
        return StaffChatSessionListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def _ensure_enabled(self):
        if not SystemSetting.get_bool("ENABLE_STAFF_CHATBOT", default=True):
            raise PermissionDenied("Staff Assistant is currently disabled by an administrator.")

    @action(detail=False, methods=["post"])
    def send(self, request):
        """
        POST { "message": "...", "session_id": null | int }
        Creates a session when session_id is omitted.
        """
        self._ensure_enabled()
        ser = StaffChatSendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message_text = ser.validated_data["message"].strip()
        session_id = ser.validated_data.get("session_id")

        if session_id:
            try:
                session = StaffChatSession.objects.get(pk=session_id, user=request.user)
            except StaffChatSession.DoesNotExist:
                raise ValidationError({"session_id": "Session not found."})
        else:
            title = message_text[:80] + ("…" if len(message_text) > 80 else "")
            session = StaffChatSession.objects.create(user=request.user, title=title)

        history = [
            {"role": m.role, "content": m.content}
            for m in session.messages.order_by("created_at")
        ]

        user_msg = StaffChatMessage.objects.create(
            session=session,
            role=StaffChatMessage.Role.USER,
            content=message_text,
        )

        reply, err = generate_staff_chat_reply(
            user=request.user,
            history=history,
            user_message=message_text,
        )

        if err:
            assistant_text = (
                f"I could not complete that request: {err}\n\n"
                "If this persists, check ANTHROPIC_API_KEY and backend connectivity."
            )
        else:
            assistant_text = reply or "I don't have a response for that."

        assistant_msg = StaffChatMessage.objects.create(
            session=session,
            role=StaffChatMessage.Role.ASSISTANT,
            content=assistant_text,
        )
        StaffChatSession.objects.filter(pk=session.pk).update(updated_at=timezone.now())
        session.refresh_from_db()

        return Response(
            {
                "session_id": session.id,
                "session_title": session.title,
                "user_message": StaffChatMessageSerializer(user_msg).data,
                "assistant_message": StaffChatMessageSerializer(assistant_msg).data,
                "messages": StaffChatMessageSerializer(
                    session.messages.order_by("created_at"), many=True
                ).data,
            },
            status=status.HTTP_200_OK,
        )
