const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  extractLeadArray,
  normalizeContractorLeads,
  normalizeConfidence,
  normalizeLead,
  normalizeLocation,
} = require('../lib/reddit-lead-feed');
const { createApp, leadStats, routeLeadsToIndustry } = require('../server');

function requestJson(server, path) {
  return new Promise((resolve, reject) => {
    http.get({ port: server.address().port, path }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('normalizes common Reddit scraper field names', () => {
  const lead = normalizeLead({
    post_id: 'abc123', subreddit_name: 'HomeImprovement', service: 'Roofing',
    city_state: 'Nashville, TN', selftext: 'Need a roof replacement',
    created_utc: 1_700_000_000, discovered_at: '2023-11-15T00:00:00Z',
    permalink: 'https://reddit.com/r/HomeImprovement/comments/abc123',
  });
  assert.equal(lead.id, 'abc123');
  assert.equal(lead.subreddit, 'HomeImprovement');
  assert.equal(lead.category, 'Roofing');
  assert.equal(lead.location.display, 'Nashville, TN');
  assert.equal(lead.postedAt, '2023-11-14T22:13:20.000Z');
  assert.equal(lead.discoveredAt, '2023-11-15T00:00:00.000Z');
});

test('uses reliable location evidence and never guesses an ambiguous location', () => {
  assert.equal(normalizeLocation({ city: 'Austin', state: 'tx' }).display, 'Austin, TX');
  assert.equal(normalizeLocation({}, 'Nashville').display, 'Nashville, TN');
  assert.equal(normalizeLocation({ title: 'Need a roofer near me' }, 'Roofing').display, 'Unknown');
});

test('shows classification confidence only when a valid score exists', () => {
  assert.equal(normalizeConfidence(0.91), 0.91);
  assert.equal(normalizeConfidence(87), 0.87);
  assert.equal(normalizeConfidence('unknown'), null);
});

test('calculates today and month opportunity totals with honest location coverage', () => {
  const stats = leadStats([
    { discoveredAt: '2026-08-28T15:00:00Z', category: 'Roofing', location: { display: 'Nashville, TN' } },
    { discoveredAt: '2026-08-02T15:00:00Z', category: 'Flooring', location: { display: 'Unknown' } },
  ], new Date('2026-08-28T18:00:00Z'), 'America/Chicago');
  assert.equal(stats.today, 1);
  assert.equal(stats.thisMonth, 2);
  assert.equal(stats.industries, 2);
  assert.equal(stats.locations, 1);
  assert.equal(stats.unknownLocations, 1);
});

test('filters unrelated industries, deduplicates, sorts, and limits contractor leads', () => {
  const payload = { leads: [
    { id: 'old', category: 'Plumbing', title: 'Need a plumber', created_at: '2026-01-01T00:00:00Z' },
    { id: 'new', category: 'HVAC', title: 'AC replacement', created_at: '2026-01-02T00:00:00Z' },
    { id: 'new', category: 'HVAC', title: 'duplicate', created_at: '2026-01-02T00:00:00Z' },
    { id: 'excluded', category: 'Mortgage', title: 'Need a loan officer', created_at: '2026-01-03T00:00:00Z' },
  ] };
  assert.deepEqual(normalizeContractorLeads(payload, 2).map((lead) => lead.id), ['new', 'old']);
});

test('accepts nested data.leads payloads and rejects unsafe URLs', () => {
  assert.equal(extractLeadArray({ data: { leads: [{ id: 1 }] } }).length, 1);
  assert.equal(normalizeLead({ id: 'x', category: 'Painting', url: 'javascript:alert(1)' }).redditUrl, '');
});

test('routes each contractor category only to its matching website industry', () => {
  const leads = [
    { id: 'r', category: 'Roofing' },
    { id: 'f', category: 'Flooring' },
    { id: 'b', category: 'Foundation' },
  ];
  assert.deepEqual(routeLeadsToIndustry(leads, 'roofing').map((lead) => lead.id), ['r']);
  assert.deepEqual(routeLeadsToIndustry(leads, 'flooring').map((lead) => lead.id), ['f']);
  assert.deepEqual(routeLeadsToIndustry(leads, 'general-contractor').map((lead) => lead.id), ['b']);
  assert.deepEqual(routeLeadsToIndustry(leads, 'mortgage'), []);
});

test('API applies the requested website-industry route to the snapshot', async (context) => {
  const previousEnabled = process.env.REDDIT_LEAD_FEED_ENABLED;
  const previousUrl = process.env.REDDIT_LEAD_FEED_URL;
  const server = createApp().listen(0);
  context.after(() => {
    server.close();
    if (previousEnabled === undefined) delete process.env.REDDIT_LEAD_FEED_ENABLED;
    else process.env.REDDIT_LEAD_FEED_ENABLED = previousEnabled;
    if (previousUrl === undefined) delete process.env.REDDIT_LEAD_FEED_URL;
    else process.env.REDDIT_LEAD_FEED_URL = previousUrl;
  });
  process.env.REDDIT_LEAD_FEED_ENABLED = 'true';
  delete process.env.REDDIT_LEAD_FEED_URL;
  const response = await requestJson(server, '/api/reddit-leads?industry=roofing');
  assert.equal(response.status, 200);
  assert.equal(response.body.industry, 'roofing');
  assert.ok(response.body.leads.length > 0);
  assert.ok(response.body.leads.every((lead) => lead.category === 'Roofing'));
});

test('API stays disabled behind the flag and returns only normalized contractor leads when enabled', async (context) => {
  const previousFetch = global.fetch;
  const previousEnabled = process.env.REDDIT_LEAD_FEED_ENABLED;
  const previousUrl = process.env.REDDIT_LEAD_FEED_URL;
  const server = createApp().listen(0);
  context.after(() => {
    server.close();
    global.fetch = previousFetch;
    if (previousEnabled === undefined) delete process.env.REDDIT_LEAD_FEED_ENABLED;
    else process.env.REDDIT_LEAD_FEED_ENABLED = previousEnabled;
    if (previousUrl === undefined) delete process.env.REDDIT_LEAD_FEED_URL;
    else process.env.REDDIT_LEAD_FEED_URL = previousUrl;
  });

  process.env.REDDIT_LEAD_FEED_ENABLED = 'false';
  assert.deepEqual(await requestJson(server, '/api/reddit-leads'), {
    status: 404, body: { enabled: false },
  });

  process.env.REDDIT_LEAD_FEED_ENABLED = 'true';
  process.env.REDDIT_LEAD_FEED_URL = 'https://scraper.example/api/leads';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ leads: [
      { id: 'roof-1', category: 'Roofing', title: 'Roof replacement needed' },
      { id: 'mortgage-1', category: 'Mortgage', title: 'Need a lender' },
    ] }),
  });
  const enabled = await requestJson(server, '/api/reddit-leads?limit=10');
  assert.equal(enabled.status, 200);
  assert.deepEqual(enabled.body.leads.map((lead) => lead.id), ['roof-1']);
});

