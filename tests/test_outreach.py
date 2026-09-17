from pathlib import Path

from lead_scraper.models import Business
from lead_scraper.outreach import TEMPLATES, TemplatePerformance, build_draft, preferred_channel


def prospect() -> Business:
    return Business(place_id="osm:1", name="Green Lawn", category="landscaping", city="Nashville",
                    phone="615-555-0100", score=20,
                    flaws=["not mobile-friendly", "no online booking"],
                    gap_flags=["NO_WEBSITE", "NO_EMAIL"], signals={"website": False})


def test_draft_uses_verified_channel_and_evidence():
    lead = prospect()
    assert preferred_channel(lead) == "phone"
    draft = build_draft(lead)
    assert draft and draft.template_id == "phone_direct_v1"
    assert "Green Lawn" in draft.body
    assert len(draft.pain_points) == 4


def test_public_social_url_is_a_verified_route():
    lead = prospect()
    lead.phone = ""
    lead.facebook_url = "https://facebook.com/greenlawn"
    assert preferred_channel(lead) == "social"


def test_confirmed_email_always_gets_safe_campaign_starter():
    lead = Business(place_id="email-1", name="Acme Fence", category="fence contractor",
                    city="Nashville", emails=["owner@acme.example"])
    draft = build_draft(lead)
    assert draft and draft.template_id == "email_intro_v1"
    assert "no-obligation example" in draft.body
    assert draft.pain_points == ()


def test_template_defaults_until_enough_sends(tmp_path: Path):
    tracker = TemplatePerformance(tmp_path / "performance.db")
    templates = TEMPLATES["email"]
    for index in range(9):
        tracker.record(templates[1]["id"], "email", str(index), "sent")
        tracker.record(templates[1]["id"], "email", str(index), "reply")
    assert tracker.best("email", templates)["id"] == templates[0]["id"]
    tracker.record(templates[1]["id"], "email", "10", "sent")
    assert tracker.best("email", templates)["id"] == templates[1]["id"]
    summary = tracker.summary()
    assert summary[0]["reply_rate"] == 90.0
    tracker.close()
