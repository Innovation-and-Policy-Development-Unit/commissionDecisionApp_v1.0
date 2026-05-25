import json
import logging
import os

from celery import shared_task
from django.conf import settings
from django.core.management import call_command

log = logging.getLogger("scdms.security")
app_log = logging.getLogger("scdms.app")


@shared_task
def run_backup():
    """Execute the backup_db management command via Celery."""
    log.info("BACKUP_SCHEDULED | starting scheduled backup")
    try:
        call_command("backup_db")
        log.info("BACKUP_SCHEDULED | completed successfully")
    except Exception as exc:
        log.error("BACKUP_SCHEDULED | failed: %s", exc)


SYSTEM_INSTRUCTION = """You are a highly efficient "Executive Secretary" and "Triage Officer" for a high-level Commission Board in Vanuatu. You are an expert in both Bislama and English.

Analyze the provided User Feedback. The feedback may be in Bislama, English, French, or a mix.

Translate: Convert any Bislama or French parts into professional English.

Summarize: Create a concise 1-sentence summary of the core issue.

Prioritize: Assign a severity (Low, Medium, High, Critical) based on the content (e.g., system crashes or legal disputes are Critical; UI suggestions are Low).

Categorize: Classify the feedback into one of: "Bug", "Feature Request", "Legal/Compliance", or "General Inquiry".

Bislama users often use 'mifala i no save...' to indicate a total system failure; treat this as Critical.

Your response must be in valid JSON format. Do not include any conversational text or Markdown formatting.

Output Schema:
{
"summary": "string",
"severity": "Low | Medium | High | Critical",
"category": "Bug | Feature Request | Legal/Compliance | General Inquiry",
"translated_text": "string"}"""


@shared_task
def process_feedback_with_ai(feedback_id: int):
    """Analyse a single FeedbackComment and persist the AI results."""
    from .models import FeedbackComment

    try:
        feedback = FeedbackComment.objects.get(id=feedback_id)
    except FeedbackComment.DoesNotExist:
        log.warning("AI_SKIP | FeedbackComment %s no longer exists", feedback_id)
        return

    if feedback.ai_processed:
        log.debug("AI_SKIP | FeedbackComment %s already processed", feedback_id)
        return

    from .ai.claude_client import complete_json

    user_input = f"User Feedback Description: {feedback.body}"

    try:
        from .ai.feature_registry import get_model_tier

        ai_data = complete_json(
            system=SYSTEM_INSTRUCTION,
            user=user_input,
            tier=get_model_tier("feedback_triage"),
        )
        if not ai_data or not isinstance(ai_data, dict):
            log.error("AI_FAIL | FeedbackComment %s | empty Claude response", feedback_id)
            return

        feedback.ai_summary = ai_data.get("summary", "")
        feedback.ai_severity = ai_data.get("severity", "")
        feedback.ai_category = ai_data.get("category", "")
        feedback.ai_translated_text = ai_data.get("translated_text", "")
        feedback.ai_processed = True
        feedback.save(update_fields=[
            "ai_summary", "ai_severity", "ai_category",
            "ai_translated_text", "ai_processed",
        ])

        log.info(
            "AI_COMPLETE | FeedbackComment %s | severity=%s category=%s",
            feedback_id, feedback.ai_severity, feedback.ai_category,
        )

    except Exception as exc:
        log.error("AI_FAIL | FeedbackComment %s | %s", feedback_id, exc)


# ── Submission executive brief (Secretariat) ──────────────────────────────────

SUBMISSION_BRIEF_STAGES = frozenset({
    "submitted",
    "secretary_review",
    "manager_checklist_review",
    "under_assessment",
    "forwarded_to_commission",
    "commission_sitting",
    "returned_for_clarification",
    "deferred_back_to_hr",
    "matters_arising",
})

SUBMISSION_BRIEF_INSTRUCTION = """You are the Executive Secretary to the Public Service Commission of Vanuatu.
A PSC Secretary must approve or route submissions without reading every attachment in full.

Read the submission context (metadata, form fields, checklist, documents list, workflow history).
Write a concise executive brief in professional English. If Bislama appears in source fields, explain meaning in English.

Output valid JSON only (no markdown fences):
{
  "executive_summary": "2-4 sentences: what is being asked and why it matters now",
  "key_ask": "One sentence stating the decision or action requested",
  "background": "2-3 sentences of relevant context",
  "documents": ["bullet — each key document on file"],
  "flags": ["bullet — risks, missing items, deadline or compliance concerns; empty array if none"],
  "secretariat_actions": ["bullet — what the Secretary should verify before approving/routing"]
}"""


