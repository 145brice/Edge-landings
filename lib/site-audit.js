const dns = require('node:dns').promises;
const net = require('node:net');

const USER_AGENT = 'EdgeLandingsWebsiteAudit/1.0 (+https://edge-landings.vercel.app)';
const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_LINK_CHECKS = 12;

function normalizeTarget(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) throw new Error('Enter a valid website URL.');
  let url;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  try { url = new URL(hasScheme ? raw : `https://${raw}`); }
  catch { throw new Error('Enter a valid website URL, such as example.com.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only public HTTP and HTTPS website URLs can be audited.');
  }
  if ((url.port && url.port !== '80' && url.port !== '443') || !url.hostname.includes('.')) {
    throw new Error('Enter a public website URL.');
  }
  url.hash = '';
  return url;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
      || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea')
      || value.startsWith('feb') || value.startsWith('::ffff:127.')
      || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.');
  }
  return true;
}

async function assertPublicHost(url, lookup = dns.lookup) {
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('That address is not available for public website audits.');
  }
}

async function safeFetch(startUrl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const lookup = options.lookup || dns.lookup;
  let current = new URL(startUrl);
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    await assertPublicHost(current, lookup);
    const response = await fetchImpl(current, {
      method: options.method || 'GET', redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: options.accept || 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(options.timeout || FETCH_TIMEOUT_MS),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The website returned an invalid redirect.');
      current = new URL(location, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new Error('The website redirected to an unsupported address.');
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error('The website redirected too many times.');
}

function tagContent(html, expression) {
  return (html.match(expression)?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function attrContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key === name.toLowerCase()) return tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() || '';
  }
  return '';
}

function detectCms(html, headers) {
  const source = `${html} ${headers.get('x-powered-by') || ''} ${headers.get('server') || ''}`.toLowerCase();
  const matches = [
    ['WordPress', /wp-content|wp-includes|wordpress/], ['Shopify', /cdn\.shopify|shopify\.theme|myshopify/],
    ['Wix', /wixstatic|wix-code|x-wix-/], ['Squarespace', /static\.squarespace|squarespace-cdn/],
    ['Webflow', /webflow\.js|data-wf-page/], ['Drupal', /drupalsettings|sites\/default\/files/],
    ['Joomla', /\/media\/system\/js\/|joomla!/],
  ];
  return matches.find(([, pattern]) => pattern.test(source))?.[0] || 'Not detected';
}

function analyzeHtml(html, finalUrl, headers, elapsedMs) {
  const title = tagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = attrContent(html, 'description');
  const viewport = attrContent(html, 'viewport');
  const robots = attrContent(html, 'robots');
  const canonical = html.match(/<link\b[^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0]
    ?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const lang = html.match(/<html\b[^>]*lang\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const h1 = tagContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    title, description, viewport, robots, canonical, lang, h1,
    cms: detectCms(html, headers), https: finalUrl.protocol === 'https:',
    responseMs: elapsedMs, htmlBytes: Buffer.byteLength(html),
  };
}

function extractInternalLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === baseUrl.origin && ['http:', 'https:'].includes(url.protocol)) {
        url.hash = '';
        if (!links.includes(url.href)) links.push(url.href);
      }
    } catch { /* Ignore malformed page links. */ }
    if (links.length >= MAX_LINK_CHECKS) break;
  }
  return links;
}

async function checkLinks(links, dependencies = {}) {
  const results = await Promise.all(links.map(async (url) => {
    try {
      const { response } = await safeFetch(url, { ...dependencies, method: 'HEAD', timeout: 6000, accept: '*/*' });
      return { url, status: response.status, broken: response.status >= 400 };
    } catch { return { url, status: null, broken: true }; }
  }));
  return { checked: results.length, broken: results.filter((item) => item.broken).length, samples: results.filter((item) => item.broken).slice(0, 3) };
}

async function pageSpeed(url, fetchImpl = fetch) {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url.href);
  endpoint.searchParams.set('strategy', 'mobile');
  endpoint.searchParams.append('category', 'performance');
  if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set('key', process.env.PAGESPEED_API_KEY);
  try {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) return null;
    const data = await response.json();
    const lighthouse = data.lighthouseResult || {};
    const audits = lighthouse.audits || {};
    const field = data.loadingExperience?.metrics || data.originLoadingExperience?.metrics || {};
    return {
      score: Math.round((lighthouse.categories?.performance?.score || 0) * 100),
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
      inp: field.INTERACTION_TO_NEXT_PAINT?.percentile ? `${field.INTERACTION_TO_NEXT_PAINT.percentile} ms` : null,
      fcp: audits['first-contentful-paint']?.displayValue || null,
      fieldStatus: data.loadingExperience?.overall_category || 'NO_DATA',
    };
  } catch { return null; }
}

