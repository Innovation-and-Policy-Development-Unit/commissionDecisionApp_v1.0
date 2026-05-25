# AI features — Claude + Whisper

Server-side AI uses **Anthropic Claude** for text/reasoning and **OpenAI Whisper** for meeting audio transcription.

## Configuration

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL_HAIKU=claude-haiku-4-5-20251001
CLAUDE_MODEL_SONNET=claude-sonnet-4-6

OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1
```

Install: `pip install anthropic openai` (see `backend/requirements.txt`).

Code: `backend/tracker/ai/claude_client.py`, `backend/tracker/ai/whisper_client.py`  
Model tiers: `backend/tracker/ai/feature_registry.py`

## Implemented today (Celery)

| Feature | Task | Model |
|---------|------|-------|
| Feedback triage | `process_feedback_with_ai` | Haiku |
| Secretary executive brief | `generate_submission_brief` | Sonnet |
| OCR + key facts (E1) | `extract_document_facts` | Sonnet |
| Deadline reminder drafts (F2) | `draft_submission_deadline_reminders` | Haiku |
| **Meeting transcribe + refine** | `run_meeting_transcription_pipeline` | Whisper → Haiku |
| Minutes draft from transcript | `draft_minutes_from_transcript` | Sonnet |
| Decision extraction | `extract_decisions_from_minutes` | Haiku |
| Action register (C4) | `extract_action_items_from_minutes` | Haiku |
| Staff Assistant | `staff_chat_views` | Sonnet |

## Meeting audio pipeline

1. Upload recording (`POST /meetings/upload/` with `meeting_id`).
2. **One button:** `POST /meetings/{id}/transcribe/` → Celery `run_meeting_transcription_pipeline`:
   - **Whisper** → `structured_data.whisper_verbatim`
   - **Claude Haiku** cleanup → `raw_text` (Bislama/ASR repair)
3. Secretariat reviews transcript in Minutes Editor.
4. **Generate minutes** → `draft_minutes_from_transcript` (Sonnet).

Requires **Celery worker** + `OPENAI_API_KEY` + `ANTHROPIC_API_KEY`. Recordings over **25 MB** must be compressed before upload (Whisper API limit).

Legacy: `POST /minutes/transcribe/` triggers the same pipeline. `GET /meetings/{id}/claude-prompt/` remains for manual copy-out.

## Adding a roadmap feature

1. Add prompt + schema in a task or view.
2. Call `complete_json(..., tier=get_model_tier("slug"))`.
3. Persist on models; gate with `ai_enabled()` / permissions.
