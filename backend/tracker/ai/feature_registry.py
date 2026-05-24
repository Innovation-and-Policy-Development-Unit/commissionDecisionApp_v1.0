"""
Roadmap: 24 AI features (see AI_Features_List.txt) → Claude model tier.

Implemented Celery/API paths today use claude_client directly.
Future features should call complete_json / complete_text with the tier below.
"""

from __future__ import annotations

from typing import Literal

ModelTier = Literal["haiku", "sonnet"]

# slug -> recommended tier per product spec
FEATURE_MODEL_TIER: dict[str, ModelTier] = {
    # Category A — Submission intelligence
    "A1_auto_fill_checklist": "haiku",
    "A2_document_classification": "haiku",
    "A3_missing_information": "haiku",
    "A4_duplicate_detector": "sonnet",
    "A5_quality_score": "haiku",
    # Category B — Case management
    "B1_case_summary": "haiku",
    "B2_risk_assessment": "sonnet",
    "B3_recommended_outcome": "sonnet",
    "B4_sla_predictor": "sonnet",
    "B5_draft_notice": "sonnet",
    # Category C — Reporting
    "C1_nl_report": "sonnet",
    "C2_executive_summary": "sonnet",
    "C2_meeting_briefing_pack": "sonnet",
    "C3_trend_analysis": "sonnet",
    "C4_minutes_action_items": "haiku",
    # Category D — Chatbots
    "D1_regulations_chatbot": "sonnet",
    "staff_chatbot": "sonnet",
    "D2_status_chatbot": "haiku",
    "D3_case_assistant": "sonnet",
    # Category E — Documents / meetings
    "E1_ocr_extraction": "sonnet",
    "E2_minutes_structured": "haiku",
    "E3_auto_redact": "sonnet",
    # Category F — Workflow
    "F1_smart_routing": "haiku",
    "F2_deadline_notifications": "haiku",
    "F3_outcome_letter": "sonnet",
    "F4_policy_qa": "sonnet",
    # Implemented today (tasks.py)
    "feedback_triage": "haiku",
    "submission_executive_brief": "sonnet",
    "minutes_draft": "sonnet",
    "decision_extract": "haiku",
}
