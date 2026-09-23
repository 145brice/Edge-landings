const crypto = require('crypto');

const STATUS_NAMES = new Set(['intake_received', 'building', 'draft_ready', 'changes_requested', 'approved', 'active', 'paused']);
const SECTION_STATUSES = new Set(['planned', 'building', 'ready', 'revision_requested', 'revised']);

function clean(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function slug(value) {
  return clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function validateIntake(body, plans) {
  const plan = plans[clean(body?.planSlug, 20)];
  if (!plan) throw new Error('Choose either the Basic or Growth plan.');
  const required = ['clientName', 'businessName', 'email', 'phone', 'businessType', 'primaryGoal', 'audience', 'services', 'primaryAction', 'differentiators', 'brandDirection', 'contactDetails', 'assetLink'];
  const intake = Object.fromEntries(required.map((key) => [key, clean(body?.[key])]));
  const missing = required.filter((key) => !intake[key]);
  if (missing.length) throw new Error('Complete every required project question before submitting.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intake.email)) throw new Error('Enter a valid email address.');
  intake.email = intake.email.toLowerCase();
  intake.existingUrl = clean(body?.existingUrl, 2048);
  intake.serviceArea = clean(body?.serviceArea);
  intake.hours = clean(body?.hours);
  intake.competitors = clean(body?.competitors);
  intake.proof = clean(body?.proof);
  intake.colors = clean(body?.colors);
  intake.mustAvoid = clean(body?.mustAvoid);
  intake.socialLinks = clean(body?.socialLinks, 2048);
  intake.domainNotes = clean(body?.domainNotes);
  intake.seoTopics = clean(body?.seoTopics);
  intake.analytics = clean(body?.analytics);
  intake.legalCopy = clean(body?.legalCopy);
  intake.additionalNotes = clean(body?.additionalNotes);
  intake.contentPermission = body?.contentPermission === true || body?.contentPermission === 'true' || body?.contentPermission === 'on';
  if (!intake.contentPermission) throw new Error('Confirm that you can provide or authorize the content and images used in the draft.');

  if (!Array.isArray(body?.siteStructure) || body.siteStructure.length < 1) throw new Error('Add at least one page to the website.');
  const maxPages = plan.slug === 'basic' ? 1 : 5;
  if (body.siteStructure.length > maxPages) throw new Error(`${plan.name} allows up to ${maxPages} page${maxPages === 1 ? '' : 's'}.`);
  const seen = new Set();
  const sections = [];
  const siteStructure = body.siteStructure.map((entry, pageIndex) => {
    const page = clean(entry?.page, 80);
    const purpose = clean(entry?.purpose, 500);
    if (!page) throw new Error('Name every page in the site structure.');
    if (!purpose) throw new Error(`Explain what people should find on ${page}.`);
    let key = `${slug(page)}--page-content`;
    while (seen.has(key)) key = `${key}-${pageIndex + 1}`;
    seen.add(key);
    sections.push({ key, page, label: 'Page content', position: 1, status: 'planned' });
    return { page, purpose, position: pageIndex + 1, sections: ['Page content'] };
  });
  return { plan, intake, siteStructure, sections };
}

function normalizeBuiltSections(project, requested) {
  if (!Array.isArray(requested) || requested.length !== project.site_structure.length) throw new Error('Include the built areas for every page.');
  const prior = new Map((project.sections || []).map((section) => [section.key, section]));
  const seen = new Set();
  const sections = [];
  const siteStructure = project.site_structure.map((page, pageIndex) => {
    const entry = requested.find((item) => clean(item?.page, 80) === page.page);
    const labels = Array.isArray(entry?.labels) ? entry.labels.map((label) => clean(label, 80)).filter(Boolean) : [];
    const limit = project.plan_slug === 'basic' ? 6 : 12;
    if (!labels.length || labels.length > limit) throw new Error(`List between 1 and ${limit} built areas for ${page.page}.`);
    const normalized = labels.map((label, sectionIndex) => {
      let key = `${slug(page.page)}--${slug(label)}`;
      while (seen.has(key)) key = `${key}-${sectionIndex + 1}`;
      seen.add(key);
      sections.push({ key, page: page.page, label, position: sectionIndex + 1, status: prior.get(key)?.status || 'planned' });
      return label;
    });
    return { ...page, position: pageIndex + 1, sections: normalized };
  });
  return { sections, siteStructure };
}

function newPortalToken() { return crypto.randomBytes(32).toString('base64url'); }
function hashPortalToken(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function validProjectStatus(value) { return STATUS_NAMES.has(value); }
function validSectionStatus(value) { return SECTION_STATUSES.has(value); }

module.exports = { validateIntake, normalizeBuiltSections, newPortalToken, hashPortalToken, validProjectStatus, validSectionStatus };
