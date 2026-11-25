"""Backup groups: what an admin can choose to back up, and what depends on what.

A backup group is a named set of data types (models). The admin ticks groups, not
tables. Dependencies are *computed* from the foreign keys between the groups' models,
never typed by hand, so they cannot drift as the data model grows:

- ``required``: a group has a non-nullable link into another group (for example every
  agenda item points to a submission). Ticking the first forces the second on.
- ``linked``: only nullable links (for example a submission may point to a meeting).
  Recommended, and the admin may untick it after a warning, because rows in this
  backup would point at data that is not in the file.

Whole groups only — no row-level slicing — so "Submissions + Agenda" means every
submission and every agenda.

``validate_group_coverage()`` fails (and a test asserts it) if any model that a full
backup dumps is not assigned to exactly one group, so a new feature's data can never
silently fall out of a selective backup.
"""
from __future__ import annotations

from django.apps import apps
from django.db import models

# Mirrors management/commands/backup_db._EXCLUDE: never part of any backup.
EXCLUDED_APPS = {"contenttypes", "axes", "token_blacklist", "sessions"}
EXCLUDED_MODELS = {"auth.permission", "admin.logentry"}

# key -> (label, description, [model labels]). Labels are "app_label.modelname", lowercase.
_T = "tracker."
GROUPS: dict[str, dict] = {
    "people": {
        "label": "People & access",
        "description": "User accounts, profiles, roles, permissions, signatures and login records.",
        "models": ["auth.user", "auth.group"] + [_T + m for m in (
            "profile roledefinition systempermission usersignature passwordhistory "
            "passwordresettoken pinresettoken loginemailotp trustedsession webpushsubscription"
        ).split()],
    },
    "organisation": {
        "label": "Organisation",
        "description": "Ministries, departments, units and public holidays.",
        "models": [_T + m for m in "ministry department unit publicholiday".split()],
    },
    "form_setup": {
        "label": "Form setup",
        "description": "Form categories and types, their fields, required documents and submission rules.",
        "models": [_T + m for m in
                   "formcategory pscformtype pscformfield requireddocument submissionrule".split()],
    },
    "submissions": {
        "label": "Submissions",
        "description": "Submissions with their documents, comments, review and recommendation history, "
                       "checklists, form answers, flags and notes.",
        "models": [_T + m for m in (
            "submission submissiondocument documentversion documentannotation documentsignature "
            "formsectionsignature comment mention remarksimage workflowevent submissionstageevent "
            "submissionchecklistitem submissionchecklistresponse submissioncoassignment "
            "submissiondraftdelegate submissionflag submissionpresence submissionprivatenote "
            "submissionchatmessage pscformresponse pscform37data "
            "restructuresubmissiondata odurestructurechecklist odurestructureboardpaper "
            "ipduboardpaper dgapprovaltoken deadlinereminderdraft integrityflag "
            "travelapprovalletter aigenerationlog referencecounter"
        ).split()],
    },
    "agenda": {
        "label": "Agenda & meetings",
        "description": "Commission meetings, agenda items and sections, deferrals, circulation, "
                       "briefing and sitting packs.",
        "models": [_T + m for m in (
            "meeting meetingbriefingpack meetingothermatter meetingtranscript agendaitem "
            "agendasection agendadeferral agendacirculationreceipt flyingagendabrief "
            "sittingpacksession"
        ).split()],
    },
    "minutes": {
        "label": "Minutes",
        "description": "Meeting minutes, comments, commissioner reviews and signatures.",
        "models": [_T + m for m in (
            "minutes minutescomment minutescommissionerreview minuteagendaintake "
            "flyingminutesignature"
        ).split()],
    },
    "decisions": {
        "label": "Decisions & implementation",
        "description": "Decision letters and service, holds, implementation tasks and updates, "
                       "decision and annual reports.",
        "models": [_T + m for m in (
            "decisionletter decisionservice decisionactioninghold decisionregisterreport "
            "commissiontask commissionsubtask commissiontaskupdate "
            "implementationdashboardreport annualreport"
        ).split()],
    },
    "messages": {
        "label": "Messages, notifications & feedback",
        "description": "Chat, direct messages, notifications and user feedback.",
        "models": [_T + m for m in (
            "conversation conversationparticipant message messageattachment messagereaction "
            "staffchatsession staffchatmessage notification feedbackreport feedbackcomment "
            "feedbackchecklistresponse"
        ).split()],
    },
    "reports": {
        "label": "Reports & intelligence",
        "description": "Dashboards, smart and intelligence reports, saved explorations and automations.",
        "models": [_T + m for m in (
            "dashboard smartreport reporttemplate reportaireview intelligencereport "
            "intelligencefavorite savedexploration automation automationrun"
        ).split()],
    },
    "audit": {
        "label": "Audit & security logs",
        "description": "The audit trail, security scans, incidents and notices.",
        "models": [_T + m for m in "auditlog securityscan securityincident securitynotice".split()],
    },
    "settings": {
        "label": "Templates, settings & knowledge base",
        "description": "Email and letter templates, system settings, API keys, translations, "
                       "backup connections, knowledge base, daily brief settings and "
                       "scheduled-task definitions.",
        "models": [_T + m for m in (
            "emailtemplate lettertemplate systemsetting apikey cloudbackupconnection "
            "uitranslation knowledgearticle knowledgecategory "
            "dailybriefsettings dailybriefstaffpreference dailybriefdeliverylog"
        ).split()] + [
            "django_celery_beat." + m for m in
            "clockedschedule crontabschedule intervalschedule periodictask periodictasks solarschedule".split()
        ],
    },
}


