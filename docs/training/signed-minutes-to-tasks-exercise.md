# Signed minutes to decision tasks — practice exercise

A practice sitting is set up in SCDMS so the last leg of the Commission process can
be tried from the signed minutes through to a completed task, without touching real
business.

- **Sitting:** `TRAIN-TASK-MTG-001` — "TRAINING SITTING — decision tasks practice, not real"
- **Minutes:** already written and reviewed, status **Awaiting signature**
- **Everything is fictional.** Papers are marked `[TRAINING]` and numbered
  `TRAIN-TASK-001` to `006`.

## Before you start (facilitator)

Tell these people the exercise is running, because Step 2 sends them **real
notifications and emails**:

- the five unit managers (ODU, VIPAM, HR, Compliance, CSU);
- the Chairperson and any Commissioners (they are told signed minutes are on record);
- the officers each manager will pick in Step 3 (they are emailed when assigned).

## The decisions in the practice minutes

| Item | Paper | Unit | Decision |
|---|---|---|---|
| 1 | TRAIN-TASK-001 Corporate Services Division restructure | ODU | Approved |
| 2 | TRAIN-TASK-002 Scholarship, Master of Public Policy | VIPAM | Approved subject to a bond |
| 3 | TRAIN-TASK-003 Appointment of Director of Policy | HR | Approved |
| 4 | TRAIN-TASK-004 Contract extension, IT Systems Adviser | HR | Deferred back to the unit |
| 5 | TRAIN-TASK-005 Disciplinary matter, Senior Clerk | Compliance | Approved |
| 6 | TRAIN-TASK-006 OPSC end-of-year office closure dates | CSU | Noted |

## Step 1 — Upload the signed minutes

**Who:** Manager CSU or the CSU Senior Officer (an Admin can also do it).

1. Sign in and open **Minutes & Agenda → Minutes**. Open `TRAIN-TASK-MTG-001`.
2. Press **Download for Signature**. This is the copy that would be printed and
   signed. For the practice, the downloaded PDF is your "signed scan" (print, sign
   and scan it if you want to try a real scan).
3. Press **Upload Signed Minutes** and choose the file.
4. The status changes to **Signed**. Press **View Signed Scan** and check it opens.
5. Try a correction: press **Re-upload Signed Minutes**, choose a file again, and
   confirm. Check **View Signed Scan** now shows the new file.

*Nothing is sent to anyone at this step.* Tasks are not created yet.

## Step 2 — Allocate the decision tasks

**Who:** a Secretary (an Admin can also do it).

6. Open **Minutes & Agenda → Minutes** and open `TRAIN-TASK-MTG-001`.
7. Press **View Signed Scan** and confirm it is the right document. This check is
   the reason allocation is a separate step.
8. Press **Allocate Decision Tasks to Managers**.
9. Open **Outcomes → Minutes decision tasks**. There should be six new tasks, one
   per decision, each with the right **Manager Responsible**:

   | Task for paper | Goes to |
   |---|---|
   | TRAIN-TASK-001 | Manager ODU |
   | TRAIN-TASK-002 | Manager VIPAM |
   | TRAIN-TASK-003 and 004 | Manager HR |
   | TRAIN-TASK-005 | Manager Compliance |
   | TRAIN-TASK-006 | Manager CSU |

*This step notifies and emails each unit manager, tells Commission members the
signed minutes are on record, and queues draft outcome letters for the approved
papers.* It can only be done once per sitting.

## Step 3 — Assign the task to an officer

**Who:** each unit manager.

10. Open the notification "Commission decision allocated to your unit", or go to
    **Outcomes → Minutes decision tasks**.
11. Open your task and read the **Decision Detail**.
12. Press **Edit**. Under **Assign staff (one or more)**, tick one or more of your
    own Principal or Senior officers and press **Reassign to … staff**. Set a
    **Due date** and press **Save**.
13. Optional: press **Add Subtask** to break the work into steps and give each step
    to an officer.

*Assigning an officer emails that officer.* You can see other units' tasks in the
register, but you can only assign your own.

## Step 4 — Work the task

**Who:** the assigned Principal or Senior officer.

14. Open **Outcomes → Minutes decision tasks** and open the task assigned to you.
15. Change **Task Status** to **In progress**.
16. Under **Status updates & comments**, write a short update and press **Post update**.
17. If you were given subtasks, mark each one completed.
18. Change **Task Status** to **Completed**.

## Step 5 — Check the result

**Who:** the unit manager, then a Secretary.

19. **Manager:** confirm your task shows the officer's update and the status Completed.
20. **Secretary:** in **Outcomes → Minutes decision tasks**, confirm all six practice
    tasks show their status and assigned officers.

## What to note down

- Could you find every screen without help? Which one was hard to find?
- Step 1: did the upload and the re-upload behave as you expected?
- Step 2: did every decision become a task for the right manager? Was the wording of
  the task usable as it came from the minutes?
- Step 3: did the list of officers show the right people for your unit, and only them?
- Step 4: could the officer do everything needed, and nothing they should not?
- Did the notifications and emails arrive, and did their links open the right screen?
- Anything that works differently from how decisions are followed up today.

## Not part of this exercise

- Writing and reviewing the minutes: that is the separate minute-taking practice
  (`TRAIN-CSU-MTG-001`).
- Outcome letters to the ministry: drafts are queued for the practice papers, but do
  not send them.

## For the facilitator

Set up (once, on the server):

```bash
sudo -n docker exec scdms-backend-1 python manage.py seed_decision_tasks_practice
```

Remove everything afterwards, including the tasks, the practice papers and every
uploaded scan:

```bash
sudo -n docker exec scdms-backend-1 python manage.py seed_decision_tasks_practice --cleanup
```

To run the exercise a second time, clean up and set up again.
