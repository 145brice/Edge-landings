from __future__ import annotations

import asyncio
import logging
import math
import random
import re
from typing import Any

import httpx

from .models import Business

LOG = logging.getLogger(__name__)
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)


class DiscoveryError(RuntimeError):
    """Raised when no discovery source can provide a usable response."""


def normalize_us_location(location: str) -> str:
    value = location.strip()
    return f"{value}, USA" if re.fullmatch(r"\d{5}", value) else value


class RawDiscoveryClient:
    """No-key discovery using Nominatim and Overpass/OpenStreetMap."""

    def __init__(self, timeout: float, user_agent: str):
        # Redirect-following is the default for GET/POST in both the older httpx
        # bundled on this machine and current releases.
        self.client = httpx.AsyncClient(
            timeout=max(timeout, 45), headers={"User-Agent": user_agent}
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def discover(self, location: str, radius_miles: float, max_results: int) -> list[Business]:
        try:
            # A bare five-digit ZIP is ambiguous globally (37138 also resolves in
            # Lithuania). This product targets US local businesses, so constrain
            # geocoding to the United States and make the country explicit.
            query_location = normalize_us_location(location)
            geo = await self.client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query_location, "format": "jsonv2", "limit": 1, "countrycodes": "us"},
            )
            geo.raise_for_status()
            hits = geo.json()
            if not hits:
                raise DiscoveryError(f"Location not found: {location}")
            lat, lon = float(hits[0]["lat"]), float(hits[0]["lon"])
            await asyncio.sleep(random.uniform(1.1, 1.8))
            radius_miles = min(radius_miles, 31.0)
            lat_delta = radius_miles / 69.0
            lon_scale = max(math.cos(math.radians(lat)), 0.2)
            lon_delta = radius_miles / (69.0 * lon_scale)
            south, west = lat - lat_delta, lon - lon_delta
            north, east = lat + lat_delta, lon + lon_delta
        except Exception as exc:
            raise DiscoveryError(f"Location lookup failed: {exc}") from exc

        # Split a large radius into small boxes. Public Overpass servers can reject
        # one broad query even when its output is capped, while the equivalent small
        # spatial queries complete quickly and use less peak memory.
        grid_size = 1 if radius_miles <= 5 else 3
        lat_step, lon_step = (north - south) / grid_size, (east - west) / grid_size
        tiles = [
            (south + row * lat_step, west + col * lon_step,
             south + (row + 1) * lat_step, west + (col + 1) * lon_step)
            for row in range(grid_size) for col in range(grid_size)
        ]
        random.SystemRandom().shuffle(tiles)
        elements_by_id: dict[tuple[str, int], dict[str, Any]] = {}
        errors: list[str] = []
        successful_tiles = 0
        preferred_endpoint = OVERPASS_ENDPOINTS[0]
        per_tile_limit = max(25, min(max_results, 40))
        for tile_number, (tile_s, tile_w, tile_n, tile_e) in enumerate(tiles, start=1):
            query = f"""[out:json][timeout:15][bbox:{tile_s},{tile_w},{tile_n},{tile_e}];(
              node[name][shop];node[name][craft];node[name][office];
              node[name][amenity~"^(restaurant|cafe|bar|pub|fast_food|clinic|dentist|doctors|veterinary|pharmacy|bank|car_rental|car_wash|fuel|nightclub|marketplace)$"];
            );out tags qt {per_tile_limit};"""
            tile_elements: list[dict[str, Any]] | None = None
            # Reuse the last healthy mirror first; fall back to the others if its
            # load changes during the run.
            endpoints = (preferred_endpoint,) + tuple(
                endpoint for endpoint in OVERPASS_ENDPOINTS if endpoint != preferred_endpoint
            )
            for attempt, endpoint in enumerate(endpoints, start=1):
                try:
                    response = await self.client.post(
                        endpoint, data=query, headers={"Content-Type": "text/plain"}, timeout=20,
                    )
                    response.raise_for_status()
                    tile_elements = response.json().get("elements", [])
                    successful_tiles += 1
                    preferred_endpoint = endpoint
                    break
                # httpx 0.13 can leak its low-level httpcore timeout exception, so
                # this boundary intentionally handles every client exception.
                except Exception as exc:
                    errors.append(f"{endpoint}: {exc}")
                    LOG.warning(
                        "raw_discovery_retry: tile=%d/%d attempt=%d/%d endpoint=%s error=%s",
                        tile_number, len(tiles), attempt, len(endpoints), endpoint, exc,
                    )
                    if attempt < len(endpoints):
                        await asyncio.sleep(1.0)
            if tile_elements:
                random.SystemRandom().shuffle(tile_elements)
                for item in tile_elements:
                    key = (str(item.get("type")), int(item.get("id", 0)))
                    elements_by_id[key] = item
            LOG.info(
                "discovery_progress: areas=%d/%d candidates=%d target=%d",
                tile_number, len(tiles), len(elements_by_id), max_results,
            )
            if len(elements_by_id) >= max_results:
                break
            await asyncio.sleep(random.uniform(0.4, 0.9))
        if not successful_tiles:
            raise DiscoveryError("All public discovery endpoints failed. " + " | ".join(errors[-6:]))

        elements = list(elements_by_id.values())
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
                city=hits[0].get("display_name", location),
                google_maps_url=f"https://www.openstreetmap.org/{item.get('type')}/{item.get('id')}",
                data_source="OpenStreetMap",
                website_evidence=("Website URL listed in OpenStreetMap" if website
                                  else "No website URL listed in OpenStreetMap; not independently verified"),
            ))
            if len(businesses) >= max_results:
                break
        return businesses