def load_all_models() -> None:
    """Register models that live outside tracker/models.py.

    AppConfig.ready() skips importing the daily-brief models for some management commands
    (``shell``, ``backup_db``), so a command-line backup would otherwise leave their tables
    out of the dump. Import them explicitly before anything enumerates the app registry.
    """
    import tracker.daily_brief.models  # noqa: F401


def dumpable_models() -> list:
    """Every model a full backup dumps."""
    load_all_models()
    out = []
    for m in apps.get_models():
        label = m._meta.label_lower
        if m._meta.app_label in EXCLUDED_APPS or label in EXCLUDED_MODELS:
            continue
        if m._meta.app_label == "admin":
            continue
        out.append(m)
    return out


def _owner_map() -> dict[str, str]:
    owner: dict[str, str] = {}
    for key, g in GROUPS.items():
        for label in g["models"]:
            owner.setdefault(label, key)
    return owner


def validate_group_coverage() -> dict[str, list[str]]:
    """Return {'unassigned': [...], 'duplicated': [...], 'unknown': [...]} (all empty = OK)."""
    seen: dict[str, int] = {}
    for g in GROUPS.values():
        for label in g["models"]:
            seen[label] = seen.get(label, 0) + 1
    real = {m._meta.label_lower for m in dumpable_models()}
    return {
        "unassigned": sorted(real - set(seen)),
        "duplicated": sorted(k for k, n in seen.items() if n > 1),
        "unknown": sorted(set(seen) - real),
    }


def group_links() -> dict[str, dict[str, dict]]:
    """{group: {other_group: {"required": bool, "because": [str, ...]}}} from model FKs."""
    owner = _owner_map()
    links: dict[str, dict[str, dict]] = {k: {} for k in GROUPS}
    for m in dumpable_models():
        src = owner.get(m._meta.label_lower)
        if not src:
            continue
        for f in m._meta.get_fields():
            if not (f.concrete and f.is_relation and (f.many_to_one or f.one_to_one or f.many_to_many)):
                continue
            target = f.related_model
            if target is None:
                continue
            dst = owner.get(target._meta.label_lower)
            if not dst or dst == src:
                continue
            entry = links[src].setdefault(dst, {"required": False, "because": []})
            if not f.many_to_many and not f.null:
                entry["required"] = True
            note = f"{m.__name__}.{f.name} → {target.__name__}"
            if note not in entry["because"]:
                entry["because"].append(note)
    return links


def required_closure(keys) -> list[str]:
    """The selected groups plus every group they (transitively) *require*."""
    links = group_links()
    chosen = [k for k in GROUPS if k in set(keys)]
    todo = list(chosen)
    seen = set(chosen)
    while todo:
        cur = todo.pop()
        for dst, info in links[cur].items():
            if info["required"] and dst not in seen:
                seen.add(dst)
                todo.append(dst)
    return [k for k in GROUPS if k in seen]


def linked_but_missing(keys) -> dict[str, list[str]]:
    """{group in selection: [groups it links to (nullable links) that are not selected]}."""
    links = group_links()
    sel = set(keys)
    out: dict[str, list[str]] = {}
    for k in sel:
        gone = sorted(d for d, info in links[k].items() if d not in sel)
        if gone:
            out[k] = gone
    return out


def model_labels(keys) -> list[str]:
    """dumpdata labels for the given groups, in group order."""
    wanted = set(keys)
    out: list[str] = []
    for key, g in GROUPS.items():
        if key in wanted:
            out.extend(g["models"])
    return out


def media_paths(keys) -> set[str]:
    """MEDIA_ROOT-relative paths of every uploaded file held by the selected groups' models."""
    paths: set[str] = set()
    for label in model_labels(keys):
        model = apps.get_model(label)
        for f in model._meta.get_fields():
            if isinstance(f, models.FileField):
                for name in model._base_manager.exclude(**{f.name: ""}).exclude(
                    **{f.name + "__isnull": True}
                ).values_list(f.name, flat=True):
                    if name:
                        paths.add(str(name))
    return paths


def describe() -> list[dict]:
    """The group list the admin UI renders (direct links only; the UI closes them)."""
    links = group_links()
    return [
        {
            "key": key,
            "label": g["label"],
            "description": g["description"],
            "model_count": len(g["models"]),
            "requires": [
                {"group": d, "label": GROUPS[d]["label"], "because": info["because"][:3]}
                for d, info in links[key].items() if info["required"]
            ],
            "linked": [
                {"group": d, "label": GROUPS[d]["label"], "because": info["because"][:3]}
                for d, info in links[key].items() if not info["required"]
            ],
        }
        for key, g in GROUPS.items()
    ]
