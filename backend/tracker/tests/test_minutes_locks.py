"""Per-agenda-item visibility locks on signed minutes.

Covers server-side redaction of Minutes.content, the restrict/share/request
endpoints, save-merge protection (an uncleared editor cannot wipe a locked
block), and the Secretary/Admin-only permission gate.
"""

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase
from rest_framework.test import APIClient

from tracker.models import (
    AgendaAccessGrant,
    AgendaAccessRequest,
    AgendaAccessRequestStatus,
    AgendaItemRestriction,
    Meeting,
    Minutes,
    MinutesStatus,
    Profile,
    Role,
    RoleDefinition,
    SystemPermission,
)

SECRET_TEXT = "Sensitive discipline discussion"


def _content():
    return {
        "opening": "Meeting opened.",
        "agenda_items": [
            {
                "agenda_item_id": 101,
                "sequence": 1,
                "submission_ref": "PSC/01/2026",
                "title": "Open item",
                "discussion": "Visible to all",
                "decision": "Approved as presented",
                "decision_type": "approved",
                "action_items": [],
            },
            {
                "agenda_item_id": 102,
                "sequence": 2,
                "submission_ref": "PSC/02/2026",
                "title": "Sensitive item",
                "discussion": SECRET_TEXT,
                "decision": "Officer dismissed",
                "decision_type": "approved",
                "action_items": [{"action": "Serve letter", "responsible": "CSU"}],
            },
        ],
        "closing": "Meeting closed.",
    }


class MinutesLockTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.secretary = User.objects.create_user(username="lock_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.officer = User.objects.create_user(
            username="lock_officer", password="pass", first_name="Olive", last_name="Officer",
        )
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        self.manager = User.objects.create_user(username="lock_manager", password="pass")
        Profile.objects.create(user=self.manager, role=Role.PSC_MANAGER)

        # Secretary's manage_minute_access comes from the RBAC registry.
        perm, _ = SystemPermission.objects.get_or_create(
            code="manage_minute_access",
            defaults={"label": "Restrict & Share Minute Agenda Items", "category": "secretariat"},
        )
        rd, _ = RoleDefinition.objects.get_or_create(role=Role.PSC_SECRETARY)
        rd.permissions.add(perm)

        self.meeting = Meeting.objects.create(
            title="Lock Sitting", date="2026-06-01", time="09:00", venue="Boardroom",
        )
        self.minutes = Minutes.objects.create(
            meeting=self.meeting,
            status=MinutesStatus.SIGNED,
            content=_content(),
            created_by=self.secretary,
        )

    def _restrict_sensitive(self, share_with=None):
        restriction = AgendaItemRestriction.objects.create(
            minutes=self.minutes, item_key="ai-102",
            item_title="Sensitive item", restricted_by=self.secretary,
        )
        for user in share_with or []:
            AgendaAccessGrant.objects.create(
                restriction=restriction, user=user, granted_by=self.secretary,
            )
        return restriction

    def _get_minutes(self, user):
        self.client.force_authenticate(user=user)
        res = self.client.get(f"/api/minutes/{self.minutes.id}/")
        self.assertEqual(res.status_code, 200)
        return res.data

    # ── redaction ────────────────────────────────────────────────────────────

    def test_unrestricted_minutes_fully_visible(self):
        data = self._get_minutes(self.officer)
        self.assertEqual(len(data["content"]["agenda_items"]), 2)
        self.assertEqual(data["content"]["agenda_items"][1]["discussion"], SECRET_TEXT)

    def test_locked_item_redacted_for_uncleared_user(self):
        self._restrict_sensitive()
        data = self._get_minutes(self.officer)

        items = data["content"]["agenda_items"]
        self.assertEqual(len(items), 2)  # whole minutes still visible
        self.assertEqual(items[0]["discussion"], "Visible to all")

        locked = items[1]
        self.assertTrue(locked["restricted"])
        self.assertEqual(locked["title"], "Sensitive item")  # identity kept
        self.assertNotIn("discussion", locked)
        self.assertNotIn("decision", locked)
        self.assertNotIn(SECRET_TEXT, str(data))

    def test_locked_item_visible_to_manager_of_access_and_grantee(self):
        self._restrict_sensitive(share_with=[self.manager])
        for user in (self.secretary, self.manager):
            data = self._get_minutes(user)
            self.assertEqual(
                data["content"]["agenda_items"][1]["discussion"], SECRET_TEXT,
                f"{user.username} should see the locked item",
            )

    def test_stored_pdf_hidden_from_uncleared_user(self):
        self.minutes.pdf_version.save("m.pdf", ContentFile(b"%PDF"), save=True)
        self._restrict_sensitive()
        self.assertIsNone(self._get_minutes(self.officer)["pdf_version"])
        self.assertIsNotNone(self._get_minutes(self.secretary)["pdf_version"])

    # ── save-merge protection ───────────────────────────────────────────────

    def test_uncleared_editor_save_does_not_wipe_locked_block(self):
        self._restrict_sensitive()
        # A commissioner can edit minutes but is not cleared on the locked item.
        commissioner = User.objects.create_user(username="lock_comm", password="pass")
        Profile.objects.create(user=commissioner, role=Role.PSC_COMMISSIONER)

        redacted = self._get_minutes(commissioner)["content"]
        redacted["opening"] = "Amended opening."
        self.client.force_authenticate(user=commissioner)
        res = self.client.patch(
            f"/api/minutes/{self.minutes.id}/", {"content": redacted}, format="json",
        )
        self.assertEqual(res.status_code, 200)

        self.minutes.refresh_from_db()
        stored = self.minutes.content["agenda_items"][1]
        self.assertEqual(stored["discussion"], SECRET_TEXT)  # original survived
        self.assertEqual(self.minutes.content["opening"], "Amended opening.")

    # ── endpoints & permission gate ─────────────────────────────────────────

    def test_restrict_requires_permission(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/restrict-item/", {"index": 1}, format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_restrict_requires_signed_minutes(self):
        self.minutes.status = MinutesStatus.DRAFT
        self.minutes.save(update_fields=["status"])
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/restrict-item/", {"index": 1}, format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_restrict_and_share_flow(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/restrict-item/",
            {"index": 1, "reason": "Discipline matter", "user_ids": [self.manager.id]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        restriction = AgendaItemRestriction.objects.get(minutes=self.minutes, item_key="ai-102")
        self.assertEqual(restriction.reason, "Discipline matter")
        self.assertTrue(restriction.grants.filter(user=self.manager).exists())

        # Manager sees it; officer does not.
        self.assertEqual(
            self._get_minutes(self.manager)["content"]["agenda_items"][1]["discussion"],
            SECRET_TEXT,
        )
        self.assertTrue(
            self._get_minutes(self.officer)["content"]["agenda_items"][1].get("restricted"),
        )

    def test_request_access_and_approval(self):
        self._restrict_sensitive()

        self.client.force_authenticate(user=self.officer)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/request-access/",
            {"item_key": "ai-102", "message": "Implementing this decision."},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        req = AgendaAccessRequest.objects.get(restriction__minutes=self.minutes)
        self.assertEqual(req.status, AgendaAccessRequestStatus.PENDING)
        # Duplicate pending request rejected.
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/request-access/",
            {"item_key": "ai-102"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

        # Officer cannot decide their own request (no permission).
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/decide-request/",
            {"request_id": req.id, "approve": True}, format="json",
        )
        self.assertEqual(res.status_code, 403)

        # Secretary approves → grant exists, officer now sees the item.
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/decide-request/",
            {"request_id": req.id, "approve": True}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, AgendaAccessRequestStatus.APPROVED)
        self.assertEqual(
            self._get_minutes(self.officer)["content"]["agenda_items"][1]["discussion"],
            SECRET_TEXT,
        )

    def test_revoke_and_unrestrict(self):
        restriction = self._restrict_sensitive(share_with=[self.manager])
        self.client.force_authenticate(user=self.secretary)

        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/revoke-access/",
            {"restriction_id": restriction.id, "user_id": self.manager.id}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            self._get_minutes(self.manager)["content"]["agenda_items"][1].get("restricted"),
        )

        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/unrestrict-item/",
            {"restriction_id": restriction.id}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            self._get_minutes(self.officer)["content"]["agenda_items"][1]["discussion"],
            SECRET_TEXT,
        )

    # ── visibility scope ────────────────────────────────────────────────────

    def test_opsc_staff_see_signed_minutes_only(self):
        self.minutes.status = MinutesStatus.DRAFT
        self.minutes.save(update_fields=["status"])

        # Draft hidden from OPSC staff (manager/officer)…
        for user in (self.manager, self.officer):
            self.client.force_authenticate(user=user)
            self.assertEqual(
                self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 404,
            )
            self.assertEqual(self.client.get("/api/minutes/").data, [])
        # …but the Secretariat still sees it.
        self.client.force_authenticate(user=self.secretary)
        self.assertEqual(self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 200)

        # Once signed, OPSC staff see it.
        self.minutes.status = MinutesStatus.SIGNED
        self.minutes.save(update_fields=["status"])
        self.client.force_authenticate(user=self.manager)
        self.assertEqual(self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 200)

    def test_ministry_side_users_never_see_minutes(self):
        ministry_user = User.objects.create_user(username="lock_ministry", password="pass")
        Profile.objects.create(user=ministry_user, role=Role.MINISTRY_HR)
        self.client.force_authenticate(user=ministry_user)
        self.assertEqual(self.client.get("/api/minutes/").data, [])
        self.assertEqual(
            self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 404,
        )

    def test_shareable_users_gate(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get(f"/api/minutes/{self.minutes.id}/shareable-users/?q=olive")
        self.assertEqual(res.status_code, 403)

        self.client.force_authenticate(user=self.secretary)
        res = self.client.get(f"/api/minutes/{self.minutes.id}/shareable-users/?q=olive")
        self.assertEqual(res.status_code, 200)
        self.assertIn("lock_officer", [u["username"] for u in res.data])
