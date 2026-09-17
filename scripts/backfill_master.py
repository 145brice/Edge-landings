"""Rebuild one deduplicated, contact-enriched master export from saved scans."""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from lead_scraper.audit import SiteAuditor, bucket_for
from lead_scraper.cli import export
from lead_scraper.config import Settings
from lead_scraper.intelligence import build_master_records
from lead_scraper.models import Business


def text_list(value: str) -> list[str]:
    return [item for item in (value or "").split("|") if item]


def business_from_row(row: dict[str, str], fallback_id: str) -> Business:
    email = (row.get("email") or "").strip()
    try:
        score = int(float(row.get("score") or 0))
    except ValueError:
        score = 0
    return Business(
        place_id=(row.get("place_id") or fallback_id).strip(),
        name=(row.get("business_name") or row.get("name") or "").strip(),
        formatted_address=(row.get("formatted_address") or "").strip(),
        phone=(row.get("phone") or "").strip(), website=(row.get("website") or "").strip(),
        category=(row.get("category") or "local_business").strip(),
        city=(row.get("city") or "").strip(), google_maps_url=(row.get("google_maps_url") or "").strip(),
        data_source=(row.get("data_source") or "historical_export").strip(),
        website_evidence=(row.get("website_evidence") or "").strip(),
        bucket=(row.get("bucket") or bucket_for(row.get("website") or "")).strip(),
        score=score, flaws=text_list(row.get("all_flaws") or row.get("top_flaw") or ""),
        emails=[email] if email else [], contact_form_url=(row.get("contact_form_url") or "").strip(),
        facebook_url=(row.get("facebook_url") or "").strip(),
        instagram_url=(row.get("instagram_url") or "").strip(),
        linkedin_url=(row.get("linkedin_url") or "").strip(),
        contact_evidence=text_list(row.get("contact_evidence") or ""),
        scanned_at=(row.get("scanned_at") or "").strip(),
    )


def load_history(runs: Path) -> list[Business]:
    observations: list[Business] = []
    for path in sorted(runs.glob("*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for number, row in enumerate(csv.DictReader(handle), start=2):
                business = business_from_row(row, f"legacy:{path.stem}:{number}")
                if business.name:
                    observations.append(business)
    return observations


async def refresh_contacts(records: list[Business], settings: Settings, concurrency: int) -> None:
    auditor = SiteAuditor(concurrency, settings.timeout_seconds, settings.user_agent)
    candidates = [record for record in records if bucket_for(record.website) == "HAS_SITE"]
    try:
        tasks = [asyncio.create_task(auditor.audit(record)) for record in candidates]
        for complete, task in enumerate(asyncio.as_completed(tasks), start=1):
            await task
            if complete % 50 == 0 or complete == len(tasks):
                print(f"contact_refresh={complete}/{len(tasks)}", flush=True)
    finally:
        await auditor.close()
    now = datetime.now(timezone.utc).isoformat()
    candidate_ids = {id(record) for record in candidates}
    for record in records:
        if id(record) not in candidate_ids:
            record.scanned_at = record.scanned_at or now


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--concurrency", type=int, default=6)
    args = parser.parse_args()
    runs = ROOT / "runs"
    observations = load_history(runs)
    print(f"historical_rows={len(observations)}", flush=True)
    records = build_master_records(observations)
    print(f"unique_before_refresh={len(records)} duplicates_removed={len(observations)-len(records)}", flush=True)
    settings = Settings.load()
    asyncio.run(refresh_contacts(records, settings, args.concurrency))
    records = build_master_records(records)
    output = runs / f"master-leads-{datetime.now():%Y%m%d-%H%M%S}.csv"
    frame = export(records, output, 100, True)
    print(json.dumps({"output": str(output), "unique_records": len(frame)}, indent=2), flush=True)


if __name__ == "__main__":
    main()
