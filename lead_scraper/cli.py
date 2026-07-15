from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .audit import SiteAuditor, bucket_for
from .config import Settings
from .database import LeadDatabase
from .models import Business
from .places import PlacesClient, estimated_cost
from .pricing import build_tiers, recommended_tier
from .raw_discovery import DiscoveryError, RawDiscoveryClient

LOG = logging.getLogger(__name__)
CSV_COLUMNS = [
    "business_name", "category", "city", "phone", "email", "website", "bucket",
    "score", "top_flaw", "all_flaws", "rating", "review_count", "outreach_channel",
    "google_maps_url", "place_id", "scanned_at",
    "health_score", "recommended_tier", "quick_win_price", "quick_win_target",
    "solid_rebuild_price", "solid_rebuild_target", "full_modernization_price",
    "full_modernization_target",
]


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("error", "url", "place_id", "niche"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        return json.dumps(data, ensure_ascii=False)


def configure_logging(log_dir: Path, verbose: bool) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / f"lead-scraper-{datetime.now():%Y%m%d-%H%M%S}.jsonl"
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if verbose else logging.INFO)
    root.handlers.clear()
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    file_handler = logging.FileHandler(path, encoding="utf-8")
    file_handler.setFormatter(JsonFormatter())
    root.addHandler(console)
    root.addHandler(file_handler)
    return path


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Find and rank local businesses needing a website rebuild.")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--niche", help='Business niche, e.g. "hvac"')
    group.add_argument("--niches-file", type=Path, help="One niche per line")
    p.add_argument("--location", required=True, help='Search location, e.g. "Lebanon, TN"')
    p.add_argument("--radius", type=float, default=15, help="Search radius in miles (default: 15)")
    p.add_argument("--min-score", type=int, default=35)
    p.add_argument("--max-results", type=int, default=60, help="Maximum results per niche")
    p.add_argument("--concurrency", type=int, default=10)
    p.add_argument("--output", type=Path, default=Path("leads.csv"))
    p.add_argument("--with-pitch", action="store_true")
    p.add_argument("--yes", action="store_true", help="Skip cost confirmation")
    p.add_argument("--verbose", action="store_true")
    p.add_argument("--source", choices=("auto", "google", "osm"), default="auto",
                   help="Discovery source; auto uses Google when keyed, otherwise OpenStreetMap")
    return p


