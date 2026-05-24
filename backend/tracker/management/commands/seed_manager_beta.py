from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from tracker.models import (
    Submission, Ministry, Department, FormCategory, 
    WorkflowStage, RoutedUnit, Profile, Role
)
import random

class Command(BaseCommand):
    help = "Delete all submissions and create targeted test cases for OPSC managers."

    def handle(self, *args, **options):
        self.stdout.write("Cleaning up existing submissions...")
        Submission.objects.all().delete()

        # Ensure we have reference data
        opsc = Ministry.objects.get(code="OPSC")
        moh = Ministry.objects.get(code="MOH")
        mfem = Ministry.objects.get(code="MFEM")
        
        cat_appointment = FormCategory.objects.get(code="appointment")
        cat_discipline = FormCategory.objects.get(code="discipline_compliance")
        
        # Managers mapping (username -> role/unit)
        manager_configs = [
            {'username': 'm.vipam',      'unit': RoutedUnit.VIPAM,      'title': 'Acting Appointment - VIPAM Review'},
            {'username': 'm.hrunit',     'unit': RoutedUnit.HR,         'title': 'New Recruitment - HR Unit Assessment'},
            {'username': 'm.odu',        'unit': RoutedUnit.ODU,        'title': 'Structure Review - ODU Analysis'},
            {'username': 'm.opsc',       'unit': RoutedUnit.CSU,        'title': 'Internal OPSC Procurement Request'},
            {'username': 'm.compliance', 'unit': RoutedUnit.COMPLIANCE, 'title': 'Routine Compliance Audit'},
        ]

        for config in manager_configs:
            try:
                user = User.objects.get(username=config['username'])
                for i in range(1, 3):
                    Submission.objects.create(
                        reference_number=f"SUB-{config['unit'].upper()}-2026-{random.randint(1000, 9999)}",
                        title=f"{config['title']} #{i}",
                        ministry=moh if i == 1 else mfem,
                        form_category=cat_appointment if config['unit'] != RoutedUnit.COMPLIANCE else cat_discipline,
                        routed_unit=config['unit'],
                        current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
                        received_at=timezone.now() - timezone.timedelta(days=2),
                    )
                self.stdout.write(f"Created 2 submissions for {config['username']} ({config['unit']})")
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"User {config['username']} not found, skipping."))

        # Special Case: Secretary (j.iati)
        # 1. Compliance submissions from CMS go directly to the Secretary
        try:
            secretary = User.objects.get(username="j.iati")
            
            # Compliance from CMS
            Submission.objects.create(
                reference_number="CMS-COMP-2026-0001",
                title="Compliance Investigation - CMS Referral #8821",
                ministry=moh,
                form_category=cat_discipline,
                routed_unit=RoutedUnit.COMPLIANCE,
                current_stage=WorkflowStage.SECRETARY_REVIEW,
                assigned_to=secretary,
                received_at=timezone.now() - timezone.timedelta(days=1),
                notes="Automated referral from Compliance Management System (CMS). Requires immediate Secretary review."
            )

            # High Priority general submission
            Submission.objects.create(
                reference_number="SEC-URG-2026-099",
                title="URGENT: Permanent Secretary Appointment Extension",
                ministry=opsc,
                form_category=cat_appointment,
                routed_unit=RoutedUnit.HR,
                current_stage=WorkflowStage.SECRETARY_REVIEW,
                assigned_to=secretary,
                received_at=timezone.now(),
            )
            self.stdout.write("Created 2 targeted submissions for Secretary (j.iati)")
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING("Secretary user j.iati not found!"))

        self.stdout.write(self.style.SUCCESS("Manager Beta Seeding complete."))
