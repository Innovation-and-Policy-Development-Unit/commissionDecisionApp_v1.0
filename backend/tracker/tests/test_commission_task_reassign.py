"""Tests for CommissionTaskViewSet.reassign() staff-assignment notification.

Regression coverage for the bug where "Reassign" silently updated
assigned_staff_m2m without telling the newly-assigned staff, unlike the
equivalent "Save" (update()) path which always called notify_task_assigned.
"""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..models import CommissionTask, EmailTemplate, Profile, Role


def _user(username, role, *, email=""):
    u = User.objects.create_user(username, password="x", email=email)
    Profile.objects.create(user=u, role=role)
    return u


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ReassignNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # is_superuser bypasses the RoleDefinition/"assign_task" permission
        # lookup (views.py's is_manager check) so this test isn't coupled to
        # RBAC fixture data unrelated to the notification bug under test.
        self.manager = User.objects.create_user(
            "reassign_mgr", password="x", email="mgr@gov.vu", is_superuser=True,
        )
        self.existing_staff = _user("reassign_existing", Role.ODU_PRINCIPAL, email="existing@gov.vu")
        self.new_staff = _user("reassign_new", Role.ODU_PRINCIPAL, email="new@gov.vu")
        self.other_new_staff = _user("reassign_new2", Role.ODU_SENIOR, email="new2@gov.vu")

        self.task = CommissionTask.objects.create(
            title="Action the decision",
            assigned_manager=self.manager,
            created_by=self.manager,
        )
        self.task.assigned_staff_m2m.add(self.existing_staff)

    def _reassign(self, staff_ids):
        self.client.force_authenticate(user=self.manager)
        return self.client.post(
            f"/api/commission-tasks/{self.task.id}/reassign/",
            {"assigned_staff_m2m": staff_ids},
            format="json",
        )

    @patch("tracker.email_notify.notify_task_assigned")
    def test_reassign_notifies_newly_added_staff(self, mock_notify):
        resp = self._reassign([self.existing_staff.id, self.new_staff.id])
        self.assertEqual(resp.status_code, 200, resp.content)

        mock_notify.assert_called_once()
        notified_task, notified_users = mock_notify.call_args[0]
        self.assertEqual(notified_task.id, self.task.id)
        self.assertEqual({u.id for u in notified_users}, {self.new_staff.id})

    @patch("tracker.email_notify.notify_task_assigned")
    def test_reassign_notifies_only_the_newly_added_staff_when_mixed(self, mock_notify):
        resp = self._reassign([self.existing_staff.id, self.new_staff.id, self.other_new_staff.id])
        self.assertEqual(resp.status_code, 200, resp.content)

        notified_task, notified_users = mock_notify.call_args[0]
        self.assertEqual({u.id for u in notified_users}, {self.new_staff.id, self.other_new_staff.id})

    @patch("tracker.email_notify.notify_task_assigned")
    def test_reassign_to_same_staff_set_does_not_notify(self, mock_notify):
        """No newly-added staff -> no notification (matches update() behavior)."""
        resp = self._reassign([self.existing_staff.id])
        self.assertEqual(resp.status_code, 200, resp.content)
        mock_notify.assert_not_called()

    @patch("tracker.email_notify.notify_task_assigned")
    def test_dropping_staff_without_adding_does_not_notify(self, mock_notify):
        self.task.assigned_staff_m2m.add(self.new_staff)
        resp = self._reassign([self.existing_staff.id])
        self.assertEqual(resp.status_code, 200, resp.content)
        mock_notify.assert_not_called()

    def test_reassign_sends_real_email_to_new_staff_end_to_end(self):
        """No mocking: exercise the actual send_templated_email path.

        Uses update_or_create because "task_assigned" (like every slug in
        DEFAULT_EMAIL_TEMPLATES) may already have been seeded by one of the
        several data migrations that call seed_default_email_templates().
        """
        EmailTemplate.objects.update_or_create(
            slug="task_assigned",
            defaults=dict(
                name="Task assigned to you",
                category=EmailTemplate.Category.TASKS,
                subject_template="Task assigned: {{task_title}}",
                body_text_template="Dear {{firstname}}, you have been assigned: {{task_title}}.",
                is_active=True,
            ),
        )
        mail.outbox.clear()

        resp = self._reassign([self.existing_staff.id, self.new_staff.id])
        self.assertEqual(resp.status_code, 200, resp.content)

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["new@gov.vu"])
        self.assertIn(self.task.title, sent.subject)
