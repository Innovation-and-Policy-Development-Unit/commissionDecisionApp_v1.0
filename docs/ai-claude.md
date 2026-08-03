# AI features — Gemini + Whisper

Server-side AI uses **Google Gemini** (Google AI Studio, free tier) for text/reasoning and
**OpenAI Whisper** for meeting audio transcription.

## Configuration

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL_HAIKU=gemini-2.5-flash-lite
GEMINI_MODEL_SONNET=gemini-2.5-flash

OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1
```

Install: `pip install google-genai openai` (see `backend/requirements.txt`).

Code: `backend/tracker/ai/claude_client.py` (Gemini wrapper — filename is a historical carry-over
from the previous Claude integration), `backend/tracker/ai/whisper_client.py`
Model tiers: `backend/tracker/ai/feature_registry.py`

## Implemented today (Celery)

| Feature | Task | Model |
|---------|------|-------|
| Feedback triage | `process_feedback_with_ai` | Fast tier |
| Secretary executive brief | `generate_submission_brief` | Quality tier |
| OCR + key facts (E1) | `extract_document_facts` | Quality tier |
| Deadline reminder drafts (F2) | `draft_submission_deadline_reminders` | Fast tier |
| **Meeting transcribe + refine** | `run_meeting_transcription_pipeline` | Whisper → Fast tier |
| Minutes draft from transcript | `draft_minutes_from_transcript` | Quality tier |
| Decision extraction | `extract_decisions_from_minutes` | Fast tier |
| Action register (C4) | `extract_action_items_from_minutes` | Fast tier |
| Staff Assistant | `staff_chat_views` | Quality tier |

## Meeting audio pipeline

1. Upload recording (`POST /meetings/upload/` with `meeting_id`).
2. **One button:** `POST /meetings/{id}/transcribe/` → Celery `run_meeting_transcription_pipeline`:
   - **Whisper** → `structured_data.whisper_verbatim`
   - **Gemini (fast tier)** cleanup → `raw_text` (Bislama/ASR repair)
3. Secretariat reviews transcript in Minutes Editor.
4. **Generate minutes** → `draft_minutes_from_transcript` (quality tier).

Requires **Celery worker** + `OPENAI_API_KEY` + `GEMINI_API_KEY`. Recordings over **25 MB** must be
compressed before upload (Whisper API limit).

Legacy: `POST /minutes/transcribe/` triggers the same pipeline. `GET /meetings/{id}/claude-prompt/`
remains for the manual "paste into Claude.ai yourself" copy-out — a separate, zero-cost path
unrelated to the API integration above, intentionally left as-is.

## Adding a roadmap feature

1. Add prompt + schema in a task or view.
2. Call `complete_json(..., tier=get_model_tier("slug"))`.
3. Persist on models; gate with `ai_enabled()` / permissions.
