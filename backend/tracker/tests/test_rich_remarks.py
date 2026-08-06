"""Rich-text workflow remarks: sanitization, plain-text derivation, and
linking pasted images to the WorkflowEvent that referenced them."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from tracker.models import Ministry, Profile, RemarksImage, Role, Submission, WorkflowEvent, WorkflowStage
from tracker.rich_text import extract_remarks_image_ids, html_to_plain_text, sanitize_remarks_html


class SanitizeRemarksHtmlTests(TestCase):
    def test_strips_script_tags(self):
        raw = '<p>Please resend</p><script>alert(1)</script>'
        cleaned = sanitize_remarks_html(raw)
        self.assertNotIn('<script', cleaned)
        self.assertIn('<p>Please resend</p>', cleaned)

    def test_strips_disallowed_attributes(self):
        raw = '<img src="/x.png" onerror="alert(1)" data-remarks-image-id="7">'
        cleaned = sanitize_remarks_html(raw)
        self.assertNotIn('onerror', cleaned)
        self.assertIn('data-remarks-image-id="7"', cleaned)
        self.assertIn('src="/x.png"', cleaned)

    def test_strips_disallowed_tags_but_keeps_text(self):
        raw = '<div onclick="evil()">Return the signed form</div>'
        cleaned = sanitize_remarks_html(raw)
        self.assertNotIn('<div', cleaned)
        self.assertIn('Return the signed form', cleaned)

    def test_allows_basic_formatting(self):
        raw = '<p><strong>Missing:</strong></p><ul><li>Financial visa</li></ul>'
        cleaned = sanitize_remarks_html(raw)
        self.assertIn('<strong>', cleaned)
        self.assertIn('<ul>', cleaned)
        self.assertIn('<li>', cleaned)

    def test_blank_input(self):
        self.assertEqual(sanitize_remarks_html(''), '')


class HtmlToPlainTextTests(TestCase):
    def test_separates_paragraphs(self):
        html = '<p>First paragraph.</p><p>Second paragraph.</p>'
        text = html_to_plain_text(html)
        self.assertEqual(text, 'First paragraph.\n\nSecond paragraph.')

    def test_separates_list_items(self):
        html = '<ul><li>Financial visa</li><li>Job description</li></ul>'
        text = html_to_plain_text(html)
        self.assertIn('Financial visa', text)
        self.assertIn('Job description', text)
        self.assertNotEqual(text, 'Financial visaJob description')

    def test_line_break_tag(self):
        html = 'Line one<br>Line two'
        self.assertEqual(html_to_plain_text(html), 'Line one\nLine two')

    def test_blank_html_only_paragraph_is_empty(self):
        # A TipTap editor with no typed content still emits "<p></p>".
        self.assertEqual(html_to_plain_text('<p></p>'), '')

    def test_blank_input(self):
        self.assertEqual(html_to_plain_text(''), '')


class ExtractRemarksImageIdsTests(TestCase):
    def test_extracts_multiple_ids(self):
        html = (
            '<p>See below</p>'
            '<img src="/media/a.png" data-remarks-image-id="3">'
            '<img src="/media/b.png" data-remarks-image-id="11">'
        )
        self.assertEqual(extract_remarks_image_ids(html), [3, 11])

    def test_no_images(self):
        self.assertEqual(extract_remarks_image_ids('<p>No images here</p>'), [])

    def test_blank_input(self):
        self.assertEqual(extract_remarks_image_ids(''), [])


class RemarksImageLinkingTests(TestCase):
    """Mirrors the linking step in SubmissionViewSet.transition(): after the
    WorkflowEvent is created, any RemarksImage ids referenced in the sanitized
    HTML get attached to it, scoped to this submission and not already linked."""

    def setUp(self):
        self.user = User.objects.create_user(username="officer1", password="pass")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.ministry = Ministry.objects.create(code="TST", name="Test Ministry")
        self.submission = Submission.objects.create(
            title="Test matter",
            ministry=self.ministry,
            current_stage=WorkflowStage.SUBMITTED,
            received_at=timezone.now(),
            created_by=self.user,
        )
        self.other_submission = Submission.objects.create(
            title="Unrelated matter",
            ministry=self.ministry,
            current_stage=WorkflowStage.SUBMITTED,
            received_at=timezone.now(),
            created_by=self.user,
        )

    def _link(self, event, html):
        ids = extract_remarks_image_ids(html)
        if ids:
            RemarksImage.objects.filter(
                submission=self.submission, id__in=ids, workflow_event__isnull=True,
            ).update(workflow_event=event)

    def test_referenced_image_gets_linked(self):
        image = RemarksImage.objects.create(submission=self.submission, uploaded_by=self.user)
        event = WorkflowEvent.objects.create(
            submission=self.submission, actor=self.user,
            previous_stage=WorkflowStage.SUBMITTED, new_stage=WorkflowStage.RETURNED_FOR_CLARIFICATION,
            remarks="See attached screenshot", remarks_html=f'<p>See attached</p><img data-remarks-image-id="{image.id}">',
        )
        self._link(event, event.remarks_html)
        image.refresh_from_db()
        self.assertEqual(image.workflow_event_id, event.id)

    def test_unreferenced_image_stays_unlinked(self):
        image = RemarksImage.objects.create(submission=self.submission, uploaded_by=self.user)
        event = WorkflowEvent.objects.create(
            submission=self.submission, actor=self.user,
            previous_stage=WorkflowStage.SUBMITTED, new_stage=WorkflowStage.RETURNED_FOR_CLARIFICATION,
            remarks="No image needed", remarks_html='<p>No image needed</p>',
        )
        self._link(event, event.remarks_html)
        image.refresh_from_db()
        self.assertIsNone(image.workflow_event_id)

    def test_cannot_link_another_submissions_image(self):
        # Guards against a crafted id referencing an image uploaded against a
        # different submission.
        foreign_image = RemarksImage.objects.create(submission=self.other_submission, uploaded_by=self.user)
        event = WorkflowEvent.objects.create(
            submission=self.submission, actor=self.user,
            previous_stage=WorkflowStage.SUBMITTED, new_stage=WorkflowStage.RETURNED_FOR_CLARIFICATION,
            remarks="See attached", remarks_html=f'<p>See attached</p><img data-remarks-image-id="{foreign_image.id}">',
        )
        self._link(event, event.remarks_html)
        foreign_image.refresh_from_db()
        self.assertIsNone(foreign_image.workflow_event_id)

    def test_already_linked_image_is_not_reassigned(self):
        image = RemarksImage.objects.create(submission=self.submission, uploaded_by=self.user)
        first_event = WorkflowEvent.objects.create(
            submission=self.submission, actor=self.user,
            previous_stage=WorkflowStage.SUBMITTED, new_stage=WorkflowStage.RETURNED_FOR_CLARIFICATION,
            remarks="First", remarks_html=f'<img data-remarks-image-id="{image.id}">',
        )
        self._link(first_event, first_event.remarks_html)

        second_event = WorkflowEvent.objects.create(
            submission=self.submission, actor=self.user,
            previous_stage=WorkflowStage.RETURNED_FOR_CLARIFICATION, new_stage=WorkflowStage.SUBMITTED,
            remarks="Reused id", remarks_html=f'<img data-remarks-image-id="{image.id}">',
        )
        self._link(second_event, second_event.remarks_html)

        image.refresh_from_db()
        self.assertEqual(image.workflow_event_id, first_event.id)
