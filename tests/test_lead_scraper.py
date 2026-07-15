from pathlib import Path

import pytest

from lead_scraper.audit import bucket_for, email_priority
from lead_scraper.cli import export, pitch_for
from lead_scraper.models import Business
from lead_scraper.places import estimated_cost
from lead_scraper.raw_discovery import normalize_us_location


def test_buckets():
    assert bucket_for("") == "NO_WEBSITE"
    assert bucket_for("https://www.facebook.com/example") == "SOCIAL_ONLY"
    assert bucket_for("https://business.site/example") == "SOCIAL_ONLY"
    assert bucket_for("https://example.com") == "HAS_SITE"


def test_personal_email_is_preferred():
    emails = ["info@example.com", "owner@example.com", "hello@example.com"]
    assert sorted(emails, key=email_priority)[0] == "owner@example.com"


def test_cost_estimate():
    assert estimated_cost(21, 2, 10, 20) == pytest.approx(0.88)


def test_export_ranking_and_pitch(tmp_path: Path):
    a = Business("a", "Alpha", score=50, review_count=10, flaws=["very slow to load"], emails=["a@example.com"])
    b = Business("b", "Beta", score=50, review_count=100, flaws=["not secure"])
    frame = export([a, b], tmp_path / "leads.csv", 35, True)
    assert list(frame.business_name) == ["Beta", "Alpha"]
    assert "very slow to load" in pitch_for(a)


def test_bare_zip_is_recognized_as_us_zip():
    # Regression guard: ZIP 37138 must not be treated as a Lithuanian postal code.
    assert normalize_us_location("37138") == "37138, USA"
    assert normalize_us_location("Lebanon, TN") == "Lebanon, TN"


def test_osm_export_does_not_invent_ratings(tmp_path: Path):
    lead = Business("osm:node:1", "Local Shop", data_source="OpenStreetMap", score=100,
                    review_count=0, flaws=["no website listed in OpenStreetMap"])
    frame = export([lead], tmp_path / "osm.csv", 35, False)
    assert frame.iloc[0]["review_count"] == ""
    assert frame.iloc[0]["data_source"] == "OpenStreetMap"
