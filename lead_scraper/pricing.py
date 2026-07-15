from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ServiceTier:
    name: str
    price: str
    timeline: str
    projected_health: str
    projected_improvement: str
    fixes: tuple[str, ...]
    benefits: tuple[str, ...]


FIXES = {
    "no website": ("Launch a mobile-ready business website", "Create clear service and contact sections", "Enable HTTPS and managed hosting"),
    "no independent website": ("Launch an owned business website", "Move key information beyond social profiles", "Add direct contact actions"),
    "not mobile-friendly": ("Build responsive mobile layouts", "Correct viewport and fixed-width issues"),
    "not secure": ("Enable and validate HTTPS",),
    "very slow to load": ("Optimize images and page assets", "Improve homepage load performance"),
    "invisible to Google": ("Add page titles and descriptions", "Implement local SEO basics"),
    "looks abandoned": ("Refresh stale site content and footer details",),
    "broken pages": ("Repair broken pages and internal links",),
    "hard to contact": ("Add tap-to-call and a working contact form",),
    "outdated build": ("Replace legacy templates and markup", "Move to a maintainable modern stack"),
    "missing basic accessibility or branding": ("Add image descriptions and site branding assets",),
    "no tracking at all": ("Install privacy-conscious visitor analytics", "Configure conversion events"),
    "site unreachable": ("Restore reliable website availability", "Move to monitored managed hosting"),
}

BENEFITS = {
    "no website": "Customers can find an official site and understand how to contact the business.",
    "no independent website": "The business controls its web presence instead of depending only on a social platform.",
    "not mobile-friendly": "Phone visitors can read the site and use its calls to action without pinching or zooming.",
    "not secure": "Visitors receive an encrypted connection without a browser security warning.",
    "very slow to load": "Visitors can reach key information with less waiting and friction.",
    "invisible to Google": "Search engines receive clearer page topics and local-business context.",
    "looks abandoned": "Current site details give visitors a more actively maintained impression.",
    "broken pages": "Visitors can complete intended paths without reaching error pages.",
    "hard to contact": "Potential customers have a direct path to call or submit an inquiry.",
    "outdated build": "The site becomes easier to maintain, update, and extend.",
    "missing basic accessibility or branding": "Images and browser tabs provide clearer accessibility and brand cues.",
    "no tracking at all": "The business can measure visits and important contact actions.",
    "site unreachable": "Customers can consistently reach the website when researching the business.",
}


def normalize_flaws(all_flaws: str | list[str]) -> list[str]:
    values = all_flaws if isinstance(all_flaws, list) else all_flaws.split("|")
    normalized = []
    for value in values:
        flaw = value.strip().lower()
        if not flaw:
            continue
        normalized.append("no website" if flaw.startswith("no website listed in ") else flaw)
    return normalized


def health_range(health: int, low: int, high: int) -> tuple[str, str]:
    lower, upper = min(100, health + low), min(100, health + high)
    actual_low, actual_high = lower - health, upper - health
    improvement = f"+{actual_low} to +{actual_high} points" if actual_low != actual_high else f"+{actual_low} points"
    return f"{lower}–{upper}/100", improvement


def build_tiers(health_score: int, flaws: str | list[str], category: str = "local business") -> tuple[int, list[ServiceTier]]:
    health = max(0, min(100, int(health_score)))
    detected = normalize_flaws(flaws) or ["website issue"]
    mapped_fixes = [(flaw, FIXES.get(flaw, (f"Correct detected issue: {flaw}",))) for flaw in detected]

    def unique(items):
        return tuple(dict.fromkeys(items))

    quick_flaws = detected[:3]
    quick_fixes = unique(fix for flaw, fixes in mapped_fixes if flaw in quick_flaws for fix in fixes)[:4]
    major_fixes = unique(fix for _, fixes in mapped_fixes for fix in fixes)
    benefits = unique(BENEFITS.get(flaw, f"The detected {flaw} issue is addressed.") for flaw in detected)
    quick_target, quick_gain = health_range(health, 15, 25)
    rebuild_target, rebuild_gain = health_range(health, 35, 50)
    modern_target, modern_gain = health_range(health, 50, 70)

    tiers = [
        ServiceTier("Quick Win", "$400–$600 one-time + $49–$79/month", "1–3 business days", quick_target, quick_gain,
                    quick_fixes, benefits[:3]),
        ServiceTier("Solid Rebuild", "$1,500–$2,500 one-time + $99–$149/month", "5–7 business days", rebuild_target, rebuild_gain,
                    major_fixes, benefits),
        ServiceTier("Full Modernization", "$3,500–$5,500 one-time + $199–$299/month", "2–3 weeks", modern_target, modern_gain,
                    unique((*major_fixes, "Create a conversion-focused visual system", "Optimize site-wide images and content delivery", "Configure conversion reporting", f"Tailor calls to action for the {category} category")),
                    unique((*benefits, "A cohesive site can compete more effectively for customer attention and support future growth."))),
    ]
    return health, tiers


def recommended_tier(health_score: int) -> str:
    if health_score <= 35:
        return "Full Modernization"
    if health_score <= 65:
        return "Solid Rebuild"
    return "Quick Win"
