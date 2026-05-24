from django.contrib.auth.models import User
from rest_framework import serializers

from .models import DailyBriefDeliveryLog, DailyBriefSettings, DailyBriefStaffPreference


class DailyBriefSettingsSerializer(serializers.ModelSerializer):
    manager_recipient_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )
    module_status = serializers.CharField(read_only=True)

    class Meta:
        model = DailyBriefSettings
        fields = (
            "enabled",
            "module_status",
            "delivery_hour",
            "weekdays_only",
            "manager_recipient_ids",
            "test_mode",
            "test_recipient_email",
            "last_run_date",
            "last_beat_at",
            "updated_at",
        )
        read_only_fields = ("last_run_date", "last_beat_at", "updated_at", "module_status")

    def validate_delivery_hour(self, value):
        if value < 5 or value > 12:
            raise serializers.ValidationError("Delivery hour must be between 05:00 and 12:00.")
        return value

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        m2m_ids = list(instance.manager_recipients.values_list("id", flat=True))
        if m2m_ids:
            ret["manager_recipient_ids"] = m2m_ids
        return ret

    def update(self, instance, validated_data):
        ids = validated_data.pop("manager_recipient_ids", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if instance.enabled:
            instance.module_status = DailyBriefSettings.ModuleStatus.ACTIVE
        else:
            instance.module_status = DailyBriefSettings.ModuleStatus.PAUSED
        instance.save()
        if ids is not None:
            instance.manager_recipient_ids = ids
            instance.save(update_fields=["manager_recipient_ids"])
            users = User.objects.filter(pk__in=ids, is_active=True)
            instance.manager_recipients.set(users)
        return instance


class DailyBriefStaffPreferenceSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyBriefStaffPreference
        fields = (
            "id",
            "user_id",
            "username",
            "email",
            "full_name",
            "enabled",
            "last_delivered_at",
            "updated_at",
        )
        read_only_fields = ("last_delivered_at", "updated_at")

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class DailyBriefDeliveryLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True, allow_null=True)

    class Meta:
        model = DailyBriefDeliveryLog
        fields = (
            "id",
            "brief_type",
            "status",
            "user",
            "username",
            "recipient_email",
            "subject",
            "sections_count",
            "items_total",
            "generation_ms",
            "error_message",
            "detail",
            "created_at",
        )


class DailyBriefPreferenceBulkSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    enabled = serializers.BooleanField()


class DailyBriefSendTestSerializer(serializers.Serializer):
    test_user_id = serializers.IntegerField(required=False, allow_null=True)
    brief_type = serializers.ChoiceField(
        choices=["staff", "manager"],
        default="staff",
    )
