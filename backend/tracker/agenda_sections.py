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


def agenda_section_label(code: str) -> str:
    if not code:
        return ""
    section = AgendaSection.objects.filter(code=code).first()
    if section:
        return section.label
    legacy = dict(AgendaCategory.choices).get(code)
    return legacy or code.replace("_", " ").title()


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


def agenda_section_ids_for_role(role: str) -> list[int]:
    """Agenda sections that list ``role`` in receiver_roles."""
    if not role:
        return []
    return list(
        AgendaSection.objects.filter(receiver_roles__contains=[role]).values_list("id", flat=True)
    )


def sync_role_receiver_agenda_sections(role: str, section_ids: list[int]) -> None:
    """Set which agenda sections notify ``role`` on new submissions."""
    wanted = {int(pk) for pk in section_ids}
    for section in AgendaSection.objects.all().only("id", "receiver_roles"):
        current = list(section.receiver_roles or [])
        has_role = role in current
        should_have = section.id in wanted
        if should_have and not has_role:
            current.append(role)
        elif not should_have and has_role:
            current = [r for r in current if r != role]
        else:
            continue
        section.receiver_roles = sorted(set(current))
        section.save(update_fields=["receiver_roles", "updated_at"])


def agenda_section_usage_counts(section: AgendaSection) -> dict[str, int]:
    code = section.code
    return {
        "submissions": Submission.objects.filter(agenda_category=code).count(),
        "agenda_items": AgendaItem.objects.filter(category=code).count(),
        "form_types": PSCFormType.objects.filter(agenda_category=code).count(),
    }
