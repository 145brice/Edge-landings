from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True, slots=True)
class Settings:
    api_key: str
    database_path: Path
    timeout_seconds: float
    user_agent: str
    cost_confirmation_threshold: float
    text_search_cost_per_1000: float
    details_cost_per_1000: float
    log_directory: Path

    @classmethod
    def load(cls) -> "Settings":
        load_dotenv()
        return cls(
            api_key=os.getenv("GOOGLE_PLACES_API_KEY", "").strip(),
            database_path=Path(os.getenv("LEAD_SCRAPER_DB", "lead_scraper.db")),
            timeout_seconds=float(os.getenv("HTTP_TIMEOUT_SECONDS", "10")),
            user_agent=os.getenv(
                "SCRAPER_USER_AGENT",
                "EdgeLandingsLeadResearch/1.0 (+https://edgelandings.com)",
            ),
            cost_confirmation_threshold=float(os.getenv("PLACES_COST_CONFIRM_THRESHOLD", "5.00")),
            # Kept configurable because Google pricing and billing tiers change.
            text_search_cost_per_1000=float(os.getenv("PLACES_TEXT_SEARCH_COST_PER_1000", "32.00")),
            details_cost_per_1000=float(os.getenv("PLACES_DETAILS_COST_PER_1000", "17.00")),
            log_directory=Path(os.getenv("LEAD_SCRAPER_LOG_DIR", "logs")),
        )
