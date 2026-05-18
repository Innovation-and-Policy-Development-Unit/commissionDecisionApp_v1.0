"""
Comprehensive SCDMS seed command.

Usage:
    python manage.py seed_tracker                     # idempotent reference data + users; submissions if DB has none
    python manage.py seed_tracker --clear           # wipe submissions/events first, then re-seed
    python manage.py seed_tracker --no-submissions  # reference data & users only; skip submissions
    python manage.py seed_tracker --submissions-only # reference data + submissions only; skip users
    python manage.py seed_tracker --force-submissions # add another full dummy submission set (dev only)
"""

from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tracker.models import (
    Department, FormCategory, Ministry, Profile,
    Role, RoleDefinition, Submission, SystemPermission, WorkflowEvent, WorkflowStage,
)

# ── Reference data ────────────────────────────────────────────────────────────

# (code, name, psc_forms_summary, display_order)
# display_order determines default agenda sequence (lower = earlier)
CATEGORIES = [
    ("discipline",             "Discipline",
     "PSC 6.2, 6.3, 6.4",                                                  10),
    ("recruitment",            "Recruitment",
     "PSC 3.1, 3.5, 3.6/7, 3.8",                                          20),
    ("training_development",   "Training & Development",
     "PSC 5.1–5.6",                                                        30),
    ("organisation_structure", "Organisation & Structure",
     "PSC 2.1 (Org Restructure / Establishment Variation), PSC 2.2 (Job Description)", 40),
    ("leave_travel",           "Leave & Travel",
     "PSC 4.4, 4.5, 4.6, 4.8, 4.9",                                      50),
    ("allowances_claims",      "Allowances & Claims",
     "PSC 4.1, 4.2, 4.3, 4.7, 4.10, 4.11",                               60),
    ("housing_vehicles",       "Housing & Vehicles",
     "PSC 8.1, 8.2, 9.1, 9.3",                                            70),
    ("performance",            "Performance",
     "PSC 10.2, 10.4a",                                                    80),
    ("other",                  "Other",
     "Local Purchase Orders (LPO), Miscellaneous",                         999),
]

MINISTRIES = [
    ("OPM",      "Office of the Prime Minister"),
    ("MFEM",     "Ministry of Finance & Economic Management"),
    ("MET",      "Ministry of Education & Training"),
    ("MOH",      "Ministry of Health"),
    ("MIPU",     "Ministry of Infrastructure & Public Utilities"),
    ("MALFFB",   "Ministry of Agriculture, Livestock, Forestry, Fisheries & Biosecurity"),
    ("MJCS",     "Ministry of Justice & Community Services"),
    ("MIA",      "Ministry of Internal Affairs"),
    ("MLGM",     "Ministry of Lands, Geology & Mines"),
    ("MFAICET",  "Ministry of Foreign Affairs & External Trade"),
    ("MTCI",     "Ministry of Tourism, Commerce & Industry"),
    ("MRDLGCD",  "Ministry of Rural Development & Local Government"),
    ("MCCE",     "Ministry of Climate Change & Environment"),
    ("VPF",      "Vanuatu Police Force"),
    ("OGCIO",    "Office of the Government Chief Information Officer"),
]

# (ministry_code, dept_code, dept_name)
DEPARTMENTS = [
    ("OPM",     "DEPT_STATE",    "Department of Strategic Policy, Planning & Aid Coordination"),
    ("OPM",     "OGCIO",         "Office of the Government Chief Information Officer"),
    ("MFEM",    "CIR",           "Customs & Inland Revenue"),
    ("MFEM",    "NSO",           "Vanuatu National Statistics Office"),
    ("MFEM",    "TREASURY",      "Treasury Department"),
    ("MFEM",    "BUDGET",        "Budget & Economic Planning"),
    ("MET",     "PRIM_ED",       "Department of Primary Education"),
    ("MET",     "SEC_ED",        "Department of Secondary Education"),
    ("MET",     "TVET",          "Technical & Vocational Education Training"),
    ("MET",     "HIGHER",        "Department of Higher Education"),
    ("MOH",     "CURATIVE",      "Department of Curative Health Services"),
    ("MOH",     "PUBLIC_HEALTH", "Department of Public Health"),
    ("MOH",     "PHARMACY",      "Department of Pharmacy Services"),
    ("MOH",     "NURSING",       "Nursing Services Division"),
    ("MIPU",    "PWD",           "Department of Public Works"),
    ("MIPU",    "PORTS",         "Department of Ports & Harbour"),
    ("MIPU",    "CIVIL_AVIATION","Department of Civil Aviation"),
    ("MALFFB",  "AGR",           "Department of Agriculture"),
    ("MALFFB",  "FORESTRY",      "Department of Forestry"),
    ("MALFFB",  "FISHERIES",     "Department of Fisheries"),
    ("MALFFB",  "LIVESTOCK",     "Department of Livestock"),
    ("MJCS",    "STATE_LAW",     "Department of State Law"),
    ("MJCS",    "CORRECTIONAL",  "Department of Correctional Services"),
    ("MJCS",    "WOMEN",         "Department of Women's Affairs"),
    ("MIA",     "POLICE",        "Vanuatu Police Force"),
    ("MIA",     "IMMIGRATION",   "Department of Immigration & Passport Services"),
    ("MIA",     "LOCAL_GOV",     "Department of Local Government"),
    ("MLGM",    "LANDS",         "Department of Lands"),
    ("MLGM",    "GEOLOGY",       "Department of Geology, Mines & Water Resources"),
    ("MLGM",    "SURVEYS",       "Department of Surveys"),
]

