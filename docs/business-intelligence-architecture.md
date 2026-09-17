# Business Intelligence Connector Architecture

The lead finder is source-agnostic. Connectors collect permitted source observations; the intelligence layer merges those observations into master business records; deterministic scoring ranks the resulting records.

## Pipeline

1. A connector returns `Business` observations and declares its access, retention, and attribution policy.
2. Previously seen source identifiers are skipped before expensive enrichment where the connector supports it.
3. Website auditing records public technical facts while honoring robots.txt and bounded request rates.
4. `build_master_records` groups exact domain matches, exact normalized phone matches, or exact normalized name-and-location matches.
5. Field selection is deterministic. Source IDs, observed signals, emails, and audit facts are preserved.
6. `scoring.json` produces separate opportunity and confidence scores plus gap flags.
7. CSV exports and the dashboard display the master record and signal provenance.

## Signal semantics

- `yes`: a configured source confirmed the signal.
- `no`: a queried source confirmed the gap.
- `unknown`: that source or signal was not checked. Unknown never creates a scoring penalty.

This three-state rule prevents an unavailable connector from being treated as evidence that a license, registration, profile, or permit does not exist.

## Connector policy

Enabled connectors:

- OpenStreetMap through Nominatim and Overpass, with ODbL attribution.
- Google Places when a licensed API key is configured. Place IDs are durable; other Google content must follow current caching, display, and attribution restrictions.
- Public business websites through the existing bounded, robots-aware auditor.

Adapters requiring authorized access before activation:

- State registries, license boards, permit portals, and chambers: jurisdiction-specific official API or authorized export.
- Yelp: official API only.
- BBB, Angi, Houzz, and Thumbtack: written agreement, licensed API, or user-provided authorized export. Public-page aggregation is not implemented.
- Social platforms: official API or user-supplied data only.

Third-party plugins can register the `edge_landings.connectors` Python entry-point group and implement `BusinessConnector`. A connector must include policy metadata and return source observations without embedding scoring logic.

## Scoring

`lead_scraper/scoring.json` is the only weight source. Opportunity scores describe evidence of a website/service gap. Confidence scores describe identity and evidence completeness. Neither score uses AI.

Changing weights requires updating the config version and regression tests. Connector-specific rankings must not be inserted into the cross-reference layer.
