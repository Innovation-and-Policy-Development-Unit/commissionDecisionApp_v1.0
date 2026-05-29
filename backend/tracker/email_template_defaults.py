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
        "slug": "new_user_welcome",
        "name": "New user account created",
        "category": "authentication",
        "description": "Sent when an administrator creates a new user account.",
        "placeholders": _ph("initial_password, login_url"),
        "subject_template": "SCDMS account created — sign-in instructions ({{username}})",
        "body_text_template": (
            "{{greeting}}\n\n"
            "An administrator created your account on SCDMS (Submission & Commission Decision Management System) "
            "for the Office of the Public Service Commission.\n\n"
            "Username: {{username}}\n"
            "Temporary password: {{initial_password}}\n\n"
            "Sign in (use this exact link):\n"
            "{{login_url}}\n\n"
            "If the link is blocked by your email or firewall, open a browser and type:\n"
            "{{login_url}}\n\n"
            "Network access: your IT team may need to allow HTTPS (port 443) to scdms.xyz.\n\n"
            "After sign-in you will be asked to set a new password.\n\n"
            "If you did not expect this email, contact your SCDMS administrator."
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 16px 0;\">An administrator created your <strong>SCDMS</strong> account "
            "(Office of the Public Service Commission).</p>"
            "<div style=\"background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:0 0 18px 0;\">"
            "<p style=\"margin:0;\"><strong>Username:</strong> {{username}}</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>Temporary password:</strong> {{initial_password}}</p>"
            "</div>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{login_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;"
            "text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;\">"
            "Sign in to SCDMS</a>"
            "</p>"
            "<p style=\"margin:0 0 10px 0;color:#475569;font-size:13px;word-break:break-all;\">"
            "Or copy this link: <a href=\"{{login_url}}\" style=\"color:#1e40af;\">{{login_url}}</a>"
            "</p>"
            "<p style=\"margin:0 0 10px 0;color:#64748b;font-size:13px;\">"
            "If your browser warns about the site or your network blocks access, ask IT to allow "
            "<strong>https://scdms.xyz</strong> on port <strong>443</strong>."
            "</p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">"
            "You will be prompted to set a new password on first sign-in."
            "</p>"
        ),
    },
    {
        "slug": "password_reset",
        "name": "Password reset",
        "category": "authentication",
        "description": "Sent when a user requests a password reset link.",
        "placeholders": _ph("reset_url, expiry_hours, login_url"),
        "subject_template": "Reset your password — Commission Decision App",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "You requested a password reset for your Commission Decision App account.\n"
            "Username: {{username}}\n\n"
            "Open this link to set a new password:\n\n"
            "{{reset_url}}\n\n"
            "This link expires in {{expiry_hours}} hour(s).\n\n"
            "After resetting, sign in at: {{login_url}}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        "body_html_template": (
            "<div style=\"font-family:Arial,sans-serif;background:#f8fafc;padding:24px;\">"
            "<div style=\"max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;\">"
            "<div style=\"background:#0f172a;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:600;\">"
            "Commission Decision App"
            "</div>"
            "<div style=\"padding:24px;color:#334155;line-height:1.6;font-size:15px;\">"
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 10px 0;\">You requested a password reset for your account.</p>"
            "<p style=\"margin:0 0 16px 0;\"><strong>Username:</strong> {{username}}</p>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{reset_url}}\" style=\"display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">Reset password</a>"
            "</p>"
            "<p style=\"margin:0 0 10px 0;color:#64748b;font-size:13px;\">This link expires in {{expiry_hours}} hour(s).</p>"
            "<p style=\"margin:0 0 10px 0;color:#64748b;font-size:13px;\">If the button does not open, copy this link:</p>"
            "<p style=\"margin:0 0 16px 0;word-break:break-all;font-size:13px;\"><a href=\"{{reset_url}}\" style=\"color:#2563eb;\">{{reset_url}}</a></p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">If you did not request this, you can ignore this email.</p>"
            "</div>"
            "</div>"
            "</div>"
        ),
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
    {
        "slug": "daily_brief_staff",
        "name": "Daily brief (staff)",
        "category": "system",
        "description": "Personalized morning digest for PSC staff (tasks, submissions, notifications, meetings).",
        "placeholders": _ph("brief_date, sections_html, portal_url"),
        "subject_template": "Your daily brief — {{brief_date}}",
        "body_text_template": (
            "{{greeting}}\n\n"
            "Here is your Commission Decision App brief for {{brief_date}}.\n\n"
            "Open the portal: {{portal_url}}\n\n"
            "— Sections are included in the HTML version of this email."
        ),
        "body_html_template": (
            "<div style=\"font-family:system-ui,sans-serif;color:#334155;max-width:640px;\">"
            "<p>{{greeting}}</p>"
            "<p>Your daily brief for <strong>{{brief_date}}</strong>.</p>"
            "{{sections_html}}"
            "<p style=\"margin-top:1.5em;\"><a href=\"{{portal_url}}\" style=\"color:#2563eb;\">"
            "Open Commission Decision App</a></p></div>"
        ),
    },
    {
        "slug": "daily_brief_manager",
        "name": "Daily brief (manager)",
        "category": "system",
        "description": "Management KPI digest: overdue tasks, pipeline stages, new submissions, meetings.",
        "placeholders": _ph("brief_date, kpis_html, portal_url"),
        "subject_template": "Manager daily brief — {{brief_date}}",
        "body_text_template": (
            "{{greeting}}\n\n"
            "Manager digest for {{brief_date}}.\n\n"
            "Portal: {{portal_url}}\n\n"
            "— KPI details are in the HTML version."
        ),
        "body_html_template": (
            "<div style=\"font-family:system-ui,sans-serif;color:#334155;max-width:640px;\">"
            "<p>{{greeting}}</p>"
            "<p>Manager daily brief for <strong>{{brief_date}}</strong>.</p>"
            "{{kpis_html}}"
            "<p style=\"margin-top:1.5em;\"><a href=\"{{portal_url}}\" style=\"color:#2563eb;\">"
            "Open Commission Decision App</a></p></div>"
        ),
    },
]


SAMPLE_EMAIL_CONTEXTS = {
    "new_user_welcome": {
        "initial_password": "TempPass123!",
        "login_url": "http://localhost:8080/auth/login",
    },
    "password_reset": {
        "reset_url": "http://localhost:8080/auth/reset-password/confirm?token=sample",
        "expiry_hours": "1",
        "login_url": "http://localhost:8080/auth/login",
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
