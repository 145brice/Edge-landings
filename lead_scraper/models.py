from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class Business:
    place_id: str
    name: str
    formatted_address: str = ""
    phone: str = ""
    website: str = ""
    rating: float | None = None
    review_count: int = 0
    business_status: str = ""
    category: str = ""
    latitude: float | None = None
    longitude: float | None = None
    google_maps_url: str = ""
    data_source: str = ""
    website_evidence: str = ""
    city: str = ""
    bucket: str = ""
    score: int = 0
    flaws: list[str] = field(default_factory=list)
    checks: dict[str, Any] = field(default_factory=dict)
    emails: list[str] = field(default_factory=list)
    contact_form_url: str = ""
    facebook_url: str = ""
    instagram_url: str = ""
    linkedin_url: str = ""
    contact_evidence: list[str] = field(default_factory=list)
    outreach_channel: str = "call"
    scanned_at: str = ""
    source_ids: dict[str, str] = field(default_factory=dict)
    signals: dict[str, bool | None] = field(default_factory=dict)
    opportunity_score: int = 0
    confidence_score: int = 0
    gap_flags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)
