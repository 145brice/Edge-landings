const SOURCES = [
  { name: 'Clutch', url: 'https://clutch.co/web-developers/pricing', metric: 'agency_hourly_usd', pattern: /between \$(\d+)[–-]\$(\d+) per hour/i },
  { name: 'Upwork', url: 'https://www.upwork.com/resources/how-much-does-it-cost-to-build-website', metric: 'small_business_site_usd', pattern: /range from \$(\d[\d,]*) to \$(\d[\d,]*)/i },
];

async function refreshMarketBaselines(fetchImpl = fetch) {
  const rows = [];
  for (const source of SOURCES) {
    const response = await fetchImpl(source.url, { headers: { 'User-Agent': 'EdgeLandingsPricingResearch/1.0' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) continue;
    const text = (await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const match = text.match(source.pattern);
    if (!match) continue;
    rows.push({ source_name: source.name, source_url: source.url, metric: source.metric, low_cents: Number(match[1].replace(/,/g, '')) * 100, high_cents: Number(match[2].replace(/,/g, '')) * 100, collected_at: new Date().toISOString() });
  }
  return rows;
}

module.exports = { SOURCES, refreshMarketBaselines };
