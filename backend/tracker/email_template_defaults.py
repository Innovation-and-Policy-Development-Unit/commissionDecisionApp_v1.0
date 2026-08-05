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
        "placeholders": _ph("initial_password, login_url, portal_domain"),
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
            "Network access: your IT team may need to allow HTTPS (port 443) to {{portal_domain}}.\n\n"
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
            "<strong>{{portal_domain}}</strong> on port <strong>443</strong>."
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
        "subject_template": "Reset your password — SCDMS",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "You requested a password reset for your SCDMS account.\n"
            "Username: {{username}}\n\n"
            "Open this link to set a new password:\n\n"
            "{{reset_url}}\n\n"
            "This link expires in {{expiry_hours}} hour(s).\n\n"
            "After resetting, sign in at: {{login_url}}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        "body_html_template": (
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
        ),
    },
    {
        "slug": "account_locked_user",
        "name": "Account locked (user notice)",
        "category": "authentication",
        "description": "Sent to a user when their account is temporarily or permanently locked.",
        "placeholders": _ph("lock_summary, unlock_instructions, ip_address, attempt_time, login_url"),
        "subject_template": "Security alert: your SCDMS account was locked",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{lock_summary}}\n\n"
            "Username: {{username}}\n"
            "Time: {{attempt_time}}\n"
            "IP address: {{ip_address}}\n\n"
            "{{unlock_instructions}}\n\n"
            "If this was you, no further action is needed once access is restored. "
            "If it was not you, please notify your SCDMS administrator immediately — "
            "someone may be attempting to access your account."
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 14px 0;\">{{lock_summary}}</p>"
            "<div style=\"background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin:0 0 16px 0;\">"
            "<p style=\"margin:0;\"><strong>Username:</strong> {{username}}</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>Time:</strong> {{attempt_time}}</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>IP address:</strong> {{ip_address}}</p>"
            "</div>"
            "<p style=\"margin:0 0 14px 0;\">{{unlock_instructions}}</p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">If this was not you, notify your SCDMS "
            "administrator immediately — someone may be attempting to access your account.</p>"
        ),
    },
    {
        "slug": "account_locked_admin",
        "name": "Account locked (administrator alert)",
        "category": "authentication",
        "description": "Sent to super administrators when any account is locked out.",
        "placeholders": _ph("target_username, target_email, lock_summary, ip_address, attempt_time, admin_url"),
        "subject_template": "SCDMS lockout: {{target_username}} was {{lock_summary}}",
        "body_text_template": (
            "A user account has been locked on SCDMS.\n\n"
            "Account: {{target_username}} ({{target_email}})\n"
            "Status: {{lock_summary}}\n"
            "Time: {{attempt_time}}\n"
            "IP address: {{ip_address}}\n\n"
            "Review the account in the Admin panel:\n"
            "{{admin_url}}\n\n"
            "Permanently locked accounts can only be unlocked by a super administrator."
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 14px 0;\">A user account has been locked on SCDMS.</p>"
            "<div style=\"background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:0 0 16px 0;\">"
            "<p style=\"margin:0;\"><strong>Account:</strong> {{target_username}} ({{target_email}})</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>Status:</strong> {{lock_summary}}</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>Time:</strong> {{attempt_time}}</p>"
            "<p style=\"margin:6px 0 0 0;\"><strong>IP address:</strong> {{ip_address}}</p>"
            "</div>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{admin_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">Open Admin panel</a>"
            "</p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">Permanently locked accounts can only be unlocked by a super administrator.</p>"
        ),
    },
    {
        "slug": "agenda_circulated",
        "name": "Agenda circulated to Commission members",
        "category": "submission_workflow",
        "description": "Sent to Commission members + Chairperson when an approved agenda is circulated.",
        "placeholders": _ph("meeting_reference, meeting_date, agenda_url"),
        "subject_template": "Agenda circulated — {{meeting_reference}} ({{meeting_date}})",
        "body_text_template": (
            "{{greeting}}\n\n"
            "The Chairman has endorsed the agenda for the Commission sitting on {{meeting_date}} "
            "({{meeting_reference}}).\n\n"
            "The approved agenda is attached and is also available in the Agenda menu:\n"
            "{{agenda_url}}\n\n"
            "During the sitting you can open the Sitting Pack to follow each item.\n"
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 14px 0;\">The Chairman has endorsed the agenda for the Commission sitting on "
            "<strong>{{meeting_date}}</strong> ({{meeting_reference}}).</p>"
            "<p style=\"margin:0 0 16px 0;\">The approved agenda is attached, and is also available in the Agenda menu.</p>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{agenda_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">View the agenda</a>"
            "</p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">During the sitting, open the Sitting Pack to follow each item.</p>"
        ),
    },
    {
        "slug": "meeting_scheduled",
        "name": "Meeting scheduled — HR notification",
        "category": "system",
        "description": "Sent to HR managers when a new Commission meeting/sitting is created.",
        "placeholders": _ph(
            "meeting_reference, meeting_title, meeting_date, meeting_time, "
            "meeting_venue, submission_deadline, meeting_url"
        ),
        "subject_template": "New sitting scheduled — {{meeting_reference}} ({{meeting_date}})",
        "body_text_template": (
            "{{greeting}}\n\n"
            "A new Commission sitting has been scheduled.\n\n"
            "Reference: {{meeting_reference}}\n"
            "Title: {{meeting_title}}\n"
            "Date: {{meeting_date}}\n"
            "Time: {{meeting_time}}\n"
            "Venue: {{meeting_venue}}\n"
            "Submission deadline (due date): {{submission_deadline}}\n\n"
            "Please ensure any submissions for this sitting are lodged before the "
            "submission deadline. You can view the sitting here:\n"
            "{{meeting_url}}\n"
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 14px 0;\">A new Commission sitting has been scheduled.</p>"
            "<table style=\"border-collapse:collapse;font-size:14px;margin:0 0 16px 0;\">"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Reference</td><td style=\"padding:3px 0;\"><strong>{{meeting_reference}}</strong></td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Title</td><td style=\"padding:3px 0;\">{{meeting_title}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Date</td><td style=\"padding:3px 0;\"><strong>{{meeting_date}}</strong></td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Time</td><td style=\"padding:3px 0;\">{{meeting_time}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Venue</td><td style=\"padding:3px 0;\">{{meeting_venue}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Submission deadline</td><td style=\"padding:3px 0;color:#b91c1c;\"><strong>{{submission_deadline}}</strong></td></tr>"
            "</table>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{meeting_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">View the sitting</a>"
            "</p>"
            "<p style=\"margin:0;color:#64748b;font-size:13px;\">Please ensure any submissions for this sitting are lodged before the submission deadline.</p>"
        ),
    },
    {
        "slug": "meeting_postponed",
        "name": "Meeting postponed — HR notification",
        "category": "system",
        "description": "Sent to HR managers when a Commission meeting/sitting's date or time is changed, since this also moves the submission deadline.",
        "placeholders": _ph(
            "meeting_reference, meeting_title, old_meeting_date, old_meeting_time, "
            "new_meeting_date, new_meeting_time, meeting_venue, old_submission_deadline, "
            "new_submission_deadline, deadline_change_note, meeting_url"
        ),
        "subject_template": "Sitting postponed — {{meeting_reference}} (now {{new_meeting_date}})",
        "body_text_template": (
            "{{greeting}}\n\n"
            "A Commission sitting has been rescheduled.\n\n"
            "Reference: {{meeting_reference}}\n"
            "Title: {{meeting_title}}\n"
            "Previous date: {{old_meeting_date}} at {{old_meeting_time}}\n"
            "New date: {{new_meeting_date}} at {{new_meeting_time}}\n"
            "Venue: {{meeting_venue}}\n\n"
            "Previous submission deadline: {{old_submission_deadline}}\n"
            "New submission deadline: {{new_submission_deadline}}\n"
            "{{deadline_change_note}}\n\n"
            "You can view the sitting here:\n"
            "{{meeting_url}}\n"
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 14px 0;\">A Commission sitting has been rescheduled.</p>"
            "<table style=\"border-collapse:collapse;font-size:14px;margin:0 0 16px 0;\">"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Reference</td><td style=\"padding:3px 0;\"><strong>{{meeting_reference}}</strong></td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Title</td><td style=\"padding:3px 0;\">{{meeting_title}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Previous date</td><td style=\"padding:3px 0;text-decoration:line-through;color:#94a3b8;\">{{old_meeting_date}} at {{old_meeting_time}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">New date</td><td style=\"padding:3px 0;\"><strong>{{new_meeting_date}} at {{new_meeting_time}}</strong></td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Venue</td><td style=\"padding:3px 0;\">{{meeting_venue}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">Previous deadline</td><td style=\"padding:3px 0;text-decoration:line-through;color:#94a3b8;\">{{old_submission_deadline}}</td></tr>"
            "<tr><td style=\"padding:3px 12px 3px 0;color:#64748b;\">New deadline</td><td style=\"padding:3px 0;color:#b91c1c;\"><strong>{{new_submission_deadline}}</strong></td></tr>"
            "</table>"
            "<p style=\"margin:0 0 16px 0;font-weight:600;\">{{deadline_change_note}}</p>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{meeting_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">View the sitting</a>"
            "</p>"
        ),
    },
    {
        "slug": "minutes_signed",
        "name": "Signed minutes on record",
        "category": "submission_workflow",
        "description": "Sent to Commission members + Chairperson when signed minutes are uploaded.",
        "placeholders": _ph("meeting_reference, meeting_date, minutes_url"),
        "subject_template": "Signed minutes on record — {{meeting_reference}}",
        "body_text_template": (
            "{{greeting}}\n\n"
            "The signed minutes for the Commission sitting of {{meeting_date}} ({{meeting_reference}}) "
            "have been uploaded and are now the official record.\n\n"
            "You can view them in the Minutes menu:\n"
            "{{minutes_url}}\n"
        ),
        "body_html_template": (
            "<p style=\"margin:0 0 12px 0;\">{{greeting}}</p>"
            "<p style=\"margin:0 0 14px 0;\">The signed minutes for the Commission sitting of "
            "<strong>{{meeting_date}}</strong> ({{meeting_reference}}) have been uploaded and are now the official record.</p>"
            "<p style=\"margin:0 0 16px 0;\">"
            "<a href=\"{{minutes_url}}\" style=\"display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;\">View the minutes</a>"
            "</p>"
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
        "slug": "submission_received_confirmation",
        "name": "Submission received — external confirmation",
        "category": "submission_workflow",
        "description": "Confirms PSC receipt to the ministry DG/HR contacts and any additional "
                        "addresses HR added — includes the public tracking link, no login required.",
        "placeholders": _ph("submission_reference, submission_title, tracking_url"),
        "subject_template": "Your submission {{submission_reference}} has been received by OPSC",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{submission_title}} (reference {{submission_reference}}) has been received by the "
            "Office of the Public Service Commission and is now being processed.\n\n"
            "You can track its progress at any time, without needing to log in:\n"
            "{{tracking_url}}\n\n"
            "Keep this reference number for future enquiries: {{submission_reference}}"
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
        "slug": "submission_pending_dg_endorsement",
        "name": "Awaiting DG endorsement",
        "category": "submission_workflow",
        "description": "Notifies the Head of Agency (DG) when Ministry HR submits a paper for their endorsement.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage"),
        "subject_template": "Endorsement required: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "\"{{submission_title}}\" ({{submission_reference}}) has been submitted by your Ministry HR "
            "and is awaiting your endorsement before it is sent to the Public Service Commission.\n\n"
            "Please review and either endorse it to the PSC or return it to HR with your comments.\n\n"
            "View submission: {{submission_url}}"
        ),
        "body_html_template": "",
    },
    {
        "slug": "submission_returned_to_hr",
        "name": "Returned by DG for changes",
        "category": "submission_workflow",
        "description": "Notifies Ministry HR when the Head of Agency (DG) returns a submission to draft for changes.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, new_stage, remarks"),
        "subject_template": "Returned for changes: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "The Director-General returned \"{{submission_title}}\" ({{submission_reference}}) to you for changes.\n\n"
            "Comment from the Director-General:\n{{remarks}}\n\n"
            "Please make the requested changes and resubmit for endorsement.\n\n"
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
        "slug": "submission_assigned_officer",
        "name": "Submission allocated to you",
        "category": "submission_workflow",
        "description": "Notifies a unit officer when their manager allocates a submission to them for assessment.",
        "placeholders": _ph("submission_reference, submission_title, submission_url, manager_name"),
        "subject_template": "Assigned to you: {{submission_reference}}",
        "body_text_template": (
            "Dear {{firstname}},\n\n"
            "{{manager_name}} has allocated \"{{submission_title}}\" ({{submission_reference}}) "
            "to you for assessment.\n\n"
            "Open the submission: {{submission_url}}"
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
            "Here is your SCDMS brief for {{brief_date}}.\n\n"
            "Open the portal: {{portal_url}}\n\n"
            "— Sections are included in the HTML version of this email."
        ),
        "body_html_template": (
            "<div style=\"font-family:system-ui,sans-serif;color:#334155;max-width:640px;\">"
            "<p>{{greeting}}</p>"
            "<p>Your daily brief for <strong>{{brief_date}}</strong>.</p>"
            "{{sections_html}}"
            "<p style=\"margin-top:1.5em;\"><a href=\"{{portal_url}}\" style=\"color:#2563eb;\">"
            "Open SCDMS</a></p></div>"
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
            "Open SCDMS</a></p></div>"
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
    "submission_received_confirmation": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "tracking_url": "http://localhost:8080/track?ref=PSC-2026-0042",
    },
    "meeting_scheduled": {
        "meeting_reference": "PSC-MTG-2026-014",
        "meeting_title": "Ordinary Commission Sitting",
        "meeting_date": "30 June 2026",
        "meeting_time": "09:00",
        "meeting_venue": "PSC Boardroom",
        "submission_deadline": "27 June 2026",
        "meeting_url": "http://localhost:8080/secretariat/agenda",
    },
    "meeting_postponed": {
        "meeting_reference": "PSC-MTG-2026-014",
        "meeting_title": "Ordinary Commission Sitting",
        "old_meeting_date": "30 June 2026",
        "old_meeting_time": "09:00",
        "new_meeting_date": "14 July 2026",
        "new_meeting_time": "09:00",
        "meeting_venue": "PSC Boardroom",
        "old_submission_deadline": "27 June 2026",
        "new_submission_deadline": "11 July 2026",
        "deadline_change_note": "The submission deadline has moved later — you now have more time to lodge submissions for this sitting.",
        "meeting_url": "http://localhost:8080/secretariat/agenda",
    },
    "submission_pending_dg_endorsement": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "submission_url": "http://localhost:8080/submissions/1",
        "new_stage": "Submitted to DG (Pending Endorsement)",
    },
    "submission_returned_to_hr": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "submission_url": "http://localhost:8080/submissions/1",
        "new_stage": "Draft",
        "remarks": "Please attach the updated organisation chart and correct the position titles in section 3.",
    },
    "submission_stage_changed": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Senior appointment — Ministry of Finance",
        "submission_url": "http://localhost:8080/submissions/1",
        "previous_stage": "Under Assessment",
        "new_stage": "Forwarded to Commission",
    },
    "submission_assigned_officer": {
        "submission_reference": "PSC-2026-0042",
        "submission_title": "Organisation restructure — Ministry of Climate Change",
        "submission_url": "http://localhost:8080/submissions/1",
        "manager_name": "Manager ODU",
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
