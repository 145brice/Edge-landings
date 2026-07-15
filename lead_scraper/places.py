from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

import httpx

from .models import Business

LOG = logging.getLogger(__name__)
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"
SEARCH_FIELDS = "places.id,nextPageToken"
DETAIL_FIELDS = ",".join(
    [
        "id", "displayName", "formattedAddress", "nationalPhoneNumber", "websiteUri",
        "rating", "userRatingCount", "businessStatus", "primaryType", "location",
        "googleMapsUri", "addressComponents",
    ]
)


class PlacesClient:
    def __init__(self, api_key: str, timeout: float = 10):
        self.headers = {"X-Goog-Api-Key": api_key}
        self.client = httpx.AsyncClient(timeout=timeout)

    async def close(self) -> None:
        await self.client.aclose()

    async def search(self, niche: str, location: str, radius_miles: float, max_results: int) -> list[str]:
        place_ids: list[str] = []
        token: str | None = None
        while len(place_ids) < max_results:
            body: dict[str, Any] = {
                "textQuery": f"{niche} in {location}",
                "pageSize": min(20, max_results - len(place_ids)),
            }
            # Text Search accepts locationBias only with a known coordinate. The location
            # text remains authoritative; exact radius filtering happens after details.
            if token:
                body["pageToken"] = token
            try:
                response = await self.client.post(
                    SEARCH_URL,
                    headers={**self.headers, "X-Goog-FieldMask": SEARCH_FIELDS},
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
            except Exception as exc:
                LOG.error("places_search_failed", extra={"error": str(exc), "niche": niche})
                break
            place_ids.extend(p["id"] for p in data.get("places", []) if p.get("id"))
            token = data.get("nextPageToken")
            if not token:
                break
            await asyncio.sleep(2)
        return list(dict.fromkeys(place_ids))[:max_results]

    async def details(self, place_id: str) -> Business | None:
        try:
            response = await self.client.get(
                DETAILS_URL.format(place_id=place_id),
                headers={**self.headers, "X-Goog-FieldMask": DETAIL_FIELDS},
            )
            response.raise_for_status()
            p = response.json()
        except Exception as exc:
            LOG.error("place_details_failed", extra={"error": str(exc), "place_id": place_id})
            return None
        location = p.get("location", {})
        city = next(
            (c.get("longText", "") for c in p.get("addressComponents", [])
             if "locality" in c.get("types", [])),
            "",
        )
        return Business(
            place_id=p.get("id", place_id),
            name=p.get("displayName", {}).get("text", ""),
            formatted_address=p.get("formattedAddress", ""),
            phone=p.get("nationalPhoneNumber", ""),
            website=p.get("websiteUri", ""),
            rating=p.get("rating"),
            review_count=p.get("userRatingCount", 0),
            business_status=p.get("businessStatus", ""),
            category=p.get("primaryType", ""),
            latitude=location.get("latitude"),
            longitude=location.get("longitude"),
            google_maps_url=p.get("googleMapsUri", ""),
            data_source="Google Places",
            website_evidence=("Website URL listed in Google Places" if p.get("websiteUri")
                              else "No website URL listed in Google Places; not independently verified"),
            city=city,
        )


def estimated_cost(max_results: int, niche_count: int, text_per_1000: float, details_per_1000: float) -> float:
    searches = math.ceil(max_results / 20) * niche_count
    details = max_results * niche_count
    return searches / 1000 * text_per_1000 + details / 1000 * details_per_1000