def load_niches(args: argparse.Namespace) -> list[str]:
    if args.niche:
        return [args.niche.strip()]
    try:
        return [line.strip() for line in args.niches_file.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")]
    except OSError as exc:
        raise SystemExit(f"Could not read niches file: {exc}") from exc


def confirm_cost(cost: float, threshold: float, assume_yes: bool) -> None:
    print(f"Estimated maximum Places API cost: ${cost:.2f} (verify rates in your Google account).")
    if cost <= threshold or assume_yes:
        return
    if not sys.stdin.isatty():
        raise SystemExit("Estimated cost exceeds threshold; rerun interactively or pass --yes.")
    answer = input(f"This exceeds your ${threshold:.2f} threshold. Continue? [y/N] ").strip().lower()
    if answer not in {"y", "yes"}:
        raise SystemExit("Cancelled.")


async def run(args: argparse.Namespace, settings: Settings) -> list[Business]:
    niches = load_niches(args)
    use_google = args.source == "google" or (args.source == "auto" and bool(settings.api_key))
    if use_google:
        cost = estimated_cost(args.max_results, len(niches), settings.text_search_cost_per_1000,
                              settings.details_cost_per_1000)
        confirm_cost(cost, settings.cost_confirmation_threshold, args.yes)
    else:
        print("Discovery source: OpenStreetMap (no API key or Places charge).")
    db = LeadDatabase(settings.database_path)
    places = PlacesClient(settings.api_key, settings.timeout_seconds) if use_google else None
    raw = RawDiscoveryClient(settings.timeout_seconds, settings.user_agent) if not use_google else None
    auditor = SiteAuditor(args.concurrency, settings.timeout_seconds, settings.user_agent)
    leads: list[Business] = []
    try:
        for niche in niches:
            # Including the requested radius in the query lets Places resolve the named
            # location without a second geocoding API/SKU.
            query = f"{niche} within {args.radius:g} miles"
            if places:
                ids = await places.search(query, args.location, args.radius, args.max_results)
                new_ids = [place_id for place_id in ids if not db.seen(place_id)]
                details = await asyncio.gather(*(places.details(place_id) for place_id in new_ids))
            else:
                discovered = await raw.discover(args.location, args.radius, args.max_results)
                ids = [b.place_id for b in discovered]
                details = [b for b in discovered if not db.seen(b.place_id)]
                new_ids = [b.place_id for b in details]
            LOG.info("discovery_complete: niche=%s found=%d new=%d", niche, len(ids), len(new_ids))
            resolved = [b for b in details if b]
            businesses = [b for b in resolved if b.business_status == "OPERATIONAL"]
            for dropped in (b for b in resolved if b.business_status != "OPERATIONAL"):
                dropped.bucket = "DROPPED_NON_OPERATIONAL"
                dropped.scanned_at = datetime.now(timezone.utc).isoformat()
                dropped.checks = {"business_status": dropped.business_status}
                db.save(dropped)
            for business in businesses:
                business.bucket = bucket_for(business.website)
                business.scanned_at = datetime.now(timezone.utc).isoformat()
                if business.bucket == "NO_WEBSITE":
                    business.score, business.flaws = 100, ["no website"]
                    business.checks = {"no_website": True}
                elif business.bucket == "SOCIAL_ONLY":
                    business.score, business.flaws = 85, ["no independent website"]
                    business.checks = {"social_only": True}
            site_leads = [b for b in businesses if b.bucket == "HAS_SITE"]
            if site_leads:
                audit_tasks = [asyncio.create_task(auditor.audit(b)) for b in site_leads]
                audited = []
                for completed_count, task in enumerate(asyncio.as_completed(audit_tasks), start=1):
                    audited.append(await task)
                    LOG.info("audit_progress: completed=%d total=%d", completed_count, len(site_leads))
                by_id = {b.place_id: b for b in audited}
                businesses = [by_id.get(b.place_id, b) for b in businesses]
            for business in businesses:
                db.save(business)
            leads.extend(businesses)
    finally:
        if places:
            await places.close()
        if raw:
            await raw.close()
        await auditor.close()
        db.close()
    return leads


def pitch_for(business: Business) -> str:
    flaw = business.flaws[0] if business.flaws else "website issue"
    return (
        f"I noticed that {business.name}'s website is {flaw}. "
        "That can make it harder for local customers to choose and contact your business. "
        "I design straightforward local-business sites and would be happy to show you what I would improve."
    )


def export(leads: list[Business], output: Path, min_score: int, with_pitch: bool) -> pd.DataFrame:
    qualified = [b for b in leads if b.score >= min_score]
    rows = []
    for b in qualified:
        row = {
            "business_name": b.name, "category": b.category, "city": b.city,
            "phone": b.phone, "email": b.emails[0] if b.emails else "",
            "website": b.website, "bucket": b.bucket, "score": b.score,
            "top_flaw": b.flaws[0] if b.flaws else "", "all_flaws": "|".join(b.flaws),
            "rating": b.rating, "review_count": b.review_count,
            "outreach_channel": b.outreach_channel, "google_maps_url": b.google_maps_url,
            "place_id": b.place_id, "scanned_at": b.scanned_at,
        }
        health, tiers = build_tiers(b.score, b.flaws, b.category)
        row.update({
            "health_score": health, "recommended_tier": recommended_tier(b.score),
            "quick_win_price": tiers[0].price, "quick_win_target": tiers[0].projected_health,
            "solid_rebuild_price": tiers[1].price, "solid_rebuild_target": tiers[1].projected_health,
            "full_modernization_price": tiers[2].price,
            "full_modernization_target": tiers[2].projected_health,
        })
        if with_pitch and b.emails:
            row["pitch_line"] = pitch_for(b)
        elif with_pitch:
            row["pitch_line"] = ""
        rows.append(row)
    columns = CSV_COLUMNS + (["pitch_line"] if with_pitch else [])
    frame = pd.DataFrame(rows, columns=columns)
    if not frame.empty:
        frame = frame.sort_values(["score", "review_count"], ascending=[False, False])
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output, index=False)
    return frame


def print_summary(leads: list[Business], frame: pd.DataFrame, min_score: int) -> None:
    buckets = Counter(b.bucket for b in leads)
    print(f"\nTotal new operational businesses: {len(leads)}")
    print(f"Qualified (score >= {min_score}): {len(frame)}")
    print("Buckets: " + ", ".join(f"{name}={count}" for name, count in sorted(buckets.items())))
    if not frame.empty:
        print("\nTop 10 leads:")
        print(frame[["business_name", "score", "review_count", "top_flaw"]].head(10).to_string(index=False))


def main() -> None:
    args = parser().parse_args()
    if not 0 <= args.min_score <= 100 or args.radius <= 0 or args.max_results <= 0 or args.concurrency <= 0:
        raise SystemExit("Scores must be 0-100; radius, max-results, and concurrency must be positive.")
    settings = Settings.load()
    if args.source == "google" and not settings.api_key:
        raise SystemExit("Google source requires GOOGLE_PLACES_API_KEY; use --source osm for no-key discovery.")
    log_path = configure_logging(settings.log_directory, args.verbose)
    try:
        leads = asyncio.run(run(args, settings))
    except DiscoveryError as exc:
        LOG.error("discovery_failed: %s", exc)
        raise SystemExit(f"Discovery failed after retries: {exc}") from exc
    frame = export(leads, args.output, args.min_score, args.with_pitch)
    print_summary(leads, frame, args.min_score)
    print(f"\nCSV: {args.output.resolve()}\nLog: {log_path.resolve()}")
