from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse

from .models import Business

SIGNALS = (
    "google_profile", "website", "phone", "email", "social", "state_registration",
    "professional_license", "chamber", "bbb", "yelp", "angi", "houzz",
    "thumbtack", "recent_permit",
)
SOURCE_SIGNAL = {
    "google": "google_profile", "yelp": "yelp", "bbb": "bbb", "angi": "angi",
    "houzz": "houzz", "thumbtack": "thumbtack", "chamber": "chamber",
    "state_registry": "state_registration", "professional_license": "professional_license",
    "permit": "recent_permit", "public_social": "social",
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "x.com", "twitter.com")


def load_scoring(path: Path | None = None) -> dict:
    config_path = path or Path(__file__).with_name("scoring.json")
    return json.loads(config_path.read_text(encoding="utf-8"))


def source_slug(business: Business) -> str:
    value = business.data_source.lower()
    if "google" in value:
        return "google"
    if "openstreetmap" in value:
        return "osm"
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_") or "unknown"


def normalized_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) >= 10 else digits


def normalized_name(value: str) -> str:
    words = re.sub(r"[^a-z0-9 ]", " ", (value or "").lower()).split()
    suffixes = {"llc", "inc", "corp", "corporation", "company", "co", "ltd", "pllc"}
    return " ".join(word for word in words if word not in suffixes)


def website_domain(value: str) -> str:
    if not value:
        return ""
    try:
        host = urlparse(value if "://" in value else f"https://{value}").hostname or ""
    except ValueError:
        return ""
    host = host.lower().removeprefix("www.")
    return "" if any(host == social or host.endswith(f".{social}") for social in SOCIAL_HOSTS) else host


def city_key(business: Business) -> str:
    return re.sub(r"[^a-z0-9]", "", (business.city or business.formatted_address).lower())[:80]


def observations_match(left: Business, right: Business) -> bool:
    if left.place_id and left.place_id == right.place_id:
        return True
    left_domain, right_domain = website_domain(left.website), website_domain(right.website)
    if left_domain and left_domain == right_domain:
        return True
    left_phone, right_phone = normalized_phone(left.phone), normalized_phone(right.phone)
    if len(left_phone) == 10 and left_phone == right_phone:
        return True
    left_name, right_name = normalized_name(left.name), normalized_name(right.name)
    return bool(left_name and left_name == right_name and city_key(left) and city_key(left) == city_key(right))


def known_signals(business: Business) -> dict[str, bool | None]:
    signals = {name: None for name in SIGNALS}
    signals.update(business.signals)
    slug = source_slug(business)
    if slug in SOURCE_SIGNAL:
        signals[SOURCE_SIGNAL[slug]] = True
    if slug in {"osm", "google", "website"}:
        signals["website"] = bool(website_domain(business.website))
        signals["social"] = business.bucket == "SOCIAL_ONLY" or bool(
            business.facebook_url or business.instagram_url or business.linkedin_url
        )
        signals["phone"] = bool(business.phone)
    if business.bucket or business.checks:
        signals["email"] = bool(business.emails)
    return signals


def merge_group(group: list[Business]) -> Business:
    ordered = sorted(group, key=lambda item: (source_slug(item) != "google", -item.review_count, item.place_id))
    master = deepcopy(ordered[0])
    sources: dict[str, str] = {}
    merged_signals = {name: None for name in SIGNALS}
    for item in ordered:
        slug = source_slug(item)
        sources[slug] = item.place_id
        for field in ("name", "formatted_address", "phone", "website", "category", "city", "google_maps_url",
                      "contact_form_url", "facebook_url", "instagram_url", "linkedin_url"):
            if not getattr(master, field) and getattr(item, field):
                setattr(master, field, getattr(item, field))
        master.rating = max((value for value in (master.rating, item.rating) if value is not None), default=None)
        master.review_count = max(master.review_count, item.review_count)
        master.emails = list(dict.fromkeys([*master.emails, *item.emails]))
        master.flaws = list(dict.fromkeys([*master.flaws, *item.flaws]))
        master.contact_evidence = list(dict.fromkeys([*master.contact_evidence, *item.contact_evidence]))
        master.checks.update(item.checks)
        for signal, value in known_signals(item).items():
            if value is True or merged_signals[signal] is None:
                merged_signals[signal] = value
    master.source_ids = sources
    master.data_source = " + ".join(dict.fromkeys(item.data_source for item in ordered if item.data_source))
    master.signals = merged_signals
    return master


