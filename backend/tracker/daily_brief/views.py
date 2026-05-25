import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .collectors import active_staff_users
from .permissions import HasAdminPanelAccess, HasManageRoles
from .models import DailyBriefDeliveryLog, DailyBriefSettings, DailyBriefStaffPreference
from .runner import run_daily_briefs
from .scheduler import get_next_beat_run, sync_daily_brief_scheduler
from .serializers import (
    DailyBriefDeliveryLogSerializer,
    DailyBriefPreferenceBulkSerializer,
    DailyBriefSendTestSerializer,
    DailyBriefSettingsSerializer,
    DailyBriefStaffPreferenceSerializer,
)

logger = logging.getLogger(__name__)

_MIGRATION_HINT = (
    "Daily Brief database tables are not available. "
    "Run migrations (0079_daily_brief) on the API server, then redeploy."
)


def _daily_brief_db_unavailable():
    return Response({"detail": _MIGRATION_HINT}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _daily_brief_server_error():
    return Response(
        {"detail": "Daily brief request could not be completed."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class DailyBriefViewSet(viewsets.ViewSet):
    """
    Daily brief admin API.
    Dashboard/logs: admin panel users. Settings/test/preferences: manage_roles.
    """

    def get_permissions(self):
        if self.action in {
            "brief_settings",
            "preferences",
            "update_preference",
            "bulk_preferences",
            "send_test",
            "purge_logs",
        }:
            return [permissions.IsAuthenticated(), HasManageRoles()]
        return [permissions.IsAuthenticated(), HasAdminPanelAccess()]

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        try:
            settings = DailyBriefSettings.get_solo()
            today = timezone.localdate()
            logs_today = DailyBriefDeliveryLog.objects.filter(created_at__date=today)
            briefs_sent_today = logs_today.filter(status=DailyBriefDeliveryLog.Status.SENT).count()
            staff_receiving = (
                logs_today.filter(
                    brief_type=DailyBriefDeliveryLog.BriefType.STAFF,
                    status=DailyBriefDeliveryLog.Status.SENT,
                )
                .values("user_id")
                .distinct()
                .count()
            )

            week_ago = timezone.now() - timedelta(days=7)
            failed_last_7 = DailyBriefDeliveryLog.objects.filter(
                created_at__gte=week_ago,
                status=DailyBriefDeliveryLog.Status.FAILED,
            ).count()

            beat_stale = False
            if settings.last_beat_at:
                beat_stale = (timezone.now() - settings.last_beat_at).total_seconds() > 28 * 3600

            recent = DailyBriefDeliveryLog.objects.select_related("user").all()[:15]

            staff_enabled_count = DailyBriefStaffPreference.objects.filter(enabled=True).count()
            staff_total = active_staff_users().count()

            last_beat_at = (
                settings.last_beat_at.isoformat() if settings.last_beat_at else None
            )
            last_run_date = (
                settings.last_run_date.isoformat() if settings.last_run_date else None
            )

            return Response(
                {
                    "module_status": settings.module_status,
                    "enabled": settings.enabled,
                    "test_mode": settings.test_mode,
                    "briefs_sent_today": briefs_sent_today,
                    "staff_receiving_today": staff_receiving,
                    "staff_enabled_count": staff_enabled_count,
                    "staff_total": staff_total,
                    "next_scheduled_run": get_next_beat_run(),
                    "delivery_hour": settings.delivery_hour,
                    "failed_last_7_days": failed_last_7,
                    "beat_stale_warning": beat_stale,
                    "last_beat_at": last_beat_at,
                    "last_run_date": last_run_date,
                    "recent_deliveries": DailyBriefDeliveryLogSerializer(recent, many=True).data,
                }
            )
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief dashboard unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief dashboard error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["get", "patch"], url_path="settings")
    def brief_settings(self, request):
        try:
            obj = DailyBriefSettings.get_solo()
            if request.method == "PATCH":
                ser = DailyBriefSettingsSerializer(obj, data=request.data, partial=True)
                ser.is_valid(raise_exception=True)
                ser.save()
                sync_daily_brief_scheduler()
                return Response(ser.data)
            return Response(DailyBriefSettingsSerializer(obj).data)
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief settings unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief settings error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["get"], url_path="logs")
    def logs(self, request):
        try:
            return self._logs_response(request)
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief logs unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief logs error: %s", exc)
            return _daily_brief_server_error()

    def _logs_response(self, request):
        qs = DailyBriefDeliveryLog.objects.all()
        brief_type = request.query_params.get("brief_type")
        log_status = request.query_params.get("status")
        user_id = request.query_params.get("user")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(100, max(1, int(request.query_params.get("page_size", 25))))

        if brief_type in ("staff", "manager"):
            qs = qs.filter(brief_type=brief_type)
        if log_status in ("sent", "failed", "skipped"):
            qs = qs.filter(status=log_status)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        total = qs.count()
        offset = (page - 1) * page_size
        rows = qs[offset : offset + page_size]
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": DailyBriefDeliveryLogSerializer(rows, many=True).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="purge-logs")
    def purge_logs(self, request):
        try:
            cutoff = timezone.now() - timedelta(days=90)
            deleted, _ = DailyBriefDeliveryLog.objects.filter(created_at__lt=cutoff).delete()
            return Response({"deleted": deleted})
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief purge unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief purge error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["get"], url_path="preferences")
    def preferences(self, request):
        try:
            users = active_staff_users()
            prefs = {
                p.user_id: p
                for p in DailyBriefStaffPreference.objects.filter(user__in=users)
            }
            out = []
            for u in users:
                p = prefs.get(u.id)
                if p:
                    out.append(DailyBriefStaffPreferenceSerializer(p).data)
                else:
                    out.append(
                        {
                            "id": None,
                            "user_id": u.id,
                            "username": u.username,
                            "email": u.email,
                            "full_name": u.get_full_name() or u.username,
                            "enabled": True,
                            "last_delivered_at": None,
                            "updated_at": None,
                        }
                    )
            return Response(out)
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief preferences unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief preferences error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["patch"], url_path=r"preferences/(?P<user_id>[0-9]+)")
    def update_preference(self, request, user_id=None):
        try:
            user = User.objects.filter(pk=user_id, is_active=True).first()
            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            enabled = request.data.get("enabled", True)
            pref, _ = DailyBriefStaffPreference.objects.get_or_create(user=user)
            pref.enabled = bool(enabled)
            pref.save(update_fields=["enabled", "updated_at"])
            return Response(DailyBriefStaffPreferenceSerializer(pref).data)
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief preference update unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief preference update error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["post"], url_path="preferences/bulk")
    def bulk_preferences(self, request):
        try:
            ser = DailyBriefPreferenceBulkSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            ids = ser.validated_data["user_ids"]
            enabled = ser.validated_data["enabled"]
            for uid in ids:
                user = User.objects.filter(pk=uid).first()
                if not user:
                    continue
                pref, _ = DailyBriefStaffPreference.objects.get_or_create(user=user)
                pref.enabled = enabled
                pref.save(update_fields=["enabled", "updated_at"])
            return Response({"updated": len(ids)})
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief bulk preferences unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief bulk preferences error: %s", exc)
            return _daily_brief_server_error()

    @action(detail=False, methods=["post"], url_path="send-test")
    def send_test(self, request):
        try:
            ser = DailyBriefSendTestSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            settings = DailyBriefSettings.get_solo()
            if not settings.test_recipient_email:
                return Response(
                    {"detail": "Set test recipient email in settings first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            brief_type = ser.validated_data.get("brief_type", "staff")
            test_user_id = ser.validated_data.get("test_user_id") or request.user.id

            if brief_type == "staff":
                run_daily_briefs(force=True, test_user_id=test_user_id)
            else:
                from .runner import _send_manager_brief

                user = User.objects.filter(pk=test_user_id).first() or request.user
                _send_manager_brief(user, settings)

            return Response({"detail": "Test brief queued."})
        except (ProgrammingError, OperationalError) as exc:
            logger.exception("Daily brief send-test unavailable (database): %s", exc)
            return _daily_brief_db_unavailable()
        except Exception as exc:
            logger.exception("Daily brief send-test error: %s", exc)
            return _daily_brief_server_error()
