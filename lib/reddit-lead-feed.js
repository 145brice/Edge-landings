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

const SUBREDDIT_LOCATIONS = {
  nashville: { city: 'Nashville', state: 'TN' },
  atlanta: { city: 'Atlanta', state: 'GA' },
  austin: { city: 'Austin', state: 'TX' },
  charlotte: { city: 'Charlotte', state: 'NC' },
  chicago: { city: 'Chicago', state: 'IL' },
  denver: { city: 'Denver', state: 'CO' },
  houston: { city: 'Houston', state: 'TX' },
  indianapolis: { city: 'Indianapolis', state: 'IN' },
  phoenix: { city: 'Phoenix', state: 'AZ' },
  tampa: { city: 'Tampa', state: 'FL' },
};

function normalizeLocation(raw, subreddit = '') {
  if (raw?.location && typeof raw.location === 'object') {
    const display = cleanText(raw.location.display, 100);
    if (display && display !== 'Unknown') {
      return {
        display,
        city: cleanText(raw.location.city, 60),
        state: cleanText(raw.location.state, 30).toUpperCase(),
        confidence: cleanText(raw.location.confidence, 20) || 'high',
        source: cleanText(raw.location.source, 40) || 'structured_location',
      };
    }
  }
  const structured = cleanText(firstValue(raw, ['location', 'city_state', 'market']), 100);
  const city = cleanText(firstValue(raw, ['city']), 60);
  const state = cleanText(firstValue(raw, ['state', 'state_code']), 30).toUpperCase();
  if (structured) {
    const match = structured.match(/^([^,]+),\s*([A-Z]{2})$/i);
    return {
      display: match ? `${match[1].trim()}, ${match[2].toUpperCase()}` : structured,
      city: match ? match[1].trim() : '',
      state: match ? match[2].toUpperCase() : '',
      confidence: 'high',
      source: 'structured_location',
    };
  }
  if (city && /^[A-Z]{2}$/.test(state)) {
    return { display: `${city}, ${state}`, city, state, confidence: 'high', source: 'structured_city_state' };
  }
  if (/^[A-Z]{2}$/.test(state)) {
    return { display: state, city: '', state, confidence: 'medium', source: 'structured_state' };
  }
  const mapped = SUBREDDIT_LOCATIONS[String(subreddit || '').toLowerCase()];
  if (mapped) {
    return { display: `${mapped.city}, ${mapped.state}`, ...mapped, confidence: 'high', source: 'city_subreddit' };
  }
  return { display: 'Unknown', city: '', state: '', confidence: 'unknown', source: 'unavailable' };
}

function normalizeConfidence(value) {
  if (value === '' || value === undefined || value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return normalized >= 0 && normalized <= 1 ? normalized : null;
}

function normalizeLead(raw) {
  const title = cleanText(firstValue(raw, ['title', 'post_title', 'headline', 'subject']), 180);
  const body = cleanText(firstValue(raw, ['excerpt', 'selftext', 'body', 'content', 'description', 'text']));
  const category = cleanText(firstValue(raw, ['category', 'service', 'trade', 'lead_category', 'industry']), 80);
  const subredditValue = cleanText(firstValue(raw, ['subreddit', 'subreddit_name', 'community']), 80).replace(/^r\//i, '');
  const url = safeUrl(firstValue(raw, ['reddit_url', 'permalink', 'url', 'post_url', 'link']));
  const discoveredAt = normalizeTimestamp(firstValue(raw, [
    'discovered_at', 'discoveredAt', 'found_at', 'foundAt', 'created_at', 'createdAt',
    'scraped_at', 'caught_at', 'caught_time', 'timestamp',
  ]));
  const postedAt = normalizeTimestamp(firstValue(raw, ['posted_at', 'postedAt', 'post_time', 'created_utc', 'reddit_created_at']));
  const id = cleanText(firstValue(raw, ['id', 'reddit_id', 'post_id', 'name', 'external_id']), 120)
    || url
    || `${subredditValue}:${title}:${discoveredAt}`;

  return {
    id,
    subreddit: subredditValue,
    category,
    location: normalizeLocation(raw, subredditValue),
    title,
    excerpt: body || title,
    discoveredAt,
    postedAt,
    classificationConfidence: normalizeConfidence(firstValue(raw, ['classification_confidence', 'classificationConfidence', 'category_confidence'])),
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
  normalizeConfidence,
  normalizeLead,
  normalizeLocation,
};
