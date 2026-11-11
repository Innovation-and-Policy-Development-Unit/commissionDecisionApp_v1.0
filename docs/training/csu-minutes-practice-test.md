# Minute-taking practice test — Manager CSU

A practice sitting is set up in SCDMS so the minute-taking flow can be tried from
start to circulation without touching real business.

- **Sitting:** `TRAIN-CSU-MTG-001` — "TRAINING SITTING — minute-taking practice, not real"
- **Status:** already launched (In Progress), agenda circulated, 8 practice items
- **Everything is fictional.** Papers are marked `[TRAINING]` and numbered `TRAIN-CSU-001` to `008`.

## The agenda

| Section | Paper | Unit |
|---|---|---|
| Matters Arising | TRAIN-CSU-001 Appraisal report for a conditional confirmation | HR |
| Discipline / Compliance | TRAIN-CSU-002 Alleged unauthorised absence, Senior Clerk | Compliance |
| Appointment | TRAIN-CSU-003 Appointment of Director of Policy | HR |
| Appointment | TRAIN-CSU-004 Acting appointment, Chief Accountant (deferred from previous sitting) | HR |
| Direct Appointment / Confirmation | TRAIN-CSU-005 Confirmation of three Administration Officers | HR |
| Restructure | TRAIN-CSU-006 Corporate Services Division restructure | ODU |
| Contract | TRAIN-CSU-007 Contract extension, IT Systems Adviser | HR |
| Other Matters | TRAIN-CSU-008 OPSC end-of-year office closure dates | CSU |

## Day 1 — during the "sitting" (Manager CSU)

1. Sign in and open **Minutes & Agenda → Minute intake**
   (`/secretariat/minute-intake/9`). Choose `TRAIN-CSU-MTG-001`.
2. For each item, type discussion notes, the decision and the action officer.
   Make up the discussion; try at least one each of approved, deferred and noted.
3. Use the AI formatting on one item, then on all items. Check the wording it produces.
4. Apply the notes to the minutes. This creates the **draft minutes**.
5. Open the draft (**Minutes & Agenda → Minutes**), fill in the opening and closing,
   save, and sign out.

## Day 2 — review and hand on

6. **Manager CSU:** reopen the draft, confirm yesterday's text is all there, edit it,
   then **Submit for review**.
   *This sends an in-app notification to the Secretaries, the Chairperson and
   Manager Compliance — tell them beforehand that it is a practice.*
7. **Manager Compliance:** find the practice minutes, read them and approve.
8. **Secretary:** approve. **Chairperson:** approve (an admin can approve on the
   Chairperson's behalf for this test).
9. **Manager CSU:** once all approvals are in, **Circulate to Commissioners**.

**Stop here.** Do not send for signature, upload signed minutes or allocate tasks:
those steps email Commission members and move papers on.

## What to note down

- Could you find every screen without help? Which one was hard to find?
- Are the agenda items listed in the same order as the agenda?
- Was any text lost between Day 1 and Day 2?
- Was the AI-formatted wording usable, or did it need heavy editing?
- Manager Compliance: how did you reach the minutes, and could you do what you needed?
- Anything that works differently from how minutes are handled today.

## Not part of this test

- **Flying agenda items** — adding one creates a real numbered paper and notifies a
  real unit manager, so it is switched off for this sitting.
- **Commissioner comments** — there are no Commissioner accounts yet. Practice ones
  can be added by the administrator if this step is to be tried.

## For the administrator

```bash
# add practice Commissioner accounts (sign-in codes go to plus-addresses of this mailbox)
sudo -n docker exec scdms-backend-1 python manage.py seed_csu_minutes_practice --commissioners-only 3 --facilitator-email you@example.org

# remove everything after the test
sudo -n docker exec scdms-backend-1 python manage.py seed_csu_minutes_practice --cleanup
```

The command was copied into the running container by hand. If the backend container is
rebuilt before the command is merged and deployed, copy it in again before cleanup:

```bash
sudo -n docker cp backend/tracker/management/commands/seed_csu_minutes_practice.py scdms-backend-1:/app/tracker/management/commands/
```