test('API falls back to real scraper output while the live scraper endpoint is unavailable', async (context) => {
  const previousFetch = global.fetch;
  const previousEnabled = process.env.REDDIT_LEAD_FEED_ENABLED;
  const previousUrl = process.env.REDDIT_LEAD_FEED_URL;
  const server = createApp().listen(0);
  context.after(() => {
    server.close();
    global.fetch = previousFetch;
    if (previousEnabled === undefined) delete process.env.REDDIT_LEAD_FEED_ENABLED;
    else process.env.REDDIT_LEAD_FEED_ENABLED = previousEnabled;
    if (previousUrl === undefined) delete process.env.REDDIT_LEAD_FEED_URL;
    else process.env.REDDIT_LEAD_FEED_URL = previousUrl;
  });
  process.env.REDDIT_LEAD_FEED_ENABLED = 'true';
  process.env.REDDIT_LEAD_FEED_URL = 'https://scraper.example/api/contractor-leads';
  global.fetch = async () => { throw new Error('offline'); };
  const response = await requestJson(server, '/api/reddit-leads?limit=2');
  assert.equal(response.status, 200);
  assert.equal(response.body.source, 'reddit-scraper-snapshot');
  assert.equal(response.body.leads.length, 2);
  assert.ok(response.body.leads.every((lead) => lead.redditUrl.includes('reddit.com')));
});