# (username, email, password, role, ministry_code_or_None)
USERS = [
    ("admin",          "admin@psc.gov.vu",          "Admin1234!",        "psc_admin",              None),
    ("p.mahe",         "p.mahe@psc.gov.vu",          "Officer123!",       "psc_officer",            None),
    ("r.kalsakau",     "r.kalsakau@psc.gov.vu",      "Officer123!",       "psc_officer",            None),
    ("j.iati",         "j.iati@psc.gov.vu",          "Secretary123!",     "psc_secretary",          None),
    # Senior Administration Officer (SOP Section 6)
    ("s.tari",         "s.tari@psc.gov.vu",          "Officer123!",       "senior_admin_officer",   None),
    # Commissioners / Chairperson
    ("m.carlot",       "m.carlot@psc.gov.vu",        "Commissioner123!",  "psc_commissioner",       None),
    ("j.taue",         "j.taue@psc.gov.vu",          "Commissioner123!",  "chairperson",            None),
    # Unit Managers
    ("m.vipam",        "m.vipam@psc.gov.vu",         "Manager123!",       "vipam_manager",          None),
    ("m.hrunit",       "m.hrunit@psc.gov.vu",        "Manager123!",       "hr_unit_manager",        None),
    ("m.odu",          "m.odu@psc.gov.vu",           "Manager123!",       "odu_manager",            None),
    ("m.compliance",   "m.compliance@psc.gov.vu",    "Manager123!",       "compliance_manager",     None),
    # OPSC Manager — allocates decisions to staff after Chairperson signs minutes
    ("m.opsc",         "m.opsc@psc.gov.vu",          "Manager123!",       "psc_manager",            None),
    # Ministry HR
    ("hr.finance",     "hr@mfem.gov.vu",             "Ministry123!",      "ministry_hr",            "MFEM"),
    ("hr.education",   "hr@met.gov.vu",              "Ministry123!",      "ministry_hr",            "MET"),
    ("hr.health",      "hr@moh.gov.vu",              "Ministry123!",      "ministry_hr",            "MOH"),
    ("hr.infra",       "hr@mipu.gov.vu",             "Ministry123!",      "ministry_hr",            "MIPU"),
    ("hr.agriculture", "hr@malffb.gov.vu",           "Ministry123!",      "ministry_hr",            "MALFFB"),
    ("hr.justice",     "hr@mjcs.gov.vu",             "Ministry123!",      "ministry_hr",            "MJCS"),
    ("hr.internal",    "hr@mia.gov.vu",              "Ministry123!",      "ministry_hr",            "MIA"),
    # Head of Agency (DG/Director) — one per ministry for demo
    ("dg.opm",         "dg@opm.gov.vu",              "DG12345!",          "head_of_agency",         "OPM"),
    ("dg.mfem",        "dg@mfem.gov.vu",             "DG12345!",          "head_of_agency",         "MFEM"),
    ("dg.met",         "dg@met.gov.vu",              "DG12345!",          "head_of_agency",         "MET"),
    ("dg.moh",         "dg@moh.gov.vu",              "DG12345!",          "head_of_agency",         "MOH"),
    ("dg.mipu",        "dg@mipu.gov.vu",             "DG12345!",          "head_of_agency",         "MIPU"),
    ("dg.malffb",      "dg@malffb.gov.vu",           "DG12345!",          "head_of_agency",         "MALFFB"),
]

# ── Workflow stage paths ───────────────────────────────────────────────────────
# (from_stage, to_stage, days_offset_from_received, remarks)