function buildReport(facts, links, speed, requestedUrl) {
  const checks = [];
  const add = (id, label, passed, points, max, detail, fix) => checks.push({ id, label, passed, points, max, detail, fix });
  add('https', 'Secure HTTPS', facts.https, facts.https ? 15 : 0, 15, facts.https ? 'The audited page loads securely.' : 'The final page is not protected by HTTPS.', 'Install HTTPS and redirect every HTTP page to its secure version.');
  const linkPoints = links.broken === 0 ? 15 : links.broken <= 2 ? 8 : 0;
  add('links', 'Working internal links', links.broken === 0, linkPoints, 15, `${links.broken} broken out of ${links.checked} sampled internal links.`, 'Repair or redirect broken internal links so visitors and search engines do not hit dead ends.');
  add('mobile', 'Mobile viewport', Boolean(facts.viewport), facts.viewport ? 10 : 0, 10, facts.viewport ? 'A mobile viewport is configured.' : 'No mobile viewport tag was found.', 'Add a responsive viewport and verify layouts at common phone widths.');
  add('title', 'Page title', facts.title.length >= 10 && facts.title.length <= 65, facts.title.length >= 10 && facts.title.length <= 65 ? 10 : 3, 10, facts.title ? `${facts.title.length} characters: ${facts.title}` : 'No page title found.', 'Write a specific 10–65 character title using the primary service and location.');
  add('description', 'Meta description', facts.description.length >= 70 && facts.description.length <= 170, facts.description.length >= 70 && facts.description.length <= 170 ? 10 : facts.description ? 4 : 0, 10, facts.description ? `${facts.description.length} characters.` : 'No meta description found.', 'Add a clear 70–170 character description with the offer and next step.');
  add('h1', 'Primary heading', Boolean(facts.h1), facts.h1 ? 5 : 0, 5, facts.h1 || 'No H1 heading found.', 'Add one clear H1 describing the page’s main purpose.');
  add('canonical', 'Canonical URL', Boolean(facts.canonical), facts.canonical ? 5 : 0, 5, facts.canonical || 'No canonical URL found.', 'Add a self-referencing canonical URL to reduce duplicate-page ambiguity.');
  add('lang', 'Language declaration', Boolean(facts.lang), facts.lang ? 3 : 0, 3, facts.lang || 'No page language declared.', 'Declare the page language on the HTML element.');
  const indexable = !/noindex/i.test(facts.robots);
  add('robots', 'Search indexability', indexable, indexable ? 2 : 0, 2, facts.robots || 'No blocking robots directive found.', 'Remove the noindex directive when the page is ready to appear in search.');
  const performanceScore = speed?.score ?? (facts.responseMs < 1200 ? 90 : facts.responseMs < 2500 ? 70 : 45);
  const performancePoints = Math.round(performanceScore * 0.2);
  add('performance', 'Mobile performance', performanceScore >= 75, performancePoints, 20, speed ? `PageSpeed mobile score: ${performanceScore}/100.` : `Estimated from a ${facts.responseMs} ms server response; PageSpeed data was unavailable.`, 'Compress large media, reduce blocking scripts, and prioritize above-the-fold content.');
  const score = Math.max(0, Math.min(100, checks.reduce((total, check) => total + check.points, 0)));
  const issues = checks.filter((check) => check.points < check.max).sort((a, b) => (b.max - b.points) - (a.max - a.points)).slice(0, 5);
  const quickWins = issues.slice(0, 3).map((issue) => issue.fix);
  return {
    url: requestedUrl.href, finalUrl: facts.finalUrl, auditedAt: new Date().toISOString(), score,
    grade: score >= 85 ? 'Strong' : score >= 70 ? 'Good foundation' : score >= 50 ? 'Needs attention' : 'High priority',
    cms: facts.cms, checks, issues, quickWins,
    performance: { ...speed, source: speed ? 'Google PageSpeed Insights' : 'Local response estimate' },
    scope: `Homepage plus ${links.checked} sampled internal links`,
  };
}

async function auditWebsite(input, dependencies = {}) {
  const requestedUrl = normalizeTarget(input);
  const started = Date.now();
  const { response, finalUrl } = await safeFetch(requestedUrl, dependencies);
  if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) throw new Error('That URL did not return a webpage.');
  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  const facts = analyzeHtml(html, finalUrl, response.headers, Date.now() - started);
  facts.finalUrl = finalUrl.href;
  const internalLinks = extractInternalLinks(html, finalUrl);
  const [links, speed] = await Promise.all([
    checkLinks(internalLinks, dependencies),
    pageSpeed(finalUrl, dependencies.fetchImpl || fetch),
  ]);
  return buildReport(facts, links, speed, requestedUrl);
}

module.exports = { auditWebsite, normalizeTarget, isPrivateAddress, analyzeHtml, buildReport };
