from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .models import Business


class LeadDatabase:
    def __init__(self, path: Path):
        self.connection = sqlite3.connect(path)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS businesses (
                place_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_scanned_at TEXT NOT NULL,
                bucket TEXT,
                score INTEGER,
                raw_checks TEXT
            )
            """
        )
        self.connection.commit()

    def seen(self, place_id: str) -> bool:
        row = self.connection.execute(
            "SELECT 1 FROM businesses WHERE place_id = ?", (place_id,)
        ).fetchone()
        return row is not None

    def save(self, business: Business) -> None:
        self.connection.execute(
            """
            INSERT INTO businesses
                (place_id, name, first_seen_at, last_scanned_at, bucket, score, raw_checks)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(place_id) DO UPDATE SET
                name=excluded.name, last_scanned_at=excluded.last_scanned_at,
                bucket=excluded.bucket, score=excluded.score, raw_checks=excluded.raw_checks
            """,
            (
                business.place_id, business.name, business.scanned_at,
                business.scanned_at, business.bucket, business.score,
                json.dumps(business.checks, ensure_ascii=False),
            ),
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()
