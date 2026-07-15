from __future__ import annotations

import asyncio
import logging
import random
import re
import ssl
import time
from collections import defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from .models import Business

LOG = logging.getLogger(__name__)
SOCIAL_HOSTS = {
    "facebook.com", "instagram.com", "linktr.ee", "yelp.com", "nextdoor.com",
    "sites.google.com", "business.site", "twitter.com", "x.com", "tiktok.com",
}
EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+", re.I)
YEAR_RE = re.compile(r"(?:©|copyright\s*)?\s*(20\d{2})", re.I)


def score_from_deductions(deductions: int) -> int:
    """Return website health where 0 is worst and 100 is excellent."""
    return 100 - max(0, min(int(deductions), 100))


def bucket_for(website: str) -> str:
    if not website.strip():
        return "NO_WEBSITE"
    host = (urlparse(website if "://" in website else f"https://{website}").hostname or "").lower()
    host = host.removeprefix("www.")
    if any(host == domain or host.endswith(f".{domain}") for domain in SOCIAL_HOSTS):
        return "SOCIAL_ONLY"
    return "HAS_SITE"


class DomainLimiter:
    def __init__(self) -> None:
        self.locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self.last_request: dict[str, float] = defaultdict(float)

    async def wait(self, url: str) -> None:
        domain = urlparse(url).netloc.lower()
        async with self.locks[domain]:
            delay = max(0.0, 1.0 - (time.monotonic() - self.last_request[domain]))
            if delay:
                await asyncio.sleep(delay)
            self.last_request[domain] = time.monotonic()


