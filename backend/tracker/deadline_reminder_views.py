"""API for AI-drafted deadline reminder emails (F2)."""

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import DeadlineReminderDraft, Role
from .serializers import DeadlineReminderDraftSerializer
from .views import HasProfilePermission, _profile


class DeadlineReminderDraftViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Secretariat reviews and sends AI-drafted deadline reminders."""

    permission_classes = [permissions.IsAuthenticated, HasProfilePermission]
    serializer_class = DeadlineReminderDraftSerializer

    def get_queryset(self):
        profile = _profile(self.request.user)
        if profile.role not in {
            Role.PSC_SECRETARY,
            Role.PSC_ADMIN,
            Role.PSC_OFFICER,
            Role.SENIOR_ADMIN_OFFICER,
            Role.PSC_MANAGER,
            Role.COMPLIANCE_MANAGER,
            Role.COMPLIANCE_SENIOR,
            Role.COMPLIANCE_PRINCIPAL,
        }:
            return DeadlineReminderDraft.objects.none()

        qs = DeadlineReminderDraft.objects.select_related(
            "submission", "submission__ministry", "ministry", "recipient_user",
        )
        submission_id = self.request.query_params.get("submission")
        if submission_id:
            qs = qs.filter(submission_id=submission_id)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("-drafted_at")

    def perform_update(self, serializer):
        profile = _profile(self.request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}:
            raise PermissionDenied("Only Secretariat staff may edit reminder drafts.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """Send the drafted email to the recipient."""
        draft = self.get_object()
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN, Role.SENIOR_ADMIN_OFFICER}:
            raise PermissionDenied("Only Secretariat staff may send reminder drafts.")

        if draft.status == DeadlineReminderDraft.Status.SENT:
            return Response({"detail": "This reminder was already sent."}, status=400)

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "noreply@psc.gov.vu"
        try:
            send_mail(
                subject=draft.subject,
                message=draft.body,
                from_email=from_email,
                recipient_list=[draft.recipient_email],
                fail_silently=False,
            )
        except Exception as exc:
            return Response(
                {"detail": f"Email could not be sent: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        draft.status = DeadlineReminderDraft.Status.SENT
        draft.sent_at = timezone.now()
        draft.save(update_fields=["status", "sent_at"])

        return Response(DeadlineReminderDraftSerializer(draft).data)

    @action(detail=False, methods=["post"], url_path="draft-now")
    def draft_now(self, request):
        """Manually trigger deadline draft generation for all eligible cases."""
        profile = _profile(request.user)
        if profile.role not in {Role.PSC_SECRETARY, Role.PSC_ADMIN}:
            raise PermissionDenied("Only Secretariat Admin may trigger draft generation.")

        from .tasks import draft_submission_deadline_reminders

        try:
            draft_submission_deadline_reminders.delay()
        except Exception:
            count = draft_submission_deadline_reminders()
            return Response({"detail": f"Drafted {count} reminder(s) (sync)."})

        return Response({"detail": "Deadline reminder drafting started."})
