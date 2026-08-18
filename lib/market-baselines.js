const SOURCES = [
  { name: 'Clutch', url: 'https://clutch.co/web-developers/pricing', metric: 'agency_hourly_usd', patterns: [/between \$(\d+)[^\d$]+\$(\d+) per hour/i, /\$(\d+)[^\d$]+\$(\d+)\/hour/i] },
  { name: 'Upwork', url: 'https://www.upwork.com/resources/how-much-does-it-cost-to-build-website', metric: 'small_business_site_usd', patterns: [/between \$(\d[\d,]*) and \$(\d[\d,]*)/i, /range from \$(\d[\d,]*) to \$(\d[\d,]*)/i] },
];

async function refreshMarketBaselines(fetchImpl = fetch) {
  const results = await Promise.allSettled(SOURCES.map(async (source) => {
    const response = await fetchImpl(source.url, { headers: { 'User-Agent': 'EdgeLandingsPricingResearch/1.0 (+https://edge-landings.vercel.app)' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
    const text = (await response.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&ndash;|&mdash;/gi, '-').replace(/\s+/g, ' ');
    const match = source.patterns.map((pattern) => text.match(pattern)).find(Boolean);
    if (!match) throw new Error(`${source.name} pricing pattern was not found`);
    const low = Number(match[1].replace(/,/g, '')) * 100;
    const high = Number(match[2].replace(/,/g, '')) * 100;
    if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high) || low <= 0 || high < low) throw new Error(`${source.name} returned an invalid range`);
    return { source_name: source.name, source_url: source.url, metric: source.metric, low_cents: low, high_cents: high, collected_at: new Date().toISOString() };
  }));
  return { rows: results.filter((result) => result.status === 'fulfilled').map((result) => result.value), errors: results.filter((result) => result.status === 'rejected').map((result) => result.reason.message) };
}

module.exports = { SOURCES, refreshMarketBaselines };
