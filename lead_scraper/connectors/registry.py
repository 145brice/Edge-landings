from __future__ import annotations

from importlib.metadata import entry_points

from .base import BusinessConnector, ConnectorPolicy
from .builtin import GooglePlacesConnector, OpenStreetMapConnector
from ..config import Settings


CONNECTOR_CATALOG = (
    ConnectorPolicy("osm", "OpenStreetMap", "public_api", True, "ODbL-compatible storage", "© OpenStreetMap contributors"),
    ConnectorPolicy("google", "Google Business Profile / Places", "licensed_api", False, "Place ID durable; other fields policy-limited", "Google Maps", "Disabled for durable master-record exports until a compliant transient display path is added."),
    ConnectorPolicy("website", "Business websites", "public_web", True, "Audit facts and public contacts", notes="robots.txt honored; bounded requests"),
    ConnectorPolicy("state_registry", "State business registries", "authorized_export_or_api", False, "Per-jurisdiction", notes="Enable a state-specific adapter only after terms review."),
    ConnectorPolicy("professional_license", "Professional license boards", "authorized_export_or_api", False, "Per-jurisdiction"),
    ConnectorPolicy("permit", "Public permit records", "authorized_export_or_api", False, "Per-jurisdiction"),
    ConnectorPolicy("chamber", "Chambers of Commerce", "authorized_export_or_api", False, "Agreement-specific"),
    ConnectorPolicy("yelp", "Yelp", "official_api_only", False, "Yelp API terms", attribution="Yelp"),
    ConnectorPolicy("bbb", "Better Business Bureau", "agreement_required", False, "No aggregation from public site", notes="Public-site aggregation is not enabled."),
    ConnectorPolicy("angi", "Angi", "agreement_required", False, "Agreement-specific"),
    ConnectorPolicy("houzz", "Houzz", "agreement_required", False, "Agreement-specific"),
    ConnectorPolicy("thumbtack", "Thumbtack", "agreement_required", False, "Agreement-specific"),
    ConnectorPolicy("public_social", "Public social pages", "official_api_or_user_supplied", False, "Platform-specific"),
)


def connector_for(source: str, settings: Settings) -> BusinessConnector:
    selected = source
    if selected == "auto":
        selected = "osm"
    if selected == "google":
        raise ValueError(
            "Google Places is disabled for durable master-record exports because most Places content "
            "has storage and attribution restrictions; only place IDs are generally durable."
        )
    if selected == "osm":
        return OpenStreetMapConnector(settings.timeout_seconds, settings.user_agent)
    for entry in entry_points(group="edge_landings.connectors"):
        if entry.name == selected:
            connector = entry.load()(settings)
            if not isinstance(connector, BusinessConnector):
                raise TypeError(f"Connector {selected} does not implement BusinessConnector.")
            return connector
    raise ValueError(f"Unknown connector: {source}")


def connector_status() -> list[dict[str, str | bool]]:
    return [
        {
            "slug": policy.slug, "name": policy.name, "access": policy.access,
            "enabled": policy.enabled, "retention": policy.retention,
            "attribution": policy.attribution, "notes": policy.notes,
        }
        for policy in CONNECTOR_CATALOG
    ]
