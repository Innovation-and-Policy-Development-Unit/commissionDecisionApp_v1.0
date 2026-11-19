"""Review tracker: which Commissioners have read the circulated draft minutes."""

import datetime
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Meeting, Ministry, Minutes, MinutesStatus, MinutesCommissionerReview,
    Notification, Profile, Role,
)
from ..tasks import remind_commissioners_to_review_minutes


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TrackerTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_CR", name="Review Tracker Ministry")
        self.meeting = Meeting.objects.create(
            title="PSC Meeting No. 13", date=timezone.now().date(),
            time=datetime.time(9, 0), venue="Boardroom",
        )
        self.secretary = self._user("cr_secretary", Role.PSC_SECRETARY)
        self.chairman = self._user("cr_chairman", Role.CHAIRPERSON)
        self.c1 = self._user("cr_comm1", Role.PSC_COMMISSIONER)
        self.c2 = self._user("cr_comm2", Role.PSC_COMMISSIONER)
        self.c3 = self._user("cr_comm3", Role.PSC_COMMISSIONER)
        self.minutes = Minutes.objects.create(
            meeting=self.meeting, created_by=self.secretary, status=MinutesStatus.REVIEWED,
        )

    def _user(self, username, role):
        user = User.objects.create_user(username, password="x")
        Profile.objects.create(user=user, role=role, ministry=self.ministry)
        return user

    def _api(self, user, method, path, data=None, **kw):
        client = APIClient()
        client.force_authenticate(user=user)
        return getattr(client, method)(f"/api/minutes/{self.minutes.id}/{path}", data or {}, format="json", **kw)

    def _circulate(self):
        with mock.patch("tracker.email_notify.notify_minutes_circulated_to_commissioners"):
            r = self._api(self.secretary, "post", "circulate-to-commissioners/")
        self.assertEqual(r.status_code, 200, r.content)
        self.minutes.refresh_from_db()

    def _by_name(self, payload):
        return {row["name"]: row["status"] for row in payload["rows"]}

    def test_circulating_makes_a_row_per_commissioner(self):
        self._circulate()
        self.assertEqual(MinutesCommissionerReview.objects.filter(minutes=self.minutes).count(), 3)

    def test_status_moves_from_not_opened_to_opened_to_responded(self):
        self._circulate()
        payload = self._api(self.secretary, "get", "review-tracker/").json()
        self.assertEqual(payload["outstanding"], 3)
        self.assertTrue(all(s == "not_opened" for s in self._by_name(payload).values()))

        self.assertEqual(self._api(self.c1, "post", "review-opened/").status_code, 204)
        self._api(self.c2, "post", "comments/", {"body": "Item 2 needs a date."})
        self.assertEqual(self._api(self.c3, "post", "confirm-read/").status_code, 200)

        payload = self._api(self.secretary, "get", "review-tracker/").json()
        by = self._by_name(payload)
        self.assertEqual(by["cr_comm1"], "opened")
        self.assertEqual(by["cr_comm2"], "commented")
        self.assertEqual(by["cr_comm3"], "no_comments")
        self.assertEqual(payload["outstanding"], 1)
        self.assertEqual(payload["responded"], 2)

    def test_a_commissioner_sees_only_their_own_line(self):
        self._circulate()
        payload = self._api(self.c1, "get", "review-tracker/").json()
        self.assertEqual([r["name"] for r in payload["rows"]], ["cr_comm1"])

    def test_confirm_read_is_commissioners_only_and_needs_circulation(self):
        self.assertEqual(self._api(self.c1, "post", "confirm-read/").status_code, 400)
        self._circulate()
        self.assertEqual(self._api(self.secretary, "post", "confirm-read/").status_code, 403)

    def test_remind_now_goes_only_to_outstanding_commissioners(self):
        self._circulate()
        self._api(self.c3, "post", "confirm-read/")
        r = self._api(self.secretary, "post", "remind-commissioners/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["reminded"], 2)
        got = set(Notification.objects.filter(title__startswith="Reminder").values_list("recipient__username", flat=True))
        self.assertEqual(got, {"cr_comm1", "cr_comm2"})
        self.assertEqual(self._api(self.c1, "post", "remind-commissioners/").status_code, 403)

    def test_daily_sweep_skips_day_one_then_chases_once_a_day(self):
        self._circulate()
        self.assertEqual(remind_commissioners_to_review_minutes(), 0)  # just circulated
        Minutes.objects.filter(pk=self.minutes.pk).update(
            commissioner_circulated_at=timezone.now() - datetime.timedelta(days=1, hours=1))
        self._api(self.c3, "post", "confirm-read/")
        self.assertEqual(remind_commissioners_to_review_minutes(), 2)
        self.assertEqual(remind_commissioners_to_review_minutes(), 0)  # already chased today

    def test_overdue_sweep_tells_secretary_and_chairman_once(self):
        self._circulate()
        past = timezone.now() - datetime.timedelta(days=3)
        Minutes.objects.filter(pk=self.minutes.pk).update(
            commissioner_circulated_at=past, commissioner_review_due_at=past + datetime.timedelta(days=2))
        remind_commissioners_to_review_minutes()
        notices = Notification.objects.filter(title__startswith="Minutes review overdue")
        self.assertEqual({n.recipient.username for n in notices}, {"cr_secretary", "cr_chairman"})
        MinutesCommissionerReview.objects.update(last_reminded_at=past)
        remind_commissioners_to_review_minutes()
        self.assertEqual(Notification.objects.filter(title__startswith="Minutes review overdue").count(), 2)

    def test_secretary_can_upload_the_signed_scan(self):
        Minutes.objects.filter(pk=self.minutes.pk).update(status=MinutesStatus.AWAITING_SIGNATURE)
        pdf = SimpleUploadedFile("signed.pdf", b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF", content_type="application/pdf")
        client = APIClient()
        client.force_authenticate(user=self.secretary)
        r = client.post(f"/api/minutes/{self.minutes.id}/upload-signed/", {"signed_document": pdf}, format="multipart")
        self.assertNotEqual(r.status_code, 403, r.content)
