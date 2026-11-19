# The agenda document

The Agenda page, the **Download PDF** button and the agenda PDF emailed to Commissioners all come from one
document (`backend/tracker/agenda_document.py`), laid out like the Commission's own agenda: one bordered
table, three title lines, then

| No. | |
|---|---|
| 1 | Adoption of Agenda |
| 2 | MINUTE: confirmation of endorsement of the previous sitting's minutes |
| 3 | MATTERS ARISING, grouped by the sitting they were first tabled at |
| | HEADING IN CAPITALS (not numbered) |
| 4, 5, 6 … | submissions, numbered on from 4 |

## Agenda numbers

- Every submission on the agenda has a permanent `agenda_no`. It is the number the Commissioners see, and the
  number used by "Agenda 04 - …" in the Sitting Pack, in item downloads and in Matters Arising references.
- While the agenda is **draft** or **with the Chairperson**, numbers are renumbered automatically whenever an item
  is added, removed, moved or re-sectioned.
- Once the Chairperson **endorses** (circulates) the agenda, numbers are **fixed**. Removing an item leaves a gap;
  a late addition takes the next number. What was circulated, the minutes and later references always agree.
- `python manage.py renumber_agendas` fills in numbers for older agendas.

## Headings

Each agenda section has an **agenda heading** (Administration, Agenda sections). Neighbouring sections that share
the same heading are printed under it, so several form types can sit under one heading such as
"ALLOWANCES / LEAVE / SEVERANCE / ARREARS / CLAIM". Blank means the section's own label. The display order of the
sections is still set on the same page.

## Matters Arising

The sitting and "Agenda NN" for each Matters Arising item are worked out from where the paper was first tabled, so
nobody has to type them. Text typed into the item is used only when nothing can be worked out.

## Reading an item

In the Sitting Pack, the papers panel has **All as one PDF**: a cover page (agenda number, title, ministry,
reference), then every PDF and image filed on the submission in order, with a bookmark for each. Word and Excel
files cannot be merged; they are listed on the cover and stay available one by one.

## Signature and font

The block under the table is the Manager CSU (or the `AGENDA_SIGNATORY_NAME` / `AGENDA_SIGNATORY_TITLE` system
settings). The PDF uses TeX Gyre Adventor, a free look-alike of Century Gothic, which is installed in the image.
