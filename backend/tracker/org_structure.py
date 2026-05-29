"""Ministry → department → unit helpers (OPM / OPSC)."""

from __future__ import annotations

from .models import Department, Ministry, Unit

# OPM = seed code; MPM = production Book 19 code for Ministry of the Prime Minister
PRIME_MINISTER_MINISTRY_CODES = frozenset({"OPM", "MPM"})
OPSC_DEPARTMENT_CODES = frozenset({"OPSC", "OPM_OPSC"})
OPSC_DEPARTMENT_NAME = "Office of the Public Service Commission"

OPSC_UNIT_SEED = (
    ("IPDU", "Innovation and Policy Development Unit", ""),
    ("ODU", "Organisation Development Unit", "odu"),
    ("VIPAM", "VIPAM Unit", "vipam"),
    ("HR", "HR Unit", "hr"),
    ("COMPLIANCE", "Compliance Unit", "compliance"),
    ("CSU", "Corporate Services Unit", "csu"),
)

LEGACY_DEPT_TO_UNIT = {
    "OPSC_ODU": "ODU",
    "OPSC_VIPAM": "VIPAM",
    "OPSC_HR": "HR",
    "OPSC_COMPLIANCE": "COMPLIANCE",
    "OPSC_CSU": "CSU",
}


def get_opm_ministry() -> Ministry | None:
    """Line ministry for OPSC (Ministry of the Prime Minister — prefer MPM)."""
    ministry = Ministry.objects.filter(code__iexact="MPM").first()
    if ministry:
        return ministry
    ministry = Ministry.objects.filter(code__iexact="OPM").first()
    if ministry:
        return ministry
    dept = (
        Department.objects.filter(code__iexact="OPSC")
        .select_related("ministry")
        .first()
    )
    if dept:
        return dept.ministry
    return Ministry.objects.filter(name__icontains="Prime Minister").first()


def get_opsc_department(*, create: bool = False) -> Department | None:
    opm = get_opm_ministry()
    if not opm:
        return None
    dept = (
        Department.objects.filter(ministry=opm, code__iexact="OPSC").first()
        or Department.objects.filter(ministry=opm, code__iexact="OPM_OPSC").first()
    )
    if dept or not create:
        return dept
    return Department.objects.create(
        ministry=opm,
        code="OPSC",
        name=OPSC_DEPARTMENT_NAME,
    )


def ensure_opsc_units(opsc_dept: Department) -> None:
    for code, name, routed in OPSC_UNIT_SEED:
        Unit.objects.update_or_create(
            department=opsc_dept,
            code=code,
            defaults={"name": name, "routed_unit": routed},
        )


def get_opsc_unit(code: str) -> Unit | None:
    dept = get_opsc_department()
    if not dept:
        return None
    return Unit.objects.filter(department=dept, code__iexact=code).first()


def resolve_opsc_submission_org(profile) -> dict[str, int | None]:
    """
    Ministry / department / unit for OPSC internal submissions and profile defaults.

    Returns ministry_id (OPM), department_id (OPSC), optional unit_id from profile.
    """
    opm = get_opm_ministry()
    if not opm:
        raise ValueError("Ministry of the Prime Minister (OPM) is not configured.")

    opsc_dept = get_opsc_department(create=False)
    if not opsc_dept:
        raise ValueError(
            "Office of the Public Service Commission (OPSC) department under OPM is not configured."
        )

    ministry_id = profile.ministry_id or opm.pk
    if profile.ministry and profile.ministry.code.upper() == "OPSC":
        ministry_id = opm.pk

    department_id = profile.department_id or opsc_dept.pk
    if profile.department and profile.department.ministry_id != opm.pk:
        department_id = opsc_dept.pk

    unit_id = profile.unit_id
    return {
        "ministry_id": ministry_id,
        "department_id": department_id,
        "unit_id": unit_id,
    }


def resolve_opsc_ministry_id(profile) -> int:
    """Backward-compatible: OPSC internal submissions use OPM as the line ministry."""
    return resolve_opsc_submission_org(profile)["ministry_id"]
