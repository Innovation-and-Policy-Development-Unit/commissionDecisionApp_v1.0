"""Helpers for admin-managed agenda sections."""

from __future__ import annotations

from .models import AgendaCategory, AgendaItem, AgendaSection, PSCFormType, Submission


def active_agenda_sections(*, include_special: bool = True, include_inactive: bool = False):
    qs = AgendaSection.objects.all().order_by("display_order", "id")
    if not include_inactive:
        qs = qs.filter(is_active=True)
    if not include_special:
        qs = qs.filter(is_special=False)
    return qs


def agenda_section_codes(*, include_special: bool = True, include_inactive: bool = False) -> set[str]:
    return set(active_agenda_sections(
        include_special=include_special,
        include_inactive=include_inactive,
    ).values_list("code", flat=True))


def validate_agenda_section_code(code: str, *, allow_inactive: bool = False) -> str:
    if not code:
        return ""
    qs = AgendaSection.objects.filter(code=code)
    if not allow_inactive:
        qs = qs.filter(is_active=True)
    if not qs.exists():
        raise ValueError(f"Unknown or inactive agenda section: {code}")
    return code


def fallback_agenda_choices():
    """When DB table is empty, use legacy enum labels."""
    return list(AgendaCategory.choices)


def apply_agenda_section_defaults(attrs: dict) -> None:
    """When lodging by agenda section only, attach the linked digitized form if configured."""
    code = attrs.get("agenda_category") or ""
    if not code or attrs.get("form_type_code"):
        return
    section = (
        AgendaSection.objects.select_related("digitized_form", "digitized_form__form_category")
        .filter(code=code, is_active=True)
        .first()
    )
    if not section or not section.digitized_form_id:
        return
    ft = section.digitized_form
    attrs["form_type_code"] = ft.code
    if ft.form_category_id and not attrs.get("form_category"):
        attrs["form_category"] = ft.form_category


def agenda_section_usage_counts(section: AgendaSection) -> dict[str, int]:
    code = section.code
    return {
        "submissions": Submission.objects.filter(agenda_category=code).count(),
        "agenda_items": AgendaItem.objects.filter(category=code).count(),
        "form_types": PSCFormType.objects.filter(agenda_category=code).count(),
    }
