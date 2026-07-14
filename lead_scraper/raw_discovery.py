from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

from .models import Business

LOG = logging.getLogger(__name__)


class RawDiscoveryClient:
    """No-key discovery using Nominatim and Overpass/OpenStreetMap."""

    def __init__(self, timeout: float, user_agent: str):
        # Redirect-following is the default for GET/POST in both the older httpx
        # bundled on this machine and current releases.
        self.client = httpx.AsyncClient(
            timeout=max(timeout, 30), headers={"User-Agent": user_agent}
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def discover(self, location: str, radius_miles: float, max_results: int) -> list[Business]:
        try:
            geo = await self.client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": location, "format": "jsonv2", "limit": 1},
            )
            geo.raise_for_status()
            hits = geo.json()
            if not hits:
                LOG.error("raw_location_not_found", extra={"error": location})
                return []
            lat, lon = float(hits[0]["lat"]), float(hits[0]["lon"])
            await asyncio.sleep(random.uniform(1.1, 1.8))
            radius = min(int(radius_miles * 1609.344), 50000)
            query = f"""[out:json][timeout:30];(
              nwr(around:{radius},{lat},{lon})[name][shop];
              nwr(around:{radius},{lat},{lon})[name][craft];
              nwr(around:{radius},{lat},{lon})[name][office];
              nwr(around:{radius},{lat},{lon})[name][amenity];
            );out center tags;"""
            response = await self.client.post(
                "https://overpass-api.de/api/interpreter", data=query,
                headers={"Content-Type": "text/plain"},
            )
            response.raise_for_status()
            elements: list[dict[str, Any]] = response.json().get("elements", [])
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            LOG.error("raw_discovery_failed", extra={"error": str(exc)})
            return []

        random.SystemRandom().shuffle(elements)
        businesses: list[Business] = []
        for item in elements:
            tags = item.get("tags", {})
            name = tags.get("name", "").strip()
            if not name:
                continue
            website = tags.get("website") or tags.get("contact:website") or ""
            phone = tags.get("phone") or tags.get("contact:phone") or ""
            category = tags.get("shop") or tags.get("craft") or tags.get("office") or tags.get("amenity") or "local_business"
            address = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
            center = item.get("center", item)
            identity = f"osm:{item.get('type')}:{item.get('id')}"
            businesses.append(Business(
                place_id=identity,
                name=name,
                formatted_address=address,
                phone=phone,
                website=website,
                business_status="OPERATIONAL",
                category=category,
                latitude=center.get("lat"),
                longitude=center.get("lon"),
                city=location,
                google_maps_url=f"https://www.openstreetmap.org/{item.get('type')}/{item.get('id')}",
            ))
            if len(businesses) >= max_results:
                break
        return businesses
