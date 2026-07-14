from lead_scraper.pricing import build_tiers, recommended_tier


def test_problem_score_is_converted_to_health_score():
    health, tiers = build_tiers(68, "not mobile-friendly|very slow to load", "barber")
    assert health == 32
    assert tiers[0].projected_health == "47–57/100"
    assert tiers[2].projected_health == "82–100/100"


def test_tiers_only_map_observed_flaws_plus_full_scope_items():
    _, tiers = build_tiers(50, "not secure|hard to contact", "hvac")
    assert "Enable and validate HTTPS" in tiers[0].fixes
    assert "Add tap-to-call and a working contact form" in tiers[1].fixes
    assert recommended_tier(50) == "Solid Rebuild"
