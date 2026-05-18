"""
Django Admin — limited to models without SPA management screens.

PSC staff should use the React app for submissions, users/profiles, ministries &
departments, and commission tasks. Only tracker models without SPA CRUD remain here
(form categories, OTP/password-reset tokens, reference counters).
"""

from django.contrib import admin

from .models import (
    FormCategory,
    PasswordResetToken,
    ReferenceCounter,
    RequiredDocument,
    SubmissionChecklistItem,
)


@admin.register(FormCategory)
class FormCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "token", "created_at", "used")
    list_filter = ("used", "created_at")
    search_fields = ("user__username", "token")


@admin.register(ReferenceCounter)
class ReferenceCounterAdmin(admin.ModelAdmin):
    list_display = ("year", "last_seq")


@admin.register(RequiredDocument)
class RequiredDocumentAdmin(admin.ModelAdmin):
    list_display = ("name", "form_category", "order", "is_active")
    list_filter = ("form_category", "is_active")
    search_fields = ("name", "description")
    list_editable = ("order", "is_active")


@admin.register(SubmissionChecklistItem)
class SubmissionChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("submission", "document", "is_present", "checked_by", "checked_at")
    list_filter = ("is_present",)
    search_fields = ("submission__reference_number", "document__name")
