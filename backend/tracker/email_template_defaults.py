"""Built-in email templates seeded on migration and available for reset."""

# Available on every recipient-specific email (User.first_name → {{firstname}})
RECIPIENT_PLACEHOLDERS = (
    "firstname, lastname, full_name, recipient_name, username, email, greeting"
)

SAMPLE_RECIPIENT = {
    "firstname": "Herman",
    "lastname": "Tavoa",
    "full_name": "Herman Tavoa",
    "recipient_name": "Herman Tavoa",
    "username": "htavoa",
    "email": "herman@example.gov.vu",
    "greeting": "Dear Herman,",
}


def _ph(*extra: str) -> str:
    parts = [RECIPIENT_PLACEHOLDERS]
    parts.extend(extra)
    return ", ".join(parts)


DEFAULT_EMAIL_TEMPLATES = [
    {
        "slug": "password_reset",
        "name": "Password reset",
        "category": "authentication",
        "description": "Sent when a user requests a password reset link.",
        "placeholders": _ph("reset_url, expiry_hours"),
        "subject_template": "Reset your password — Commission Decision App",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "You requested a password reset for your Commission Decision App account.\n"
            "Open this link to set a new password:\n\n"
            "{{reset_url}}\n\n"
            "This link expires in {{expiry_hours}} hour(s).\n\n"
            "If you did not request this, you can ignore this email."
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_submitted",
        "name": "Submission submitted to PSC",
        "category": "submission_workflow",
        "description": "Notifies the routed unit manager when a ministry submission is first submitted.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "New submission: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{submission_title}} ({{submission_reference}}) has been submitted to PSC.\n"
            "Current stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_returned_clarification",
        "name": "Returned for clarification",
        "category": "submission_workflow",
        "description": "Notifies the submitter when PSC returns a submission for clarification.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "Submission returned: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "Your submission \"{{submission_title}}\" ({{submission_reference}}) was returned for clarification.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_resubmitted",
        "name": "Submission resubmitted",
        "category": "submission_workflow",
        "description": "Notifies the unit manager when a submission is resubmitted after clarification.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "Resubmitted: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{submission_title}} ({{submission_reference}}) has been resubmitted after clarification.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_forwarded_commission",
        "name": "Forwarded to Commission",
        "category": "submission_workflow",
        "description": "Notifies Secretary and Commissioners that a submission is ready for Commission.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "Ready for Commission: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{submission_title}} ({{submission_reference}}) has been forwarded to the Commission.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_deferred_back_hr",
        "name": "Deferred back to ministry/HR",
        "category": "submission_workflow",
        "description": "Notifies the submitter when the Commission defers a matter back to the ministry.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "Deferred back to ministry: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "The Commission has deferred \"{{submission_title}}\" ({{submission_reference}}) back to your ministry for further action.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_approved",
        "name": "Submission approved",
        "category": "submission_workflow",
        "description": "Notifies managers and submitter when the Commission approves a submission.",
        "placeholders": _ph(
            "submission_reference, submission_title, submission_url, new_stage, decision_label"
        ),
        "subject_template": "Submission approved: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "\"{{submission_title}}\" ({{submission_reference}}) has been {{decision_label}} by the Commission.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_rejected",
        "name": "Submission rejected",
        "category": "submission_workflow",
        "description": "Notifies managers and submitter when the Commission rejects a submission.",
        "placeholders": _ph(
            "submission_reference, submission_title, submission_url, new_stage, decision_label"
        ),
        "subject_template": "Submission rejected: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "\"{{submission_title}}\" ({{submission_reference}}) has been {{decision_label}} by the Commission.\n"
            "Stage: {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_stage_changed",
        "name": "Submission stage changed (generic)",
        "category": "submission_workflow",
        "description": "Generic template when a submission moves between workflow stages.",
        "placeholders": _ph(
            "submission_reference, submission_title, submission_url, previous_stage, new_stage"
        ),
        "subject_template": "Submission update: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{submission_title}} ({{submission_reference}}) has moved from {{previous_stage}} to {{new_stage}}.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "task_assigned",
        "name": "Task assigned to you",
        "category": "tasks",
        "description": "Sent when a commission implementation task is allocated or staff are assigned.",
        "placeholders": _ph("task_title, task_url, submission_reference, due_date"),
        "subject_template": "Task assigned: {{task_title}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "You have been assigned a commission task: {{task_title}}.\n"
            "Submission: {{submission_reference}}\n"
            "Due date: {{due_date}}\n\n"
            "Open tasks: {{task_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "task_due_soon",
        "name": "Task due soon",
        "category": "tasks",
        "description": "Reminder when a task due date is within the configured alert window.",
        "placeholders": _ph("task_title, task_url, submission_reference, due_date, days_remaining"),
        "subject_template": "Due soon: {{task_title}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "Task \"{{task_title}}\" ({{submission_reference}}) is due on {{due_date}}.\n"
            "Only {{days_remaining}} day(s) remaining.\n\n"
            "Open tasks: {{task_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "subtask_due_soon",
        "name": "Subtask due soon",
        "category": "tasks",
        "description": "Reminder when a subtask due date is within the alert window.",
        "placeholders": _ph("task_title, parent_task_title, task_url, due_date, days_remaining"),
        "subject_template": "Subtask due soon: {{task_title}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "Subtask \"{{task_title}}\" (under {{parent_task_title}}) is due on {{due_date}}.\n"
            "Only {{days_remaining}} day(s) remaining.\n\n"
            "Open tasks: {{task_url}}"
        ),
        "body_html_template": "",
    },
]


SAMPLE_EMAIL_CONTEXTS = {
    "password_reset": {
        "reset_url": "http://localhost:8080/auth/reset-password/confirm?token=sample",
        "expiry_hours": "1",
    },
    "submission_submitted": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "submission_url": "http://localhost:8080/submissions/1",
        "new_stage": "Submitted to PSC",
    },
    "submission_stage_changed": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "submission_url": "http://localhost:8080/submissions/1",
        "previous_stage": "Under Assessment",
        "new_stage": "Forwarded to Commission",
    },
    "task_assigned": {
        "task_title": "Implement decision on senior appointment",
        "task_url": "http://localhost:8080/secretariat/tasks",
        "submission_reference": "PSC-2026-0042",
        "due_date": "2026-06-30",
    },
    "task_due_soon": {
        "task_title": "Implement decision on senior appointment",
        "task_url": "http://localhost:8080/secretariat/tasks",
        "submission_reference": "PSC-2026-0042",
        "due_date": "2026-06-30",
        "days_remaining": "3",
    },
    "subtask_due_soon": {
        "task_title": "Draft implementation plan",
        "parent_task_title": "Implement decision on senior appointment",
        "task_url": "http://localhost:8080/secretariat/tasks",
        "due_date": "2026-06-15",
        "days_remaining": "3",
    },
}
