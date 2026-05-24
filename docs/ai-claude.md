# AI features — Anthropic Claude API

All server-side AI in the Commission Decision App uses the **Anthropic Messages API** (not Google Gemini).

## Configuration

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL_HAIKU=claude-3-5-haiku-20241022   # fast / cheap
CLAUDE_MODEL_SONNET=claude-sonnet-4-20250514  # drafting / reasoning
```

Install: `pip install anthropic` (listed in `backend/requirements.txt`).

Code entry point: `backend/tracker/ai/claude_client.py`  
Roadmap model tiers (24 features): `backend/tracker/ai/feature_registry.py`  
Product spec: `AI_Features_List.txt` (repo root)

## Implemented today (Celery)

| Feature | Task | Model tier |
|---------|------|------------|
| Feedback triage | `process_feedback_with_ai` | Haiku |
| Secretary executive brief | `generate_submission_brief` | Sonnet |
| Minutes draft from transcript | `draft_minutes_from_transcript` | Sonnet |
| Decision extraction | `extract_decisions_from_minutes` | Haiku |

## Meeting audio

**Claude does not accept raw audio** on the Messages API. The workflow is:

1. Record / upload audio (archival).
2. Run **Zoom ASR** (or other ASR) → paste transcript.
3. Optional: **Copy Claude prompt** (`GET /meetings/{id}/claude-prompt/`) for Bislama → English repair in Claude.ai or via future in-app call.
4. **Generate minutes** from pasted text (`draft_minutes_from_transcript`).

`transcribe_meeting_recording` no longer calls an external ASR API; it logs a skip message.

## Adding a roadmap feature (A1–F4)

1. Add prompt + JSON schema in a new task or view.
2. Call `complete_json(..., tier=FEATURE_MODEL_TIER["A1_auto_fill_checklist"])`.
3. Persist results on the relevant model.
4. Gate with `ai_enabled()` and staff permissions.

## Cost guidance (from product spec)

- **Haiku** — checklist fill, classification, missing-info, feedback, due-date drafts.
- **Sonnet** — briefs, minutes, duplicate detection, risk, chatbots, policy Q&A.

Use Sonnet only where reasoning quality justifies the higher token rate.
