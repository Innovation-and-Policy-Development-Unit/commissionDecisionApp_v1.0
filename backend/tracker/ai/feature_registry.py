"""
Roadmap: 24 AI features (see AI_Features_List.txt) → Claude model tier.

Policy (enforced in code review):
- Haiku: checklists, classification, quality score, reminders, action items, validation
- Sonnet: briefs, NL reports, similarity, letters, long-context chat, vision/OCR on hard PDFs
- Always: async Celery, no sync Claude on page load; store on models; "AI draft — verify" for formal output

See AI_STANDARDS.md in this package.
"""

from __future__ import annotations

from typing import Literal

ModelTier = Literal["haiku", "sonnet"]

DEFAULT_TIER: ModelTier = "haiku"


def get_model_tier(slug: str, *, default: ModelTier | None = None) -> ModelTier:
    """Resolve Claude tier for a feature slug."""
    return FEATURE_MODEL_TIER.get(slug, default or DEFAULT_TIER)

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
    # Batch 8 — workflow & documents
    "transition_guidance": "haiku",
    "agenda_blurb": "haiku",
    "bilingual_ministry_comms": "haiku",
    "implementation_subtask_draft": "haiku",
    "staff_knowledge_rag": "sonnet",
    "submission_nl_search": "sonnet",
    "annotation_assist": "sonnet",
    "redaction_preview": "sonnet",
}
