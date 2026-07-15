# Local Business Website Lead Scraper

Python 3.11 CLI that discovers local businesses through Google Places API
(New), audits their websites, finds public contact details, and produces a
ranked mail-merge CSV.

## Setup

Enable **Places API (New)** in Google Cloud and create an API key restricted to
that API. From the repository root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GOOGLE_PLACES_API_KEY` in `.env`, then run:

```powershell
python scraper.py --niche "hvac" --location "Lebanon, TN" --radius 15 --max-score 65
python scraper.py --niches-file niches.txt --location "Mount Juliet, TN" --radius 20 --with-pitch
```

Options include `--max-results 60`, `--concurrency 10`, `--output leads.csv`,
`--yes` for non-interactive cost approval, and `--verbose`.

The radius is included in the Places text query, avoiding a separate Geocoding
API dependency. It is search intent around the named location, not a strict
geometric boundary.

## Behavior

- Website scores run from 0 (worst) to 100 (excellent); detected flaws deduct weighted points.
- Unreachable sites score 40, `NO_WEBSITE` scores 0, and `SOCIAL_ONLY` scores 15.
- Raw checks are saved as JSON in SQLite; seen place IDs are skipped later.
- By default, sites scoring 65 or lower qualify. The CSV sorts lowest score first,
  then highest review count.
- `--with-pitch` uses only the recorded top flaw.
- The auditor honors robots.txt, limits each domain to one request per second,
  caps concurrency, identifies itself, and uses a 10-second default timeout.

The tool estimates maximum Places cost using configurable rates in `.env` and
prompts above `PLACES_COST_CONFIRM_THRESHOLD`. Google changes pricing, so keep
those planning values aligned with your billing account. Use contact data in
compliance with applicable privacy, anti-spam, and outreach laws.

## Structure

```text
scraper.py                 CLI entry point
lead_scraper/cli.py        orchestration, logs, CSV, summary
lead_scraper/places.py     Text Search and Place Details
lead_scraper/audit.py      audits, rate limiting, contacts
lead_scraper/database.py   SQLite dedupe and raw results
lead_scraper/config.py     environment configuration
```