class SiteAuditor:
    def __init__(self, concurrency: int, timeout: float, user_agent: str):
        self.semaphore = asyncio.Semaphore(concurrency)
        self.timeout = timeout
        self.user_agent = user_agent
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": user_agent, "Accept": "text/html,application/xhtml+xml"},
        )
        self.limiter = DomainLimiter()
        self.robots: dict[str, RobotFileParser] = {}

    async def close(self) -> None:
        await self.client.aclose()

    async def allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        root = f"{parsed.scheme}://{parsed.netloc}"
        if root not in self.robots:
            parser = RobotFileParser()
            parser.set_url(urljoin(root, "/robots.txt"))
            try:
                await self.limiter.wait(parser.url)
                response = await self.client.get(parser.url)
                parser.parse(response.text.splitlines() if response.status_code < 400 else [])
            # httpx 0.13 can leak low-level httpcore DNS/timeout exceptions.
            except Exception as exc:
                LOG.warning("robots_fetch_failed", extra={"url": parser.url, "error": str(exc)})
                parser.parse([])
            self.robots[root] = parser
        return self.robots[root].can_fetch(self.user_agent, url)

    async def fetch(self, url: str) -> tuple[httpx.Response, float] | None:
        if not await self.allowed(url):
            LOG.info("robots_disallowed", extra={"url": url})
            return None
        try:
            await self.limiter.wait(url)
            # Small jitter avoids synchronized bursts across domains while keeping the
            # scraper transparent and robots-compliant.
            await asyncio.sleep(random.uniform(0.25, 1.25))
            started = time.monotonic()
            response = await self.client.get(url)
            return response, time.monotonic() - started
        except Exception as exc:
            LOG.warning("site_fetch_failed", extra={"url": url, "error": str(exc)})
            return None

    async def audit(self, business: Business) -> Business:
        async with self.semaphore:
            business.scanned_at = datetime.now(timezone.utc).isoformat()
            result = await self.fetch(business.website)
            if result is None:
                business.score = 40
                business.flaws = ["site unreachable"]
                business.checks = {"site_unreachable": True}
                await self.enrich(business, None, business.website)
                return business

            response, elapsed = result
            html = response.text
            soup = BeautifulSoup(html, "html.parser")
            checks: dict[str, object] = {
                "final_url": str(response.url), "status_code": response.status_code,
                "load_seconds": round(elapsed, 3), "payload_bytes": len(response.content),
            }
            deductions, flaws = 0, []

            def fail(key: str, points: int, flaw: str, detail: object = True) -> None:
                nonlocal deductions
                checks[key] = detail
                deductions += points
                if flaw and flaw not in flaws:
                    flaws.append(flaw)

            if response.url.scheme != "https":
                fail("not_secure", 15, "not secure")
            else:
                checks["not_secure"] = False
            viewport = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
            fixed_width = bool(re.search(r"width\s*:\s*[89]\d{2,}px", html, re.I))
            if not viewport or fixed_width:
                fail("not_mobile_friendly", 20, "not mobile-friendly", {"viewport_missing": not bool(viewport), "fixed_width": fixed_width})
            if elapsed > 4 or len(response.content) > 3 * 1024 * 1024:
                fail("slow_or_large", 12, "very slow to load", {"seconds": round(elapsed, 3), "bytes": len(response.content)})
            title = soup.title.string.strip() if soup.title and soup.title.string else ""
            description = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
            if not title or not description or not description.get("content", "").strip():
                fail("seo_metadata_missing", 8, "invisible to Google", {"title_missing": not bool(title), "description_missing": not bool(description and description.get("content", "").strip())})
            footer_text = " ".join(f.get_text(" ", strip=True) for f in soup.find_all("footer"))
            years = [int(y) for y in YEAR_RE.findall(footer_text)]
            current_year = datetime.now().year
            if years and max(years) <= current_year - 2:
                fail("stale_copyright", 10, "looks abandoned", max(years))
            broken = await self.broken_internal_links(soup, str(response.url))
            if response.status_code >= 400 or broken >= 3:
                fail("broken_pages", 15, "broken pages", {"homepage_status": response.status_code, "broken_internal_links": broken})
            has_tel = bool(soup.select_one('a[href^="tel:"]'))
            has_form = bool(soup.find("form"))
            if not has_tel and not has_form:
                fail("hard_to_contact", 10, "hard to contact")
            legacy = self.legacy_signals(soup, html)
            if legacy:
                fail("legacy_stack", 12, "outdated build", legacy)
            images = soup.find_all("img")
            no_alt_at_all = bool(images) and not any(img.get("alt", "").strip() for img in images)
            has_favicon = bool(soup.select_one('link[rel~="icon"], link[rel="shortcut icon"]'))
            if no_alt_at_all or not has_favicon:
                fail("accessibility_branding", 5, "missing basic accessibility or branding", {"no_alt_tags": no_alt_at_all, "no_favicon": not has_favicon})
            tracking = re.search(r"googletagmanager|google-analytics|gtag\(|fbq\(|connect\.facebook\.net", html, re.I)
            if not tracking:
                fail("no_tracking", 5, "no tracking at all")

            # Public score is website health: 0 is worst and 100 is excellent.
            business.score = score_from_deductions(deductions)
            business.flaws = flaws
            business.checks = checks
            await self.enrich(business, soup, str(response.url))
            return business

    @staticmethod
    def legacy_signals(soup: BeautifulSoup, html: str) -> list[str]:
        signals: list[str] = []
        if soup.find(["font", "frameset", "frame", "object", "embed"]): signals.append("legacy_html_or_flash")
        if soup.find("table") and not soup.find("main"): signals.append("table_layout")
        match = re.search(r"WordPress\s*([0-9.]+)", html, re.I)
        if match:
            try:
                if int(match.group(1).split(".")[0]) < 5: signals.append("wordpress_pre_5")
            except ValueError: pass
        if re.search(r"wixstatic|weebly|godaddysites", html, re.I): signals.append("site_builder_template")
        return signals

    async def broken_internal_links(self, soup: BeautifulSoup, base_url: str) -> int:
        host = urlparse(base_url).netloc
        urls: list[str] = []
        for tag in soup.select("a[href]"):
            url = urljoin(base_url, tag.get("href", "")).split("#", 1)[0]
            if urlparse(url).netloc == host and url not in urls and url != base_url:
                urls.append(url)
            # Three failures trigger the check; five samples provide enough evidence
            # without crawling a business site or creating unnecessary laptop load.
            if len(urls) >= 5:
                break
        broken = 0
        for url in urls:
            if not await self.allowed(url):
                continue
            try:
                await self.limiter.wait(url)
                response = await self.client.head(url)
                if response.status_code in {405, 501}:
                    await self.limiter.wait(url)
                    response = await self.client.get(url)
                broken += response.status_code >= 400
            except Exception:
                broken += 1
            if broken >= 3:
                break
        return broken

    async def enrich(self, business: Business, homepage: BeautifulSoup | None, base_url: str) -> None:
        soups: list[tuple[BeautifulSoup, str]] = []
        if homepage is not None:
            soups.append((homepage, base_url))
        for path in ("/contact", "/about"):
            url = urljoin(base_url, path)
            result = await self.fetch(url)
            if result and result[0].status_code < 400:
                soups.append((BeautifulSoup(result[0].text, "html.parser"), str(result[0].url)))
        emails: set[str] = set()
        forms: list[str] = []
        for soup, page_url in soups:
            for link in soup.select('a[href^="mailto:"]'):
                emails.add(link.get("href", "")[7:].split("?", 1)[0].strip().lower())
            emails.update(e.lower().rstrip(".") for e in EMAIL_RE.findall(soup.get_text(" ")))
            for form in soup.find_all("form"):
                forms.append(urljoin(page_url, form.get("action") or page_url))
        business.emails = sorted((e for e in emails if e), key=email_priority)
        business.contact_form_url = forms[0] if forms else ""
        business.outreach_channel = "email" if business.emails else ("form" if forms else "call")


def email_priority(email: str) -> tuple[int, str]:
    generic = ("info@", "contact@", "hello@", "office@", "support@", "admin@", "sales@")
    return (1 if email.startswith(generic) else 0, email)
