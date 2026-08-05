"""
Generates a decision letter for a submission from its admin-editable
LetterTemplate (see tracker/letter_templates.py and tracker/models.py's
LetterTemplate). The per-form-type wording used to be hardcoded in this
package's cessation.py/recruitment.py/secondment.py/leave_payout.py/
allowances.py — those files' field-resolution logic now lives in
context.py, and their template *text* was seeded into the database (see
tracker/letter_template_defaults.py) so PSC Admins can edit it without a
code change. The original per-letter functions are left in place as
reference/legacy but are no longer called at runtime.
"""
from __future__ import annotations

from .context import build_letter_context


def generate_letter(submission) -> dict:
    """
    Returns {'subject': str, 'body_text': str, 'body_html': str}.
    Raises ValueError if the submission's form type has no letter context
    builder registered, or LetterTemplate.DoesNotExist if no active
    template row exists for it (run seed_default_letter_templates() to
    populate the built-in defaults).
    """
    from ..letter_templates import render_letter_template

    code = (submission.form_type_code or "").upper()
    context = build_letter_context(code, submission)
    return render_letter_template(code, context)