def compute_submission_ai_context_key(submission) -> str:
    """Stable fingerprint — only changes when stage, documents, or checklist meaningfully change."""
    import hashlib

    from django.db.models import Count, Max

    from .models import SubmissionChecklistItem, SubmissionDocument

    doc_stats = SubmissionDocument.objects.filter(submission=submission).aggregate(
        n=Count("id"),
        latest=Max("uploaded_at"),
    )
    cl = SubmissionChecklistItem.objects.filter(submission=submission)
    cl_total = cl.count()
    cl_present = cl.filter(is_present=True).count()
    parts = [
        submission.current_stage or "",
        str(doc_stats["n"] or 0),
        doc_stats["latest"].isoformat() if doc_stats["latest"] else "",
        f"{cl_present}/{cl_total}",
        submission.form_type_code or "",
        str(submission.ai_package_ready),
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


def submission_brief_needs_refresh(submission) -> bool:
    if not submission.ai_brief_processed:
        return True
    key = compute_submission_ai_context_key(submission)
    return (submission.ai_brief_context_key or "") != key


def _mark_submission_brief_failed(submission, message: str) -> None:
    """Stop the UI spinner — record a readable error in the brief field."""
    from django.utils import timezone

    submission.ai_brief_summary = message.strip()
    submission.ai_brief_processed = True
    submission.ai_brief_generated_at = timezone.now()
    submission.ai_brief_context_key = compute_submission_ai_context_key(submission)
    submission.save(
        update_fields=[
            "ai_brief_summary",
            "ai_brief_processed",
            "ai_brief_generated_at",
            "ai_brief_context_key",
            "updated_at",
        ]
    )


def queue_submission_brief(
    submission_id: int,
    *,
    force: bool = False,
    sync_fallback: bool = False,
) -> None:
    """Queue via Celery when possible; sync only when explicitly requested (dev fallback)."""
    try:
        generate_submission_brief.delay(submission_id, force=force)
        return
    except Exception as exc:
        if not sync_fallback:
            app_log.warning(
                "BRIEF_QUEUE_SKIP | Submission %s | async only: %s",
                submission_id,
                exc,
            )
            return
        app_log.warning(
            "BRIEF_QUEUE_FALLBACK | Submission %s | running sync: %s",
            submission_id,
            exc,
        )
        generate_submission_brief(submission_id, force=force)


def build_submission_brief_context(submission) -> str:
    """Assemble structured text context for the AI brief."""
    from .models import (
        PSCForm37Data,
        PSCFormResponse,
        RestructureSubmissionData,
        SubmissionChecklistItem,
        SubmissionDocument,
        WorkflowEvent,
    )

    lines = [
        f"Reference: {submission.reference_number}",
        f"Title: {submission.title}",
        f"Form type: {submission.form_type_code or '—'}",
        f"Ministry: {submission.ministry.name if submission.ministry_id else '—'}",
        f"Department: {submission.department.name if submission.department_id else '—'}",
        f"Current stage: {submission.get_current_stage_display()} ({submission.current_stage})",
        f"Classification: {submission.get_classification_display()}",
        f"Internal (OPSC) submission: {submission.is_internal}",
        f"Routed unit: {submission.routed_unit or '—'}",
        f"Received: {submission.received_at}",
        f"Assessment deadline: {submission.assessment_deadline_at or '—'}",
        f"Overdue assessment: {submission.is_assessment_overdue}",
        f"DG endorsed by: {submission.dg_endorsed_by.username if submission.dg_endorsed_by_id else '—'}",
        f"Assigned principal: {submission.assigned_to.username if submission.assigned_to_id else '—'}",
        f"Submission notes: {submission.notes or '—'}",
    ]

    if submission.parent_submission_id:
        p = submission.parent_submission
        lines.append(f"Parent submission: {p.reference_number} — {p.title}")

    for doc in SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at"):
        desc = f" — {doc.description}" if doc.description else ""
        lines.append(f"Document: {doc.original_name}{desc}")
        if doc.extracted_text:
            snippet = doc.extracted_text[:500].replace("\n", " ")
            lines.append(f"  Extracted text (snippet): {snippet}…")
        facts = doc.extracted_facts or {}
        if isinstance(facts, dict) and facts.get("document_summary"):
            lines.append(f"  Document summary: {facts.get('document_summary')}")

    checklist = SubmissionChecklistItem.objects.filter(submission=submission).select_related("document")
    for item in checklist:
        label = item.document.name if item.document_id else "Item"
        status = "present" if item.is_present else "MISSING"
        lines.append(f"Checklist: {label} — {status}")

    for ev in WorkflowEvent.objects.filter(submission=submission).order_by("-created_at")[:8]:
        actor_name = (
            ev.actor.username
            if ev.actor_id
            else (ev.actor_label or "System")
        )
        lines.append(
            f"Workflow: {ev.previous_stage} → {ev.new_stage} by {actor_name}"
            + (f" | {ev.remarks}" if ev.remarks else "")
        )

    try:
        f37 = submission.form37_data
        lines.append("PSC Form 3-7 data:")
        for field in f37._meta.fields:
            if field.name in ("id", "submission", "created_at", "updated_at"):
                continue
            val = getattr(f37, field.name)
            if val not in (None, "", []):
                lines.append(f"  {field.name}: {val}")
    except PSCForm37Data.DoesNotExist:
        pass

    try:
        rd = submission.restructure_data
        lines.append(f"Restructure subject: {rd.subject_title or '—'}")
        if rd.background:
            lines.append(f"  background: {rd.background[:2000]}")
        if rd.proposal:
            lines.append(f"  proposal: {rd.proposal[:2000]}")
        if rd.recommendation:
            lines.append(f"  recommendation: {rd.recommendation[:1500]}")
        if rd.costing_rows:
            lines.append(f"  costing_rows: {json.dumps(rd.costing_rows)[:4000]}")
    except RestructureSubmissionData.DoesNotExist:
        pass

    try:
        resp = submission.dynamic_form_response
        data = resp.data or {}
        snippet = json.dumps(data, ensure_ascii=False, default=str)
        if len(snippet) > 6000:
            snippet = snippet[:6000] + "…"
        lines.append(f"Dynamic form ({resp.form_type.code}): {snippet}")
    except PSCFormResponse.DoesNotExist:
        pass

    return "\n".join(lines)


def build_submission_package_context(submission) -> str:
    """Context for A3 pre-submit validation (draft package completeness)."""
    from .submission_checklist import expected_documents_lines

    base = build_submission_brief_context(submission)
    extra = ["", "Expected checklist (ministry submissions):"]
    doc_lines = expected_documents_lines(submission)
    if doc_lines:
        extra.extend(doc_lines)
    else:
        extra.append(
            "- No required-document checklist applies "
            "(internal OPSC submission or attachment)."
        )
    return base + "\n" + "\n".join(extra)


def _format_submission_brief(data: dict) -> str:
    """Turn JSON brief into readable plain text for the UI."""
    parts = []
    if data.get("executive_summary"):
        parts.append(data["executive_summary"].strip())
    if data.get("key_ask"):
        parts.append(f"\nKey ask\n{data['key_ask'].strip()}")
    if data.get("background"):
        parts.append(f"\nBackground\n{data['background'].strip()}")

    def _bullets(title, items):
        if not items:
            return
        lines = [f"\n{title}"]
        for item in items:
            if item:
                lines.append(f"• {item}")
        parts.append("\n".join(lines))

    _bullets("Documents on file", data.get("documents") or [])
    _bullets("Flags for Secretariat", data.get("flags") or [])
    _bullets("Suggested actions", data.get("secretariat_actions") or [])
    return "\n".join(parts).strip()


@shared_task
def generate_submission_brief(submission_id: int, force: bool = False):
    """Generate an AI executive brief for PSC Secretary review."""
    from django.utils import timezone

    from .models import Submission

    try:
        submission = Submission.objects.select_related(
            "ministry", "department", "parent_submission", "assigned_to", "dg_endorsed_by",
        ).get(id=submission_id)
    except Submission.DoesNotExist:
        app_log.warning("BRIEF_SKIP | Submission %s not found", submission_id)
        return

    if not force and not submission_brief_needs_refresh(submission):
        return

    from .ai.claude_client import ai_enabled, complete_json_with_error, get_model_id

    if not ai_enabled():
        _mark_submission_brief_failed(
            submission,
            "AI brief could not be generated: ANTHROPIC_API_KEY is not configured on the server. "
            "Add the key to .env and restart the backend, then click Regenerate.",
        )
        app_log.error("BRIEF_FAIL | Submission %s | ANTHROPIC_API_KEY missing", submission_id)
        return

    context = build_submission_brief_context(submission)
    user_input = f"Submission context:\n\n{context}"

    try:
        from .ai.feature_registry import get_model_tier

        data, api_err = complete_json_with_error(
            system=SUBMISSION_BRIEF_INSTRUCTION,
            user=user_input,
            tier=get_model_tier("submission_executive_brief"),
            max_tokens=2048,
        )
        if not data:
            detail = api_err or "Unknown error"
            _mark_submission_brief_failed(
                submission,
                f"AI brief could not be generated: {detail} "
                f"(model={get_model_id('sonnet')}). Check .env and click Regenerate.",
            )
            app_log.error("BRIEF_FAIL | Submission %s | %s", submission_id, detail)
            return
        if not isinstance(data, dict):
            data = {"executive_summary": str(data)}

        submission.ai_brief_summary = _format_submission_brief(data)
        submission.ai_brief_processed = True
        submission.ai_brief_generated_at = timezone.now()
        submission.ai_brief_context_key = compute_submission_ai_context_key(submission)
        submission.save(update_fields=[
            "ai_brief_summary",
            "ai_brief_processed",
            "ai_brief_generated_at",
            "ai_brief_context_key",
            "updated_at",
        ])
        app_log.info("BRIEF_COMPLETE | Submission %s", submission_id)
    except Exception as exc:
        _mark_submission_brief_failed(
            submission,
            f"AI brief could not be generated: {exc}. "
            "Check ANTHROPIC_API_KEY, Celery worker logs, and try Regenerate.",
        )
        app_log.error("BRIEF_FAIL | Submission %s | %s", submission_id, exc)


# ── Meeting transcription (Whisper → Claude refine) ────────────────────────────


def _meeting_agenda_block(meeting) -> str:
    lines = []
    for item in meeting.agenda_items.select_related("submission").order_by("sequence"):
        sub = item.submission
        ref = getattr(sub, "reference_number", "") if sub else ""
        title = getattr(sub, "title", "") if sub else ""
        lines.append(f"- {item.sequence}. {ref} — {title}")
    return "\n".join(lines) if lines else "(No agenda items on record)"


def _meeting_info_block(meeting) -> str:
    return (
        f"Reference: {meeting.reference_number}\n"
        f"Title: {meeting.title}\n"
        f"Date: {meeting.date} at {meeting.time}\n"
        f"Venue: {meeting.venue}\n"
        f"Type: {meeting.get_type_display()}"
    )


@shared_task(bind=True)
def run_meeting_transcription_pipeline(self, meeting_id: int):
    """
    Whisper transcription of meeting recording, then Claude cleanup for Bislama/ASR errors.
    """
    from django.utils import timezone

    from .ai.transcript_refine import refine_transcript_text
    from .ai.whisper_client import transcribe_audio_file, whisper_enabled
    from .models import Meeting, MeetingTranscript, TranscriptSource, TranscriptionStatus

    try:
        meeting = Meeting.objects.prefetch_related("agenda_items__submission").get(id=meeting_id)
    except Meeting.DoesNotExist:
        app_log.warning("TRANSCRIBE_FAIL | Meeting %s not found", meeting_id)
        return

    transcript, _ = MeetingTranscript.objects.get_or_create(meeting=meeting)

    def _save_status(status: str, *, error: str = "", extra_fields=None):
        transcript.transcription_status = status
        transcript.transcription_error = (error or "")[:2000]
        fields = ["transcription_status", "transcription_error"]
        if extra_fields:
            fields.extend(extra_fields)
        transcript.save(update_fields=fields)

    audio_name = (transcript.audio_file or "").strip()
    if not audio_name:
        _save_status(TranscriptionStatus.FAILED, error="No recording linked. Upload audio on Meeting Capture first.")
        return

    audio_path = os.path.join(settings.MEDIA_ROOT, "recordings", audio_name)
    if not os.path.isfile(audio_path):
        _save_status(
            TranscriptionStatus.FAILED,
            error=f"Recording file missing on server: {audio_name}",
        )
        return

    if not whisper_enabled():
        _save_status(
            TranscriptionStatus.FAILED,
            error="OPENAI_API_KEY is not configured on the API server.",
        )
        return

    _save_status(TranscriptionStatus.TRANSCRIBING)
    app_log.info("TRANSCRIBE_START | meeting=%s file=%s", meeting_id, audio_name)

    whisper_text, whisper_err = transcribe_audio_file(audio_path)
    if whisper_err or not whisper_text:
        _save_status(
            TranscriptionStatus.FAILED,
            error=whisper_err or "Whisper returned empty text.",
        )
        app_log.error("TRANSCRIBE_WHISPER_FAIL | meeting=%s | %s", meeting_id, whisper_err)
        return

    structured = dict(transcript.structured_data or {})
    structured["whisper_verbatim"] = whisper_text
    structured["whisper_at"] = timezone.now().isoformat()
    transcript.structured_data = structured
    transcript.save(update_fields=["structured_data"])

    _save_status(TranscriptionStatus.REFINING)
    refined, refine_err = refine_transcript_text(
        meeting_info=_meeting_info_block(meeting),
        agenda_block=_meeting_agenda_block(meeting),
        whisper_text=whisper_text,
    )

    if refine_err or not (refined or "").strip():
        app_log.warning(
            "TRANSCRIBE_REFINE_FALLBACK | meeting=%s | %s",
            meeting_id,
            refine_err or "empty Claude response",
        )
        transcript.raw_text = whisper_text
        structured["claude_refine_error"] = refine_err or "empty response"
    else:
        transcript.raw_text = refined.strip()
        structured["claude_refined_at"] = timezone.now().isoformat()
        structured.pop("claude_refine_error", None)

    transcript.structured_data = structured
    transcript.source = TranscriptSource.AI_WHISPER
    transcript.ai_processed = True
    transcript.processed_at = timezone.now()
    transcript.transcription_status = TranscriptionStatus.READY
    transcript.transcription_error = ""
    transcript.save(
        update_fields=[
            "raw_text",
            "structured_data",
            "source",
            "ai_processed",
            "processed_at",
            "transcription_status",
            "transcription_error",
        ]
    )
    app_log.info(
        "TRANSCRIBE_OK | meeting=%s chars=%s",
        meeting_id,
        len(transcript.raw_text or ""),
    )


@shared_task
def transcribe_meeting_recording(meeting_id: int, audio_path: str = ""):
    """Legacy entry point — runs Whisper + Claude refine pipeline."""
    run_meeting_transcription_pipeline.delay(meeting_id)


# ── Minutes drafting from transcript ─────────────────────────────────────────


MINUTES_DRAFT_PROMPT = """You are a Commission Secretary in Vanuatu. Draft formal Commission minutes from the meeting transcript and agenda items below.

Meeting information:
{meeting_info}

Agenda items:
{agenda_items}

Transcript:
{transcript}

Draft structured minutes in valid JSON with this exact schema:
{{
  "opening": "string - meeting opened at time, prayer, welcome remarks",
  "confirmation_previous_minutes": "string - confirmation status of previous meeting minutes",
  "agenda_items": [
    {{
      "sequence": 1,
      "submission_ref": "string",
      "title": "string",
      "discussion": "string - 2-3 sentence summary of discussion in English, with key Bislama phrases preserved in quotes where notable",
      "decision": "string - formal resolution wording (APPROVED/REJECTED/DEFERRED/RETURNED/TABLED)",
      "decision_type": "approved|rejected|deferred|returned|tabled",
      "action_items": [
        {{"action": "string", "responsible": "string", "deadline": "string or null"}}
      ]
    }}
  ],
  "any_other_business": "string",
  "closing": "string - closing remarks, next meeting reference",
  "next_meeting_date": "string or null"
}}

If a Bislama phrase captures the discussion better than English, include both (e.g. "The Commission considered the matter (Komisin i lukluk gud long toktok ia)...").
Output ONLY valid JSON. No conversational text, no markdown formatting."""


@shared_task
def draft_minutes_from_transcript(meeting_id: int, user_id: int = None):
    """Draft structured minutes from meeting transcript using Claude."""
    from django.contrib.auth.models import User

    from .models import AgendaItem, Meeting, MeetingTranscript, Minutes, MinutesStatus

    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        app_log.warning("MINUTES_SKIP | Meeting %s not found", meeting_id)
        return

    try:
        transcript = meeting.transcript
    except MeetingTranscript.DoesNotExist:
        app_log.warning("MINUTES_SKIP | No transcript for meeting %s", meeting_id)
        return

    if not transcript.ai_processed or not transcript.raw_text:
        app_log.warning("MINUTES_SKIP | Transcript not yet processed for meeting %s", meeting_id)
        return

    from .ai.claude_client import complete_json

    agenda_qs = AgendaItem.objects.filter(meeting=meeting).select_related("submission")
    agenda_lines = []
    for item in agenda_qs:
        agenda_lines.append(
            f"Item {item.sequence}: {item.submission.reference_number} — {item.submission.title}"
        )

    meeting_info = (
        f"Reference: {meeting.reference_number}\n"
        f"Title: {meeting.title}\n"
        f"Date: {meeting.date}\n"
        f"Venue: {meeting.venue}\n"
        f"Type: {meeting.type}"
    )

    prompt = MINUTES_DRAFT_PROMPT.format(
        meeting_info=meeting_info,
        agenda_items="\n".join(agenda_lines) if agenda_lines else "No agenda items recorded.",
        transcript=transcript.raw_text[:50000],
    )

    try:
        from .ai.feature_registry import get_model_tier

        minutes_data = complete_json(
            system="You draft formal Vanuatu Public Service Commission minutes.",
            user=prompt,
            tier=get_model_tier("minutes_draft"),
            max_tokens=8192,
        )
        if not minutes_data:
            app_log.error("MINUTES_FAIL | Meeting %s | empty Claude response", meeting_id)
            return

        creator = None
        if user_id:
            try:
                creator = User.objects.get(id=user_id)
            except User.DoesNotExist:
                pass

        minutes_obj, created = Minutes.objects.get_or_create(
            meeting=meeting,
            defaults={
                "status": MinutesStatus.DRAFT,
                "content": minutes_data,
                "created_by": creator or User.objects.filter(is_superuser=True).first(),
            },
        )
        if not created:
            minutes_obj.content = minutes_data
            minutes_obj.save(update_fields=["content"])

        app_log.info(
            "MINUTES_DRAFT_%s | Meeting %s | items=%d",
            "CREATED" if created else "UPDATED",
            meeting_id, len(minutes_data.get("agenda_items", [])),
        )

    except Exception as exc:
        app_log.error("MINUTES_FAIL | Meeting %s | %s", meeting_id, exc)


# ── Decision extraction from minutes ─────────────────────────────────────────


DECISION_EXTRACT_PROMPT = """You are a Commission Secretary in Vanuatu. Extract formal decisions from these minutes.
For each agenda item that has a decision, output the structured decision data.

Minutes content:
{minutes_content}

Output valid JSON array:
[
  {{
    "submission_ref": "string - reference number",
    "submission_title": "string",
    "outcome": "APPROVED|REJECTED|DEFERRED|RETURNED|TABLED",
    "remarks": "string - any conditions or remarks from the commission",
    "next_stage": "string - the workflow stage slug this submission should advance to",
    "action_items": [
      {{"action": "string", "responsible": "string", "deadline": "string or null"}}
    ]
  }}
]

Map outcomes to workflow stages:
- APPROVED -> "approved"
- REJECTED -> "rejected"
- DEFERRED -> "deferred_back_to_hr"
- RETURNED -> "returned"
- TABLED -> "tabled"

Output ONLY valid JSON. No conversational text, no markdown formatting."""


@shared_task
def extract_decisions_from_minutes(meeting_id: int):
    """Extract formal decisions from minutes content using Claude."""
    from .models import Meeting

    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        app_log.warning("DECISION_SKIP | Meeting %s not found", meeting_id)
        return

    try:
        minutes = meeting.minutes
    except Exception:
        app_log.warning("DECISION_SKIP | No minutes for meeting %s", meeting_id)
        return

    if not minutes.content:
        app_log.warning("DECISION_SKIP | Minutes empty for meeting %s", meeting_id)
        return

    from .ai.claude_client import complete_json

    prompt = DECISION_EXTRACT_PROMPT.format(
        minutes_content=json.dumps(minutes.content, indent=2),
    )

    try:
        from .ai.feature_registry import get_model_tier

        decisions = complete_json(
            system="You extract structured Commission decisions from minutes.",
            user=prompt,
            tier=get_model_tier("decision_extract"),
            max_tokens=4096,
        )
        if decisions is None:
            app_log.error("DECISION_EXTRACT_FAIL | Meeting %s | empty Claude response", meeting_id)
            return

        minutes.content["extracted_decisions"] = decisions
        minutes.save(update_fields=["content"])

        app_log.info(
            "DECISION_EXTRACT | Meeting %s | decisions=%d",
            meeting_id, len(decisions),
        )

    except Exception as exc:
        app_log.error("DECISION_EXTRACT_FAIL | Meeting %s | %s", meeting_id, exc)


# ── Scheduled email dispatch (SystemSetting cron) ─────────────────────────────


@shared_task
def send_scheduled_emails():
    """Celery Beat: flush queued notification emails via Django SMTP."""
    from .email_dispatch import dispatch_pending_emails

    log.info("EMAIL_CRON | starting scheduled email dispatch")
    stats = dispatch_pending_emails()
    log.info("EMAIL_CRON | finished | %s", stats)
    return stats


# ── Due-date notifications ────────────────────────────────────────────────────


NOTIFY_DAYS_BEFORE = 3


@shared_task
def notify_approaching_due_dates():
    """Send in-app notifications for tasks/subtasks with due dates within NOTIFY_DAYS_BEFORE days."""
    from datetime import date, timedelta
    from .models import Notification, CommissionTask, CommissionSubTask, Meeting

    today = date.today()
    alert_from = today
    alert_to = today + timedelta(days=NOTIFY_DAYS_BEFORE)

    tasks_qs = CommissionTask.objects.filter(
        due_date__gte=alert_from,
        due_date__lte=alert_to,
        due_date_notified=False,
        status__in=["open", "in_progress"],
    ).select_related("assigned_manager").prefetch_related("assigned_staff_m2m")

    notified_task_ids = []
    for task in tasks_qs:
        recipients = {task.assigned_manager}
        for staff in task.assigned_staff_m2m.all():
            recipients.add(staff)
        if task.assigned_staff:
            recipients.add(task.assigned_staff)

        from .email_notify import notify_task_due_soon

        for user in recipients:
            if not user or not user.is_active:
                continue
            Notification.objects.create(
                recipient=user,
                channel=Notification.Channel.IN_APP,
                title=f"Task due soon: {task.title}",
                body=(
                    f"Task '{task.title}' (ref: {task.submission.reference_number}) "
                    f"is due on {task.due_date}. "
                    f"Only {NOTIFY_DAYS_BEFORE} days remaining."
                ),
                submission_id=task.submission_id,
            )
            notify_task_due_soon(task, user, days_remaining=NOTIFY_DAYS_BEFORE)

        task.due_date_notified = True
        task.save(update_fields=["due_date_notified"])
        notified_task_ids.append(task.id)

    if notified_task_ids:
        app_log.info(
            "DUE_DATE_NOTIFY | Tasks notified: %s",
            ", ".join(str(i) for i in notified_task_ids),
        )

    # Subtasks
    subtask_qs = CommissionSubTask.objects.filter(
        due_date__gte=alert_from,
        due_date__lte=alert_to,
        due_date_notified=False,
        status__in=["open", "in_progress"],
    ).prefetch_related("assigned_staff")

    notified_subtask_ids = []
    for sub in subtask_qs:
        recipients = set(sub.assigned_staff.all())
        from .email_notify import notify_subtask_due_soon

        for user in recipients:
            if not user or not user.is_active:
                continue
            Notification.objects.create(
                recipient=user,
                channel=Notification.Channel.IN_APP,
                title=f"Subtask due soon: {sub.title}",
                body=(
                    f"Subtask '{sub.title}' (task: {sub.task.title}) "
                    f"is due on {sub.due_date}. "
                    f"Only {NOTIFY_DAYS_BEFORE} days remaining."
                ),
            )
            notify_subtask_due_soon(sub, user, days_remaining=NOTIFY_DAYS_BEFORE)
        sub.due_date_notified = True
        sub.save(update_fields=["due_date_notified"])
        notified_subtask_ids.append(sub.id)

    if notified_subtask_ids:
        app_log.info(
            "DUE_DATE_NOTIFY | Subtasks notified: %s",
            ", ".join(str(i) for i in notified_subtask_ids),
        )

    total = len(notified_task_ids) + len(notified_subtask_ids)
    app_log.info("DUE_DATE_NOTIFY | Complete: %d items notified", total)
    return total


# ── E1: OCR + key facts from scanned documents ───────────────────────────────


def queue_document_extraction(document_id: int) -> None:
    try:
        extract_document_facts.delay(document_id)
    except Exception as exc:
        app_log.warning(
            "DOC_EXTRACT_QUEUE_FALLBACK | doc=%s | sync: %s",
            document_id,
            exc,
        )
        extract_document_facts(document_id)


@shared_task
def extract_document_facts(document_id: int):
    """OCR / key-facts extraction for a submission document (E1)."""
    from django.utils import timezone

    from .ai.document_extraction import run_document_extraction
    from .models import DocumentOcrStatus, SubmissionDocument

    try:
        doc = SubmissionDocument.objects.select_related("submission").get(id=document_id)
    except SubmissionDocument.DoesNotExist:
        app_log.warning("DOC_EXTRACT_SKIP | document %s missing", document_id)
        return

    doc.ocr_status = DocumentOcrStatus.PROCESSING
    doc.ocr_error = ""
    doc.save(update_fields=["ocr_status", "ocr_error"])

    from .media_access import materialize_file_field

    try:
        with materialize_file_field(doc.file) as path:
            result, err = run_document_extraction(
                file_path=path,
                original_name=doc.original_name,
                description=doc.description,
            )
    except FileNotFoundError as exc:
        doc.ocr_status = DocumentOcrStatus.FAILED
        doc.ocr_error = str(exc)
        doc.ocr_processed_at = timezone.now()
        doc.save(update_fields=["ocr_status", "ocr_error", "ocr_processed_at"])
        return

    if err or not result:
        doc.ocr_status = DocumentOcrStatus.FAILED
        doc.ocr_error = err or "Extraction returned no data"
        doc.ocr_processed_at = timezone.now()
        doc.save(update_fields=["ocr_status", "ocr_error", "ocr_processed_at"])
        app_log.error("DOC_EXTRACT_FAIL | doc=%s | %s", document_id, doc.ocr_error)
        return

    doc.extracted_text = (result.get("extracted_text") or "")[:500000]
    facts = result.get("key_facts") or {}
    if result.get("document_summary"):
        facts = {**facts, "document_summary": result["document_summary"]}
    doc.extracted_facts = facts
    doc.ocr_status = DocumentOcrStatus.COMPLETED
    doc.ocr_processed_at = timezone.now()
    doc.ocr_error = ""
    doc.save(
        update_fields=[
            "extracted_text",
            "extracted_facts",
            "ocr_status",
            "ocr_processed_at",
            "ocr_error",
        ]
    )
    app_log.info("DOC_EXTRACT_OK | doc=%s | chars=%d", document_id, len(doc.extracted_text))
    queue_document_classification(document_id, force=True)


# ── A2: Document type classification (Haiku) ─────────────────────────────────


def queue_document_classification(document_id: int, *, force: bool = False) -> None:
    try:
        classify_submission_document.delay(document_id, force=force)
    except Exception as exc:
        app_log.warning(
            "DOC_CLASSIFY_QUEUE_FALLBACK | doc=%s | %s",
            document_id,
            exc,
        )
        classify_submission_document(document_id, force=force)


@shared_task
def classify_submission_document(document_id: int, *, force: bool = False):
    from django.utils import timezone

    from .ai.document_classification import classify_document_from_signals
    from .models import DocumentClassificationType, SubmissionDocument

    try:
        doc = SubmissionDocument.objects.select_related("submission").get(id=document_id)
    except SubmissionDocument.DoesNotExist:
        app_log.warning("DOC_CLASSIFY_SKIP | document %s missing", document_id)
        return

    if (
        not force
        and doc.document_classified_at
        and doc.document_type != DocumentClassificationType.UNCLASSIFIED
    ):
        return

    result = classify_document_from_signals(
        original_name=doc.original_name,
        description=doc.description,
        extracted_text=doc.extracted_text or "",
        extracted_facts=doc.extracted_facts if isinstance(doc.extracted_facts, dict) else None,
    )
    doc.document_type = result.get("document_type") or DocumentClassificationType.UNCLASSIFIED
    doc.document_type_confidence = result.get("confidence")
    doc.document_type_note = (result.get("note") or "")[:255]
    doc.document_classified_at = timezone.now()
    doc.save(
        update_fields=[
            "document_type",
            "document_type_confidence",
            "document_type_note",
            "document_classified_at",
        ]
    )
    app_log.info(
        "DOC_CLASSIFY_OK | doc=%s | type=%s conf=%s",
        document_id,
        doc.document_type,
        doc.document_type_confidence,
    )


# ── C2: Commission sitting briefing pack ───────────────────────────────────


def queue_meeting_briefing_pack(pack_id: int) -> None:
    try:
        generate_meeting_briefing_pack.delay(pack_id)
    except Exception as exc:
        app_log.warning("MEETING_BRIEFING_QUEUE_FALLBACK | pack=%s | %s", pack_id, exc)
        generate_meeting_briefing_pack(pack_id)


@shared_task
def generate_meeting_briefing_pack(pack_id: int):
    from .reports.meeting_briefing import run_meeting_briefing_generation

    run_meeting_briefing_generation(pack_id)


# ── F2: AI-drafted deadline reminder emails (Haiku) ──────────────────────────

DEADLINE_REMINDER_DAYS_BEFORE = 5

DEADLINE_REMINDER_PROMPT = """You are drafting a formal reminder email for the Vanuatu Public Service Commission Secretariat.

Write a personalised email to the recipient about an approaching case deadline.
Tone: professional, clear, respectful. Use English; you may note Bislama terms if in context.

Output valid JSON only:
{{
  "subject": "email subject line with case reference",
  "body": "full email body with greeting, paragraphs, and sign-off from PSC Secretariat",
  "outstanding_summary": "1-2 sentences on what is still required",
  "consequence_note": "1 sentence on consequence of missing the deadline under PSC processes"
}}

Case context:
{case_context}

Recipient:
{recipient_context}
"""


def _submission_deadline_recipients(submission):
    """Ministry HR contacts, assigned principal, and DG endorser for this case."""
    from django.contrib.auth.models import User

    from .models import Profile, Role

    seen_emails = set()
    recipients = []

    def add_user(user, role_label):
        if not user or not user.is_active:
            return
        email = (user.email or "").strip()
        if not email or email in seen_emails:
            return
        seen_emails.add(email)
        recipients.append((user, email, role_label))

    if submission.assigned_to_id:
        add_user(submission.assigned_to, "assigned_principal")

    if submission.dg_endorsed_by_id:
        add_user(submission.dg_endorsed_by, "dg_endorser")

    if submission.ministry_id:
        hr_users = User.objects.filter(
            is_active=True,
            psc_profile__role=Role.MINISTRY_HR,
            psc_profile__ministry_id=submission.ministry_id,
        ).select_related("psc_profile")
        for u in hr_users:
            add_user(u, "ministry_hr")

    return recipients


def _build_deadline_case_context(submission) -> str:
    from .models import SubmissionChecklistItem, WorkflowStage

    lines = [
        f"Reference: {submission.reference_number}",
        f"Title: {submission.title}",
        f"Ministry: {submission.ministry.name if submission.ministry_id else '—'}",
        f"Current stage: {submission.get_current_stage_display()} ({submission.current_stage})",
        f"Assessment deadline: {submission.assessment_deadline_at}",
        f"Overdue: {submission.is_assessment_overdue}",
    ]
    missing = SubmissionChecklistItem.objects.filter(
        submission=submission, is_present=False,
    ).select_related("document")[:15]
    if missing:
        lines.append("Missing checklist items:")
        for item in missing:
            label = item.document.name if item.document_id else "Item"
            lines.append(f"  - {label}")
    if submission.current_stage == WorkflowStage.RETURNED_FOR_CLARIFICATION:
        lines.append("Outstanding: ministry must resubmit clarification/documents.")
    return "\n".join(lines)


@shared_task
def draft_submission_deadline_reminders():
    """Daily: draft personalised deadline emails for cases nearing assessment deadline (F2)."""
    from datetime import timedelta

    from django.utils import timezone

    from .ai.claude_client import complete_json_with_error
    from .ai.feature_registry import FEATURE_MODEL_TIER
    from .email_notify import user_recipient_context
    from .models import DeadlineReminderDraft, Submission, WorkflowStage

    now = timezone.now()
    window_end = now + timedelta(days=DEADLINE_REMINDER_DAYS_BEFORE)

    submissions = Submission.objects.filter(
        current_stage__in=[
            WorkflowStage.UNDER_ASSESSMENT,
            WorkflowStage.RETURNED_FOR_CLARIFICATION,
            WorkflowStage.SECRETARY_REVIEW,
            WorkflowStage.MANAGER_CHECKLIST_REVIEW,
        ],
        assessment_deadline_at__isnull=False,
        assessment_deadline_at__gte=now,
        assessment_deadline_at__lte=window_end,
    ).select_related("ministry", "assigned_to", "dg_endorsed_by")

    tier = FEATURE_MODEL_TIER.get("F2_deadline_notifications", "haiku")
    created = 0

    for submission in submissions:
        case_ctx = _build_deadline_case_context(submission)
        for user, email, role_label in _submission_deadline_recipients(submission):
            exists = DeadlineReminderDraft.objects.filter(
                submission=submission,
                recipient_email=email,
                stage=submission.current_stage,
                deadline_at=submission.assessment_deadline_at,
                status=DeadlineReminderDraft.Status.DRAFT,
            ).exists()
            if exists:
                continue

            recip_ctx = user_recipient_context(user)
            recip_ctx["role"] = role_label
            prompt = DEADLINE_REMINDER_PROMPT.format(
                case_context=case_ctx,
                recipient_context="\n".join(f"{k}: {v}" for k, v in recip_ctx.items()),
            )

            data, err = complete_json_with_error(
                system="You draft PSC Secretariat reminder emails.",
                user=prompt,
                tier=tier,
                max_tokens=2048,
            )
            if err or not data:
                app_log.warning(
                    "DEADLINE_DRAFT_FAIL | sub=%s | %s | %s",
                    submission.id,
                    email,
                    err,
                )
                continue

            subject = (data.get("subject") or "")[:500]
            body = data.get("body") or ""
            subject_bi = ""
            body_bi = ""
            try:
                from .ai.bilingual_comms import enrich_deadline_draft_bilingual

                bi = enrich_deadline_draft_bilingual(
                    subject=subject, body=body, case_context=case_ctx
                )
                body_bi = bi.get("body_bi", "")[:10000]
                subject_bi = (bi.get("subject_bi") or "")[:500]
            except Exception as exc:
                app_log.warning("DEADLINE_BI_SKIP | %s", exc)

            DeadlineReminderDraft.objects.create(
                submission=submission,
                recipient_user=user,
                recipient_email=email,
                recipient_name=recip_ctx.get("full_name") or email,
                recipient_role=role_label,
                ministry=submission.ministry,
                stage=submission.current_stage,
                deadline_at=submission.assessment_deadline_at,
                outstanding_summary=data.get("outstanding_summary", ""),
                consequence_note=data.get("consequence_note", ""),
                subject=subject,
                body=body,
                subject_bi=subject_bi,
                body_bi=body_bi,
            )
            created += 1

    app_log.info("DEADLINE_DRAFT_COMPLETE | created=%d", created)
    return created


# ── C4: Meeting minutes → action register (Haiku) ───────────────────────────

ACTION_ITEMS_PROMPT = """You are a Commission Secretary in Vanuatu. Extract a structured action register from meeting minutes text.

Minutes:
{minutes_text}

Output valid JSON only:
{{
  "decisions": [
    {{"decision": "string", "context": "string"}}
  ],
  "action_items": [
    {{
      "action": "string",
      "owner": "string",
      "deadline": "string or null",
      "priority": "high|medium|low",
      "source_section": "agenda item ref or AOB"
    }}
  ],
  "deferred_matters": [
    {{"matter": "string", "reason": "string", "next_step": "string"}}
  ],
  "follow_up_questions": [
    {{"question": "string", "directed_to": "string"}}
  ],
  "summary": "2-3 sentence overview of actions required"
}}

Include every action item with a clear owner where stated. Output ONLY valid JSON."""


@shared_task
def extract_action_items_from_minutes(meeting_id: int, minutes_text: str | None = None):
    """Extract action register from minutes content or pasted text (C4, Haiku)."""
    from .models import Meeting

    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        app_log.warning("ACTION_ITEMS_SKIP | meeting %s not found", meeting_id)
        return

    text = (minutes_text or "").strip()
    if not text:
        try:
            minutes = meeting.minutes
            if minutes.content:
                import json as _json

                text = _json.dumps(minutes.content, indent=2)
        except Exception:
            pass
    if not text:
        try:
            text = meeting.transcript.raw_text or ""
        except Exception:
            pass

    if not text.strip():
        app_log.warning("ACTION_ITEMS_SKIP | meeting %s | no minutes text", meeting_id)
        return

    from .ai.claude_client import complete_json_with_error
    from .ai.feature_registry import FEATURE_MODEL_TIER

    tier = FEATURE_MODEL_TIER.get("C4_minutes_action_items", "haiku")
    data, err = complete_json_with_error(
        system="You extract Commission meeting action registers.",
        user=ACTION_ITEMS_PROMPT.format(minutes_text=text[:80000]),
        tier=tier,
        max_tokens=8192,
    )
    if err or not data:
        app_log.error("ACTION_ITEMS_FAIL | meeting %s | %s", meeting_id, err)
        return

    from django.contrib.auth.models import User

    from .models import Minutes

    minutes_obj, _ = Minutes.objects.get_or_create(
        meeting=meeting,
        defaults={
            "content": {},
            "created_by": User.objects.filter(is_superuser=True).first(),
        },
    )
    content = minutes_obj.content if isinstance(minutes_obj.content, dict) else {}
    content["action_register"] = data
    minutes_obj.content = content
    minutes_obj.save(update_fields=["content"])

    app_log.info(
        "ACTION_ITEMS_OK | meeting %s | actions=%d",
        meeting_id,
        len(data.get("action_items") or []),
    )


@shared_task
def generate_decision_register_report(report_id: int):
    """Render Quarto HTML for a DecisionRegisterReport."""
    from .reports.decision_register import run_report_generation

    run_report_generation(report_id)


def queue_decision_register_report(report_id: int) -> None:
    try:
        generate_decision_register_report.delay(report_id)
    except Exception as exc:
        app_log.warning(
            "REGISTER_REPORT_QUEUE_FALLBACK | id=%s | %s",
            report_id,
            exc,
        )
        generate_decision_register_report(report_id)


# ── Submission quality score (A5) ─────────────────────────────────────────────

QUALITY_SCORE_STAGES = frozenset({
    "submitted",
    "manager_checklist_review",
    "secretary_review",
    "under_assessment",
    "compliance_under_review",
})


def submission_quality_needs_refresh(submission) -> bool:
    if not submission.ai_quality_processed:
        return True
    key = compute_submission_ai_context_key(submission)
    return (submission.ai_quality_context_key or "") != key


def _mark_submission_quality_failed(submission, message: str) -> None:
    from django.utils import timezone

    submission.ai_quality_explanation = message.strip()[:2000]
    submission.ai_quality_processed = True
    submission.ai_quality_generated_at = timezone.now()
    submission.ai_quality_context_key = compute_submission_ai_context_key(submission)
    submission.save(
        update_fields=[
            "ai_quality_explanation",
            "ai_quality_processed",
            "ai_quality_generated_at",
            "ai_quality_context_key",
            "updated_at",
        ]
    )


@shared_task
def score_submission_quality(submission_id: int, *, force: bool = False):
    """Assign AI quality score (0–100) for compliance / unit review triage."""
    from django.utils import timezone

    from .models import Submission

    try:
        submission = Submission.objects.select_related(
            "ministry", "department", "created_by", "dg_endorsed_by", "assigned_to",
        ).get(pk=submission_id)
    except Submission.DoesNotExist:
        app_log.warning("QUALITY_SKIP | Submission %s not found", submission_id)
        return

    if submission.current_stage == "draft":
        return

    if not force and not submission_quality_needs_refresh(submission):
        return

    from .ai.submission_quality_score import score_submission_from_context

    context = build_submission_brief_context(submission)
    result, err = score_submission_from_context(context)
    if not result:
        _mark_submission_quality_failed(
            submission,
            err or "Quality score could not be generated. Check ANTHROPIC_API_KEY and try again.",
        )
        app_log.error("QUALITY_FAIL | Submission %s | %s", submission_id, err)
        return

    submission.ai_quality_score = result["score"]
    submission.ai_quality_explanation = result["explanation"]
    submission.ai_quality_dimensions = result.get("dimensions") or {}
    submission.ai_quality_review_effort = result.get("review_effort", "")
    submission.ai_quality_processed = True
    submission.ai_quality_generated_at = timezone.now()
    submission.ai_quality_context_key = compute_submission_ai_context_key(submission)
    submission.save(
        update_fields=[
            "ai_quality_score",
            "ai_quality_explanation",
            "ai_quality_dimensions",
            "ai_quality_review_effort",
            "ai_quality_processed",
            "ai_quality_generated_at",
            "ai_quality_context_key",
            "updated_at",
        ]
    )
    app_log.info(
        "QUALITY_OK | Submission %s | score=%s effort=%s",
        submission_id,
        submission.ai_quality_score,
        submission.ai_quality_review_effort,
    )


def queue_submission_quality_score(submission_id: int, *, force: bool = False) -> None:
    try:
        score_submission_quality.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning(
            "QUALITY_QUEUE_FALLBACK | Submission %s | %s",
            submission_id,
            exc,
        )
        score_submission_quality(submission_id, force=force)


def package_validation_needs_refresh(submission) -> bool:
    if not submission.ai_package_processed:
        return True
    if submission.ai_package_generated_at and submission.updated_at > submission.ai_package_generated_at:
        return True
    return False


def queue_submission_package_validation(submission_id: int, *, force: bool = False) -> None:
    try:
        validate_submission_package_task.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning("PACKAGE_VALIDATE_QUEUE_FALLBACK | %s | %s", submission_id, exc)
        validate_submission_package_task(submission_id, force=force)


@shared_task
def validate_submission_package_task(submission_id: int, *, force: bool = False):
    validate_submission_package_sync(submission_id, force=force)


def validate_submission_package_sync(submission_id: int, *, force: bool = False) -> dict:
    """
    Run A3 package validation synchronously (draft pre-submit).
    Returns {ready, summary, gaps} and persists on the submission.
    """
    from .models import Submission
    from .ai.submission_package_validation import (
        persist_package_validation,
        validate_package_from_context,
    )

    submission = Submission.objects.select_related(
        "ministry", "department", "created_by", "dg_endorsed_by", "form_category",
    ).get(pk=submission_id)

    if submission.current_stage != "draft":
        return {
            "ready": submission.ai_package_ready,
            "summary": submission.ai_package_summary or "",
            "gaps": submission.ai_package_gaps or [],
        }

    if not force and not package_validation_needs_refresh(submission):
        return {
            "ready": submission.ai_package_ready,
            "summary": submission.ai_package_summary or "",
            "gaps": submission.ai_package_gaps or [],
        }

    context = build_submission_package_context(submission)
    result, err = validate_package_from_context(submission, context)
    if not result:
        result = {
            "ready": False,
            "summary": err or "Package validation failed.",
            "gaps": [{
                "severity": "warning",
                "category": "other",
                "message": err or "Package validation could not be completed.",
            }],
        }

    persist_package_validation(submission, result)
    app_log.info(
        "PACKAGE_VALIDATE | Submission %s | ready=%s gaps=%s",
        submission_id,
        result.get("ready"),
        len(result.get("gaps") or []),
    )
    return result


# ── A6: Policy guardrail (pre-submit) ────────────────────────────────────────


def compute_policy_guardrail_context_key(submission) -> str:
    import hashlib
    import json

    from .models import PSCFormResponse

    parts = [
        submission.form_type_code or "",
        str(submission.form_category_id or ""),
        str(submission.ministry_id or ""),
    ]
    try:
        data = submission.dynamic_form_response.data or {}
        snippet = json.dumps(data, ensure_ascii=False, default=str, sort_keys=True)
        parts.append(hashlib.sha256(snippet.encode()).hexdigest()[:16])
    except PSCFormResponse.DoesNotExist:
        parts.append("no_form")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


def policy_guardrail_needs_refresh(submission) -> bool:
    from .ai.policy_guardrail import policy_guardrail_applies

    if not policy_guardrail_applies(submission):
        return False
    if not submission.ai_policy_processed:
        return True
    key = compute_policy_guardrail_context_key(submission)
    return (submission.ai_policy_context_key or "") != key


def queue_submission_policy_guardrail(submission_id: int, *, force: bool = False) -> None:
    try:
        scan_submission_policy_guardrail_task.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning("POLICY_GUARDRAIL_QUEUE_FALLBACK | %s | %s", submission_id, exc)
        scan_submission_policy_guardrail_task(submission_id, force=force)


@shared_task
def scan_submission_policy_guardrail_task(submission_id: int, *, force: bool = False):
    scan_submission_policy_guardrail_sync(submission_id, force=force)


def scan_submission_policy_guardrail_sync(submission_id: int, *, force: bool = False) -> dict:
    from .ai.policy_guardrail import (
        persist_policy_guardrail,
        policy_guardrail_applies,
        run_policy_guardrail_scan,
    )
    from .models import Submission

    submission = Submission.objects.select_related(
        "ministry", "department", "form_category", "dg_endorsed_by",
    ).get(pk=submission_id)

    if not policy_guardrail_applies(submission):
        return {
            "confidence_score": None,
            "summary": "Policy guardrail does not apply.",
            "observations": [],
            "skipped": True,
        }

    if not force and not policy_guardrail_needs_refresh(submission):
        return {
            "confidence_score": submission.ai_policy_confidence,
            "summary": submission.ai_policy_summary or "",
            "observations": submission.ai_policy_observations or [],
            "skipped": False,
        }

    result = run_policy_guardrail_scan(submission)
    if not result.get("skipped"):
        submission.ai_policy_context_key = compute_policy_guardrail_context_key(submission)
        persist_policy_guardrail(submission, result)
        submission.save(update_fields=["ai_policy_context_key", "updated_at"])
    app_log.info(
        "POLICY_GUARDRAIL | Submission %s | confidence=%s obs=%s",
        submission_id,
        result.get("confidence_score"),
        len(result.get("observations") or []),
    )
    return result


# ── F1: Transition guidance ─────────────────────────────────────────────────


def queue_transition_guidance(submission_id: int, *, role: str, force: bool = False) -> None:
    try:
        generate_transition_guidance_task.delay(submission_id, role=role, force=force)
    except Exception as exc:
        app_log.warning("TRANSITION_GUIDANCE_FALLBACK | %s | %s", submission_id, exc)
        generate_transition_guidance_task(submission_id, role=role, force=force)


@shared_task
def generate_transition_guidance_task(submission_id: int, *, role: str, force: bool = False):
    from .ai.transition_helper import generate_transition_guidance
    from .models import Submission

    submission = Submission.objects.get(pk=submission_id)
    if not force and submission.ai_transition_guidance.get("processed"):
        return
    guidance = generate_transition_guidance(
        submission, role=role, is_internal=submission.is_internal
    )
    submission.ai_transition_guidance = guidance
    submission.save(update_fields=["ai_transition_guidance", "updated_at"])


# ── Agenda blurb ──────────────────────────────────────────────────────────────


def queue_agenda_item_blurb(agenda_item_id: int) -> None:
    try:
        generate_agenda_item_blurb.delay(agenda_item_id)
    except Exception as exc:
        app_log.warning("AGENDA_BLURB_FALLBACK | %s | %s", agenda_item_id, exc)
        generate_agenda_item_blurb(agenda_item_id)


@shared_task
def generate_agenda_item_blurb(agenda_item_id: int):
    from .ai.agenda_blurb import generate_agenda_blurb
    from .models import AgendaItem

    item = AgendaItem.objects.select_related("submission", "meeting").get(pk=agenda_item_id)
    blurb, _err = generate_agenda_blurb(submission=item.submission, meeting=item.meeting)
    item.agenda_blurb = blurb
    item.agenda_blurb_processed = True
    item.save(update_fields=["agenda_blurb", "agenda_blurb_processed"])


# ── Bilingual clarification remarks ─────────────────────────────────────────


def queue_clarification_bilingual(submission_id: int, *, remarks: str) -> None:
    try:
        generate_clarification_bilingual.delay(submission_id, remarks=remarks)
    except Exception as exc:
        app_log.warning("CLARIFICATION_BI_FALLBACK | %s | %s", submission_id, exc)
        generate_clarification_bilingual(submission_id, remarks=remarks)


@shared_task
def generate_clarification_bilingual(submission_id: int, *, remarks: str):
    from .ai.bilingual_comms import translate_ministry_comms
    from .models import Submission

    submission = Submission.objects.get(pk=submission_id)
    ctx = f"Returned for clarification. Reference {submission.reference_number}."
    result = translate_ministry_comms(english_text=remarks, context=ctx)
    submission.ai_clarification_bilingual = {
        "processed": True,
        "english": result.get("english") or remarks,
        "bislama": result.get("bislama") or "",
        "notes": result.get("notes") or "",
        "disclaimer": "AI draft — verify before sending to ministry.",
    }
    submission.save(update_fields=["ai_clarification_bilingual", "updated_at"])


# ── Implementation subtask drafts ─────────────────────────────────────────────


def queue_draft_implementation_subtasks(task_id: int) -> None:
    try:
        draft_implementation_subtasks.delay(task_id)
    except Exception as exc:
        app_log.warning("SUBTASK_DRAFT_FALLBACK | %s | %s", task_id, exc)
        draft_implementation_subtasks(task_id)


@shared_task
def draft_implementation_subtasks(task_id: int):
    from .ai.implementation_subtasks import draft_subtasks_from_task
    from .models import CommissionTask

    task = CommissionTask.objects.select_related("submission").get(pk=task_id)
    data, err = draft_subtasks_from_task(task)
    task.ai_subtask_drafts = data or {
        "processed": True,
        "error": err or "Failed",
        "subtasks": [],
    }
    if data:
        task.ai_subtask_drafts["processed"] = True
    task.save(update_fields=["ai_subtask_drafts", "updated_at"])


# ── Document annotation assist & redaction preview ───────────────────────────


def queue_document_annotation_assist(document_id: int) -> None:
    try:
        generate_document_annotation_assist.delay(document_id)
    except Exception as exc:
        app_log.warning("ANNOTATION_ASSIST_FALLBACK | %s | %s", document_id, exc)
        generate_document_annotation_assist(document_id)


@shared_task
def generate_document_annotation_assist(document_id: int):
    from .ai.annotation_assist import suggest_annotations
    from .models import SubmissionDocument

    doc = SubmissionDocument.objects.select_related("submission").get(pk=document_id)
    from .media_access import materialize_file_field

    ctx = f"Submission {doc.submission.reference_number}: {doc.submission.title}"
    try:
        with materialize_file_field(doc.file) as path:
            data, err = suggest_annotations(
                file_path=path,
                original_name=doc.original_name,
                extracted_text=doc.extracted_text,
                submission_context=ctx,
            )
    except FileNotFoundError as exc:
        doc.ai_annotation_suggestions = {"processed": True, "error": str(exc), "suggestions": []}
        doc.save(update_fields=["ai_annotation_suggestions"])
        return
    doc.ai_annotation_suggestions = data or {"processed": True, "error": err, "suggestions": []}
    doc.save(update_fields=["ai_annotation_suggestions"])


def queue_document_redaction_preview(document_id: int) -> None:
    try:
        generate_document_redaction_preview.delay(document_id)
    except Exception as exc:
        app_log.warning("REDACTION_PREVIEW_FALLBACK | %s | %s", document_id, exc)
        generate_document_redaction_preview(document_id)


@shared_task
def run_daily_briefs_task():
    """Hourly Celery beat check; sends briefs when local hour matches settings."""
    from django.utils import timezone

    from tracker.daily_brief.models import DailyBriefSettings
    from tracker.daily_brief.runner import run_daily_briefs
    from tracker.daily_brief.scheduler import should_run_delivery_now

    settings = DailyBriefSettings.get_solo()
    settings.last_beat_at = timezone.now()
    settings.save(update_fields=["last_beat_at"])

    if should_run_delivery_now():
        run_daily_briefs()


@shared_task
def generate_document_redaction_preview(document_id: int):
    from .ai.redaction_preview import suggest_redaction_spans
    from .models import SubmissionDocument

    doc = SubmissionDocument.objects.get(pk=document_id)
    from .media_access import materialize_file_field

    try:
        with materialize_file_field(doc.file) as path:
            data, err = suggest_redaction_spans(
                file_path=path,
                original_name=doc.original_name,
                extracted_text=doc.extracted_text,
            )
    except FileNotFoundError as exc:
        doc.ai_redaction_spans = {"processed": True, "error": str(exc), "spans": []}
        doc.save(update_fields=["ai_redaction_spans"])
        return
    doc.ai_redaction_spans = data or {"processed": True, "error": err, "spans": []}
    doc.save(update_fields=["ai_redaction_spans"])


# ═══════════════════════════════════════════════════════════════════════════════
# ── P1–P4 AI Analysis Tasks ──────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════════════

def _build_submission_context(submission) -> str:
    """Return a text block describing a submission for use in AI prompts."""
    from .models import SubmissionDocument, SubmissionChecklistItem

    docs = SubmissionDocument.objects.filter(submission=submission).values_list("original_name", flat=True)
    doc_list = "\n".join(f"  - {d}" for d in docs) or "  (none)"
    checklist = SubmissionChecklistItem.objects.filter(submission=submission)
    cl_present = checklist.filter(is_present=True).count()
    cl_total = checklist.count()

    lines = [
        f"Reference: {submission.reference_number or 'N/A'}",
        f"Title: {submission.title or 'N/A'}",
        f"Form Type: {submission.form_type_code or 'N/A'}",
        f"Ministry: {submission.ministry.name if submission.ministry else 'N/A'}",
        f"Officer Name: {submission.officer_name or 'N/A'}",
        f"Officer Grade: {submission.officer_grade or 'N/A'}",
        f"Stage: {submission.current_stage or 'N/A'}",
        f"Submission Date: {submission.submitted_at.date() if submission.submitted_at else 'N/A'}",
        f"Checklist Completeness: {cl_present}/{cl_total}",
        f"Narrative/Description: {(submission.description or 'N/A')[:1500]}",
        f"Documents on file:\n{doc_list}",
    ]
    return "\n".join(lines)


# ── A4: Duplicate Detection ───────────────────────────────────────────────────

@shared_task
def detect_submission_duplicates(submission_id: int, force: bool = False):
    """A4 — Detect duplicate/similar submissions using Claude Sonnet."""
    from django.utils import timezone
    from .models import Submission
    from .ai.A4_duplicate_detector import detect_duplicates
    from .ai.claude_client import ai_enabled

    if not ai_enabled():
        return

    try:
        submission = Submission.objects.select_related("ministry").get(pk=submission_id)
    except Submission.DoesNotExist:
        app_log.warning("A4_DUPLICATE | Submission %s not found", submission_id)
        return

    if not force and submission.ai_duplicate_processed:
        return

    # Build context for candidate similar submissions (same ministry, similar form type)
    candidates = Submission.objects.filter(
        ministry=submission.ministry,
    ).exclude(pk=submission_id).order_by("-submitted_at")[:20]

    submission_ctx = _build_submission_context(submission)
    existing_ctx = "\n\n---\n\n".join(
        _build_submission_context(c) for c in candidates
    ) or "No existing submissions found."

    data, err = detect_duplicates(submission_ctx, existing_ctx)

    if err or not data:
        app_log.error("A4_DUPLICATE | Sub %s | Error: %s", submission_id, err)
        submission.ai_duplicate_processed = True
        submission.ai_duplicate_recommendation = f"AI error: {err or 'empty response'}"
        submission.ai_duplicate_generated_at = timezone.now()
        submission.save(update_fields=[
            "ai_duplicate_processed", "ai_duplicate_recommendation",
            "ai_duplicate_generated_at", "updated_at",
        ])
        return

    submission.ai_duplicate_processed = True
    submission.ai_duplicate_is_duplicate = data.get("is_duplicate", False)
    submission.ai_duplicate_confidence = data.get("confidence", 0)
    submission.ai_duplicate_similar_cases = data.get("similar_cases", [])
    submission.ai_duplicate_recommendation = data.get("recommendation", "")
    submission.ai_duplicate_generated_at = timezone.now()
    submission.save(update_fields=[
        "ai_duplicate_processed", "ai_duplicate_is_duplicate",
        "ai_duplicate_confidence", "ai_duplicate_similar_cases",
        "ai_duplicate_recommendation", "ai_duplicate_generated_at", "updated_at",
    ])
    app_log.info("A4_DUPLICATE | Sub %s | is_duplicate=%s confidence=%s",
                 submission_id, submission.ai_duplicate_is_duplicate,
                 submission.ai_duplicate_confidence)


def queue_duplicate_detection(submission_id: int, force: bool = False) -> None:
    try:
        detect_submission_duplicates.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning("A4_DUPLICATE_FALLBACK | %s | %s", submission_id, exc)
        detect_submission_duplicates(submission_id, force=force)


# ── B2: Risk Assessment ───────────────────────────────────────────────────────

@shared_task
def run_risk_assessment(submission_id: int, force: bool = False):
    """B2 — Risk assessment using Claude Sonnet."""
    from django.utils import timezone
    from .models import Submission
    from .ai.B2_risk_assessment import assess_risk
    from .ai.claude_client import ai_enabled

    if not ai_enabled():
        return

    try:
        submission = Submission.objects.select_related("ministry").get(pk=submission_id)
    except Submission.DoesNotExist:
        return

    if not force and submission.ai_risk_processed:
        return

    submission_ctx = _build_submission_context(submission)
    data, err = assess_risk(submission_ctx)

    if err or not data:
        submission.ai_risk_processed = True
        submission.ai_risk_recommendation = f"AI error: {err or 'empty response'}"
        submission.ai_risk_generated_at = timezone.now()
        submission.save(update_fields=[
            "ai_risk_processed", "ai_risk_recommendation", "ai_risk_generated_at", "updated_at"
        ])
        return

    submission.ai_risk_processed = True
    submission.ai_risk_score = data.get("risk_score", 0)
    submission.ai_risk_level = data.get("risk_level", "")
    submission.ai_risk_factors = data.get("risk_factors", [])
    submission.ai_risk_mitigation = data.get("mitigation_steps", [])
    submission.ai_risk_recommendation = data.get("recommendation", "")
    submission.ai_risk_generated_at = timezone.now()
    submission.save(update_fields=[
        "ai_risk_processed", "ai_risk_score", "ai_risk_level",
        "ai_risk_factors", "ai_risk_mitigation", "ai_risk_recommendation",
        "ai_risk_generated_at", "updated_at",
    ])
    app_log.info("B2_RISK | Sub %s | level=%s score=%s",
                 submission_id, submission.ai_risk_level, submission.ai_risk_score)


def queue_risk_assessment(submission_id: int, force: bool = False) -> None:
    try:
        run_risk_assessment.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning("B2_RISK_FALLBACK | %s | %s", submission_id, exc)
        run_risk_assessment(submission_id, force=force)


# ── B3: Recommended Outcome ───────────────────────────────────────────────────

@shared_task
def generate_recommended_outcome(submission_id: int, force: bool = False):
    """B3 — Recommend decision outcome using Claude Sonnet."""
    from django.utils import timezone
    from .models import Submission
    from .ai.B3_recommended_outcome import recommend_outcome
    from .ai.claude_client import ai_enabled

    if not ai_enabled():
        return

    try:
        submission = Submission.objects.select_related("ministry").get(pk=submission_id)
    except Submission.DoesNotExist:
        return

    if not force and submission.ai_outcome_processed:
        return

    submission_ctx = _build_submission_context(submission)
    data, err = recommend_outcome(submission_ctx)

    if err or not data:
        submission.ai_outcome_processed = True
        submission.ai_outcome_rationale = f"AI error: {err or 'empty response'}"
        submission.ai_outcome_generated_at = timezone.now()
        submission.save(update_fields=[
            "ai_outcome_processed", "ai_outcome_rationale", "ai_outcome_generated_at", "updated_at"
        ])
        return

    submission.ai_outcome_processed = True
    submission.ai_outcome_recommendation = data.get("recommendation", "")
    submission.ai_outcome_confidence = data.get("confidence", 0)
    submission.ai_outcome_rationale = data.get("rationale", "")
    submission.ai_outcome_conditions = data.get("conditions", [])
    submission.ai_outcome_precedents = data.get("precedents", [])
    submission.ai_outcome_legal_basis = data.get("legal_basis", "")
    submission.ai_outcome_generated_at = timezone.now()
    submission.save(update_fields=[
        "ai_outcome_processed", "ai_outcome_recommendation", "ai_outcome_confidence",
        "ai_outcome_rationale", "ai_outcome_conditions", "ai_outcome_precedents",
        "ai_outcome_legal_basis", "ai_outcome_generated_at", "updated_at",
    ])
    app_log.info("B3_OUTCOME | Sub %s | recommendation=%s confidence=%s",
                 submission_id, submission.ai_outcome_recommendation,
                 submission.ai_outcome_confidence)


def queue_recommended_outcome(submission_id: int, force: bool = False) -> None:
    try:
        generate_recommended_outcome.delay(submission_id, force=force)
    except Exception as exc:
        app_log.warning("B3_OUTCOME_FALLBACK | %s | %s", submission_id, exc)
        generate_recommended_outcome(submission_id, force=force)


# ── B5: Notice of Allegation ──────────────────────────────────────────────────

@shared_task
def generate_notice_of_allegation(submission_id: int, response_deadline_days: int = 14, force: bool = False):
    """B5 — Draft notice of allegation letter using Claude Sonnet."""
    from django.utils import timezone
    from .models import Submission
    from .ai.B5_notice_of_allegation import draft_notice_of_allegation
    from .ai.claude_client import ai_enabled

    if not ai_enabled():
        return

    try:
        submission = Submission.objects.select_related("ministry").get(pk=submission_id)
    except Submission.DoesNotExist:
        return

    if not force and submission.ai_noa_processed:
        return

    submission_ctx = _build_submission_context(submission)
    data, err = draft_notice_of_allegation(submission_ctx, response_deadline_days=response_deadline_days)

    if err or not data:
        submission.ai_noa_processed = True
        submission.ai_noa_content = f"AI error: {err or 'empty response'}"
        submission.ai_noa_generated_at = timezone.now()
        submission.save(update_fields=[
            "ai_noa_processed", "ai_noa_content", "ai_noa_generated_at", "updated_at"
        ])
        return

    submission.ai_noa_processed = True
    submission.ai_noa_content = data.get("letter_content", "")
    submission.ai_noa_subject = data.get("subject_line", "")
    submission.ai_noa_key_points = data.get("key_points", [])
    submission.ai_noa_generated_at = timezone.now()
    submission.save(update_fields=[
        "ai_noa_processed", "ai_noa_content", "ai_noa_subject",
        "ai_noa_key_points", "ai_noa_generated_at", "updated_at",
    ])
    app_log.info("B5_NOA | Sub %s | subject=%s", submission_id, submission.ai_noa_subject)


def queue_notice_of_allegation(submission_id: int, response_deadline_days: int = 14, force: bool = False) -> None:
    try:
        generate_notice_of_allegation.delay(submission_id, response_deadline_days=response_deadline_days, force=force)
    except Exception as exc:
        app_log.warning("B5_NOA_FALLBACK | %s | %s", submission_id, exc)
        generate_notice_of_allegation(submission_id, response_deadline_days=response_deadline_days, force=force)


# ── F3: Outcome Letter ────────────────────────────────────────────────────────

@shared_task
def generate_outcome_letter(submission_id: int, outcome: str = "", conditions: list = None, force: bool = False):
    """F3 — Draft formal outcome letter using Claude Sonnet."""
    from django.utils import timezone
    from .models import Submission
    from .ai.F3_outcome_letter import draft_outcome_letter
    from .ai.claude_client import ai_enabled

    if not ai_enabled():
        return

    try:
        submission = Submission.objects.select_related("ministry").get(pk=submission_id)
    except Submission.DoesNotExist:
        return

    if not force and submission.ai_letter_processed:
        return

    submission_ctx = _build_submission_context(submission)
    data, err = draft_outcome_letter(submission_ctx, outcome=outcome, conditions=conditions or [])

    if err or not data:
        submission.ai_letter_processed = True
        submission.ai_letter_content = f"AI error: {err or 'empty response'}"
        submission.ai_letter_generated_at = timezone.now()
        submission.save(update_fields=[
            "ai_letter_processed", "ai_letter_content", "ai_letter_generated_at", "updated_at"
        ])
        return

    submission.ai_letter_processed = True
    submission.ai_letter_content = data.get("letter_content", "")
    submission.ai_letter_subject = data.get("subject_line", "")
    submission.ai_letter_action_items = data.get("action_items", [])
    submission.ai_letter_generated_at = timezone.now()
    submission.save(update_fields=[
        "ai_letter_processed", "ai_letter_content", "ai_letter_subject",
        "ai_letter_action_items", "ai_letter_generated_at", "updated_at",
    ])
    app_log.info("F3_LETTER | Sub %s | subject=%s", submission_id, submission.ai_letter_subject)


def queue_outcome_letter(submission_id: int, outcome: str = "", conditions: list = None, force: bool = False) -> None:
    try:
        generate_outcome_letter.delay(submission_id, outcome=outcome, conditions=conditions or [], force=force)
    except Exception as exc:
        app_log.warning("F3_LETTER_FALLBACK | %s | %s", submission_id, exc)
        generate_outcome_letter(submission_id, outcome=outcome, conditions=conditions or [], force=force)
