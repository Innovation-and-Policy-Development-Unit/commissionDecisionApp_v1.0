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
        ai_data = complete_json(
            system=SYSTEM_INSTRUCTION,
            user=user_input,
            tier="haiku",
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


def submission_brief_needs_refresh(submission) -> bool:
    if not submission.ai_brief_processed:
        return True
    if submission.ai_brief_generated_at and submission.updated_at > submission.ai_brief_generated_at:
        return True
    return False


def _mark_submission_brief_failed(submission, message: str) -> None:
    """Stop the UI spinner — record a readable error in the brief field."""
    from django.utils import timezone

    submission.ai_brief_summary = message.strip()
    submission.ai_brief_processed = True
    submission.ai_brief_generated_at = timezone.now()
    submission.save(
        update_fields=["ai_brief_summary", "ai_brief_processed", "ai_brief_generated_at", "updated_at"]
    )


def queue_submission_brief(submission_id: int, *, force: bool = False) -> None:
    """Queue via Celery when possible; otherwise run synchronously in-process."""
    try:
        generate_submission_brief.delay(submission_id, force=force)
    except Exception as exc:
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
        data, api_err = complete_json_with_error(
            system=SUBMISSION_BRIEF_INSTRUCTION,
            user=user_input,
            tier="sonnet",
            max_tokens=4096,
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
        submission.save(update_fields=[
            "ai_brief_summary", "ai_brief_processed", "ai_brief_generated_at", "updated_at",
        ])
        app_log.info("BRIEF_COMPLETE | Submission %s", submission_id)
    except Exception as exc:
        _mark_submission_brief_failed(
            submission,
            f"AI brief could not be generated: {exc}. "
            "Check ANTHROPIC_API_KEY, Celery worker logs, and try Regenerate.",
        )
        app_log.error("BRIEF_FAIL | Submission %s | %s", submission_id, exc)


# ── Meeting transcription ────────────────────────────────────────────────────


@shared_task
def transcribe_meeting_recording(meeting_id: int, audio_path: str):
    """Audio file is stored; transcription is not done via Claude API.

    Use Zoom/local ASR, paste text into the transcript editor, then Claude prompt
  repair (GET /meetings/{id}/claude-prompt/) or draft_minutes_from_transcript.
    """
    app_log.warning(
        "TRANSCRIBE_SKIP | Claude API does not accept audio uploads. "
        "Meeting %s file=%s — paste ASR transcript manually.",
        meeting_id,
        os.path.basename(audio_path) if audio_path else "",
    )


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
        minutes_data = complete_json(
            system="You draft formal Vanuatu Public Service Commission minutes.",
            user=prompt,
            tier="sonnet",
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
        decisions = complete_json(
            system="You extract structured Commission decisions from minutes.",
            user=prompt,
            tier="haiku",
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
