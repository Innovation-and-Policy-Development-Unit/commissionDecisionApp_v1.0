"""Smart Report domain resolvers (RBAC-scoped dataset builders)."""

from .base import DOMAIN_RESOLVERS, ResolvedDataset, domain_allows, get_resolver

__all__ = ["DOMAIN_RESOLVERS", "ResolvedDataset", "domain_allows", "get_resolver"]
