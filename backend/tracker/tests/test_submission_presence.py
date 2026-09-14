"""Submission presence over WebSockets (SubmissionPresenceConsumer)."""

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from tracker.models import Ministry, Profile, Role, Submission, SubmissionPresence


class SubmissionPresenceConsumerTests(TransactionTestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="officer_a", password="pass")
        self.user_b = User.objects.create_user(username="officer_b", password="pass")
        Profile.objects.create(user=self.user_a, role=Role.PSC_OFFICER)
        Profile.objects.create(user=self.user_b, role=Role.PSC_OFFICER)
        ministry = Ministry.objects.create(code="TST-PRES", name="Test Ministry Presence")
        self.submission = Submission.objects.create(
            title="Shared matter",
            ministry=ministry,
            received_at=timezone.now(),
            created_by=self.user_a,
        )

    async def _connect(self, user, submission_id=None):
        token = str(AccessToken.for_user(user))
        sid = submission_id if submission_id is not None else self.submission.id
        communicator = WebsocketCommunicator(
            application, f"/ws/submissions/{sid}/presence/?token={token}",
        )
        connected, _ = await communicator.connect()
        return communicator, connected

    async def test_second_viewer_appears_to_first(self):
        comm_a, connected = await self._connect(self.user_a)
        self.assertTrue(connected)
        initial_a = await comm_a.receive_json_from()
        self.assertEqual([v["username"] for v in initial_a["viewers"]], ["officer_a"])
        self.assertTrue(initial_a["viewers"][0]["is_self"])

        comm_b, connected_b = await self._connect(self.user_b)
        self.assertTrue(connected_b)
        await comm_b.receive_json_from()  # b's own initial list (contains a)

        update = await comm_a.receive_json_from()
        usernames = {v["username"] for v in update["viewers"]}
        self.assertIn("officer_b", usernames)

        await comm_a.disconnect()
        await comm_b.disconnect()

    async def test_disconnect_removes_viewer_and_clears_row(self):
        comm_a, _ = await self._connect(self.user_a)
        await comm_a.receive_json_from()
        comm_b, _ = await self._connect(self.user_b)
        await comm_b.receive_json_from()
        await comm_a.receive_json_from()  # a sees b join

        await comm_b.disconnect()
        update = await comm_a.receive_json_from()
        usernames = {v["username"] for v in update["viewers"]}
        self.assertNotIn("officer_b", usernames)

        exists = await database_sync_to_async(
            SubmissionPresence.objects.filter(submission=self.submission, user=self.user_b).exists
        )()
        self.assertFalse(exists)

        await comm_a.disconnect()

    async def test_user_without_access_is_rejected(self):
        outsider = await database_sync_to_async(User.objects.create_user)(
            username="outsider", password="pass",
        )
        await database_sync_to_async(Profile.objects.create)(
            user=outsider, role=Role.MINISTRY_HR,
        )
        comm, connected = await self._connect(outsider)
        self.assertFalse(connected)
