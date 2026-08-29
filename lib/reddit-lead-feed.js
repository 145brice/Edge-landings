const CONTRACTOR_TERMS = [
  'roof', 'roofing', 'general contractor', 'construction', 'remodel', 'renovation',
  'hvac', 'heating', 'air conditioning', 'plumb', 'electric', 'landscap', 'concrete',
  'flooring', 'floor installer', 'paint', 'fenc', 'restoration', 'water damage',
  'mold remediation', 'fire damage', 'siding', 'deck', 'masonry', 'carpentry',
  'drywall', 'foundation', 'excavat', 'grading', 'paving', 'garage door', 'insulation',
];

const EXCLUDED_TERMS = [
  'realtor', 'real estate agent', 'mortgage', 'loan officer', 'attorney', 'lawyer',
  'insurance agent', 'financial advisor', 'web design', 'software developer',
];

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function cleanText(value, maxLength = 280) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeTimestamp(value) {
  if (!value) return '';
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeLead(raw) {
  const title = cleanText(firstValue(raw, ['title', 'post_title', 'headline', 'subject']), 180);
  const body = cleanText(firstValue(raw, ['excerpt', 'selftext', 'body', 'content', 'description', 'text']));
  const category = cleanText(firstValue(raw, ['category', 'service', 'trade', 'lead_category', 'industry']), 80);
  const subredditValue = cleanText(firstValue(raw, ['subreddit', 'subreddit_name', 'community']), 80).replace(/^r\//i, '');
  const url = safeUrl(firstValue(raw, ['reddit_url', 'permalink', 'url', 'post_url', 'link']));
  const discoveredAt = normalizeTimestamp(firstValue(raw, [
    'discovered_at', 'discoveredAt', 'found_at', 'foundAt', 'created_at', 'createdAt',
    'scraped_at', 'timestamp', 'created_utc',
  ]));
  const id = cleanText(firstValue(raw, ['id', 'reddit_id', 'post_id', 'name', 'external_id']), 120)
    || url
    || `${subredditValue}:${title}:${discoveredAt}`;

  return {
    id,
    subreddit: subredditValue,
    category,
    location: cleanText(firstValue(raw, ['location', 'city_state', 'market', 'city', 'region']), 100),
    title,
    excerpt: body || title,
    discoveredAt,
    redditUrl: url,
  };
}

function isContractorLead(lead) {
  const haystack = `${lead.category} ${lead.title} ${lead.excerpt}`.toLowerCase();
  if (EXCLUDED_TERMS.some((term) => haystack.includes(term))) return false;
  return CONTRACTOR_TERMS.some((term) => haystack.includes(term));
}

function extractLeadArray(payload) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload?.leads, payload?.data, payload?.results, payload?.items, payload?.data?.leads]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeContractorLeads(payload, limit = 10) {
  const seen = new Set();
  return extractLeadArray(payload)
    .map(normalizeLead)
    .filter((lead) => lead.id && isContractorLead(lead))
    .filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    })
    .sort((a, b) => (Date.parse(b.discoveredAt) || 0) - (Date.parse(a.discoveredAt) || 0))
    .slice(0, limit);
}

async function fetchContractorLeads({ endpoint, token, limit = 10, fetchImpl = fetch }) {
  const url = new URL(endpoint);
  url.searchParams.set('limit', String(Math.min(Math.max(limit * 3, limit), 100)));
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Lead feed returned HTTP ${response.status}`);
  return normalizeContractorLeads(await response.json(), limit);
}

module.exports = {
  CONTRACTOR_TERMS,
  extractLeadArray,
  fetchContractorLeads,
  isContractorLead,
  normalizeContractorLeads,
  normalizeLead,
};
