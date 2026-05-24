"""REST API for Submission Status Chatbot (D2)."""

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .ai.status_chat import generate_status_chat_reply
from .models import Profile, Role, StaffChatMessage, StaffChatSession, SystemSetting
from .serializers import (
    StaffChatMessageSerializer,
    StaffChatSendSerializer,
    StaffChatSessionDetailSerializer,
    StaffChatSessionListSerializer,
)

_STATUS_ALLOWED_ROLES = {
    Role.MINISTRY_HR,
    Role.DEPT_ADMIN,
    Role.HEAD_OF_AGENCY,
    Role.PSC_OFFICER,
    Role.PSC_SECRETARY,
    Role.PSC_COMMISSIONER,
    Role.CHAIRPERSON,
    Role.PSC_ADMIN,
    Role.SENIOR_ADMIN_OFFICER,
    Role.PSC_MANAGER,
    Role.PRINCIPAL_OFFICER,
    Role.SENIOR_OFFICER,
    Role.VIPAM_MANAGER,
    Role.HR_UNIT_MANAGER,
    Role.ODU_MANAGER,
    Role.COMPLIANCE_MANAGER,
    Role.COMPLIANCE_SENIOR,
    Role.COMPLIANCE_PRINCIPAL,
    Role.ODU_PRINCIPAL,
    Role.HR_UNIT_PRINCIPAL,
    Role.VIPAM_PRINCIPAL,
    Role.CSU_MANAGER,
}


class StatusChatSessionViewSet(viewsets.ModelViewSet):
    """Submission status Q&A — ministry HR and authorised SCDMS users."""

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_throttles(self):
        if self.action == "send":
            from .throttles import StatusChatThrottle

            return [StatusChatThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return StaffChatSession.objects.filter(
            user=self.request.user,
            purpose=StaffChatSession.Purpose.STATUS,
        ).prefetch_related("messages")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return StaffChatSessionDetailSerializer
        return StaffChatSessionListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, purpose=StaffChatSession.Purpose.STATUS)

    def _ensure_enabled(self):
        if not SystemSetting.get_bool("ENABLE_STATUS_CHATBOT", default=True):
            raise PermissionDenied("Case status assistant is currently disabled.")

    def _ensure_role(self, user):
        profile = Profile.objects.filter(user=user).first()
        if user.is_superuser:
            return
        if not profile or profile.role not in _STATUS_ALLOWED_ROLES:
            raise PermissionDenied(
                "Your account cannot use the case status assistant. "
                "Contact your ministry HR or PSC Secretariat."
            )

    @action(detail=False, methods=["post"])
    def send(self, request):
        """
        POST { "message": "...", "session_id": null | int }
        """
        self._ensure_enabled()
        self._ensure_role(request.user)

        ser = StaffChatSendSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message_text = ser.validated_data["message"].strip()
        session_id = ser.validated_data.get("session_id")

        if session_id:
            try:
                session = StaffChatSession.objects.get(
                    pk=session_id,
                    user=request.user,
                    purpose=StaffChatSession.Purpose.STATUS,
                )
            except StaffChatSession.DoesNotExist:
                raise ValidationError({"session_id": "Session not found."})
        else:
            title = message_text[:80] + ("…" if len(message_text) > 80 else "")
            session = StaffChatSession.objects.create(
                user=request.user,
                title=title,
                purpose=StaffChatSession.Purpose.STATUS,
            )

        history = [
            {"role": m.role, "content": m.content}
            for m in session.messages.order_by("created_at")
        ]

        user_msg = StaffChatMessage.objects.create(
            session=session,
            role=StaffChatMessage.Role.USER,
            content=message_text,
        )

        reply, err = generate_status_chat_reply(
            user=request.user,
            history=history,
            user_message=message_text,
        )

        if err:
            assistant_text = (
                f"I could not look up that case right now: {err}\n\n"
                "Try again shortly, or check the submission in SCDMS under Submissions."
            )
        else:
            assistant_text = reply or "Please include a PSC reference (e.g. PSC-2026-00042) or ask about your active cases."

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
