from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .models import Business


TEMPLATES = {
    "email": (
        {"id": "email_direct_v1", "subject": "A quick note about {business_name}",
         "body": "Hi {business_name} team,\n\nI was looking at local {category} businesses in {city} and noticed:\n{pain_points}\n\nI help local businesses fix these specific gaps. Would it be useful if I sent a simple example of what I would improve?\n\n— Edge Landings"},
        {"id": "email_quote_v1", "subject": "Online quote opportunity for {business_name}",
         "body": "Hi {business_name} team,\n\nA few public details stood out:\n{pain_points}\n\nA focused website and quote-request setup could make it easier for customers to reach you. May I send a quick, no-obligation mockup?\n\n— Edge Landings"},
    ),
    "form": (
        {"id": "form_direct_v1", "subject": "", "body": "Hi {business_name} team — I found a few public online-presence gaps that may be costing inquiries:\n{pain_points}\n\nI build straightforward websites and quote tools for local {category} businesses. Would you like a quick example of possible improvements? — Edge Landings"},
    ),
    "phone": (
        {"id": "phone_direct_v1", "subject": "", "body": "Hi, this is [YOUR NAME] with Edge Landings. I’m calling because I noticed a few public online-presence gaps for {business_name}: {pain_points_inline}. I help local {category} businesses address those issues. Would it be okay if I sent a quick example?"},
    ),
    "social": (
        {"id": "social_direct_v1", "subject": "", "body": "Hi {business_name} — I came across your {category} business in {city}. I noticed {pain_points_inline}. I help local businesses improve those areas. Would you be open to a quick example of possible fixes? — Edge Landings"},
    ),
}

EMAIL_INTRO_TEMPLATE = {
    "id": "email_intro_v1",
    "subject": "A quick introduction for {business_name}",
    "body": "Hi {business_name} team,\n\nI came across your {category} business in {city}. I help local businesses improve their websites and make it easier for customers to request information or quotes online.\n\nWould it be useful if I sent a short, no-obligation example tailored to {business_name}?\n\n— Edge Landings",
}


@dataclass(frozen=True)
class OutreachDraft:
    channel: str
    template_id: str
    subject: str
    body: str
    pain_points: tuple[str, ...]


class TemplatePerformance:
    def __init__(self, path: Path):
        self.connection = sqlite3.connect(path)
        self.connection.execute("""CREATE TABLE IF NOT EXISTS outreach_events (
            id INTEGER PRIMARY KEY, template_id TEXT NOT NULL, channel TEXT NOT NULL,
            business_id TEXT NOT NULL, event TEXT NOT NULL CHECK(event IN ('sent','reply')),
            occurred_at TEXT NOT NULL)""")
        self.connection.commit()

    def record(self, template_id: str, channel: str, business_id: str, event: str) -> None:
        if event not in {"sent", "reply"}:
            raise ValueError("event must be sent or reply")
        self.connection.execute(
            "INSERT INTO outreach_events(template_id,channel,business_id,event,occurred_at) VALUES(?,?,?,?,?)",
            (template_id, channel, business_id, event, datetime.now(timezone.utc).isoformat()),
        )
        self.connection.commit()

    def best(self, channel: str, candidates: tuple[dict, ...], minimum_sends: int = 10) -> dict:
        rows = self.connection.execute("""SELECT template_id,
            SUM(event='sent') sends, SUM(event='reply') replies
            FROM outreach_events WHERE channel=? GROUP BY template_id""", (channel,)).fetchall()
        metrics = {template_id: (sends, replies) for template_id, sends, replies in rows}
        eligible = [item for item in candidates if metrics.get(item["id"], (0, 0))[0] >= minimum_sends]
        if not eligible:
            return candidates[0]
        return max(eligible, key=lambda item: (
            (metrics[item["id"]][1] + 1) / (metrics[item["id"]][0] + 2),
            metrics[item["id"]][0], item["id"],
        ))

    def summary(self) -> list[dict[str, int | float | str]]:
        rows = self.connection.execute("""SELECT template_id, channel,
            SUM(event='sent') sends, SUM(event='reply') replies
            FROM outreach_events GROUP BY template_id, channel ORDER BY channel, template_id""").fetchall()
        return [{"template_id": template_id, "channel": channel, "sends": sends,
                 "replies": replies, "reply_rate": round(replies / sends * 100, 1) if sends else 0.0}
                for template_id, channel, sends, replies in rows]

    def close(self) -> None:
        self.connection.close()


def preferred_channel(business: Business) -> str:
    if business.emails:
        return "email"
    if business.contact_form_url:
        return "form"
    if business.phone:
        return "phone"
    if business.facebook_url or business.instagram_url or business.linkedin_url or business.signals.get("social") is True:
        return "social"
    return "none"


def evidence_points(business: Business) -> tuple[str, ...]:
    labels = {
        "NO_WEBSITE": "no independent website was found",
        "SOCIAL_ONLY": "customers appear to rely on a social page instead of a dedicated website",
        "WEBSITE_HEALTH_CRITICAL": f"the website health score is only {business.score}/100",
        "WEBSITE_HEALTH_LOW": f"the website health score is {business.score}/100",
        "NO_EMAIL": "no public business email was found",
        "NO_PHONE": "no public business phone number was found",
    }
    points = [labels[flag] for flag in business.gap_flags if flag in labels]
    points.extend(flaw for flaw in business.flaws if flaw and flaw not in points)
    return tuple(dict.fromkeys(points))[:5]


def build_draft(business: Business, performance: TemplatePerformance | None = None) -> OutreachDraft | None:
    channel = preferred_channel(business)
    if channel == "none":
        return None
    points = evidence_points(business)
    if channel == "email" and len(points) < 3:
        template = EMAIL_INTRO_TEMPLATE
    elif len(points) < 3:
        return None
    else:
        candidates = TEMPLATES[channel]
        template = performance.best(channel, candidates) if performance else candidates[0]
    values = {
        "business_name": business.name,
        "category": (business.category or "service").replace("_", " "),
        "city": business.city or "your area",
        "pain_points": "\n".join(f"• {point}" for point in points),
        "pain_points_inline": "; ".join(points),
    }
    return OutreachDraft(channel, template["id"], template["subject"].format_map(values),
                         template["body"].format_map(values), points)
