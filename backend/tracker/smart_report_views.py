"""REST API for the Smart Report Enterprise Reporting Engine."""

from __future__ import annotations

from django.http import FileResponse
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import ReportTemplate, SmartReport
from .rbac import rbac_user_has_permission
from .report_template_views import template_visible_to
from .tasks import queue_smart_report


def _user_can_use_smart_reports(user) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    return rbac_user_has_permission(user, "view_reports") or rbac_user_has_permission(
        user, "export_reports"
    )


class SmartReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmartReport
        fields = [
            "id", "domain", "report_type", "prompt", "params", "title", "subtitle",
            "status", "error_message", "row_count", "created_at", "completed_at",
        ]
        read_only_fields = fields


class SmartReportViewSet(viewsets.ViewSet):
    """Catalog + ad-hoc report generation, library, status, download, re-run."""

    permission_classes = [permissions.IsAuthenticated]

    # ── helpers ──────────────────────────────────────────────────────────────
    def _gate(self, user):
        if not _user_can_use_smart_reports(user):
            raise PermissionDenied("You do not have permission to use Smart Reports.")

    def _is_report_admin(self, user) -> bool:
        return bool(
            user.is_superuser
            or user.is_staff
            or rbac_user_has_permission(user, "export_reports")
        )

    def _get_for_user(self, request, pk) -> SmartReport:
        report = SmartReport.objects.filter(pk=pk).first()
        if not report:
            raise NotFound("Report not found.")
        if report.requested_by_id != request.user.id and not self._is_report_admin(request.user):
            raise PermissionDenied("You cannot access this report.")
        return report

    def _status_payload(self, request, report: SmartReport) -> dict:
        data = SmartReportSerializer(report).data
        data["downloads"] = {}
        if report.status == SmartReport.Status.READY and report.html_file:
            base = request.build_absolute_uri(f"/api/smart-reports/{report.id}/download/")
            data["downloads"] = {
                "html": f"{base}?fmt=html",
                "view": f"{base}?fmt=html&inline=1",
            }
        return data

    # ── endpoints ────────────────────────────────────────────────────────────
    def list(self, request):
        self._gate(request.user)
        qs = SmartReport.objects.all()
        mine = request.query_params.get("mine") == "1"
        if mine or not self._is_report_admin(request.user):
            qs = qs.filter(requested_by=request.user)
        return Response(SmartReportSerializer(qs[:200], many=True).data)

    def create(self, request):
        self._gate(request.user)
        slug = (request.data.get("template") or request.data.get("report_type") or "").strip()
        prompt = (request.data.get("prompt") or "").strip()
        params = request.data.get("params") or {}
        if not isinstance(params, dict):
            raise ValidationError({"params": "params must be an object."})

        if not slug or slug == "adhoc":
            # Internal ad-hoc path (not surfaced in Reports; used by SCDMS Intelligence).
            if not prompt:
                raise ValidationError({"prompt": "Describe the report you need."})
            report = SmartReport.objects.create(
                requested_by=request.user,
                domain="submissions",
                report_type="adhoc",
                prompt=prompt,
                params=params,
                status=SmartReport.Status.PENDING,
            )
        else:
            tmpl = ReportTemplate.objects.filter(slug=slug, is_active=True).first()
            if not tmpl:
                raise ValidationError({"template": f"Unknown or inactive template '{slug}'."})
            if not template_visible_to(request.user, tmpl):
                raise PermissionDenied("You cannot generate this report.")
            allowed = {p.get("key") for p in (tmpl.param_schema or []) if isinstance(p, dict)}
            clean_params = {k: v for k, v in params.items() if k in allowed}
            report = SmartReport.objects.create(
                requested_by=request.user,
                template=tmpl,
                domain=tmpl.domain,
                report_type=tmpl.slug,
                params=clean_params,
                status=SmartReport.Status.PENDING,
            )
        queue_smart_report(report.id)
        return Response(self._status_payload(request, report), status=status.HTTP_202_ACCEPTED)

    def retrieve(self, request, pk=None):
        self._gate(request.user)
        report = self._get_for_user(request, pk)
        return Response(self._status_payload(request, report))

    def destroy(self, request, pk=None):
        self._gate(request.user)
        report = self._get_for_user(request, pk)
        if report.html_file:
            report.html_file.delete(save=False)
        if report.pdf_file:
            report.pdf_file.delete(save=False)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        self._gate(request.user)
        report = self._get_for_user(request, pk)
        if report.status != SmartReport.Status.READY or not report.html_file:
            return Response({"detail": "Report is not ready yet."}, status=409)
        fmt = (request.query_params.get("fmt") or "html").lower()
        if fmt != "html":
            return Response({"detail": "Only fmt=html is supported."}, status=400)
        inline = request.query_params.get("inline") == "1"
        fh = report.html_file.open("rb")
        return FileResponse(
            fh,
            as_attachment=not inline,
            filename=report.html_file.name.split("/")[-1],
            content_type="text/html; charset=utf-8",
        )

    @action(detail=True, methods=["post"])
    def rerun(self, request, pk=None):
        self._gate(request.user)
        report = self._get_for_user(request, pk)
        clone = SmartReport.objects.create(
            requested_by=request.user,
            domain=report.domain,
            report_type=report.report_type,
            prompt=report.prompt,
            params=report.params,
            status=SmartReport.Status.PENDING,
        )
        queue_smart_report(clone.id)
        return Response(self._status_payload(request, clone), status=status.HTTP_202_ACCEPTED)
