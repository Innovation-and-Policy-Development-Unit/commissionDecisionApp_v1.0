"""
Comprehensive SCDMS seed command.

Usage:
    python manage.py seed_tracker                     # idempotent reference data + users; submissions if DB has none
    python manage.py seed_tracker --clear           # wipe submissions/events first, then re-seed
    python manage.py seed_tracker --no-submissions  # reference data & users only; skip submissions
    python manage.py seed_tracker --submissions-only # reference data + submissions only; skip users
    python manage.py seed_tracker --force-submissions # add another full dummy submission set (dev only)
"""

from datetime import date, datetime, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tracker.models import (
    AgendaItem, CommissionTask, Department, FormCategory, Meeting,
    Ministry, Profile, Role, RoleDefinition, Submission, Unit,
    SystemPermission, WorkflowEvent, WorkflowStage,
)
from tracker.org_structure import OPSC_UNIT_SEED, ensure_opsc_units, get_opsc_department

# ── Reference data ────────────────────────────────────────────────────────────

# (code, name, psc_forms_summary, display_order)
# display_order determines default agenda sequence (lower = earlier)
# NOTE: Preliminaries and Matters Arising are NOT submission categories,
# they are structural agenda sections managed in AgendaCategory enum.
CATEGORIES = [
    ("discipline_compliance", "3. Discipline / Compliance",
     "Disciplinary cases and preliminary assessment reports",              30),
    ("health_commission",     "4. Health Commission",
     "Vanuatu Health Services Commission (VHSC) matters",                  40),
    ("appointment",           "5. Appointment / Acting Appointment",
     "Regular appointments and acting roles",                              50),
    ("direct_appointment",    "6. Direct Appointment / Confirmation of Appointment",
     "Direct appointments and confirmations",                              60),
    ("extra_responsibility",  "7. Extra Responsibility / Overtime Allowance / Special Skills Allowance",
     "Extra responsibility, OT, and special skills allowances",            70),
    ("contract",              "8. Contract / Temporary Salaried Appointment",
     "New contracts and renewals",                                         80),
    ("temporary_salaried",    "9. Temporary Salaried Appointment",
     "Temporary salaried employees (TSE)",                                 90),
    ("salary_adjustment",     "10. Salary Adjustment",
     "Adjustments to base salary",                                        100),
    ("training",              "11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment",
     "Training, scholarships, and internships",                           110),
    ("medical_claim",         "12. Medical Claim",
     "Medical claims and refunds",                                                120),
    ("partial_severance",     "13. Partial Severance",
     "Partial severance requests",                                                130),
    ("resignation",           "14. Resignation / Retirement / Death",
     "Resignations, retirements and death benefit payouts",                       140),
    ("other",                 "15. Other Matters",
     "Miscellaneous matters not covered by other categories",                     999),
]

MINISTRIES = [
    # Ministries from Book 19 CSV (official names)
    ("MPM",      "Ministry of the Prime Minister"),
    ("MALFB",    "Ministry of Agriculture, Livestock, Forestry and Biosecurity"),
    ("MCCA",     "Ministry of Climate Change and Adaptation"),
    ("MTTCNB",   "Ministry of Trades, Tourism, Commerce and Ni-Vanuatu Business"),
    ("MET",      "Ministry of Education and Training"),
    ("MFEM",     "Ministry of Finance and Economic Management"),
    ("MFAICET",  "Ministry of Foreign Affairs, International Cooperation and External Trade"),
    ("MOH",      "Ministry of Health"),
    ("MIPU",     "Ministry of Infrastructure and Public Utilities"),
    ("MIA",      "Ministry of Internal Affairs"),
    ("MJCS",     "Ministry of Justice and Community Services"),
    ("MLR",      "Ministry of Lands and Natural Resources"),
    ("MFOMA",    "Ministry of Fisheries, Ocean and Maritime Affairs"),
]

