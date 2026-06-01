from django.test import TestCase

from ..intake_routing import routed_unit_for_form_type
from ..models import RoutedUnit


class IntakeRoutingTests(TestCase):
    def test_restructure_routes_to_odu(self):
        self.assertEqual(routed_unit_for_form_type("ORG-3.1"), RoutedUnit.ODU)

    def test_psc_2_1_routes_to_odu(self):
        self.assertEqual(routed_unit_for_form_type("PSC 2-1"), RoutedUnit.ODU)

    def test_case_insensitive_match(self):
        self.assertEqual(routed_unit_for_form_type("org-3.1"), RoutedUnit.ODU)

    def test_unmapped_form_type_returns_none(self):
        self.assertIsNone(routed_unit_for_form_type("PSC 5-1"))

    def test_blank_returns_none(self):
        self.assertIsNone(routed_unit_for_form_type(""))
        self.assertIsNone(routed_unit_for_form_type(None))
