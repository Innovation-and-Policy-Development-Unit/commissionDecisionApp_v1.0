"""API for dashboard UI translations (i18next)."""
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .i18n_utils import (
    SUPPORTED_LANGS,
    flatten_translation_tree,
    load_bundled_locale_files,
    merge_bundles,
    namespace_from_key,
)
from .models import UiTranslation
from .permissions import CanManageUiTranslations
from .serializers import UiTranslationSerializer


def _sync_from_locale_files(*, force: bool = False) -> dict[str, int]:
    bundles = load_bundled_locale_files()
    flat_en = flatten_translation_tree(bundles.get("en") or {})
    flat_fr = flatten_translation_tree(bundles.get("fr") or {})
    flat_bi = flatten_translation_tree(bundles.get("bi") or {})
    all_keys = set(flat_en) | set(flat_fr) | set(flat_bi)

    created = updated = skipped = 0
    with transaction.atomic():
        for key in sorted(all_keys):
            defaults = {
                "namespace": namespace_from_key(key),
                "text_en": flat_en.get(key, ""),
                "text_fr": flat_fr.get(key, ""),
                "text_bi": flat_bi.get(key, ""),
            }
            obj, was_created = UiTranslation.objects.get_or_create(
                key=key,
                defaults=defaults,
            )
            if was_created:
                created += 1
                continue
            if obj.is_customized and not force:
                skipped += 1
                continue
            for field, val in defaults.items():
                setattr(obj, field, val)
            obj.is_customized = False
            obj.save(update_fields=["namespace", "text_en", "text_fr", "text_bi", "is_customized", "updated_at"])
            updated += 1
    return {"created": created, "updated": updated, "skipped": skipped, "total_keys": len(all_keys)}


class UiTranslationViewSet(viewsets.ModelViewSet):
    """
    Manage UI translation keys (admin).
    Public bundle endpoint merges file baseline + DB overrides for the SPA.
    """

    queryset = UiTranslation.objects.all()
    serializer_class = UiTranslationSerializer
    permission_classes = [IsAuthenticated, CanManageUiTranslations]
    search_fields = ["key", "text_en", "text_fr", "text_bi"]
    ordering_fields = ["key", "namespace", "updated_at"]
    ordering = ["namespace", "key"]

    def get_queryset(self):
        qs = super().get_queryset()
        ns = self.request.query_params.get("namespace", "").strip()
        if ns:
            qs = qs.filter(namespace=ns)
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(key__icontains=q)
        return qs

    def get_permissions(self):
        if self.action == "bundles":
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(
            updated_by=self.request.user,
            is_customized=True,
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
            is_customized=True,
        )

    @action(detail=False, methods=["get"], url_path="bundles")
    def bundles(self, request):
        base = load_bundled_locale_files()
        rows = UiTranslation.objects.all().values_list("key", "text_en", "text_fr", "text_bi")
        merged = merge_bundles(base, list(rows))
        return Response(merged)

    @action(detail=False, methods=["get"], url_path="namespaces")
    def namespaces(self, request):
        names = (
            UiTranslation.objects.values_list("namespace", flat=True)
            .distinct()
            .order_by("namespace")
        )
        return Response(list(names))

    @action(detail=False, methods=["post"], url_path="sync-from-files")
    def sync_from_files(self, request):
        force = request.data.get("force") in (True, "true", "1", 1)
        stats = _sync_from_locale_files(force=force)
        if stats["total_keys"] == 0:
            return Response(
                {
                    "detail": (
                        "No locale JSON files found on the server. "
                        "Ensure frontend/src/i18n/locales is copied to backend/locale_bundles "
                        "in the API image, or mount that folder in Docker."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(stats)

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        items = request.data.get("items") or []
        if not isinstance(items, list):
            return Response({"detail": "items must be a list."}, status=status.HTTP_400_BAD_REQUEST)
        updated = 0
        with transaction.atomic():
            for row in items:
                pk = row.get("id")
                if not pk:
                    continue
                try:
                    obj = UiTranslation.objects.get(pk=pk)
                except UiTranslation.DoesNotExist:
                    continue
                ser = UiTranslationSerializer(obj, data=row, partial=True, context={"request": request})
                ser.is_valid(raise_exception=True)
                ser.save(updated_by=request.user, is_customized=True)
                updated += 1
        return Response({"updated": updated})
