"""DRF permission classes."""
from rest_framework.permissions import BasePermission

from .rbac import rbac_user_can_manage_translations


class CanManageUiTranslations(BasePermission):
    message = "You do not have permission to manage UI translations."

    def has_permission(self, request, view):
        return rbac_user_can_manage_translations(request.user)
