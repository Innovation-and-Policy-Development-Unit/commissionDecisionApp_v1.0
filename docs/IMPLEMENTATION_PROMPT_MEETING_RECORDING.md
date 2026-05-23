# Implementation prompt — Commission Decision App (copy into Cursor)

**Workspace:** `C:\Users\USER\Documents\Commission Decision App\commissionDecisionApp_v1.0`  
**Do NOT implement in psc-drfms.** This work belongs only in the Commission Decision App.

---

## Prompt (paste everything below this line into a new Cursor chat)

```
Implement boardroom meeting recording and Bislama-aware minutes workflow in the Commission Decision App (commissionDecisionApp_v1.0). Extend existing code — do not duplicate parallel systems.

## Context

The app already has:
- `Meeting` model (`backend/tracker/models.py`)
- `MeetingTranscript` (raw_text, structured_data, audio_file, ai_processed)
- `MeetingCapture.jsx` at `/meetings/capture?meetingId=` — browser MediaRecorder + file upload → `POST /meetings/upload/` → `transcribe_meeting_recording` Celery task
- `MinutesEditor.jsx` at `/secretariat/meetings/:meetingId/minutes`
- i18n: `frontend/src/i18n/locales/{en,bi,fr}.json`
- Menu: Secretariat → Meetings (`/secretariat/meetings`)

**Policy requirement:** Commission boardroom recordings must use the **Logitech GROUP** conference system (USB speakerphone in the room). Do **not** use laptop, tablet, or phone built-in microphones for official sittings. In-browser capture may remain as a fallback only when explicitly marked “remote / exception” and must default to **upload Zoom/Teams recording** from the room PC where Logitech GROUP was selected as mic.

## Part 1 — Logitech GROUP animated setup guide

Create `frontend/src/pages/meeting/LogitechGroupGuide.jsx`:
- 6 animated steps (CSS only, match existing Tailwind/card patterns from `Layout.jsx` / `PageHeader`)
- Steps: USB connect → forbid laptop/tablet/phone mics → Windows sound input = Logitech GROUP → Zoom/Teams device selection → optional expansion mics → start recording
- Link from MeetingCapture and CommissionSittings

Routes:
- `/secretariat/meeting-room/logitech-guide`
- Add menu item under Commission Decision group in `menuItems.js` + i18n keys (`nav.logitech_guide`, etc.)

## Part 2 — Staff brief: Zoom ASR + Claude (Bislama pipeline)

Create `frontend/src/pages/meeting/MinutesPipelineBrief.jsx`:
- One-page staff brief explaining:
  - Zoom/Teams ASR = speech-to-text (blind to Bislama, outputs garbled English-like text)
  - Claude = text repair → formal English minutes (cannot natively listen to audio in this workflow)
  - Official record = uploaded recording + chair-approved minutes in this app
- Include comparison table, worked example:
  - Spoken: "Yumi mas leftemap ol Principal i go long Manager fastem."
  - Zoom output: "You me mass left em up all principal he go long manager fast time."
  - Final minutes (after Claude + review): professional English resolution text
- **Copy prompt** button with template filled from linked `Meeting` (title, date, chair, attendees, agenda from API)
- Print-friendly CSS

Route: `/secretariat/meeting-room/minutes-pipeline`

## Part 3 — Enhance MeetingCapture.jsx (critical)

File: `frontend/src/pages/psc/MeetingCapture.jsx`

1. **Default mode for boardroom:** Prominent “Recommended: upload recording from room PC” (Zoom/Teams export or local recording file). De-emphasize or gate “Record in browser” behind “Remote / exception only”.

2. **Device picker for in-browser record (if kept):**
   - `navigator.mediaDevices.enumerateDevices()`
   - Dropdown: require selection of input whose label contains `Logitech`, `GROUP`, or `Echo Cancelling Speakerphone`
   - Block start if user selects “Default” / “Built-in” / phone names; show link to Logitech guide
   - Optional: `deviceId` constraint in `getUserMedia({ audio: { deviceId: { exact: id } } })`

3. **Audio source field:** POST with upload metadata `audio_source: logitech_group | other` (add backend field if needed on `MeetingTranscript` or meeting metadata JSON on `Meeting.notes` / new `recording_metadata` JSONField — minimal migration).

4. **UI copy:** Yellow policy banner at top (GROUP-only for boardroom).

5. **After upload:** Link to Minutes pipeline brief + MinutesEditor for that meeting.

## Part 4 — Enhance MinutesEditor.jsx

File: `frontend/src/pages/secretariat/MinutesEditor.jsx`

1. Section **“Transcript workflow”** with steps:
   - Upload recording (link to capture page)
   - Paste Zoom transcript OR view `MeetingTranscript.raw_text` after AI transcribe
   - Button **“Copy Claude prompt”** — build prompt server-side or client-side using meeting fields + raw transcript
   - Button **“Run AI transcribe”** (existing API `POST .../transcribe/` if present)
   - Button **“Generate minutes from transcript”** (existing `generate-from-transcript`)

2. If `raw_text` exists, show editable textarea + warning: “ASR may have mangled Bislama — review before approving minutes.”

3. Manual paste area for Zoom transcript before AI transcribe (save to `MeetingTranscript.raw_text` via PATCH API — add endpoint if missing).

## Part 5 — Backend (minimal)

In `backend/tracker/`:

1. Add optional fields (migration):
   - `Meeting.recording_audio_source` CharField choices: logitech_group, zoom_export, browser_exception, other
   - `MeetingTranscript.source` CharField: zoom_asr | ai_whisper | manual_paste (default zoom_asr)

2. `MeetingViewSet` or meeting actions:
   - `PATCH /meetings/{id}/transcript/` — update raw_text (manual paste from Zoom)
   - `GET /meetings/{id}/claude-prompt/` — return generated prompt string from meeting + transcript

3. Do **not** replace existing `transcribe_meeting_recording` task; document in UI that post-transcribe text still needs Claude pass for Bislama-heavy sittings.

4. Optional: extend `transcribe_meeting_recording` task comment/docstring that output is English-biased ASR; minutes generation should use `draft_minutes_from_transcript` after secretariat review.

## Part 6 — Hub page

`frontend/src/pages/meeting/MeetingRoomHub.jsx` at `/secretariat/meeting-room`:
- Cards: Logitech guide | Minutes pipeline | Upload recording (capture with meetingId) | Secretariat meetings list
- Register routes in `frontend/src/router/index.jsx`

## Part 7 — i18n

Add English + Bislama (`bi.json`) + French keys for all new labels. Use existing `translateLabel` / `t()` patterns.

## Part 8 — Testing

- `docker compose up` or local dev per project README
- Create test meeting → open capture with meetingId → verify device picker + upload path
- Paste sample garbled transcript → copy Claude prompt → verify MinutesEditor shows transcript
- Frontend build must pass (`npm run build` — use `node node_modules/vite/bin/vite.js build` if path has `&`)

## Constraints

- Match existing code style (api client from `frontend/src/api/client.js`, PageHeader, card classes).
- Minimize scope: no new `meetings` Django app — extend `tracker` only.
- No changes to psc-drfms repository.
- Do not commit secrets. Do not force git commit unless asked.

## Deliverables checklist

- [ ] LogitechGroupGuide.jsx + routes + menu + i18n
- [ ] MinutesPipelineBrief.jsx + routes + menu + i18n  
- [ ] MeetingRoomHub.jsx
- [ ] MeetingCapture.jsx — GROUP policy, device picker, upload-first UX
- [ ] MinutesEditor.jsx — transcript workflow + Claude prompt
- [ ] Backend migration + transcript PATCH + claude-prompt endpoint
- [ ] Brief manual test notes in PR description or comment at top of hub page
```

---

## Quick start for you

1. Open folder: `commissionDecisionApp_v1.0` in Cursor (not psc-drfms).
2. New Agent chat → paste the prompt block above.
3. After implementation: `docker compose up -d --build` (or project’s dev command).
4. Test: Secretariat → Meeting room → Logitech guide → Meetings → Capture recording for a sitting.

## Reference: what was wrongly built in psc-drfms (do not copy verbatim)

Those features were reverted from psc-drfms. Use this app’s existing `Meeting` / `MeetingTranscript` / `MeetingCapture` instead of creating a separate `MeetingSession` model.
