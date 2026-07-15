from pathlib import Path
from unittest.mock import patch

import pytest

from lead_scraper.audit import bucket_for, email_priority, score_from_deductions
from lead_scraper.cli import export, pitch_for
from lead_scraper.models import Business
from lead_scraper.places import estimated_cost
from lead_scraper.raw_discovery import normalize_us_location
from dashboard import jobs, persist_job, read_csv


def test_buckets():
    assert bucket_for("") == "NO_WEBSITE"
    assert bucket_for("https://www.facebook.com/example") == "SOCIAL_ONLY"
    assert bucket_for("https://business.site/example") == "SOCIAL_ONLY"
    assert bucket_for("https://example.com") == "HAS_SITE"


def test_score_is_health_with_lower_values_worse():
    assert score_from_deductions(0) == 100
    assert score_from_deductions(68) == 32
    assert score_from_deductions(150) == 0


def test_personal_email_is_preferred():
    emails = ["info@example.com", "owner@example.com", "hello@example.com"]
    assert sorted(emails, key=email_priority)[0] == "owner@example.com"


def test_cost_estimate():
    assert estimated_cost(21, 2, 10, 20) == pytest.approx(0.88)


def test_export_ranking_and_pitch(tmp_path: Path):
    a = Business("a", "Alpha", score=20, review_count=10, flaws=["very slow to load"], emails=["a@example.com"])
    b = Business("b", "Beta", score=50, review_count=100, flaws=["not secure"])
    c = Business("c", "Charlie", score=20, review_count=50, flaws=["broken pages"])
    d = Business("d", "Healthy", score=80, review_count=500, flaws=["no tracking at all"])
    frame = export([a, b, c, d], tmp_path / "leads.csv", 65, True)
    assert list(frame.business_name) == ["Charlie", "Alpha", "Beta"]
    assert "very slow to load" in pitch_for(a)


def test_bare_zip_is_recognized_as_us_zip():
    # Regression guard: ZIP 37138 must not be treated as a Lithuanian postal code.
    assert normalize_us_location("37138") == "37138, USA"
    assert normalize_us_location("Lebanon, TN") == "Lebanon, TN"


def test_osm_export_does_not_invent_ratings(tmp_path: Path):
    lead = Business("osm:node:1", "Local Shop", data_source="OpenStreetMap", score=0,
                    review_count=0, flaws=["no website listed in OpenStreetMap"])
    frame = export([lead], tmp_path / "osm.csv", 65, False)
    assert frame.iloc[0]["review_count"] == ""
    assert frame.iloc[0]["data_source"] == "OpenStreetMap"


def test_job_history_failure_never_crashes_a_scan():
    jobs["write-test"] = {"id": "write-test", "status": "running", "log": ""}
    try:
        with patch("pathlib.Path.write_text", side_effect=PermissionError("locked")):
            persist_job("write-test")
    finally:
        jobs.pop("write-test", None)


def test_legacy_problem_scores_are_normalized_when_viewed(tmp_path: Path):
    with_health = tmp_path / "with-health.csv"
    with_health.write_text(
        "business_name,score,health_score,recommended_tier,place_id\n"
        "No Site,100,0,Full Modernization,osm:node:1\n",
        encoding="utf-8",
    )
    columns, rows = read_csv(with_health)
    assert "health_score" not in columns
    assert rows[0]["score"] == "0"
    assert rows[0]["recommended_tier"] == "Full Modernization"
    assert rows[0]["score_scale"] == "0=worst, 100=excellent"

    oldest = tmp_path / "oldest.csv"
    oldest.write_text(
        "business_name,score,place_id\nNo Site,100,osm:node:2\n",
        encoding="utf-8",
    )
    _, oldest_rows = read_csv(oldest)
    assert oldest_rows[0]["score"] == "0"
