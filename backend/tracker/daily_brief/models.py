from django.conf import settings
from django.db import models


class DailyBriefSettings(models.Model):
    """Singleton configuration for daily brief delivery."""

    class ModuleStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    enabled = models.BooleanField(default=False)
    module_status = models.CharField(
        max_length=16,
        choices=ModuleStatus.choices,
        default=ModuleStatus.PAUSED,
    )
    delivery_hour = models.PositiveSmallIntegerField(
        default=7,
        help_text="Hour (05–12) in Pacific/Efate when briefs are sent.",
    )
    weekdays_only = models.BooleanField(default=True)
    manager_recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="daily_brief_manager_recipient_for",
    )
    manager_recipient_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Legacy/extra manager recipient user IDs (synced with M2M on save).",
    )
    test_mode = models.BooleanField(default=False)
    test_recipient_email = models.EmailField(blank=True)
    last_run_date = models.DateField(null=True, blank=True)
    last_beat_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Daily brief settings"
        verbose_name_plural = "Daily brief settings"

    def save(self, *args, **kwargs):
        if not self.module_status:
            self.module_status = (
                self.ModuleStatus.ACTIVE if self.enabled else self.ModuleStatus.PAUSED
            )
        elif self.enabled and self.module_status == self.ModuleStatus.PAUSED:
            self.module_status = self.ModuleStatus.ACTIVE
        elif not self.enabled:
            self.module_status = self.ModuleStatus.PAUSED
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class DailyBriefStaffPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_brief_preference",
    )
    enabled = models.BooleanField(default=True)
    last_delivered_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Daily brief staff preference"
        verbose_name_plural = "Daily brief staff preferences"

    def __str__(self):
        return f"{self.user_id}: {'on' if self.enabled else 'off'}"


class DailyBriefDeliveryLog(models.Model):
    class BriefType(models.TextChoices):
        STAFF = "staff", "Staff"
        MANAGER = "manager", "Manager"

    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    brief_type = models.CharField(max_length=16, choices=BriefType.choices)
    status = models.CharField(max_length=16, choices=Status.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="daily_brief_delivery_logs",
    )
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=500, blank=True)
    sections_count = models.PositiveSmallIntegerField(default=0)
    items_total = models.PositiveSmallIntegerField(default=0)
    generation_ms = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["brief_type", "status"]),
        ]

    def __str__(self):
        return f"{self.brief_type} {self.status} → {self.recipient_email}"
