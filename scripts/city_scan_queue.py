"""Build the master lead database from qualifying large-city OSM batches."""

from __future__ import annotations

import csv
import os
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"
MASTER_DB = ROOT / "lead_scraper.db"
TARGET = 10_000
MIN_CITY_RESULTS = 1_000
CITIES = (
    ("new-york", "New York, NY", 22),
    ("los-angeles", "Los Angeles, CA", 25),
    ("chicago", "Chicago, IL", 22),
    ("houston", "Houston, TX", 28),
    ("phoenix", "Phoenix, AZ", 28),
    ("philadelphia", "Philadelphia, PA", 22),
    ("san-antonio", "San Antonio, TX", 28),
    ("san-diego", "San Diego, CA", 24),
    ("dallas", "Dallas, TX", 25),
    ("austin", "Austin, TX", 25),
    ("jacksonville", "Jacksonville, FL", 28),
    ("columbus", "Columbus, OH", 24),
    ("charlotte", "Charlotte, NC", 25),
    ("indianapolis", "Indianapolis, IN", 25),
)


def db_count(path: Path) -> int:
    with sqlite3.connect(path) as connection:
        return connection.execute("SELECT COUNT(*) FROM businesses").fetchone()[0]


def csv_count(path: Path) -> int:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def seed_screen_db(path: Path) -> None:
    if path.exists():
        return
    source = sqlite3.connect(MASTER_DB)
    target = sqlite3.connect(path)
    source.backup(target)
    target.close()
    source.close()


def merge_screen_db(path: Path) -> int:
    before = db_count(MASTER_DB)
    with sqlite3.connect(MASTER_DB) as connection:
        connection.execute("ATTACH DATABASE ? AS screened", (str(path),))
        connection.execute(
            """INSERT OR IGNORE INTO businesses
               SELECT * FROM screened.businesses"""
        )
        connection.commit()
    return db_count(MASTER_DB) - before


def log(message: str) -> None:
    stamp = datetime.now().astimezone().strftime("%m/%d/%Y %I:%M:%S %p %Z")
    print(f"[{stamp}] {message}", flush=True)


def main() -> int:
    RUNS.mkdir(exist_ok=True)
    log(f"Queue started; master={db_count(MASTER_DB):,}, target={TARGET:,}")
    for slug, city, radius in CITIES:
        current = db_count(MASTER_DB)
        if current >= TARGET:
            log(f"Target reached; master={current:,}")
            return 0
        output = RUNS / f"city-{slug}-screen.csv"
        screen_db = RUNS / f"city-{slug}-screen.db"
        if output.exists():
            count = csv_count(output)
            log(f"Using completed {city} screen: {count:,} records")
        else:
            seed_screen_db(screen_db)
            env = os.environ.copy()
            env["LEAD_SCRAPER_DB"] = str(screen_db)
            command = [
                sys.executable, str(ROOT / "scraper.py"), "--niche", "local businesses",
                "--location", city, "--radius", str(radius), "--max-score", "100",
                "--max-results", "1600", "--concurrency", "8", "--source", "osm",
                "--output", str(output), "--yes",
            ]
            log(f"Screening {city} (radius {radius} mi)")
            result = subprocess.run(command, cwd=ROOT, env=env)
            if result.returncode or not output.exists():
                log(f"Screen failed for {city}; continuing")
                continue
            count = csv_count(output)
        if count < MIN_CITY_RESULTS:
            log(f"Rejected {city}: {count:,} < {MIN_CITY_RESULTS:,}")
            continue
        added = merge_screen_db(screen_db)
        log(f"Accepted {city}: batch={count:,}, new master IDs={added:,}, master={db_count(MASTER_DB):,}")
    log(f"Queue exhausted; master={db_count(MASTER_DB):,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
