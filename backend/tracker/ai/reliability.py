"""
Shared AI-call reliability helpers.

Every Celery task (and synchronous view) that calls the Gemini API should
log its outcome here — success, transient retry, or permanent failure — so
the AI reliability dashboard (Administration -> AI reliability) has real
data instead of nobody noticing until a user reports a stuck spinner.

Usage (Celery task, retryable):
    from .ai.reliability import FEATURE_QUALITY_SCORE, log_ai_call
    from .ai.claude_client import is_retryable_ai_error

    if not data:
        detail = api_err or "Unknown error"
        if is_retryable_ai_error(detail) and self.request.retries < self.max_retries:
            log_ai_call(feature=FEATURE_QUALITY_SCORE, submission_id=submission_id,
                        status=AIGenerationLog.Status.RETRYING, error_detail=detail,
                        attempt=self.request.retries + 1)
            raise self.retry(countdown=30 * (2 ** self.request.retries))
        log_ai_call(feature=FEATURE_QUALITY_SCORE, submission_id=submission_id,
                    status=AIGenerationLog.Status.FAILED, error_detail=detail,
                    attempt=self.request.retries + 1)
        _mark_quality_failed(submission, detail)
        return

Usage (synchronous view, no retry):
    log_ai_call(feature=FEATURE_NL_SEARCH, status=AIGenerationLog.Status.SUCCESS,
                model_tier="haiku", latency_ms=elapsed_ms)
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager

# Stable feature identifiers — used as AIGenerationLog.feature and shown on
# the reliability dashboard. Keep these short, snake_case, and stable: a
# rename breaks historical dashboard continuity (old rows keep the old name).
FEATURE_SUBMISSION_BRIEF     = "submission_brief"
FEATURE_QUALITY_SCORE        = "quality_score"
FEATURE_DUPLICATE_DETECTION  = "duplicate_detection"
FEATURE_RISK_ASSESSMENT      = "risk_assessment"
FEATURE_RECOMMENDED_OUTCOME  = "recommended_outcome"
FEATURE_NOTICE_OF_ALLEGATION = "notice_of_allegation"
FEATURE_OUTCOME_LETTER       = "outcome_letter"
FEATURE_SMART_REPORT         = "smart_report"
FEATURE_AGENDA_BLURB         = "agenda_blurb"
FEATURE_NL_SEARCH            = "nl_search"
FEATURE_CHECKLIST_AUTOFILL   = "checklist_autofill"
FEATURE_WORKLOAD_SUGGESTION  = "workload_suggestion"

ALL_FEATURES = (
    FEATURE_SUBMISSION_BRIEF,
    FEATURE_QUALITY_SCORE,
    FEATURE_DUPLICATE_DETECTION,
    FEATURE_RISK_ASSESSMENT,
    FEATURE_RECOMMENDED_OUTCOME,
    FEATURE_NOTICE_OF_ALLEGATION,
    FEATURE_OUTCOME_LETTER,
    FEATURE_SMART_REPORT,
    FEATURE_AGENDA_BLURB,
    FEATURE_NL_SEARCH,
    FEATURE_CHECKLIST_AUTOFILL,
    FEATURE_WORKLOAD_SUGGESTION,
)

_log = logging.getLogger("scdms.app")


def log_ai_call(
    *,
    feature: str,
    status: str,
    submission_id: int | None = None,
    error_detail: str = "",
    model_tier: str = "",
    latency_ms: int | None = None,
    attempt: int = 1,
) -> None:
    """Write one AIGenerationLog row. Never raises — a logging failure must
    never break the AI feature it's observing."""
    try:
        from ..models import AIGenerationLog

        AIGenerationLog.objects.create(
            feature=feature,
            submission_id=submission_id,
            status=status,
            error_detail=(error_detail or "")[:4000],
            model_tier=model_tier,
            latency_ms=latency_ms,
            attempt=attempt,
        )
    except Exception:
        _log.exception("AI_LOG_FAIL | feature=%s", feature)


@contextmanager
def timed_call():
    """Yields a callable returning elapsed milliseconds since the `with` block started.

    with timed_call() as elapsed:
        data, err = complete_json_with_error(...)
    log_ai_call(..., latency_ms=elapsed())
    """
    start = time.monotonic()
    yield lambda: int((time.monotonic() - start) * 1000)
