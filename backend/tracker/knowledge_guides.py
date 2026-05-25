"""Seed data for role-based user guides in the Knowledge Base."""

from __future__ import annotations

GUIDES_CATEGORY = {
    "title": "User guides",
    "description": "Step-by-step guides for HR managers, unit managers, and PSC secretariat staff.",
    "icon_name": "BookOpen",
    "display_order": 1,
}

# Slug, title, html file under /guides/, roles (empty = all authenticated users)
ROLE_GUIDE_ARTICLES = [
    {
        "slug": "hr-manager-guide",
        "title": "HR Manager — User Guide",
        "html_asset": "hr-manager-guide.html",
        "allowed_roles": ["ministry_hr", "dept_admin", "head_of_agency"],
        "is_internal": False,
        "content": (
            "Complete guide for ministry HR staff preparing and submitting cases "
            "to the Public Service Commission via SCDMS."
        ),
    },
    {
        "slug": "unit-manager-guide",
        "title": "Unit Manager — Processing Guide",
        "html_asset": "unit-manager-guide.html",
        "allowed_roles": [
            "hr_unit_manager",
            "hr_unit_principal",
            "vipam_manager",
            "vipam_principal",
            "odu_manager",
            "senior_admin_officer",
        ],
        "is_internal": True,
        "content": (
            "Processing guide for OPSC unit managers reviewing submissions, "
            "checklists, and forwarding cases to the Commission."
        ),
    },
    {
        "slug": "secretary-guide",
        "title": "PSC Secretary — User Guide",
        "html_asset": "secretary-guide.html",
        "allowed_roles": ["psc_secretary", "senior_admin_officer", "psc_admin"],
        "is_internal": True,
        "content": (
            "Secretariat guide covering agenda, Commission sittings, minutes, "
            "decisions, and notifications."
        ),
    },
]
