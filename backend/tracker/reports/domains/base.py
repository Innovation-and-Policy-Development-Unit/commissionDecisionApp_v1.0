"""
Domain resolver contract for the Smart Report engine.

A resolver turns a validated parameter dict into a `ResolvedDataset` — detail rows
(for tables/export) plus named aggregates (for KPIs/charts) — using an RBAC-scoped
queryset. The engine never lets Quarto touch the database; it serializes the resolved
dataset to JSON and the .qmd reads that file.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ResolvedDataset:
    rows: list[dict[str, Any]] = field(default_factory=list)
    aggregates: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_payload(self) -> dict[str, Any]:
        return {"rows": self.rows, "aggregates": self.aggregates, "meta": self.meta}


class DomainResolver(Protocol):
    key: str

    def param_schema(self) -> dict[str, str]:
        """Map of accepted param key -> type ("date" | "int" | "str" | "bool")."""
        ...

    def resolve(self, *, user, params: dict[str, Any]) -> ResolvedDataset:
        ...


# Resolver registry — populated on import of each domain module.
DOMAIN_RESOLVERS: dict[str, DomainResolver] = {}


def register_resolver(resolver: DomainResolver) -> None:
    DOMAIN_RESOLVERS[resolver.key] = resolver


def get_resolver(domain: str) -> DomainResolver | None:
    # Import submodules lazily so the registry is populated without circular imports.
    if not DOMAIN_RESOLVERS:
        from . import submissions  # noqa: F401
    return DOMAIN_RESOLVERS.get(domain)
