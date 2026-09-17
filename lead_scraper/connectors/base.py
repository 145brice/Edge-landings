from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable

from ..models import Business


@dataclass(frozen=True, slots=True)
class ConnectorPolicy:
    slug: str
    name: str
    access: str
    enabled: bool
    retention: str
    attribution: str = ""
    notes: str = ""


class BusinessConnector(ABC):
    policy: ConnectorPolicy

    @abstractmethod
    async def discover(
        self, niche: str, location: str, radius_miles: float, max_results: int,
        seen: Callable[[str], bool] | None = None,
    ) -> list[Business]:
        """Return source observations without merging or scoring them."""

    async def close(self) -> None:
        """Release connector resources."""
