from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from .audit import SiteAuditor, bucket_for
from .config import Settings
from .connectors import connector_for
from .database import LeadDatabase
from .intelligence import build_master_records
from .models import Business
from .outreach import TemplatePerformance, build_draft, preferred_channel
from .places import estimated_cost
from .pricing import build_tiers, recommended_tier
from .raw_discovery import DiscoveryError

LOG = logging.getLogger(__name__)
SIGNAL_COLUMNS = [
    "signal_google_profile", "signal_website", "signal_phone", "signal_email", "signal_social",
    "signal_state_registration", "signal_professional_license", "signal_chamber", "signal_bbb",
    "signal_yelp", "signal_angi", "signal_houzz", "signal_thumbtack", "signal_recent_permit",
]
CSV_COLUMNS = [
    "rank", "score", "business_name", "category", "city", "phone", "email", "website", "bucket",
    "top_flaw", "all_flaws", "rating", "review_count", "outreach_channel", "contact_form_url",
    "facebook_url", "instagram_url", "linkedin_url", "contact_evidence",
    "google_maps_url", "place_id", "scanned_at", "scanned_date", "scanned_time",
    "scanned_timezone", "data_source", "website_evidence",
    "score_scale", "recommended_tier", "quick_win_price", "quick_win_target",
    "solid_rebuild_price", "solid_rebuild_target", "full_modernization_price",
    "full_modernization_target", "opportunity_score", "confidence_score", "gap_flags",
    "source_count", "source_ids", *SIGNAL_COLUMNS,
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
    p.add_argument("--max-score", type=int, default=65,
                   help="Highest website health score to qualify (0=worst, 100=excellent)")
    p.add_argument("--min-score", type=int, dest="legacy_min_score", help=argparse.SUPPRESS)
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
    use_google = args.source == "google"
    if use_google:
        cost = estimated_cost(args.max_results, len(niches), settings.text_search_cost_per_1000,
                              settings.details_cost_per_1000)
        confirm_cost(cost, settings.cost_confirmation_threshold, args.yes)
    else:
        print("Discovery source: OpenStreetMap (no API key or Places charge).")
    db = LeadDatabase(settings.database_path)
    connector = connector_for(args.source, settings)
    auditor = SiteAuditor(args.concurrency, settings.timeout_seconds, settings.user_agent)
    leads: list[Business] = []
    try:
        for niche in niches:
            resolved = await connector.discover(
                niche, args.location, args.radius, args.max_results, seen=db.seen
            )
            LOG.info("discovery_complete: connector=%s niche=%s new=%d", connector.policy.slug, niche, len(resolved))
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
                    source = business.data_source or "discovery source"
                    business.score = 0
                    business.flaws = [f"no website listed in {source}"]
                    business.checks = {"no_website_listed": True, "independently_verified": False}
                elif business.bucket == "SOCIAL_ONLY":
                    business.score, business.flaws = 15, ["no independent website"]
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
        await connector.close()
        await auditor.close()
        db.close()
    return build_master_records(leads)


def pitch_for(business: Business) -> str:
    draft = build_draft(business)
    return draft.body if draft else ""


def export_timestamp(value: str) -> dict[str, str]:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        central = parsed.astimezone(ZoneInfo("America/Chicago"))
    except (TypeError, ValueError):
        return {"scanned_at": value or "", "scanned_date": "", "scanned_time": "", "scanned_timezone": "CT"}
    clock = central.strftime("%I:%M %p").lstrip("0")
    return {"scanned_at": f"{central:%m/%d/%Y} {clock} CT",
            "scanned_date": central.strftime("%m/%d/%Y"), "scanned_time": clock,
            "scanned_timezone": "CT"}


def export(leads: list[Business], output: Path, max_score: int, with_pitch: bool) -> pd.DataFrame:
    if any(not business.source_ids for business in leads):
        leads = build_master_records(leads)
    qualified = [b for b in leads if b.score <= max_score]
    rows = []
    performance = TemplatePerformance(output.parent / "outreach-performance.db") if with_pitch else None
    for b in qualified:
        row = {
            "business_name": b.name, "category": b.category, "city": b.city,
            "phone": b.phone, "email": b.emails[0] if b.emails else "",
            "website": b.website, "bucket": b.bucket, "score": b.score,
            "top_flaw": b.flaws[0] if b.flaws else "", "all_flaws": "|".join(b.flaws),
            "rating": b.rating,
            "review_count": ("" if set(b.source_ids) == {"osm"} else b.review_count),
            "outreach_channel": preferred_channel(b), "contact_form_url": b.contact_form_url,
            "facebook_url": b.facebook_url, "instagram_url": b.instagram_url,
            "linkedin_url": b.linkedin_url, "contact_evidence": "|".join(b.contact_evidence),
            "google_maps_url": b.google_maps_url,
            "place_id": b.place_id,
            "data_source": b.data_source, "website_evidence": b.website_evidence,
            "score_scale": "0=worst, 100=excellent",
            "opportunity_score": b.opportunity_score,
            "confidence_score": b.confidence_score,
            "gap_flags": "|".join(b.gap_flags),
            "source_count": len(b.source_ids),
            "source_ids": json.dumps(b.source_ids, sort_keys=True),
        }
        row.update(export_timestamp(b.scanned_at))
        for column in SIGNAL_COLUMNS:
            value = b.signals.get(column.removeprefix("signal_"))
            row[column] = "yes" if value is True else "no" if value is False else "unknown"
        _, tiers = build_tiers(b.score, b.flaws, b.category)
        row.update({
            "recommended_tier": recommended_tier(b.score),
            "quick_win_price": tiers[0].price, "quick_win_target": tiers[0].projected_health,
            "solid_rebuild_price": tiers[1].price, "solid_rebuild_target": tiers[1].projected_health,
            "full_modernization_price": tiers[2].price,
            "full_modernization_target": tiers[2].projected_health,
        })
        if with_pitch:
            draft = build_draft(b, performance)
            row.update({
                "outreach_template_id": draft.template_id if draft else "",
                "outreach_subject": draft.subject if draft else "",
                "outreach_script": draft.body if draft else "",
                "outreach_pain_points": "|".join(draft.pain_points) if draft else "",
                "pitch_line": draft.body if draft else "",
            })
        rows.append(row)
    if performance:
        performance.close()
    columns = CSV_COLUMNS + (["outreach_template_id", "outreach_subject", "outreach_script",
                              "outreach_pain_points", "pitch_line"] if with_pitch else [])
    frame = pd.DataFrame(rows, columns=columns)
    if not frame.empty:
        frame["_review_sort"] = pd.to_numeric(frame["review_count"], errors="coerce").fillna(0)
        frame = frame.sort_values(
            ["opportunity_score", "confidence_score", "score", "_review_sort"],
            ascending=[False, False, True, False],
        ).drop(columns=["_review_sort"])
        frame["rank"] = range(1, len(frame) + 1)
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output, index=False)
    return frame


