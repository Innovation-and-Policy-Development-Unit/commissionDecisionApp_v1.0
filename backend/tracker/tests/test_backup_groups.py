"""Selective backup: groups, computed dependencies, partial dumps, manifest, API."""

import json
import os
import shutil
import tempfile
import zipfile
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker import backup_groups
from tracker.backup_restore import read_manifest
from tracker.models import Ministry, Profile, Role, Submission, SubmissionDocument


class GroupDefinitionTests(TestCase):
    def test_every_dumpable_model_is_in_exactly_one_group(self):
        # A new model that is not assigned would silently fall out of selective backups.
        self.assertEqual(
            backup_groups.validate_group_coverage(),
            {"unassigned": [], "duplicated": [], "unknown": []},
        )

    def test_daily_brief_models_are_grouped_even_when_ready_skipped_them(self):
        owners = {label for g in backup_groups.GROUPS.values() for label in g["models"]}
        self.assertIn("tracker.dailybriefdeliverylog", owners)
        self.assertIn("tracker.dailybriefsettings", owners)

    def test_agenda_requires_submissions_but_not_the_other_way_round(self):
        links = backup_groups.group_links()
        self.assertTrue(links["agenda"]["submissions"]["required"])
        self.assertIn("submissions", links["agenda"])
        self.assertFalse(links["submissions"]["agenda"]["required"])  # nullable link only

    def test_required_closure_follows_chains(self):
        closure = backup_groups.required_closure(["minutes"])
        for needed in ("agenda", "submissions", "people", "organisation", "form_setup"):
            self.assertIn(needed, closure)
        self.assertNotIn("audit", closure)

    def test_closure_of_an_independent_group_is_just_itself(self):
        self.assertEqual(backup_groups.required_closure(["organisation"]), ["organisation"])

    def test_closure_ignores_unknown_keys(self):
        self.assertEqual(backup_groups.required_closure(["nope"]), [])

    def test_linked_but_missing_reports_nullable_links(self):
        missing = backup_groups.linked_but_missing(["submissions", "people", "organisation", "form_setup"])
        self.assertIn("agenda", missing["submissions"])
        self.assertIn("decisions", missing["submissions"])

    def test_describe_lists_requirements_with_reasons(self):
        agenda = next(g for g in backup_groups.describe() if g["key"] == "agenda")
        req = {r["group"]: r for r in agenda["requires"]}
        self.assertIn("submissions", req)
        self.assertTrue(req["submissions"]["because"])
        self.assertIn("→", req["submissions"]["because"][0])


class PartialBackupTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.media = os.path.join(self.tmp, "media")
        os.makedirs(self.media)
        self.out = os.path.join(self.tmp, "out")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.ministry = Ministry.objects.create(code="ZZ_BK", name="Backup Ministry")
        self.user = User.objects.create_user("bk_user", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.sub = Submission.objects.create(
            title="Backed up paper", received_at=timezone.now(), created_by=self.user,
            ministry=self.ministry, is_internal=False,
        )

    def _backup(self, *args):
        with override_settings(MEDIA_ROOT=self.media):
            call_command("backup_db", "--dir", self.out, *args)
        name = sorted(os.listdir(self.out))[-1]
        return name, zipfile.ZipFile(os.path.join(self.out, name))

    def _models(self, zf):
        return {row["model"] for row in json.loads(zf.read("data.json"))}

    def test_full_backup_is_unchanged_and_marked_full(self):
        name, zf = self._backup()
        self.assertTrue(name.startswith("scdms_backup_2"))
        self.assertEqual(read_manifest(zf), {"kind": "full", "groups": []})
        self.assertIn("tracker.submission", self._models(zf))

    def test_partial_backup_holds_only_the_chosen_groups_and_what_they_require(self):
        name, zf = self._backup("--groups", "agenda")
        self.assertTrue(name.startswith("scdms_backup_partial_"))
        manifest = read_manifest(zf)
        self.assertEqual(manifest["kind"], "partial")
        for needed in ("agenda", "submissions", "people", "organisation", "form_setup"):
            self.assertIn(needed, manifest["groups"])
        models = self._models(zf)
        self.assertIn("tracker.submission", models)   # pulled in by the agenda
        self.assertIn("tracker.ministry", models)
        self.assertNotIn("tracker.auditlog", models)  # not selected, not required
        self.assertNotIn("tracker.minutes", models)

    def test_unknown_group_is_refused(self):
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            self._backup("--groups", "nope")

    def test_partial_backup_carries_only_files_of_the_chosen_groups(self):
        doc = SubmissionDocument(submission=self.sub, original_name="a.pdf", uploaded_by=self.user)
        with override_settings(MEDIA_ROOT=self.media):
            doc.file.save("a.pdf", ContentFile(b"%PDF-1.4 a"), save=True)
        stray = os.path.join(self.media, "stray.txt")
        with open(stray, "w") as fh:
            fh.write("not referenced by anything")
        _, zf = self._backup("--groups", "submissions")
        media = [n for n in zf.namelist() if n.startswith("media/")]
        self.assertEqual(len(media), 1)
        self.assertTrue(media[0].endswith("a.pdf"))
        # a full backup still takes everything
        shutil.rmtree(self.out)
        _, full = self._backup()
        self.assertTrue(any(n.endswith("stray.txt") for n in full.namelist()))

    def test_read_manifest_defaults_to_full(self):
        buf = os.path.join(self.tmp, "old.zip")
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("data.json", "[]")
        self.assertEqual(read_manifest(zipfile.ZipFile(buf)), {"kind": "full", "groups": []})
        bad = os.path.join(self.tmp, "bad.zip")
        with zipfile.ZipFile(bad, "w") as zf:
            zf.writestr("data.json", "[]")
            zf.writestr("manifest.json", "{not json")
        self.assertEqual(read_manifest(zipfile.ZipFile(bad)), {"kind": "full", "groups": []})
        odd = os.path.join(self.tmp, "odd.zip")
        with zipfile.ZipFile(odd, "w") as zf:
            zf.writestr("data.json", "[]")
            zf.writestr("manifest.json", json.dumps({"kind": "partial", "groups": ["bogus"]}))
        self.assertEqual(read_manifest(zipfile.ZipFile(odd)), {"kind": "full", "groups": []})


class BackupApiTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        patcher = mock.patch("tracker.views._BACKUP_DIR", self.tmp)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.admin = User.objects.create_superuser("bk_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.officer = User.objects.create_user("bk_officer", password="x")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.ministry = Ministry.objects.create(code="ZZ_BK2", name="Restore Ministry")

    def _make(self, groups):
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            return self.client.post("/api/backup/", {"groups": groups}, format="json")

    def test_groups_endpoint_lists_groups_for_admins_only(self):
        res = self.client.get("/api/backup/groups/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("agenda", {g["key"] for g in res.data})
        self.client.force_authenticate(user=self.officer)
        self.assertEqual(self.client.get("/api/backup/groups/").status_code, 403)

    def test_unknown_group_is_a_400(self):
        res = self._make(["nope"])
        self.assertEqual(res.status_code, 400, res.content)

    def test_groups_must_be_a_list(self):
        res = self.client.post("/api/backup/", {"groups": "agenda"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_partial_backup_is_listed_with_its_groups(self):
        self.assertEqual(self._make(["organisation"]).status_code, 200)
        rows = self.client.get("/api/backup/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["kind"], "partial")
        self.assertEqual(rows[0]["groups"], ["organisation"])
        self.assertTrue(rows[0]["filename"].startswith("scdms_backup_partial_"))

    def test_empty_selection_is_a_full_backup(self):
        self.assertEqual(self._make([]).status_code, 200)
        rows = self.client.get("/api/backup/").data
        self.assertEqual(rows[0]["kind"], "full")

    def test_inspect_reports_groups_and_missing_links(self):
        self._make(["submissions"])
        name = self.client.get("/api/backup/").data[0]["filename"]
        res = self.client.post("/api/backup/inspect/", {"filename": name}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["kind"], "partial")
        keys = {g["key"] for g in res.data["groups"]}
        self.assertTrue({"submissions", "people", "organisation", "form_setup"} <= keys)
        self.assertIn("submissions", res.data["missing_links"])

    def test_inspect_rejects_bad_filenames(self):
        res = self.client.post("/api/backup/inspect/", {"filename": "../etc/passwd"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_partial_backup_restores_only_its_rows(self):
        self._make(["organisation"])
        name = self.client.get("/api/backup/").data[0]["filename"]
        self.ministry.name = "Changed after backup"
        self.ministry.save()
        user_count = User.objects.count()
        with override_settings(MEDIA_ROOT=tempfile.mkdtemp()):
            res = self.client.post("/api/backup/restore/", {"filename": name, "confirm": "RESTORE"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("Partial restore complete", res.data["detail"])
        self.ministry.refresh_from_db()
        self.assertEqual(self.ministry.name, "Restore Ministry")  # the group was restored
        self.assertEqual(User.objects.count(), user_count)       # other groups untouched


class CloudNamingTests(TestCase):
    def test_mega_prunes_and_deletes_partial_backups_too(self):
        from tracker import mega_backup

        for name in ("scdms_backup_20261125_120000.zip",
                     "scdms_backup_partial_20261125_120000.zip",
                     "scdms_backup_partial_20261125_120000.zip.enc"):
            self.assertTrue(mega_backup._TS_RE.match(name), name)
        self.assertFalse(mega_backup._TS_RE.match("scdms_backup_partial_x.zip"))
        self.assertFalse(mega_backup._TS_RE.match("other_20261125_120000.zip"))