# (ministry_code, dept_code, dept_name)
# OPSC internal units kept; all others sourced from Book 19 CSV.
DEPARTMENTS = [
    # Office of the Prime Minister — OPSC is a department; IPDU/ODU/etc. are units (seeded separately)
    ("MPM",     "OPSC",            "Office of the Public Service Commission"),
    ("MPM",     "OPM_CSU",         "Corporate Service Unit"),
    ("MPM",     "OPM_DSPPAC",      "Department of Strategic Policy, Planning and Aid Coordination"),
    ("MPM",     "OPM_DLS",         "Department of Language Services"),
    ("MPM",     "OPM_GRT",         "Government Remuneration Tribunal"),
    ("MPM",     "OPM_DCDT",        "Department of Communication and Digital Transformation"),
    ("MPM",     "OPM_CO",          "Citizenship Office"),
    # Agriculture, Livestock, Forestry and Biosecurity
    ("MALFB",   "MALFB_CSU",       "Corporate Service Unit"),
    ("MALFB",   "MALFB_DARD",      "Department of Agriculture and Rural Development"),
    ("MALFB",   "MALFB_DL",        "Department of Livestock"),
    ("MALFB",   "MALFB_DF",        "Department of Forestry"),
    ("MALFB",   "MALFB_DB",        "Department of Biosecurity"),
    # Climate Change and Adaptation
    ("MCCA",    "MCCA_CSU",        "Corporate Service Unit"),
    ("MCCA",    "MCCA_DCC",        "Department of Climate Change"),
    ("MCCA",    "MCCA_VMGD",       "Vanuatu Meteorology and Geo-hazards Department"),
    ("MCCA",    "MCCA_DE",         "Department of Energy"),
    ("MCCA",    "MCCA_DEPC",       "Department of Environment Protection and Conservation"),
    ("MCCA",    "MCCA_NDMO",       "National Disaster Management Office"),
    # Trades, Tourism, Commerce and Ni-Vanuatu Business
    ("MTTCNB",  "MTTCNB_CSU",      "Corporate Service Unit"),
    ("MTTCNB",  "MTTCNB_DI",       "Department of Industry"),
    ("MTTCNB",  "MTTCNB_DT",       "Department of Tourism"),
    ("MTTCNB",  "MTTCNB_DC",       "Department of Cooperative"),
    # Education and Training
    ("MET",     "MET_CSU",         "Corporate Service Unit"),
    ("MET",     "MET_DES",         "Department of Education Services"),
    ("MET",     "MET_DFA",         "Department of Finance and Admin"),
    ("MET",     "MET_DTE",         "Department of Tertiary Education"),
    ("MET",     "MET_DPP",         "Department of Policy and Planning"),
    # Finance and Economic Management
    ("MFEM",    "MFEM_CSU",        "Corporate Service Unit"),
    ("MFEM",    "MFEM_DFT",        "Department of Finance and Treasury"),
    ("MFEM",    "MFEM_VBS",        "Vanuatu Bureau of Statistics"),
    ("MFEM",    "MFEM_DCIR",       "Department of Customs and Inland Revenue"),
    ("MFEM",    "MFEM_VNAO",       "Vanuatu National Audit Office"),
    # Foreign Affairs, International Cooperation and External Trade
    ("MFAICET", "MFAICET_CSU",     "Corporate Service Unit"),
    ("MFAICET", "MFAICET_DFA",     "Department of Foreign Affairs"),
    ("MFAICET", "MFAICET_DET",     "Department of External Trade"),
    # Health
    ("MOH",     "MOH_CSU",         "Corporate Service Unit"),
    ("MOH",     "MOH_DPP",         "Department of Policy and Planning"),
    ("MOH",     "MOH_DCHS",        "Department of Curative and Hospital Services"),
    ("MOH",     "MOH_DPH",         "Department of Public Health"),
    # Infrastructure and Public Utilities
    ("MIPU",    "MIPU_CSU",        "Corporate Service Unit"),
    ("MIPU",    "MIPU_PWD",        "Public Works Department"),
    ("MIPU",    "MIPU_CAV",        "Civil Aviation Authority of Vanuatu"),
    ("MIPU",    "MIPU_DPM",        "Department of Ports and Marine"),
    # Internal Affairs
    ("MIA",     "MIA_CSU",         "Corporate Service Unit"),
    ("MIA",     "MIA_DL",          "Department of Labour"),
    ("MIA",     "MIA_DI",          "Department of Immigration"),
    ("MIA",     "MIA_DUA",         "Department of Urban Affairs"),
    ("MIA",     "MIA_DLA",         "Department of Local Authorities"),
    ("MIA",     "MIA_DCRIM",       "Department Civil Registration and Identity Management"),
    ("MIA",     "MIA_VEO",         "Vanuatu Electoral Office"),
    # Justice and Community Services
    ("MJCS",    "MJCS_CSU",        "Corporate Service Unit"),
    ("MJCS",    "MJCS_DCS",        "Department of Correctional Services"),
    ("MJCS",    "MJCS_CLMO",       "Customary land Management Office"),
    ("MJCS",    "MJCS_DWA",        "Department of Womans Affairs"),
    ("MJCS",    "MJCS_DYS",        "Department of Youth and Sports"),
    # Lands and Natural Resources
    ("MLR",     "MLR_CSU",         "Corporate Service Unit"),
    ("MLR",     "MLR_DLSR",        "Department of Lands, Survey and Records"),
    ("MLR",     "MLR_DWR",         "Department of Water Resources"),
    # Fisheries, Ocean and Maritime Affairs
    ("MFOMA",   "MFOMA_CSU",       "Corporate Service Unit"),
    ("MFOMA",   "MFOMA_DOMA",      "Department of Ocean's and Maritime Affairs"),
    ("MFOMA",   "MFOMA_DF",        "Department of Fisheries"),
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
    ("m.vipam",        "m.vipam@psc.gov.vu",         "Manager123!",       "vipam_manager",          "MPM"),
    ("m.hrunit",       "m.hrunit@psc.gov.vu",        "Manager123!",       "hr_unit_manager",        "MPM"),
    ("m.odu",          "m.odu@psc.gov.vu",           "Manager123!",       "odu_manager",            "MPM"),
    ("m.compliance",   "m.compliance@psc.gov.vu",    "Manager123!",       "compliance_manager",     "MPM"),
    ("s.compliance",   "s.compliance@psc.gov.vu",    "Officer123!",       "compliance_senior",      "MPM"),
    ("p.compliance",   "p.compliance@psc.gov.vu",    "Officer123!",       "compliance_principal",   "MPM"),
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
     "MFEM", "TREASURY", "appointment", "PSC 3.6", "odu", "implementation_report", 125),
    ("Transfer of Chief Nursing Officer to Northern Provincial Hospital, MOH",
     "MOH", "NURSING", "other", "PSC 4.5", "hr", "implementation_report", 118),
    ("Reclassification of ICT Officers — OGCIO Grades 3–5",
     "OPM", "OGCIO", "other", "PSC 2.1", "hr", "implementation_report", 112),
    ("Secondment of Agricultural Officer to SPC Regional Office, Suva",
     "MALFFB", "AGR", "other", "PSC 4.8", "hr", "implementation_report", 105),

    # ── UNDER IMPLEMENTATION ───────────────────────────────────────────────
    ("Appointment of Deputy Director — Customs & Inland Revenue",
     "MFEM", "CIR", "appointment", "PSC 3.6", "odu", "under_implementation", 96),
    ("Promotion of Senior Education Officers to Principal Grade (Batch of 6)",
     "MET", "PRIM_ED", "appointment", "PSC 3.5", "hr", "under_implementation", 90),
    ("Secondment of Legal Officer to Ministry of Foreign Affairs",
     "MJCS", "STATE_LAW", "other", "PSC 4.8", "hr", "under_implementation", 86),
    ("Termination of Employment — Finance Officer, Ministry of Infrastructure",
     "MIPU", "PWD", "discipline_compliance", "PSC 6.4", "compliance", "under_implementation", 82),
    ("Appointment of Director of Agriculture",
     "MALFFB", "AGR", "appointment", "PSC 3.6", "odu", "under_implementation", 79),
    ("Reclassification of Tourism Officer Posts — Ministry of Tourism",
     "MTCI", None, "other", "PSC 2.1", "hr", "under_implementation", 75),

    # ── DECISION ENTERED & ASSIGNED ────────────────────────────────────────
    ("Appointment of Principal Statistician — National Statistics Office",
     "MFEM", "NSO", "appointment", "PSC 3.6", "odu", "decision_entered_assigned", 72),
    ("Promotion of Senior Health Inspector to Principal Grade",
     "MOH", "PUBLIC_HEALTH", "appointment", "PSC 3.5", "hr", "decision_entered_assigned", 68),
    ("Acting Appointment — Director of Public Works",
     "MIPU", "PWD", "appointment", "PSC 3.8", "odu", "decision_entered_assigned", 64),
    ("Transfer of Education Officer to Tafea Province",
     "MET", "PRIM_ED", "other", "PSC 4.5", "hr", "decision_entered_assigned", 60),
    ("Appointment of Deputy Commissioner of Police",
     "MIA", "POLICE", "appointment", "PSC 3.6", "odu", "decision_entered_assigned", 57),

    # ── MINUTES DRAFTED & SIGNED ───────────────────────────────────────────
    ("Appointment of Chief Surveyor — Department of Surveys",
     "MLGM", "SURVEYS", "appointment", "PSC 3.6", "odu", "minutes_drafted_signed", 54),
    ("Promotion — Senior Accountant to Principal Accountant, Treasury",
     "MFEM", "TREASURY", "appointment", "PSC 3.5", "odu", "minutes_drafted_signed", 51),
    ("Secondment of Nurse to WHO Regional Office, Manila",
     "MOH", "NURSING", "other", "PSC 4.8", "hr", "minutes_drafted_signed", 47),
    ("Acting Appointment of Director — Department of Forestry",
     "MALFFB", "FORESTRY", "appointment", "PSC 3.8", "odu", "minutes_drafted_signed", 44),

    # ── APPROVED ───────────────────────────────────────────────────────────
    ("Appointment of Director of Education Policy",
     "MET", "HIGHER", "appointment", "PSC 3.6", "odu", "approved", 52),
    ("Promotion — Senior Lands Officer to Principal Grade",
     "MLGM", "LANDS", "appointment", "PSC 3.5", "hr", "approved", 48),
    ("Transfer of Pharmacist — Vila Central Hospital",
     "MOH", "PHARMACY", "other", "PSC 4.5", "hr", "approved", 44),
    ("Secondment of Policy Analyst to Asian Development Bank",
     "OPM", "DEPT_STATE", "other", "PSC 4.8", "hr", "approved", 42),
    ("Appointment of Chief Fisheries Officer",
     "MALFFB", "FISHERIES", "appointment", "PSC 3.6", "odu", "approved", 40),
    ("Promotion — Senior Immigration Officer to Principal Grade",
     "MIA", "IMMIGRATION", "appointment", "PSC 3.5", "odu", "approved", 38),
    ("Establishment Variation — Ministry of Tourism (3 New Posts)",
     "MTCI", None, "other", "PSC 2.2", "hr", "approved", 36),
    ("Appointment of State Counsel — Department of State Law",
     "MJCS", "STATE_LAW", "appointment", "PSC 3.6", "odu", "approved", 34),

    # ── REJECTED ───────────────────────────────────────────────────────────
    ("Termination — Senior Finance Officer, Ministry of Finance",
     "MFEM", "BUDGET", "discipline_compliance", "PSC 6.4", "compliance", "rejected", 50),
    ("Reclassification — IT Officer Posts, Ministry of Justice",
     "MJCS", None, "other", "PSC 2.1", "hr", "rejected", 46),

    # ── RETURNED ───────────────────────────────────────────────────────────
    ("Secondment of Lands Officer to Pacific Islands Development Forum",
     "MLGM", "LANDS", "other", "PSC 4.8", "hr", "returned", 42),
    ("Establishment Variation — Ministry of Infrastructure (Grade Reclassification)",
     "MIPU", "PWD", "other", "PSC 2.1", "hr", "returned", 38),

    # ── COMMISSION SITTING ─────────────────────────────────────────────────
    ("Appointment of Director General — Office of the Prime Minister",
     "OPM", "DEPT_STATE", "appointment", "PSC 3.6", "odu", "commission_sitting", 14),
    ("Promotion Batch — Ministry of Health Nursing Officers (Grade 4 to 5)",
     "MOH", "NURSING", "appointment", "PSC 3.5", "hr", "commission_sitting", 12),
    ("Termination — Department of Agriculture Officer",
     "MALFFB", "AGR", "discipline_compliance", "PSC 6.4", "compliance", "commission_sitting", 10),
    ("Reclassification — Finance Officers, Treasury Department (Grade 7 to 8)",
     "MFEM", "TREASURY", "other", "PSC 2.1", "odu", "commission_sitting", 7),

    # ── FORWARDED TO COMMISSION ────────────────────────────────────────────
    ("Appointment of Principal Lands Officer — Ministry of Lands",
     "MLGM", "LANDS", "appointment", "PSC 3.6", "odu", "forwarded_to_commission", 23),
    ("Promotion — Senior Engineer to Principal Engineer, Public Works",
     "MIPU", "PWD", "appointment", "PSC 3.5", "hr", "forwarded_to_commission", 20),
    ("Secondment of Education Officer to Pacific Community, Noumea",
     "MET", "SEC_ED", "other", "PSC 4.8", "hr", "forwarded_to_commission", 18),
    ("Acting Appointment — Director of Internal Revenue",
     "MFEM", "CIR", "appointment", "PSC 3.8", "odu", "forwarded_to_commission", 15),
    ("Appointment of Chief of Police — Vanuatu Police Force",
     "MIA", "POLICE", "appointment", "PSC 3.6", "odu", "forwarded_to_commission", 12),

    # ── DEFERRED ───────────────────────────────────────────────────────────
    ("Appointment of Divisional Finance Officer — Ministry of Finance",
     "MFEM", "BUDGET", "appointment", "PSC 3.6", "odu", "deferred", 38),
    ("Termination of Employment — Ports & Harbour Staff Member",
     "MIPU", "PORTS", "discipline_compliance", "PSC 6.3", "compliance", "deferred", 30),
    ("Reclassification — Health Inspector Posts, Ministry of Health",
     "MOH", "PUBLIC_HEALTH", "other", "PSC 2.1", "hr", "deferred", 25),
    ("Secondment of Survey Officer to UN-HABITAT Regional Office",
     "MLGM", "SURVEYS", "other", "PSC 4.8", "hr", "deferred", 22),

    # ── RESUBMITTED ────────────────────────────────────────────────────────
    ("Appointment of Chief Education Officer — Curriculum (Resubmission)",
     "MET", "HIGHER", "appointment", "PSC 3.6", "odu", "resubmitted", 18),
    ("Promotion — Senior Correctional Officer to Principal Grade (Resubmission)",
     "MJCS", "CORRECTIONAL", "appointment", "PSC 3.5", "hr", "resubmitted", 12),

    # ── UNDER ASSESSMENT (some overdue) ───────────────────────────────────
    ("Appointment of Director of Forestry — MALFFB",
     "MALFFB", "FORESTRY", "appointment", "PSC 3.6", "odu", "under_assessment", 38),   # OVERDUE
    ("Termination — Senior Accountant, Ministry of Finance",
     "MFEM", "TREASURY", "discipline_compliance", "PSC 6.4", "compliance", "under_assessment", 34),  # OVERDUE
    ("Promotion — Senior Police Officer to Inspector Grade",
     "MIA", "POLICE", "appointment", "PSC 3.5", "odu", "under_assessment", 22),
    ("Secondment of Livestock Officer to FAO Rome",
     "MALFFB", "LIVESTOCK", "other", "PSC 4.8", "hr", "under_assessment", 18),
    ("Reclassification — Transport Officers, Ministry of Infrastructure",
     "MIPU", "PWD", "other", "PSC 2.1", "hr", "under_assessment", 15),
    ("Appointment of Deputy Secretary — Ministry of Health",
     "MOH", "CURATIVE", "appointment", "PSC 3.6", "odu", "under_assessment", 13),
    ("Acting Appointment — Deputy Director Education (Curriculum)",
     "MET", "SEC_ED", "appointment", "PSC 3.8", "hr", "under_assessment", 10),
    ("Establishment Variation — Ministry of Agriculture (Additional Posts)",
     "MALFFB", None, "other", "PSC 2.2", "hr", "under_assessment", 8),

    # ── MANAGER CHECKLIST REVIEW ───────────────────────────────────────────
    ("Appointment of Chief Immigration Officer",
     "MIA", "IMMIGRATION", "appointment", "PSC 3.6", "odu", "manager_checklist_review", 14),
    ("Promotion — Senior Tourism Officers (Batch of 4)",
     "MTCI", None, "appointment", "PSC 3.5", "hr", "manager_checklist_review", 12),
    ("Transfer of Education Officer to Santo Province",
     "MET", "PRIM_ED", "other", "PSC 4.5", "hr", "manager_checklist_review", 10),
    ("Reclassification — Finance Officers, Budget Department",
     "MFEM", "BUDGET", "other", "PSC 2.1", "odu", "manager_checklist_review", 8),
    ("Termination — Staff Member, Ministry of Rural Development",
     "MRDLGCD", None, "discipline_compliance", "PSC 6.3", "compliance", "manager_checklist_review", 6),
    ("Secondment of Lands Officer to SPREP, Apia",
     "MLGM", "LANDS", "other", "PSC 4.8", "hr", "manager_checklist_review", 5),

    # ── REGISTERED & ROUTED ───────────────────────────────────────────────
    ("Appointment of Director of Budget & Economic Planning",
     "MFEM", "BUDGET", "appointment", "PSC 3.6", "odu", "registered_routed", 7),
    ("Promotion — Senior Nurse to Nursing Officer Grade 5",
     "MOH", "NURSING", "appointment", "PSC 3.5", "hr", "registered_routed", 6),
    ("Secondment of Police Officer to Pacific Islands Chiefs of Police Working Group",
     "MIA", "POLICE", "other", "PSC 4.8", "odu", "registered_routed", 5),
    ("Reclassification — Health Worker Posts (Grade 2 to Grade 3)",
     "MOH", "PUBLIC_HEALTH", "other", "PSC 2.1", "hr", "registered_routed", 4),
    ("Transfer of Fisheries Officer to Luganville Field Office",
     "MALFFB", "FISHERIES", "other", "PSC 4.5", "hr", "registered_routed", 4),
    ("Appointment of Principal Education Officer — Curriculum Development",
     "MET", "HIGHER", "appointment", "PSC 3.6", "odu", "registered_routed", 3),
    ("Establishment Variation — Ministry of Health (New Nursing Posts, Santo)",
     "MOH", None, "other", "PSC 2.2", "hr", "registered_routed", 3),

    # ── RECEIVED BY PSC (just arrived) ────────────────────────────────────
    ("Appointment of Director of Civil Aviation",
     "MIPU", "CIVIL_AVIATION", "appointment", "PSC 3.6", "odu", "received_by_psc", 2),
    ("Promotion — Senior Agricultural Officer to Principal Grade",
     "MALFFB", "AGR", "appointment", "PSC 3.5", "hr", "received_by_psc", 2),
    ("Transfer of Legal Officer to Ministry of Justice Head Office",
     "MJCS", "STATE_LAW", "other", "PSC 4.5", "hr", "received_by_psc", 1),
    ("Reclassification of Customs Officers — Grade Alignment Review",
     "MFEM", "CIR", "other", "PSC 2.1", "odu", "received_by_psc", 1),
    ("Appointment of Chief Information Officer — OGCIO",
     "OPM", "OGCIO", "appointment", "PSC 3.6", "odu", "received_by_psc", 0),

    # ── NEW STAGES FOR VALIDATION (added for demo) ───────────────────────
    ("Recruitment Review — Department of Lands (Missing JD)",
     "MLGM", "LANDS", "appointment", "PSC 3.1", "hr", "returned_for_clarification", 5),
    ("Termination Case — Ministry of Internal Affairs (Legal Review)",
     "MIA", "POLICE", "discipline_compliance", "PSC 6.4", "compliance", "awaiting_legal_advice", 20),
    ("Establishment Restructure — Ministry of Finance (Matters Arising)",
     "MFEM", "BUDGET", "other", "PSC 2.1", "odu", "matters_arising", 30),
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
        parser.add_argument(
            "--minute-intake",
            action="store_true",
            help="Only seed Minute intake demo sittings (approved/circulated agendas + items).",
        )

    def handle(self, *args, **options):
        if options["minute_intake"]:
            from django.core.management import call_command
            call_command("seed_minute_intake", "--with-sample-notes")
            return

        if options["clear"]:
            self._clear()

        self._seed_categories()
        self._seed_ministries()
        self._seed_departments()
        self._seed_opsc_units()
        self._seed_permissions()
        self._seed_role_definitions()

        submissions_only = options["submissions_only"]
        no_submissions   = options["no_submissions"]

        if not submissions_only:
            self._seed_users()

        if not no_submissions:
            self._seed_submissions(force=bool(options["force_submissions"]))
            self._seed_agenda_items()
            self._seed_commission_tasks()
            self._seed_minute_intake()

        self._seed_ui_translations()

        self.stdout.write(self.style.SUCCESS("\n[OK] Database seeded successfully."))
        if not submissions_only:
            self.stdout.write("  Login credentials:")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")
            self.stdout.write("  | Username              | Password             | Role               |")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")
            for u in USERS:
                self.stdout.write(f"  | {u[0]:<21} | {u[2]:<20} | {u[3]:<18} |")
            self.stdout.write("  +-----------------------+----------------------+--------------------+")

    def _seed_ui_translations(self):
        from tracker.models import UiTranslation
        from tracker.ui_translation_views import _sync_from_locale_files

        before = UiTranslation.objects.count()
        stats = _sync_from_locale_files(force=False)
        if stats["total_keys"] == 0:
            self.stdout.write(self.style.WARNING(
                "  [SKIP] UI translations: locale JSON not found (check locale_bundles or frontend/src/i18n/locales)."
            ))
            return
        after = UiTranslation.objects.count()
        self.stdout.write(
            f"  [OK] UI translations: {stats['total_keys']} keys in files, "
            f"{stats['created']} created, {stats['updated']} updated, "
            f"{stats['skipped']} customized skipped ({after} rows, was {before})."
        )

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

    _OPSC_ROLE_UNIT = {
        "vipam_manager": "VIPAM",
        "hr_unit_manager": "HR",
        "odu_manager": "ODU",
        "compliance_manager": "COMPLIANCE",
        "compliance_senior": "COMPLIANCE",
        "compliance_principal": "COMPLIANCE",
        "csu_manager": "CSU",
    }

    _OPSC_STAFF_ROLES = frozenset({
        "psc_admin", "psc_officer", "psc_secretary", "senior_admin_officer",
        "psc_commissioner", "chairperson", "psc_manager", "principal_officer",
        "senior_officer", "odu_principal", "principal_org_dev_analyst",
        "principal_job_analyst",
    })

    def _seed_opsc_units(self):
        dept = get_opsc_department(create=True)
        if not dept:
            self.stdout.write(self.style.WARNING("  [SKIP] OPSC department under OPM not found"))
            return
        ensure_opsc_units(dept)
        self.stdout.write(f"  [OK] {len(OPSC_UNIT_SEED)} OPSC units under {dept.code}")

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
        ("view_commission_minutes", "View Commission Minutes", "tasks",
         "Browse Commission minutes (read-only for OPSC unit managers and principals)."),
        ("view_commission_tasks", "View Commission Task Register", "tasks",
         "See all post-decision tasks; change only tasks allocated to you."),
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
        ("manage_ui_translations", "Manage UI Translations", "administration", "Edit dashboard labels in English, French, and Bislama without changing code."),
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
            "manage_users", "manage_roles", "manage_ui_translations", "view_audit_trail",
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
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("principal_officer", (
            "Executes tasks allocated by the OPSC Manager; updates implementation status "
            "and reports on progress to the Manager."
        ), [
            "view_submissions", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("senior_officer", (
            "Assists in executing tasks allocated by the OPSC Manager; updates implementation "
            "progress and escalates issues to the Principal Officer or Manager."
        ), [
            "view_submissions", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("vipam_manager", (
            "VIPAM Manager — reviews checklist for study/training-related submissions; "
            "views all Commission minutes and tasks; works only on tasks allocated to VIPAM."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "assign_task", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("hr_unit_manager", (
            "HR Unit Manager — reviews HR submissions; views all Commission minutes and tasks; "
            "works only on tasks allocated to the HR unit."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "assign_task", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("odu_manager", (
            "ODU Manager — reviews organisational development submissions; views all Commission "
            "minutes and tasks; works only on tasks allocated to ODU."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "assign_task", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("csu_manager", (
            "CSU Manager — lodges internal OPSC submissions; views all Commission minutes and tasks; "
            "works only on tasks allocated to CSU."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow", "create_submission",
            "assign_task", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("compliance_manager", (
            "Compliance Manager — manages cases in CMS; registers linked records with the "
            "Commission Portal for Secretary review and sign-off."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "assign_task", "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_reports", "view_audit_trail",
        ]),
        ("vipam_principal", (
            "VIPAM Principal — assessment work assigned by the VIPAM Manager; views all Commission "
            "minutes and tasks; updates only tasks allocated to them."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("hr_unit_principal", (
            "HR Unit Principal — assessment work assigned by the HR Unit Manager; views all Commission "
            "minutes and tasks; updates only tasks allocated to them."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("odu_principal", (
            "ODU Principal — assessment work assigned by the ODU Manager; views all Commission "
            "minutes and tasks; updates only tasks allocated to them."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("principal_org_dev_analyst", (
            "Principal Organization Development Analyst (ODU) — completes the ODU restructure "
            "checklist and assessment on submissions assigned by the ODU Manager (ORG-3.1 / PSC 2-1)."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("principal_job_analyst", (
            "Principal Job Analyst (ODU) — job analysis and establishment variation work on "
            "submissions assigned by the ODU Manager; same ODU workflow access as org development analyst."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
            "view_audit_trail",
        ]),
        ("compliance_senior", (
            "Compliance Senior Officer — creates and maintains compliance cases in CMS "
            "(PSA amendments: Principal and Manager only in CMS)."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "view_reports", "view_audit_trail",
        ]),
        ("compliance_principal", (
            "Compliance Principal — assigned compliance cases in CMS; views all Commission "
            "minutes and tasks; updates only tasks allocated to them."
        ), [
            "view_dashboard", "view_submissions", "transition_workflow",
            "update_implementation",
            "view_commission_minutes", "view_commission_tasks",
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
        opsc_dept = get_opsc_department(create=False)
        unit_map = {}
        if opsc_dept:
            unit_map = {u.code.upper(): u for u in Unit.objects.filter(department=opsc_dept)}
        opm = ministry_map.get("OPM")
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
            profile_defaults = {"role": role, "ministry": ministry}
            if opm and (min_code in ("OPM", "MPM") or role in self._OPSC_STAFF_ROLES):
                profile_defaults["ministry"] = opm
                if opsc_dept:
                    profile_defaults["department"] = opsc_dept
                    unit_code = self._OPSC_ROLE_UNIT.get(role)
                    if unit_code:
                        profile_defaults["unit"] = unit_map.get(unit_code.upper())
            Profile.objects.update_or_create(
                user=user,
                defaults=profile_defaults,
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

    # ── Agenda items ──────────────────────────────────────────────────────────

    def _seed_agenda_items(self):
        """Seed ≥15 agenda items on MTG-2026-012 (the upcoming May 2026 sitting)."""
        try:
            meeting = Meeting.objects.get(reference_number="MTG-2026-012")
        except Meeting.DoesNotExist:
            self.stdout.write(self.style.WARNING(
                "  [SKIP] Meeting MTG-2026-012 not found — create it in the Meetings page first."
            ))
            return

        # (submission title, agenda category)
        # First: submissions currently at commission_sitting or forwarded_to_commission
        # Then: 6 more from approved/minutes_drafted_signed to reach 15
        AGENDA_ITEMS = [
            # commission_sitting (4)
            ("Appointment of Director General — Office of the Prime Minister",         "appointment"),
            ("Promotion Batch — Ministry of Health Nursing Officers (Grade 4 to 5)",   "appointment"),
            ("Termination — Department of Agriculture Officer",                        "discipline_compliance"),
            ("Reclassification — Finance Officers, Treasury Department (Grade 7 to 8)","other"),
            # forwarded_to_commission (5)
            ("Appointment of Principal Lands Officer — Ministry of Lands",             "appointment"),
            ("Promotion — Senior Engineer to Principal Engineer, Public Works",        "appointment"),
            ("Secondment of Education Officer to Pacific Community, Noumea",           "other"),
            ("Acting Appointment — Director of Internal Revenue",                      "appointment"),
            ("Appointment of Chief of Police — Vanuatu Police Force",                  "appointment"),
            # approved / minutes_drafted_signed — appear for completeness (6)
            ("Appointment of Director of Education Policy",                            "appointment"),
            ("Promotion — Senior Lands Officer to Principal Grade",                    "appointment"),
            ("Transfer of Pharmacist — Vila Central Hospital",                         "other"),
            ("Secondment of Policy Analyst to Asian Development Bank",                 "other"),
            ("Appointment of Chief Fisheries Officer",                                 "appointment"),
            ("Appointment of Chief Surveyor — Department of Surveys",                  "appointment"),
        ]

        created = 0
        seq_by_cat: dict[str, int] = {}
        for title, category in AGENDA_ITEMS:
            try:
                sub = Submission.objects.get(title=title)
            except Submission.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"    [SKIP] Submission not found: {title[:60]}"))
                continue
            seq_by_cat[category] = seq_by_cat.get(category, 0) + 1
            _, c = AgendaItem.objects.get_or_create(
                meeting=meeting,
                submission=sub,
                defaults={
                    "sequence": seq_by_cat[category],
                    "category": category,
                },
            )
            if c:
                created += 1

        self.stdout.write(f"  [OK] {created} agenda items seeded on {meeting.reference_number}")

    def _seed_minute_intake(self):
        """Eligible sittings for Minute intake (circulated / chairman-approved agendas)."""
        from django.core.management import call_command
        call_command("seed_minute_intake", "--with-sample-notes")

    # ── Commission tasks (Decision Register) ──────────────────────────────────

    def _seed_commission_tasks(self):
        """Seed ≥15 commission tasks drawn from post-decision submissions."""
        try:
            manager = User.objects.get(username="m.opsc")
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING(
                "  [SKIP] User m.opsc not found — run user seed first."
            ))
            return

        try:
            secretary = User.objects.get(username="j.iati")
        except User.DoesNotExist:
            secretary = manager

        mtg_010 = Meeting.objects.filter(reference_number="MTG-2026-010").first()
        mtg_011 = Meeting.objects.filter(reference_number="MTG-2026-011").first()

        today = date.today()

        # fmt: (title, decision_number, meeting_obj, decision_outcome,
        #        action_unit, implementation_status, decision_detail,
        #        way_forward, task_status, due_date_offset_days)
        TASKS = [
            # ── IMPLEMENTATION REPORT (completed) ────────────────────────────
            (
                "Appointment of Director of Finance — Ministry of Finance & Economic Management",
                "01-10-2026", mtg_010, "approved", "ODU", "actioned",
                "The Commission approved the appointment of the Director of Finance for the "
                "Ministry of Finance & Economic Management, effective 1 April 2026.",
                "Letter of appointment issued. Ministry confirmed officer commenced duty.",
                "completed", -30,
            ),
            (
                "Transfer of Chief Nursing Officer to Northern Provincial Hospital, MOH",
                "02-10-2026", mtg_010, "approved", "HRMU", "actioned",
                "The Commission approved the transfer of the Chief Nursing Officer to the "
                "Northern Provincial Hospital, effective 14 April 2026.",
                "Transfer letter issued. Officer reported to new post on schedule.",
                "completed", -25,
            ),
            (
                "Reclassification of ICT Officers — OGCIO Grades 3–5",
                "03-10-2026", mtg_010, "approved", "HRMU", "now_irrelevant",
                "The Commission approved the reclassification of ICT Officer posts at OGCIO "
                "from Grades 3–5, subject to budget confirmation.",
                "Budget not confirmed for current fiscal year. Matter now irrelevant — "
                "to be revisited in the next budget cycle.",
                "completed", -20,
            ),
            (
                "Secondment of Agricultural Officer to SPC Regional Office, Suva",
                "04-10-2026", mtg_010, "approved", "VIPAM_HRDU", "actioned",
                "The Commission approved the secondment of the Agricultural Officer to the "
                "SPC Regional Office in Suva for a period of 2 years.",
                "Secondment agreement signed. Officer departed 15 April 2026.",
                "completed", -18,
            ),
            # ── UNDER IMPLEMENTATION ──────────────────────────────────────────
            (
                "Appointment of Deputy Director — Customs & Inland Revenue",
                "01-11-2026", mtg_011, "approved", "ODU", "with_unit",
                "The Commission approved the appointment of the Deputy Director for "
                "Customs & Inland Revenue.",
                "Letter of appointment being prepared. Awaiting signature from OPSC Secretary.",
                "in_progress", 15,
            ),
            (
                "Promotion of Senior Education Officers to Principal Grade (Batch of 6)",
                "02-11-2026", mtg_011, "approved", "HRMU", "with_unit",
                "The Commission approved the promotion of 6 Senior Education Officers "
                "to Principal Grade.",
                "Individual promotion letters being prepared for each of the 6 officers.",
                "in_progress", 18,
            ),
            (
                "Secondment of Legal Officer to Ministry of Foreign Affairs",
                "03-11-2026", mtg_011, "approved", "VIPAM_HRDU", "with_unit",
                "The Commission approved the secondment of the Legal Officer to the "
                "Ministry of Foreign Affairs.",
                "Secondment agreement under preparation. MFAICET to confirm posting date.",
                "in_progress", 20,
            ),
            (
                "Termination of Employment — Finance Officer, Ministry of Infrastructure",
                "04-11-2026", mtg_011, "approved", "HRMU", "matters_arising",
                "The Commission approved the termination of employment of the Finance Officer, "
                "Ministry of Infrastructure.",
                "Legal review of termination notice required before issuance. "
                "Referred to State Law Office for opinion.",
                "in_progress", 12,
            ),
            (
                "Appointment of Director of Agriculture",
                "05-11-2026", mtg_011, "approved", "ODU", "with_unit",
                "The Commission approved the appointment of the Director of Agriculture.",
                "Appointment letter being finalised. Ministry of Agriculture notified.",
                "in_progress", 22,
            ),
            (
                "Reclassification of Tourism Officer Posts — Ministry of Tourism",
                "06-11-2026", mtg_011, "approved", "HRMU", "with_unit",
                "The Commission approved the reclassification of Tourism Officer posts at "
                "the Ministry of Tourism, Commerce & Industry.",
                "Establishment variation forms to be completed and signed by PS. In progress.",
                "open", 25,
            ),
            # ── DECISION ENTERED & ASSIGNED ───────────────────────────────────
            (
                "Appointment of Principal Statistician — National Statistics Office",
                "07-11-2026", mtg_011, "approved", "ODU", "with_unit",
                "The Commission approved the appointment of the Principal Statistician at "
                "the National Statistics Office.",
                "Awaiting confirmation of position vacancy clearance from the Budget Department.",
                "open", 30,
            ),
            (
                "Promotion of Senior Health Inspector to Principal Grade",
                "08-11-2026", mtg_011, "approved", "HRMU", "with_unit",
                "The Commission approved the promotion of the Senior Health Inspector "
                "to Principal Grade.",
                "Promotion letter to be issued. MOH HR unit contacted for staff particulars.",
                "open", 28,
            ),
            (
                "Acting Appointment — Director of Public Works",
                "09-11-2026", mtg_011, "approved", "ODU", "with_unit",
                "The Commission approved the acting appointment of the Director of "
                "Public Works for a 3-month period.",
                "Acting appointment letter to be issued. MIPU notified of Commission decision.",
                "open", 21,
            ),
            (
                "Transfer of Education Officer to Tafea Province",
                "10-11-2026", mtg_011, "approved", "HRMU", "with_unit",
                "The Commission approved the transfer of the Education Officer to Tafea Province.",
                "Transfer letter to be prepared. Ministry of Education to confirm transport "
                "arrangements with provincial office.",
                "open", 20,
            ),
            (
                "Appointment of Deputy Commissioner of Police",
                "11-11-2026", mtg_011, "approved", "ODU", "with_unit",
                "The Commission approved the appointment of the Deputy Commissioner of Police.",
                "Security clearance verification in progress. Appointment letter pending "
                "clearance confirmation.",
                "open", 35,
            ),
        ]

        created = 0
        for row in TASKS:
            (title, dec_num, meeting_obj, outcome, action_unit, impl_status,
             dec_detail, way_fwd, task_status, due_offset) = row

            try:
                sub = Submission.objects.get(title=title)
            except Submission.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"    [SKIP] Submission not found: {title[:60]}"
                ))
                continue

            due = today + timedelta(days=due_offset)

            # Infer decision_type from title keywords
            title_lower = title.lower()
            if any(k in title_lower for k in ("terminat",)):
                dtype = "termination"
            elif any(k in title_lower for k in ("promot",)):
                dtype = "promotion"
            elif any(k in title_lower for k in ("transfer", "secondment")):
                dtype = "other"
            elif any(k in title_lower for k in ("reclassif", "establishment")):
                dtype = "policy_change"
            else:
                dtype = "appointment"

            _, c = CommissionTask.objects.get_or_create(
                submission=sub,
                title=title,
                defaults={
                    "decision_number":       dec_num,
                    "meeting":               meeting_obj,
                    "meeting_reference":     meeting_obj.reference_number if meeting_obj else "",
                    "meeting_date":          meeting_obj.date if meeting_obj else None,
                    "decision_outcome":      outcome,
                    "action_unit":           action_unit,
                    "implementation_status": impl_status,
                    "decision_detail":       dec_detail,
                    "way_forward":           way_fwd,
                    "status":                task_status,
                    "decision_type":         dtype,
                    "assigned_manager":      manager,
                    "created_by":            secretary,
                    "due_date":              due,
                },
            )
            if c:
                created += 1

        self.stdout.write(f"  [OK] {created} commission tasks seeded")