def print_summary(leads: list[Business], frame: pd.DataFrame, max_score: int) -> None:
    buckets = Counter(b.bucket for b in leads)
    print(f"\nTotal new operational businesses: {len(leads)}")
    print(f"Qualified (website score <= {max_score}): {len(frame)}")
    print("Buckets: " + ", ".join(f"{name}={count}" for name, count in sorted(buckets.items())))
    if not frame.empty:
        print("\nTop 10 leads:")
        print(frame[["business_name", "score", "review_count", "top_flaw"]].head(10).to_string(index=False))


def main() -> None:
    args = parser().parse_args()
    if args.legacy_min_score is not None:
        # Preserve old commands: old problem score >= 35 equals new health score <= 65.
        args.max_score = 100 - args.legacy_min_score
    if not 0 <= args.max_score <= 100 or args.radius <= 0 or args.max_results <= 0 or args.concurrency <= 0:
        raise SystemExit("Scores must be 0-100; radius, max-results, and concurrency must be positive.")
    settings = Settings.load()
    if args.source == "google":
        raise SystemExit(
            "Google Places cannot feed durable master-record exports in this build; use --source osm."
        )
    log_path = configure_logging(settings.log_directory, args.verbose)
    try:
        leads = asyncio.run(run(args, settings))
    except DiscoveryError as exc:
        LOG.error("discovery_failed: %s", exc)
        raise SystemExit(f"Discovery failed after retries: {exc}") from exc
    frame = export(leads, args.output, args.max_score, args.with_pitch)
    print_summary(leads, frame, args.max_score)
    print(f"\nCSV: {args.output.resolve()}\nLog: {log_path.resolve()}")
