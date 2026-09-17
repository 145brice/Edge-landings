from __future__ import annotations

import asyncio
from typing import Callable

from .base import BusinessConnector, ConnectorPolicy
from ..models import Business
from ..places import PlacesClient
from ..raw_discovery import RawDiscoveryClient


class OpenStreetMapConnector(BusinessConnector):
    policy = ConnectorPolicy(
        slug="osm", name="OpenStreetMap", access="public_api", enabled=True,
        retention="permitted_with_odbl_attribution", attribution="© OpenStreetMap contributors",
        notes="Uses Nominatim and public Overpass endpoints conservatively.",
    )

    def __init__(self, timeout: float, user_agent: str):
        self.client = RawDiscoveryClient(timeout, user_agent)

    async def discover(self, niche: str, location: str, radius_miles: float, max_results: int,
                       seen: Callable[[str], bool] | None = None) -> list[Business]:
        businesses = await self.client.discover(location, radius_miles, max_results)
        return [business for business in businesses if not seen or not seen(business.place_id)]

    async def close(self) -> None:
        await self.client.close()


class GooglePlacesConnector(BusinessConnector):
    policy = ConnectorPolicy(
        slug="google", name="Google Business Profile / Places", access="licensed_api", enabled=True,
        retention="place_id_only_unless_terms_allow", attribution="Google Maps",
        notes="Non-place-ID fields must follow current Google caching, display, and attribution rules.",
    )

    def __init__(self, api_key: str, timeout: float):
        self.client = PlacesClient(api_key, timeout)

    async def discover(self, niche: str, location: str, radius_miles: float, max_results: int,
                       seen: Callable[[str], bool] | None = None) -> list[Business]:
        ids = await self.client.search(f"{niche} within {radius_miles:g} miles", location, radius_miles, max_results)
        if seen:
            ids = [place_id for place_id in ids if not seen(place_id)]
        details = await asyncio.gather(*(self.client.details(place_id) for place_id in ids))
        return [business for business in details if business]

    async def close(self) -> None:
        await self.client.close()