STAGE_PATHS = {
    "received_by_psc": [],
    "registered_routed": [
        ("received_by_psc", "registered_routed", 2, "Submission registered and routed to relevant PSC unit."),
    ],
    "manager_checklist_review": [
        ("received_by_psc",     "registered_routed",       2, "Registered and routed."),
        ("registered_routed",   "manager_checklist_review", 4, "Forwarded for manager checklist review."),
    ],
    "under_assessment": [
        ("received_by_psc",            "registered_routed",       2,  "Registered and routed."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist review initiated."),
        ("manager_checklist_review",   "under_assessment",         7,  "Checklist cleared. Assessment commenced."),
    ],
    "deferred": [
        ("received_by_psc",            "registered_routed",       2,  "Registered and routed."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist review."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment started."),
        ("under_assessment",           "deferred",                 16, "Deferred — additional documentation required from ministry."),
    ],
    "resubmitted": [
        ("received_by_psc",            "registered_routed",       2,  "Registered."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment started."),
        ("under_assessment",           "deferred",                 16, "Deferred — awaiting additional info."),
        ("deferred",                   "resubmitted",              26, "Ministry resubmitted with supplementary documents."),
    ],
    "forwarded_to_commission": [
        ("received_by_psc",            "registered_routed",       2,  "Registered and routed."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment started."),
        ("under_assessment",           "forwarded_to_commission",  22, "Assessment complete. Forwarded to Commission for decision."),
    ],
    "commission_sitting": [
        ("received_by_psc",            "registered_routed",       2,  "Registered."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",  22, "Forwarded to Commission."),
        ("forwarded_to_commission",    "commission_sitting",       27, "Placed on Commission sitting agenda."),
    ],
    "approved": [
        ("received_by_psc",            "registered_routed",       2,  "Registered."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist review."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment started."),
        ("under_assessment",           "forwarded_to_commission",  21, "Assessment complete. Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",       26, "Commission sitting."),
        ("commission_sitting",         "approved",                 27, "Commission resolved: Approved."),
    ],
    "rejected": [
        ("received_by_psc",            "registered_routed",       2,  "Registered."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",  21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",       26, "Sitting."),
        ("commission_sitting",         "rejected",                 27, "Commission resolved: Not approved."),
    ],
    "returned": [
        ("received_by_psc",            "registered_routed",       2,  "Registered."),
        ("registered_routed",          "manager_checklist_review", 4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",         7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",  21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",       26, "Sitting."),
        ("commission_sitting",         "returned",                 27, "Returned to ministry — submission requires revision."),
    ],
    "minutes_drafted_signed": [
        ("received_by_psc",            "registered_routed",        2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",  4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",          7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",   21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",        26, "Sitting."),
        ("commission_sitting",         "approved",                  27, "Approved."),
        ("approved",                   "minutes_drafted_signed",    32, "Commission minutes drafted and signed by Chairperson."),
    ],
    "decision_entered_assigned": [
        ("received_by_psc",            "registered_routed",         2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",   4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",           7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",    21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",         26, "Sitting."),
        ("commission_sitting",         "approved",                   27, "Approved."),
        ("approved",                   "minutes_drafted_signed",     32, "Minutes signed."),
        ("minutes_drafted_signed",     "decision_entered_assigned",  35, "Decision entered and assigned to officer for notification."),
    ],
    "under_implementation": [
        ("received_by_psc",            "registered_routed",          2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",    4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",            7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",     21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",          26, "Sitting."),
        ("commission_sitting",         "approved",                    27, "Approved."),
        ("approved",                   "minutes_drafted_signed",      32, "Minutes signed."),
        ("minutes_drafted_signed",     "decision_entered_assigned",   35, "Decision entered."),
        ("decision_entered_assigned",  "under_implementation",        42, "Notification issued. Ministry implementing decision."),
    ],
    "implementation_report": [
        ("received_by_psc",            "registered_routed",           2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",     4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",             7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",      21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",           26, "Sitting."),
        ("commission_sitting",         "approved",                     27, "Approved."),
        ("approved",                   "minutes_drafted_signed",       32, "Minutes signed."),
        ("minutes_drafted_signed",     "decision_entered_assigned",    35, "Decision entered."),
        ("decision_entered_assigned",  "under_implementation",         42, "Ministry implementing."),
        ("under_implementation",       "implementation_report",        72, "Implementation report received from ministry."),
    ],
    "returned_for_clarification": [
        ("received_by_psc",            "registered_routed",           2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",     4,  "Checklist review."),
        ("manager_checklist_review",   "returned_for_clarification",   6,  "Returned for clarification — incomplete documents."),
    ],
    "awaiting_legal_advice": [
        ("received_by_psc",            "registered_routed",           2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",     4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",             7,  "Assessment started."),
        ("under_assessment",           "awaiting_legal_advice",        15, "Referred to State Law Office for legal opinion."),
    ],
    "matters_arising": [
        ("received_by_psc",            "registered_routed",           2,  "Registered."),
        ("registered_routed",          "manager_checklist_review",     4,  "Checklist."),
        ("manager_checklist_review",   "under_assessment",             7,  "Assessment."),
        ("under_assessment",           "forwarded_to_commission",      21, "Forwarded."),
        ("forwarded_to_commission",    "commission_sitting",           26, "Sitting."),
        ("commission_sitting",         "matters_arising",              27, "Commission deferred decision pending further information (Matters Arising)."),
    ],
}

# ── Submission definitions ─────────────────────────────────────────────────────
# (title, ministry_code, dept_code_or_None, category_code, form_type_code,
#  routed_unit, target_stage, received_days_ago)

SUBMISSIONS = [
    # ── IMPLEMENTATION REPORT (completed cycle) ────────────────────────────
    ("Appointment of Director of Finance — Ministry of Finance & Economic Management",
     "MFEM", "TREASURY", "recruitment", "PSC 3.6", "odu", "implementation_report", 125),
    ("Transfer of Chief Nursing Officer to Northern Provincial Hospital, MOH",
     "MOH", "NURSING", "leave_travel", "PSC 4.5", "hr", "implementation_report", 118),
    ("Reclassification of ICT Officers — OGCIO Grades 3–5",
     "OPM", "OGCIO", "organisation_structure", "PSC 2.1", "hr", "implementation_report", 112),
    ("Secondment of Agricultural Officer to SPC Regional Office, Suva",
     "MALFFB", "AGR", "leave_travel", "PSC 4.8", "hr", "implementation_report", 105),

    # ── UNDER IMPLEMENTATION ───────────────────────────────────────────────
    ("Appointment of Deputy Director — Customs & Inland Revenue",
     "MFEM", "CIR", "recruitment", "PSC 3.6", "odu", "under_implementation", 96),
    ("Promotion of Senior Education Officers to Principal Grade (Batch of 6)",
     "MET", "PRIM_ED", "recruitment", "PSC 3.5", "hr", "under_implementation", 90),
    ("Secondment of Legal Officer to Ministry of Foreign Affairs",
     "MJCS", "STATE_LAW", "leave_travel", "PSC 4.8", "hr", "under_implementation", 86),
    ("Termination of Employment — Finance Officer, Ministry of Infrastructure",
     "MIPU", "PWD", "discipline", "PSC 6.4", "compliance", "under_implementation", 82),
    ("Appointment of Director of Agriculture",
     "MALFFB", "AGR", "recruitment", "PSC 3.6", "odu", "under_implementation", 79),
    ("Reclassification of Tourism Officer Posts — Ministry of Tourism",
     "MTCI", None, "organisation_structure", "PSC 2.1", "hr", "under_implementation", 75),

    # ── DECISION ENTERED & ASSIGNED ────────────────────────────────────────
    ("Appointment of Principal Statistician — National Statistics Office",
     "MFEM", "NSO", "recruitment", "PSC 3.6", "odu", "decision_entered_assigned", 72),
    ("Promotion of Senior Health Inspector to Principal Grade",
     "MOH", "PUBLIC_HEALTH", "recruitment", "PSC 3.5", "hr", "decision_entered_assigned", 68),
    ("Acting Appointment — Director of Public Works",
     "MIPU", "PWD", "recruitment", "PSC 3.8", "odu", "decision_entered_assigned", 64),
    ("Transfer of Education Officer to Tafea Province",
     "MET", "PRIM_ED", "leave_travel", "PSC 4.5", "hr", "decision_entered_assigned", 60),
    ("Appointment of Deputy Commissioner of Police",
     "MIA", "POLICE", "recruitment", "PSC 3.6", "odu", "decision_entered_assigned", 57),

    # ── MINUTES DRAFTED & SIGNED ───────────────────────────────────────────
    ("Appointment of Chief Surveyor — Department of Surveys",
     "MLGM", "SURVEYS", "recruitment", "PSC 3.6", "odu", "minutes_drafted_signed", 54),
    ("Promotion — Senior Accountant to Principal Accountant, Treasury",
     "MFEM", "TREASURY", "recruitment", "PSC 3.5", "odu", "minutes_drafted_signed", 51),
    ("Secondment of Nurse to WHO Regional Office, Manila",
     "MOH", "NURSING", "leave_travel", "PSC 4.8", "hr", "minutes_drafted_signed", 47),
    ("Acting Appointment of Director — Department of Forestry",
     "MALFFB", "FORESTRY", "recruitment", "PSC 3.8", "odu", "minutes_drafted_signed", 44),

    # ── APPROVED ───────────────────────────────────────────────────────────
    ("Appointment of Director of Education Policy",
     "MET", "HIGHER", "recruitment", "PSC 3.6", "odu", "approved", 52),
    ("Promotion — Senior Lands Officer to Principal Grade",
     "MLGM", "LANDS", "recruitment", "PSC 3.5", "hr", "approved", 48),
    ("Transfer of Pharmacist — Vila Central Hospital",
     "MOH", "PHARMACY", "leave_travel", "PSC 4.5", "hr", "approved", 44),
    ("Secondment of Policy Analyst to Asian Development Bank",
     "OPM", "DEPT_STATE", "leave_travel", "PSC 4.8", "hr", "approved", 42),
    ("Appointment of Chief Fisheries Officer",
     "MALFFB", "FISHERIES", "recruitment", "PSC 3.6", "odu", "approved", 40),
    ("Promotion — Senior Immigration Officer to Principal Grade",
     "MIA", "IMMIGRATION", "recruitment", "PSC 3.5", "odu", "approved", 38),
    ("Establishment Variation — Ministry of Tourism (3 New Posts)",
     "MTCI", None, "organisation_structure", "PSC 2.2", "hr", "approved", 36),
    ("Appointment of State Counsel — Department of State Law",
     "MJCS", "STATE_LAW", "recruitment", "PSC 3.6", "odu", "approved", 34),

    # ── REJECTED ───────────────────────────────────────────────────────────
    ("Termination — Senior Finance Officer, Ministry of Finance",
     "MFEM", "BUDGET", "discipline", "PSC 6.4", "compliance", "rejected", 50),
    ("Reclassification — IT Officer Posts, Ministry of Justice",
     "MJCS", None, "organisation_structure", "PSC 2.1", "hr", "rejected", 46),

    # ── RETURNED ───────────────────────────────────────────────────────────
    ("Secondment of Lands Officer to Pacific Islands Development Forum",
     "MLGM", "LANDS", "leave_travel", "PSC 4.8", "hr", "returned", 42),
    ("Establishment Variation — Ministry of Infrastructure (Grade Reclassification)",
     "MIPU", "PWD", "organisation_structure", "PSC 2.1", "hr", "returned", 38),

    # ── COMMISSION SITTING ─────────────────────────────────────────────────
    ("Appointment of Director General — Office of the Prime Minister",
     "OPM", "DEPT_STATE", "recruitment", "PSC 3.6", "odu", "commission_sitting", 14),
    ("Promotion Batch — Ministry of Health Nursing Officers (Grade 4 to 5)",
     "MOH", "NURSING", "recruitment", "PSC 3.5", "hr", "commission_sitting", 12),
    ("Termination — Department of Agriculture Officer",
     "MALFFB", "AGR", "discipline", "PSC 6.4", "compliance", "commission_sitting", 10),
    ("Reclassification — Finance Officers, Treasury Department (Grade 7 to 8)",
     "MFEM", "TREASURY", "organisation_structure", "PSC 2.1", "odu", "commission_sitting", 7),

    # ── FORWARDED TO COMMISSION ────────────────────────────────────────────
    ("Appointment of Principal Lands Officer — Ministry of Lands",
     "MLGM", "LANDS", "recruitment", "PSC 3.6", "odu", "forwarded_to_commission", 23),
    ("Promotion — Senior Engineer to Principal Engineer, Public Works",
     "MIPU", "PWD", "recruitment", "PSC 3.5", "hr", "forwarded_to_commission", 20),
    ("Secondment of Education Officer to Pacific Community, Noumea",
     "MET", "SEC_ED", "leave_travel", "PSC 4.8", "hr", "forwarded_to_commission", 18),
    ("Acting Appointment — Director of Internal Revenue",
     "MFEM", "CIR", "recruitment", "PSC 3.8", "odu", "forwarded_to_commission", 15),
    ("Appointment of Chief of Police — Vanuatu Police Force",
     "MIA", "POLICE", "recruitment", "PSC 3.6", "odu", "forwarded_to_commission", 12),

    # ── DEFERRED ───────────────────────────────────────────────────────────
    ("Appointment of Divisional Finance Officer — Ministry of Finance",
     "MFEM", "BUDGET", "recruitment", "PSC 3.6", "odu", "deferred", 38),
    ("Termination of Employment — Ports & Harbour Staff Member",
     "MIPU", "PORTS", "discipline", "PSC 6.3", "compliance", "deferred", 30),
    ("Reclassification — Health Inspector Posts, Ministry of Health",
     "MOH", "PUBLIC_HEALTH", "organisation_structure", "PSC 2.1", "hr", "deferred", 25),
    ("Secondment of Survey Officer to UN-HABITAT Regional Office",
     "MLGM", "SURVEYS", "leave_travel", "PSC 4.8", "hr", "deferred", 22),

    # ── RESUBMITTED ────────────────────────────────────────────────────────
    ("Appointment of Chief Education Officer — Curriculum (Resubmission)",
     "MET", "HIGHER", "recruitment", "PSC 3.6", "odu", "resubmitted", 18),
    ("Promotion — Senior Correctional Officer to Principal Grade (Resubmission)",
     "MJCS", "CORRECTIONAL", "recruitment", "PSC 3.5", "hr", "resubmitted", 12),

    # ── UNDER ASSESSMENT (some overdue) ───────────────────────────────────
    ("Appointment of Director of Forestry — MALFFB",
     "MALFFB", "FORESTRY", "recruitment", "PSC 3.6", "odu", "under_assessment", 38),   # OVERDUE
    ("Termination — Senior Accountant, Ministry of Finance",
     "MFEM", "TREASURY", "discipline", "PSC 6.4", "compliance", "under_assessment", 34),  # OVERDUE
    ("Promotion — Senior Police Officer to Inspector Grade",
     "MIA", "POLICE", "recruitment", "PSC 3.5", "odu", "under_assessment", 22),
    ("Secondment of Livestock Officer to FAO Rome",
     "MALFFB", "LIVESTOCK", "leave_travel", "PSC 4.8", "hr", "under_assessment", 18),
    ("Reclassification — Transport Officers, Ministry of Infrastructure",
     "MIPU", "PWD", "organisation_structure", "PSC 2.1", "hr", "under_assessment", 15),
    ("Appointment of Deputy Secretary — Ministry of Health",
     "MOH", "CURATIVE", "recruitment", "PSC 3.6", "odu", "under_assessment", 13),
    ("Acting Appointment — Deputy Director Education (Curriculum)",
     "MET", "SEC_ED", "recruitment", "PSC 3.8", "hr", "under_assessment", 10),
    ("Establishment Variation — Ministry of Agriculture (Additional Posts)",
     "MALFFB", None, "organisation_structure", "PSC 2.2", "hr", "under_assessment", 8),

    # ── MANAGER CHECKLIST REVIEW ───────────────────────────────────────────
    ("Appointment of Chief Immigration Officer",
     "MIA", "IMMIGRATION", "recruitment", "PSC 3.6", "odu", "manager_checklist_review", 14),
    ("Promotion — Senior Tourism Officers (Batch of 4)",
     "MTCI", None, "recruitment", "PSC 3.5", "hr", "manager_checklist_review", 12),
    ("Transfer of Education Officer to Santo Province",
     "MET", "PRIM_ED", "leave_travel", "PSC 4.5", "hr", "manager_checklist_review", 10),
    ("Reclassification — Finance Officers, Budget Department",
     "MFEM", "BUDGET", "organisation_structure", "PSC 2.1", "odu", "manager_checklist_review", 8),
    ("Termination — Staff Member, Ministry of Rural Development",
     "MRDLGCD", None, "discipline", "PSC 6.3", "compliance", "manager_checklist_review", 6),
    ("Secondment of Lands Officer to SPREP, Apia",
     "MLGM", "LANDS", "leave_travel", "PSC 4.8", "hr", "manager_checklist_review", 5),

    # ── REGISTERED & ROUTED ───────────────────────────────────────────────
    ("Appointment of Director of Budget & Economic Planning",
     "MFEM", "BUDGET", "recruitment", "PSC 3.6", "odu", "registered_routed", 7),
    ("Promotion — Senior Nurse to Nursing Officer Grade 5",
     "MOH", "NURSING", "recruitment", "PSC 3.5", "hr", "registered_routed", 6),
    ("Secondment of Police Officer to Pacific Islands Chiefs of Police Working Group",
     "MIA", "POLICE", "leave_travel", "PSC 4.8", "odu", "registered_routed", 5),
    ("Reclassification — Health Worker Posts (Grade 2 to Grade 3)",
     "MOH", "PUBLIC_HEALTH", "organisation_structure", "PSC 2.1", "hr", "registered_routed", 4),
    ("Transfer of Fisheries Officer to Luganville Field Office",
     "MALFFB", "FISHERIES", "leave_travel", "PSC 4.5", "hr", "registered_routed", 4),
    ("Appointment of Principal Education Officer — Curriculum Development",
     "MET", "HIGHER", "recruitment", "PSC 3.6", "odu", "registered_routed", 3),
    ("Establishment Variation — Ministry of Health (New Nursing Posts, Santo)",
     "MOH", None, "organisation_structure", "PSC 2.2", "hr", "registered_routed", 3),

    # ── RECEIVED BY PSC (just arrived) ────────────────────────────────────
    ("Appointment of Director of Civil Aviation",
     "MIPU", "CIVIL_AVIATION", "recruitment", "PSC 3.6", "odu", "received_by_psc", 2),
    ("Promotion — Senior Agricultural Officer to Principal Grade",
     "MALFFB", "AGR", "recruitment", "PSC 3.5", "hr", "received_by_psc", 2),
    ("Transfer of Legal Officer to Ministry of Justice Head Office",
     "MJCS", "STATE_LAW", "leave_travel", "PSC 4.5", "hr", "received_by_psc", 1),
    ("Reclassification of Customs Officers — Grade Alignment Review",
     "MFEM", "CIR", "organisation_structure", "PSC 2.1", "odu", "received_by_psc", 1),
    ("Appointment of Chief Information Officer — OGCIO",
     "OPM", "OGCIO", "recruitment", "PSC 3.6", "odu", "received_by_psc", 0),

    # ── NEW STAGES FOR VALIDATION (added for demo) ───────────────────────
    ("Recruitment Review — Department of Lands (Missing JD)",
     "MLGM", "LANDS", "recruitment", "PSC 3.1", "hr", "returned_for_clarification", 5),
    ("Termination Case — Ministry of Internal Affairs (Legal Review)",
     "MIA", "POLICE", "discipline", "PSC 6.4", "compliance", "awaiting_legal_advice", 20),
    ("Establishment Restructure — Ministry of Finance (Matters Arising)",
     "MFEM", "BUDGET", "organisation_structure", "PSC 2.1", "odu", "matters_arising", 30),
]

# Stages where assessment was active (to set assessment_started_at)
ASSESSMENT_STAGES = {
    "under_assessment", "deferred", "resubmitted",
    "awaiting_legal_advice", "matters_arising",
    "forwarded_to_commission", "commission_sitting",
    "approved", "rejected", "returned",
    "minutes_drafted_signed", "decision_entered_assigned",
    "under_implementation", "implementation_report",
}


# ── Command ───────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed the SCDMS database with realistic PSC dummy data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all submissions and workflow events before seeding.",
        )
        parser.add_argument(
            "--no-submissions",
            action="store_true",
            help="Seed reference data and users only; skip submissions.",
        )
        parser.add_argument(
            "--submissions-only",
            action="store_true",
            help="Seed reference data and submissions only; skip user accounts.",
        )
        parser.add_argument(
            "--force-submissions",
            action="store_true",
            help="Create the full dummy submission set even if submissions already exist (dev only).",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()

        self._seed_categories()
        self._seed_ministries()
        self._seed_departments()
        self._seed_permissions()
        self._seed_role_definitions()

        submissions_only = options["submissions_only"]
        no_submissions   = options["no_submissions"]

        if not submissions_only:
            self._seed_users()

        if not no_submissions:
            self._seed_submissions(force=bool(options["force_submissions"]))

        self.stdout.write(self.style.SUCCESS("\n[OK] Database seeded successfully."))
        if not submissions_only:
            self.stdout.write("  Login credentials:")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")
            self.stdout.write("  | Username              | Password             | Role               |")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")
            for u in USERS:
                self.stdout.write(f"  | {u[0]:<21} | {u[2]:<20} | {u[3]:<18} |")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _clear(self):
        count_e = WorkflowEvent.objects.count()
        count_s = Submission.objects.count()
        WorkflowEvent.objects.all().delete()
        Submission.objects.all().delete()
        from tracker.models import ReferenceCounter
        ReferenceCounter.objects.all().delete()
        self.stdout.write(self.style.WARNING(
            f"  Cleared {count_s} submissions and {count_e} workflow events."
        ))

    def _seed_categories(self):
        for code, name, summary, display_order in CATEGORIES:
            FormCategory.objects.update_or_create(
                code=code,
                defaults={"name": name, "psc_forms_summary": summary, "display_order": display_order},
            )
        self.stdout.write(f"  [OK] {len(CATEGORIES)} form categories")

    def _seed_ministries(self):
        for code, name in MINISTRIES:
            Ministry.objects.update_or_create(code=code, defaults={"name": name})
        self.stdout.write(f"  [OK] {len(MINISTRIES)} ministries")

    def _seed_departments(self):
        created = 0
        for min_code, dept_code, dept_name in DEPARTMENTS:
            try:
                ministry = Ministry.objects.get(code=min_code)
            except Ministry.DoesNotExist:
                continue
            _, c = Department.objects.update_or_create(
                ministry=ministry,
                code=dept_code,
                defaults={"name": dept_name},
            )
            if c:
                created += 1
        self.stdout.write(f"  [OK] {len(DEPARTMENTS)} departments ({created} new)")

    # ── Permissions ───────────────────────────────────────────────────────────

    # (code, label, category, description)
    _PERMISSIONS = [
        # Submissions
        ("view_submissions",    "View Submissions",    "submissions",    "Browse the submissions list and open submission details."),
        ("create_submission",   "Create Submission",   "submissions",    "Log a new incoming submission to the system."),
        ("edit_submission",     "Edit Submission",     "submissions",    "Update the details of an existing submission."),
        ("export_submissions",  "Export Submissions",  "submissions",    "Download the full submissions list as a CSV file."),
        # Workflow
        ("transition_workflow", "Transition Workflow", "workflow",       "Advance or change the workflow stage of a submission."),
        ("assess_submission",   "Assess Submission",   "workflow",       "Conduct the 21-working-day assessment of a submission."),
        ("forward_commission",  "Forward to Commission", "workflow",     "Forward a submission for inclusion at a commission sitting."),
        ("record_decision",     "Record Commission Decision", "secretariat", "Record the formal outcome of a commission deliberation."),
        # Task allocation (post-decision)
        ("allocate_decision",   "Allocate Decision",   "tasks",          "Assign post-decision work to an OPSC Manager after commission deliberation."),
        ("assign_task",         "Assign Task to Staff","tasks",          "Assign a specific task to a Principal Officer or Senior Officer."),
        ("update_implementation","Update Implementation","tasks",        "Update the implementation status and progress of a decision."),
        # Reports
        ("view_dashboard",      "View Dashboard",      "reports",        "Access the analytics and performance dashboard."),
        ("view_reports",        "View Reports",        "reports",        "Access the reports module and statistical summaries."),
        ("export_reports",      "Export Reports",      "reports",        "Generate and download system reports."),
        # Secretariat
        ("manage_meetings",     "Manage Commission Meetings", "secretariat", "Schedule and administer commission sitting meetings."),
        ("manage_agenda",       "Manage Meeting Agenda",      "secretariat", "Add, order, and manage agenda items for each sitting."),
        ("manage_notifications","Manage Decision Notifications","secretariat","Draft and issue formal decision notification letters."),
        # Administration
        ("manage_users",        "Manage Users",        "administration", "Create, edit, and deactivate user accounts."),
        ("manage_roles",        "Manage Roles & Permissions","administration","Configure role definitions and their permission sets."),
        ("view_audit_trail",    "View Audit Trail",    "administration", "Access the full workflow event audit trail for all submissions."),
        # Feedback
        ("feedback_view",       "View Feedback",       "feedback",       "View user submitted feedback reports."),
        ("feedback_manage",     "Manage Feedback",     "feedback",       "Assign and update status of feedback reports."),
        ("feedback_respond",    "Respond to Feedback", "feedback",       "Add comments and internal notes to feedback."),
        ("feedback_configure",  "Configure Feedback",  "feedback",       "Toggle feedback system and configure settings."),
    ]

    # (role, description, [permission_codes])
    _ROLE_DEFINITIONS = [
        ("psc_admin", "Full system access — manages users, roles, submissions, and all workflow stages.", [
            "view_dashboard", "view_submissions", "create_submission", "edit_submission",
            "export_submissions", "transition_workflow", "assess_submission",
            "forward_commission", "record_decision", "allocate_decision", "assign_task",
            "update_implementation", "view_reports", "export_reports",
            "manage_meetings", "manage_agenda", "manage_notifications",
            "manage_users", "manage_roles", "view_audit_trail",
            "feedback_view", "feedback_manage", "feedback_respond", "feedback_configure",
        ]),
        ("psc_officer", "Receives and processes submissions through initial operational workflow stages.", [
            "view_dashboard", "view_submissions", "create_submission", "edit_submission",
            "export_submissions", "transition_workflow", "assess_submission",
            "view_reports", "view_audit_trail",
        ]),
        ("psc_secretary", "Manages commission meetings, agendas, decisions, and formal notifications.", [
            "view_dashboard", "view_submissions", "export_submissions", "transition_workflow",
            "forward_commission", "record_decision",
            "manage_meetings", "manage_agenda", "manage_notifications",
            "view_reports", "view_audit_trail",
            "feedback_view", "feedback_respond",
        ]),
        ("psc_commissioner", "Read access to submissions and reports for deliberation; records formal outcomes.", [
            "view_dashboard", "view_submissions", "view_reports", "view_audit_trail",
        ]),
        ("chairperson", "Chairperson of the PSC — approves agenda, records decisions, signs minutes.", [
            "view_dashboard", "view_submissions", "view_reports", "view_audit_trail",
        ]),
        ("senior_admin_officer", (
            "Senior Administration Officer — receives signed submissions, prepares draft agenda, "
            "consults with Secretary, submits to Chairman, coordinates meeting logistics."
        ), [
            "view_dashboard", "view_submissions", "export_submissions", "transition_workflow",
            "manage_meetings", "manage_agenda", "manage_notifications",
            "view_reports", "view_audit_trail",
        ]),
        ("head_of_agency", (
            "Head of Agency (DG/Director) — reviews and endorses submissions prepared by Ministry HR "
            "before they are dispatched to OPSC."
        ), [
            "view_dashboard", "view_submissions", "view_audit_trail",
        ]),
        ("psc_manager", (
            "OPSC Manager — receives allocated commission decisions from the Secretary after deliberation "
            "and assigns execution tasks to Principal Officers and Senior Officers within their unit."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "allocate_decision", "assign_task", "update_implementation",
            "view_reports", "view_audit_trail",
        ]),
        ("principal_officer", (
            "Executes tasks allocated by the OPSC Manager; updates implementation status "
            "and reports on progress to the Manager."
        ), [
            "view_submissions", "update_implementation", "view_audit_trail",
        ]),
        ("senior_officer", (
            "Assists in executing tasks allocated by the OPSC Manager; updates implementation "
            "progress and escalates issues to the Principal Officer or Manager."
        ), [
            "view_submissions", "update_implementation", "view_audit_trail",
        ]),
        ("vipam_manager", (
            "VIPAM Manager — reviews checklist for study/training-related submissions "
            "and approves or returns them for clarification."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "view_reports", "view_audit_trail",
        ]),
        ("hr_unit_manager", (
            "HR Unit Manager — reviews checklist for HR-related submissions "
            "and approves or returns them for clarification."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "view_reports", "view_audit_trail",
        ]),
        ("odu_manager", (
            "ODU Manager — reviews checklist for organisational development-related submissions "
            "and approves or returns them for clarification."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "view_reports", "view_audit_trail",
        ]),
        ("compliance_manager", (
            "Compliance Manager — reviews checklist for compliance-related submissions "
            "and approves or returns them for clarification."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "view_reports", "view_audit_trail",
        ]),
        ("ministry_hr", "Submits cases on behalf of their ministry and monitors submission status.", [
            "view_dashboard", "view_submissions", "view_audit_trail",
        ]),
        ("dept_admin", "Views submissions relevant to their department only.", [
            "view_submissions", "view_audit_trail",
        ]),
    ]

    def _seed_permissions(self):
        created = 0
        for code, label, category, description in self._PERMISSIONS:
            _, c = SystemPermission.objects.update_or_create(
                code=code,
                defaults={
                    "label": label,
                    "category": category,
                    "description": description,
                    "is_builtin": True,
                },
            )
            if c:
                created += 1
        self.stdout.write(f"  [OK] {len(self._PERMISSIONS)} system permissions ({created} new)")

    def _seed_role_definitions(self):
        perm_map = {p.code: p for p in SystemPermission.objects.all()}
        created = 0
        for role, description, perm_codes in self._ROLE_DEFINITIONS:
            rd, c = RoleDefinition.objects.get_or_create(
                role=role,
                defaults={"description": description, "is_builtin": True},
            )
            if not c:
                rd.description = description
                rd.save(update_fields=["description"])
            perms = [perm_map[code] for code in perm_codes if code in perm_map]
            rd.permissions.set(perms)
            if c:
                created += 1
        self.stdout.write(f"  [OK] {len(self._ROLE_DEFINITIONS)} role definitions ({created} new)")

    def _seed_users(self):
        ministry_map = {m.code: m for m in Ministry.objects.all()}
        created = 0
        for username, email, password, role, min_code in USERS:
            user, new_user = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "is_active": True},
            )
            if new_user:
                user.set_password(password)
                user.save()
                created += 1
            else:
                # Always ensure seeded accounts remain active and have current email
                changed = False
                if not user.is_active:
                    user.is_active = True
                    changed = True
                if email and user.email != email:
                    user.email = email
                    changed = True
                if changed:
                    user.save(update_fields=["is_active", "email"])
            # Ensure profile exists
            ministry = ministry_map.get(min_code) if min_code else None
            Profile.objects.update_or_create(
                user=user,
                defaults={"role": role, "ministry": ministry},
            )
        self.stdout.write(f"  [OK] {len(USERS)} users ({created} new)")

    def _seed_submissions(self, force=False):
        if not force and Submission.objects.exists():
            self.stdout.write(
                "  [OK] submissions already present — skipped "
                "(use --clear or --force-submissions to re-seed dummy submissions)"
            )
            return

        ministry_map  = {m.code: m for m in Ministry.objects.all()}
        dept_map      = {(d.ministry.code, d.code): d for d in Department.objects.select_related("ministry")}
        category_map  = {c.code: c for c in FormCategory.objects.all()}

        # Rotate between PSC officers as "created_by"
        officers = list(User.objects.filter(
            psc_profile__role__in=["psc_officer", "psc_admin"]
        ).select_related("psc_profile"))
        if not officers:
            self.stdout.write(self.style.ERROR("  No PSC officers found — run user seed first."))
            return

        now = timezone.now()
        created_count = 0

        for i, row in enumerate(SUBMISSIONS):
            (title, min_code, dept_code, cat_code,
             form_code, routed_unit, target_stage, days_ago) = row

            ministry = ministry_map.get(min_code)
            if not ministry:
                continue
            category = category_map.get(cat_code)
            if not category:
                continue
            department = dept_map.get((min_code, dept_code)) if dept_code else None
            officer = officers[i % len(officers)]
            received_at = now - timedelta(days=days_ago)

            # Determine assessment_started_at
            assessment_started_at = None
            if target_stage in ASSESSMENT_STAGES:
                assessment_started_at = received_at + timedelta(days=7)

            with transaction.atomic():
                sub = Submission(
                    title=title,
                    form_category=category,
                    form_type_code=form_code,
                    ministry=ministry,
                    department=department,
                    routed_unit=routed_unit,
                    current_stage=target_stage,
                    received_at=received_at,
                    created_by=officer,
                    notes="",
                )
                if assessment_started_at:
                    sub.assessment_started_at = assessment_started_at
                sub.save()  # triggers reference number allocation + deadline calc

                # Create workflow events
                # auto_now_add ignores created_at on create(), so we use
                # a follow-up .update() call to backdate each event.
                events = STAGE_PATHS.get(target_stage, [])
                for from_s, to_s, day_offset, remarks in events:
                    event_time = received_at + timedelta(days=day_offset)
                    ev = WorkflowEvent.objects.create(
                        submission=sub,
                        actor=officer,
                        previous_stage=from_s,
                        new_stage=to_s,
                        remarks=remarks,
                    )
                    WorkflowEvent.objects.filter(pk=ev.pk).update(created_at=event_time)

            created_count += 1

        self.stdout.write(f"  [OK] {created_count} submissions seeded across all workflow stages")