def merge_businesses(observations: list[Business]) -> list[Business]:
    # Union observations through strong deterministic keys. This preserves
    # transitive matches while avoiding an O(n²) comparison across large
    # historical exports.
    parents = list(range(len(observations)))
    keys: dict[tuple[str, str], int] = {}

    def root(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left: int, right: int) -> None:
        left_root, right_root = root(left), root(right)
        if left_root != right_root:
            parents[right_root] = left_root

    for index, item in enumerate(observations):
        item_keys: list[tuple[str, str]] = []
        if item.place_id:
            item_keys.append(("id", item.place_id))
        domain = website_domain(item.website)
        if domain:
            item_keys.append(("domain", domain))
        phone = normalized_phone(item.phone)
        if len(phone) == 10:
            item_keys.append(("phone", phone))
        name, city = normalized_name(item.name), city_key(item)
        if name and city:
            item_keys.append(("name_city", f"{name}|{city}"))
        for key in item_keys:
            if key in keys:
                union(index, keys[key])
            else:
                keys[key] = index
    groups: dict[int, list[Business]] = {}
    for index, item in enumerate(observations):
        groups.setdefault(root(index), []).append(item)
    return [merge_group(group) for group in groups.values()]


def score_master(business: Business, config: dict | None = None) -> Business:
    weights = config or load_scoring()
    opportunity = weights["opportunity"]
    flags: list[str] = []
    total = 0
    if business.signals.get("website") is False:
        total += opportunity["no_website"]
        flags.append("NO_WEBSITE")
    elif business.signals.get("social") is True:
        total += opportunity["social_only"]
        flags.append("SOCIAL_ONLY")
    elif business.score < 40:
        total += opportunity["website_health_below_40"]
        flags.append("WEBSITE_HEALTH_CRITICAL")
    elif business.score < 65:
        total += opportunity["website_health_below_65"]
        flags.append("WEBSITE_HEALTH_LOW")
    gap_map = {
        "email": ("no_email", "NO_EMAIL"), "phone": ("no_phone", "NO_PHONE"),
        "state_registration": ("no_state_registration", "REGISTRATION_NOT_FOUND"),
        "professional_license": ("no_professional_license", "LICENSE_NOT_FOUND"),
        "chamber": ("no_chamber", "CHAMBER_NOT_FOUND"),
        "recent_permit": ("no_recent_permit", "NO_RECENT_PERMIT"),
    }
    for signal, (weight, flag) in gap_map.items():
        if business.signals.get(signal) is False:
            total += opportunity[weight]
            flags.append(flag)
    confidence = weights["confidence"]
    source_count = len(business.source_ids) or 1
    confidence_total = min(source_count * confidence["per_source"], confidence["source_cap"])
    for signal in ("website", "phone", "email"):
        if business.signals.get(signal) is True:
            confidence_total += confidence[signal]
    confidence_total += confidence["address"] if business.formatted_address else 0
    confidence_total += confidence["coordinates"] if business.latitude is not None and business.longitude is not None else 0
    confidence_total += confidence["license"] if business.signals.get("professional_license") is True else 0
    confidence_total += confidence["registration"] if business.signals.get("state_registration") is True else 0
    business.opportunity_score = min(100, total)
    business.confidence_score = min(100, confidence_total)
    business.gap_flags = flags
    return business


def build_master_records(observations: list[Business], config: dict | None = None) -> list[Business]:
    return [score_master(business, config) for business in merge_businesses(observations)]
