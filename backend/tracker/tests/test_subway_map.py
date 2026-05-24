"""Tests for ministry subway map builder."""
from django.test import SimpleTestCase

from tracker.models import WorkflowStage
from tracker.subway_map import build_subway_map, station_id_for_stage


class _FakeEvent:
    def __init__(self, previous_stage, new_stage):
        self.previous_stage = previous_stage
        self.new_stage = new_stage


class _FakeEvents:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeSubmission:
    def __init__(self, current_stage, events=None):
        self.current_stage = current_stage
        self.events = _FakeEvents(events or [])


class SubwayMapTests(SimpleTestCase):
    def test_under_assessment_station(self):
        sub = _FakeSubmission(WorkflowStage.UNDER_ASSESSMENT)
        data = build_subway_map(sub)
        self.assertEqual(data["current_station_id"], "under_assessment")
        self.assertEqual(data["path_variant"], "normal")

    def test_returned_for_clarification_amber_path(self):
        sub = _FakeSubmission(
            WorkflowStage.RETURNED_FOR_CLARIFICATION,
            events=[
                _FakeEvent(WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.RETURNED_FOR_CLARIFICATION),
            ],
        )
        data = build_subway_map(sub)
        self.assertEqual(data["path_variant"], "returned")
        self.assertTrue(data["sent_back"]["active"])
        self.assertEqual(data["sent_back"]["target_station_id"], "registered")
        self.assertEqual(station_id_for_stage(WorkflowStage.COMMISSION_SITTING), "commission_sitting")
