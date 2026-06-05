"""REST API for admin-managed report templates (Reports product)."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import ReportTemplate
from .rbac import rbac_user_has_permission
from .reports.catalog import validate_spec, vocabulary

SPEC_KEYS = ("sections", "kpis", "charts", "table", "narrative_markdown")


def can_manage_templates(user) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    return rbac_user_has_permission(user, "manage_report_templates")


def can_use_reports(user) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    return (
        rbac_user_has_permission(user, "view_reports")
        or rbac_user_has_permission(user, "export_reports")
        or can_manage_templates(user)
    )


def _user_role(user):
    try:
        return user.psc_profile.role
    except Exception:
        return None


def template_visible_to(user, tmpl: ReportTemplate) -> bool:
    if can_manage_templates(user):
        return True
    if not tmpl.is_active:
        return False
    if tmpl.visible_to_all:
        return True
    return _user_role(user) in (tmpl.visible_roles or [])


def _unique_slug(name: str, instance_pk=None) -> str:
    base = slugify(name)[:70] or "template"
    slug = base
    i = 2
    qs = ReportTemplate.objects.all()
    if instance_pk:
        qs = qs.exclude(pk=instance_pk)
    while qs.filter(slug=slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


class ReportTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportTemplate
        fields = [
            "id", "name", "slug", "description", "domain", "spec", "param_schema",
            "default_params", "visible_to_all", "visible_roles", "is_active",
            "version", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "version", "created_at", "updated_at"]

    def validate(self, attrs):
        domain = attrs.get("domain") or (self.instance.domain if self.instance else "submissions")
        name = attrs.get("name") or (self.instance.name if self.instance else "")
        if "spec" in attrs:
            cleaned = validate_spec({**(attrs["spec"] or {}), "title": name}, domain=domain)
            # Persist only the builder fields; runtime adds title/params/subtitle.
            attrs["spec"] = {k: cleaned[k] for k in SPEC_KEYS if k in cleaned}
        if not isinstance(attrs.get("param_schema", []), list):
            raise serializers.ValidationError({"param_schema": "Must be a list."})
        return attrs


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """Browse (visible) for readers; full CRUD for template managers."""

    serializer_class = ReportTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "slug"

    def get_queryset(self):
        return ReportTemplate.objects.all()

    def _gate_read(self):
        if not can_use_reports(self.request.user):
            raise PermissionDenied("You do not have permission to use Reports.")

    def _gate_manage(self):
        if not can_manage_templates(self.request.user):
            raise PermissionDenied("You cannot manage report templates.")

    def list(self, request, *args, **kwargs):
        self._gate_read()
        qs = self.get_queryset()
        manage = can_manage_templates(request.user) and request.query_params.get("manage") == "1"
        data = list(qs) if manage else [t for t in qs.filter(is_active=True) if template_visible_to(request.user, t)]
        return Response(ReportTemplateSerializer(data, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        self._gate_read()
        tmpl = get_object_or_404(ReportTemplate, slug=kwargs["slug"])
        if not template_visible_to(request.user, tmpl):
            raise PermissionDenied("You cannot access this template.")
        return Response(ReportTemplateSerializer(tmpl).data)

    def create(self, request, *args, **kwargs):
        self._gate_manage()
        ser = ReportTemplateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(
            created_by=request.user,
            updated_by=request.user,
            slug=_unique_slug(ser.validated_data.get("name", "template")),
        )
        return Response(ser.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        self._gate_manage()
        tmpl = get_object_or_404(ReportTemplate, slug=kwargs["slug"])
        ser = ReportTemplateSerializer(tmpl, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save(updated_by=request.user, version=tmpl.version + 1)
        return Response(ser.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._gate_manage()
        tmpl = get_object_or_404(ReportTemplate, slug=kwargs["slug"])
        tmpl.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def vocabulary(self, request):
        self._gate_manage()
        return Response(vocabulary())
