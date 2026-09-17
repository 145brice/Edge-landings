from pathlib import Path
from unittest.mock import patch
import asyncio

import pytest

from lead_scraper.audit import bucket_for, email_priority, score_from_deductions
from lead_scraper.cli import export, export_timestamp, pitch_for
from lead_scraper.models import Business
from lead_scraper.intelligence import build_master_records, load_scoring, observations_match
from lead_scraper.connectors import connector_status
from lead_scraper.places import estimated_cost
from lead_scraper.raw_discovery import grid_size_for, normalize_us_location
from dashboard import central_timestamp, effective_radius, jobs, persist_job, read_csv, result_file_timestamp, table_sort_value
from dashboard import MAX_STANDARD_RESULTS


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


def test_contact_refresh_preserves_previously_confirmed_email():
    from bs4 import BeautifulSoup
    from lead_scraper.audit import SiteAuditor
    lead = Business("id", "Local Co", website="https://example.com", emails=["owner@example.com"],
                    contact_form_url="https://example.com/contact")
    async def exercise():
        auditor = SiteAuditor(1, 1, "test")
        with patch.object(auditor, "fetch", return_value=None):
            await auditor.enrich(lead, BeautifulSoup("<html></html>", "html.parser"), lead.website)
        await auditor.close()
    asyncio.run(exercise())
    assert lead.emails == ["owner@example.com"]
    assert lead.contact_form_url == "https://example.com/contact"


def test_cost_estimate():
    assert estimated_cost(21, 2, 10, 20) == pytest.approx(0.88)


def test_export_ranking_and_pitch(tmp_path: Path):
    a = Business("a", "Alpha", score=20, review_count=10, flaws=["very slow to load"], emails=["a@example.com"])
    b = Business("b", "Beta", score=50, review_count=100, flaws=["not secure"])
    c = Business("c", "Charlie", score=20, review_count=50, flaws=["broken pages"])
    d = Business("d", "Healthy", score=80, review_count=500, flaws=["no tracking at all"])
    frame = export([a, b, c, d], tmp_path / "leads.csv", 65, True)
    assert list(frame.business_name) == ["Charlie", "Alpha", "Beta"]
    assert list(frame["rank"]) == [1, 2, 3]
    assert list(frame.columns[:3]) == ["rank", "score", "business_name"]
    assert "no-obligation example" in pitch_for(a)


def test_bare_zip_is_recognized_as_us_zip():
    # Regression guard: ZIP 37138 must not be treated as a Lithuanian postal code.
    assert normalize_us_location("37138") == "37138, USA"
    assert normalize_us_location("Lebanon, TN") == "Lebanon, TN"


def test_bulk_discovery_uses_more_small_geographic_tiles():
    assert grid_size_for(5, 40) == 1
    assert grid_size_for(15, 50) == 3
    assert grid_size_for(31, 1000) == 5
    assert grid_size_for(31, 5000) == 12
    assert grid_size_for(85, 10000) == 14


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
    assert columns[0] == "rank"


def test_result_pages_keep_global_rank_and_include_every_row(tmp_path: Path):
    path = tmp_path / "many.csv"
    path.write_text(
        "business_name,score,place_id\n" +
        "".join(f"Business {number},{number},id-{number}\n" for number in range(45)),
        encoding="utf-8",
    )
    _, first = read_csv(path, limit=20, offset=0)
    _, second = read_csv(path, limit=20, offset=20)
    _, third = read_csv(path, limit=20, offset=40)
    assert [len(first), len(second), len(third)] == [20, 20, 5]
    assert second[0]["rank"] == "21"
    assert third[-1]["rank"] == "45"


def test_expanded_search_radius_doubles_with_supported_cap():
    assert effective_radius(10, False) == 10
    assert effective_radius(10, True) == 20
    assert effective_radius(20, True) == 31


def test_standard_scan_allows_large_total_targets():
    assert MAX_STANDARD_RESULTS == 1000


def test_email_sort_key_orders_real_addresses_consistently():
    rows = [{"email": "z@example.com"}, {"email": "a@example.com"}]
    assert [row["email"] for row in sorted(rows, key=lambda row: table_sort_value(row, "email"))] == [
        "a@example.com", "z@example.com"
    ]


def test_legacy_result_rows_receive_labeled_file_timestamp(tmp_path: Path):
    path = tmp_path / "legacy.csv"
    path.write_text("business_name,score,place_id\nOld Lead,40,old-1\n", encoding="utf-8")
    columns, rows = read_csv(path)
    assert "scanned_at" in columns
    assert rows[0]["scanned_at"]
    assert rows[0]["timestamp_source"] == "result file modified time (fallback)"
    assert result_file_timestamp(path).endswith(" CT")


def test_timestamp_is_readable_and_converted_to_central_time():
    assert central_timestamp("2026-07-15T23:19:47.310536+00:00") == "07/15/2026 6:19 PM CT"
    fields = export_timestamp("2026-07-15T23:19:47.310536+00:00")
    assert fields["scanned_at"] == "07/15/2026 6:19 PM CT"
    assert fields["scanned_date"] == "07/15/2026"
    assert fields["scanned_time"] == "6:19 PM"
    assert fields["scanned_timezone"] == "CT"


def test_cross_reference_merges_exact_domain_and_preserves_sources():
    osm = Business(
        "osm:node:1", "Acme Heating LLC", phone="(615) 555-0100",
        website="https://acmeheat.example", city="Nashville", data_source="OpenStreetMap",
        bucket="HAS_SITE", score=45, emails=["hello@acmeheat.example"],
    )
    registry = Business(
        "tn:123", "ACME HEATING, INC.", phone="615-555-0100",
        website="https://www.acmeheat.example/about", city="Nashville",
        data_source="state_registry", signals={"state_registration": True}, score=45,
    )
    assert observations_match(osm, registry)
    records = build_master_records([osm, registry])
    assert len(records) == 1
    assert set(records[0].source_ids) == {"osm", "state_registry"}
    assert records[0].signals["website"] is True
    assert records[0].signals["state_registration"] is True
    assert records[0].confidence_score > 30


def test_cross_reference_merges_repeated_source_id():
    old = Business("osm:node:9", "Green Lawn", phone="", city="Nashville", data_source="OpenStreetMap")
    updated = Business("osm:node:9", "Green Lawn", phone="615-555-0100", city="Nashville", data_source="OpenStreetMap")
    records = build_master_records([old, updated])
    assert len(records) == 1
    assert records[0].phone == "615-555-0100"


def test_scoring_counts_confirmed_gaps_but_not_unknown_sources():
    lead = Business(
        "osm:node:2", "No Web Shop", data_source="OpenStreetMap", bucket="NO_WEBSITE",
        score=0, signals={"website": False, "phone": False, "email": False},
    )
    record = build_master_records([lead], load_scoring())[0]
    assert record.opportunity_score == 50
    assert "NO_WEBSITE" in record.gap_flags
    assert "NO_EMAIL" in record.gap_flags
    assert "REGISTRATION_NOT_FOUND" not in record.gap_flags
    assert record.signals["state_registration"] is None


def test_restricted_sources_are_not_silently_enabled():
    catalog = {item["slug"]: item for item in connector_status()}
    assert catalog["osm"]["enabled"] is True
    assert catalog["bbb"]["enabled"] is False
    assert catalog["bbb"]["access"] == "agreement_required"
    assert catalog["yelp"]["access"] == "official_api_only"
