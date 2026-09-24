const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { normalizeEmail, normalizeSender, ownerOnboardingEmail, customerOnboardingEmail, ownerProjectIntakeEmail, customerProjectIntakeEmail, ownerUpdateEmail, ownerLoginEmail, clientOwnerReplyEmail } = require('./lib/email-templates');
const projectStore = require('./lib/project-store');
const { validateIntake, normalizeBuiltSections, newPortalToken, hashPortalToken, validProjectStatus, validSectionStatus } = require('./lib/project-workflow');
const { fetchContractorLeads } = require('./lib/reddit-lead-feed');
const redditLeadSnapshot = require('./data/reddit-contractor-leads.json');

const INDUSTRY_LEAD_CATEGORIES = {
  roofing: ['Roofing'],
  flooring: ['Flooring'],
  'general-contractor': ['Foundation', 'Remodeling', 'General Contracting', 'Concrete'],
  hvac: ['HVAC'],
  plumbing: ['Plumbing'],
  electrical: ['Electrical'],
  painting: ['Painting'],
  landscaping: ['Landscaping'],
  restoration: ['Restoration'],
  'real-estate': ['Real Estate', 'Mortgage', 'Home Buyer', 'Home Seller'],
  'law-firm': ['Legal', 'Personal Injury', 'Family Law', 'Criminal Defense', 'Estate Planning'],
};

function routeLeadsToIndustry(leads, industry) {
  if (!industry) return leads;
  const categories = INDUSTRY_LEAD_CATEGORIES[String(industry).trim().toLowerCase()];
  if (!categories) return [];
  return leads.filter((lead) => categories.includes(lead.category));
}

function dateKey(value, timeZone, includeDay = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', ...(includeDay ? { day: '2-digit' } : {}),
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return includeDay ? `${parts.year}-${parts.month}-${parts.day}` : `${parts.year}-${parts.month}`;
}

function leadStats(leads, now = new Date(), timeZone = 'America/Chicago') {
  const todayKey = dateKey(now, timeZone);
  const monthKey = dateKey(now, timeZone, false);
  const valid = leads.filter((lead) => dateKey(lead.discoveredAt, timeZone));
  const locations = leads.map((lead) => typeof lead.location === 'object' ? lead.location?.display : lead.location)
    .filter((value) => value && value !== 'Unknown');
  return {
    today: valid.filter((lead) => dateKey(lead.discoveredAt, timeZone) === todayKey).length,
    thisMonth: valid.filter((lead) => dateKey(lead.discoveredAt, timeZone, false) === monthKey).length,
    industries: new Set(leads.map((lead) => lead.category).filter(Boolean)).size,
    locations: new Set(locations).size,
    unknownLocations: leads.length - locations.length,
    timezone: timeZone,
    complete: true,
  };
}

const PORT = process.env.PORT || 3000;
const PLANS = {
  basic: { slug: 'basic', name: 'Edge Landings Basic', betaPriceCents: 4900 },
  growth: { slug: 'growth', name: 'Edge Landings Growth', betaPriceCents: 9900 },
};
const MAX_FIELD_LENGTH = 5000;
const auditRequests = new Map();

function auditRateAllowed(key, now = Date.now()) {
  const windowMs = 10 * 60 * 1000;
  const recent = (auditRequests.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= 5) return false;
  recent.push(now);
  auditRequests.set(key, recent);
  return true;
}

function configuredStripe() {
  return process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
}

function publicBaseUrl() {
  if (!process.env.APP_URL) throw new Error('APP_URL is not configured.');
  const value = process.env.APP_URL.trim().replace(/\/$/, '');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('APP_URL must use HTTPS.');
  return value;
}

function checkoutSessionParams(plan, options = {}) {
  const baseUrl = publicBaseUrl();
  return {
    mode: 'subscription', payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: plan.betaPriceCents,
        recurring: { interval: 'month' },
        product_data: { name: `${plan.name} — Beta` },
      },
      quantity: 1,
    }],
    success_url: options.successUrl || `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl || `${baseUrl}/pricing.html`,
    metadata: { service: plan.name, plan_slug: plan.slug, ...(options.projectId ? { project_id: options.projectId } : {}) },
    ...(options.customerEmail ? { customer_email: options.customerEmail } : {}),
  };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ownerToken(ttlMs = 15 * 60 * 1000) {
  if (!process.env.OWNER_PORTAL_SECRET) throw new Error('OWNER_PORTAL_SECRET is not configured.');
  const payload = Buffer.from(JSON.stringify({ scope: 'owner', exp: Date.now() + ttlMs, nonce: crypto.randomUUID() })).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.OWNER_PORTAL_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validOwnerToken(token) {
  if (!process.env.OWNER_PORTAL_SECRET || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.OWNER_PORTAL_SECRET).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.scope === 'owner' && Number(parsed.exp) > Date.now();
  } catch { return false; }
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value));
}

function requireOwner(req, res, next) {
  if (!validOwnerToken(cookies(req).edge_owner)) return res.status(401).json({ error: 'Owner sign-in is required.' });
  next();
}

async function projectFromRequest(req) {
  const token = String(req.query.token || req.body?.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return projectStore.getProjectByTokenHash(hashPortalToken(token));
}

function publicProject(project, requests, messages) {
  return {
    id: project.id, planSlug: project.plan_slug, status: project.status,
    clientName: project.client_name, businessName: project.business_name, email: project.email,
    intake: project.intake, siteStructure: project.site_structure, sections: project.sections,
    previewUrl: project.preview_url, approvedAt: project.approved_at, paidAt: project.paid_at,
    requests, messages, createdAt: project.created_at, updatedAt: project.updated_at,
  };
}

function verifiedCheckout(session, submittedEmail) {
  const checkoutEmail = session.customer_details?.email || session.customer?.email || session.customer_email;
  return session.mode === 'subscription'
    && session.status === 'complete'
    && ['paid', 'no_payment_required'].includes(session.payment_status)
    && Boolean(session.subscription)
    && Boolean(session.customer)
    && Boolean(PLANS[session.metadata?.plan_slug])
    && session.metadata?.service === PLANS[session.metadata.plan_slug].name
    && checkoutEmail?.toLowerCase() === submittedEmail.toLowerCase();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

async function sendEmail(message, idempotencyKey) {
  if (!process.env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY is not configured.');
  const payload = {
    ...message,
    from: normalizeSender(message.from || process.env.EMAIL_FROM),
    to: normalizeEmail(message.to, 'Recipient'),
    ...(message.reply_to ? { reply_to: normalizeEmail(message.reply_to, 'Reply-to') } : {}),
  };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}): ${await response.text()}`);
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
    });
    res.locals.requestId = req.headers['x-request-id'] || require('crypto').randomUUID();
    res.set('X-Request-ID', res.locals.requestId);
    next();
  });
  // Stripe requires the untouched request body for signature verification.
  // This route must be registered before express.json().
  app.post('/api/webhook', express.raw({ type: 'application/json' }), require('./api/webhook'));
  app.use(express.json({ limit: '100kb' }));
  app.all('/api/catalog-webhook', require('./api/catalog-webhook'));
  // Only deliberate browser assets belong here. Never serve the repository.
  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'site', req.hostname.toLowerCase() === 'websites.edgelandings.com' ? 'websites.html' : 'index.html')));
  app.get('/leads.html', (req, res) => res.redirect(302, 'https://leads.edgelandings.com/'));
  app.use(express.static(path.join(__dirname, 'site'), { extensions: ['html'], dotfiles: 'deny' }));
  app.get('/api/health', async (req, res) => {
    const required = ['APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'EMAIL_API_KEY', 'EMAIL_FROM', 'OWNER_EMAIL', 'OWNER_PORTAL_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_PRICE_MAP'];
    const missing = required.filter((name) => !process.env[name]);
    let portalStorage = false;
    let storageError = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        portalStorage = await projectStore.checkHealth();
      } catch (error) {
        storageError = 'Client portal tables are unavailable. Run service-catalog.sql in Supabase.';
        console.error('Health check failed:', error.message);
      }
    }
    const ready = missing.length === 0 && portalStorage;
    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : missing.length ? 'configuration_required' : 'storage_required', missing,
      systems: {
        portalStorage,
        catalogJobsConfigured: Boolean(process.env.ESTIMATOR_WEBHOOK_SECRET),
        scheduledBaselinesConfigured: Boolean(process.env.CRON_SECRET),
        pageSpeedConfigured: Boolean(process.env.PAGESPEED_API_KEY),
      },
      ...(storageError ? { action: storageError } : {}),
    });
  });

  app.post('/api/site-audit', async (req, res) => {
    if (!auditRateAllowed(req.ip || 'unknown')) {
      return res.status(429).json({ error: 'You have reached the audit limit. Please try again in a few minutes.' });
    }
    const website = typeof req.body?.website === 'string' ? req.body.website.trim() : '';
    if (!website) return res.status(400).json({ error: 'Enter a website URL to audit.' });
    try {
      const report = await require('./lib/site-audit').auditWebsite(website);
      return res.json(report);
    } catch (error) {
      console.error('Public site audit failed:', error.message);
      const safeMessages = [
        'Enter a valid website URL.', 'Enter a valid website URL, such as example.com.',
        'Only public HTTP and HTTPS website URLs can be audited.', 'Enter a public website URL.',
        'That address is not available for public website audits.', 'The website redirected too many times.',
        'The website returned an invalid redirect.', 'The website redirected to an unsupported address.',
        'That URL did not return a webpage.',
      ];
      const message = safeMessages.includes(error.message) || /^The website returned HTTP \d{3}\.$/.test(error.message)
        ? error.message : 'We could not audit that website. Check the address and try again.';
      return res.status(422).json({ error: message });
    }
  });

  app.post('/api/contact', async (req, res) => {
    if (!auditRateAllowed(`contact:${req.ip || 'unknown'}`)) return res.status(429).json({ error: 'Please wait a few minutes before sending another message.' });
    const { name, email, message, companyWebsite } = req.body || {};
    if (companyWebsite) return res.json({ success: true });
    if (![name, email, message].every((value) => typeof value === 'string' && value.trim() && value.length <= MAX_FIELD_LENGTH)) {
      return res.status(400).json({ error: 'Please include your name, email, and a message of up to 5,000 characters.' });
    }
    let replyTo;
    try { replyTo = normalizeEmail(email); } catch { return res.status(400).json({ error: 'Please enter a valid email address.' }); }
    if (!process.env.OWNER_EMAIL || !process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) return res.status(503).json({ error: 'Messaging is temporarily unavailable. Please try again later.' });
    try {
      await sendEmail({ to: process.env.OWNER_EMAIL, reply_to: replyTo, subject: 'Edge Landings website inquiry', text: `Name: ${name.trim()}\nEmail: ${replyTo}\n\n${message.trim()}` }, `contact-${require('crypto').randomUUID()}`);
      return res.json({ success: true });
    } catch (error) {
      console.error('Contact delivery failed:', error.message);
      return res.status(502).json({ error: 'Your message could not be sent. Please try again.' });
    }
  });

  app.post('/api/project-intake', async (req, res) => {
    if (!auditRateAllowed(`intake:${req.ip || 'unknown'}`)) return res.status(429).json({ error: 'Please wait a few minutes before submitting another project.' });
    if (req.body?.companyWebsite) return res.json({ success: true });
    if (!process.env.OWNER_EMAIL || !process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: 'The project portal is being configured. Please contact us directly for now.' });
    }
    try {
      const { plan, intake, siteStructure, sections } = validateIntake(req.body, PLANS);
      const token = newPortalToken();
      const project = await projectStore.createProject({
        portal_token_hash: hashPortalToken(token), plan_slug: plan.slug, status: 'intake_received',
        client_name: intake.clientName, business_name: intake.businessName, email: intake.email, phone: intake.phone,
        intake, site_structure: siteStructure, sections,
      });
      await projectStore.addMessage({ project_id: project.id, sender: 'system', category: 'new_build', body: 'Complete project brief received. No payment is due while the first draft is prepared.' });
      const portalUrl = `${publicBaseUrl()}/portal.html?token=${encodeURIComponent(token)}`;
      const ownerPortalUrl = `${publicBaseUrl()}/admin.html`;
      let emailDelivered = true;
      try {
        const ownerEmail = ownerProjectIntakeEmail({ project, portalUrl: ownerPortalUrl });
        const clientEmail = customerProjectIntakeEmail({ project, portalUrl });
        await Promise.all([
          sendEmail({ ...ownerEmail, to: process.env.OWNER_EMAIL, reply_to: project.email }, `new-build-owner-${project.id}`),
          sendEmail({ ...clientEmail, to: project.email, reply_to: process.env.OWNER_EMAIL }, `new-build-client-${project.id}`),
        ]);
      } catch (emailError) {
        emailDelivered = false;
        console.error('Project intake email failed:', emailError.message);
      }
      return res.status(201).json({ success: true, portalUrl, emailDelivered });
    } catch (error) {
      const clientErrors = ['Choose either the Basic or Growth plan.', 'Complete every required project question before submitting.', 'Enter a valid email address.', 'Confirm that you can provide or authorize the content and images used in the draft.', 'Add at least one page to the website.', 'Name every page in the site structure.'];
      if (clientErrors.includes(error.message) || /allows up to|Explain what people should find/.test(error.message)) return res.status(400).json({ error: error.message });
      console.error('Project intake failed:', error.message);
      return res.status(500).json({ error: 'We could not create your project portal. Please try again.' });
    }
  });

  app.get('/api/client-project', async (req, res) => {
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid or has expired.' });
      const [requests, messages] = await Promise.all([projectStore.listRequests(project.id), projectStore.listMessages(project.id)]);
      res.set('Cache-Control', 'private, no-store');
      return res.json(publicProject(project, requests, messages));
    } catch (error) {
      console.error('Client project lookup failed:', error.message);
      return res.status(503).json({ error: 'The project portal is temporarily unavailable.' });
    }
  });

  app.post('/api/change-request', async (req, res) => {
    if (!auditRateAllowed(`change:${req.ip || 'unknown'}`)) return res.status(429).json({ error: 'Please wait a few minutes before sending another request.' });
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid.' });
      const sectionKey = String(req.body?.sectionKey || '');
      const section = (project.sections || []).find((item) => item.key === sectionKey);
      if (!section) return res.status(400).json({ error: 'Choose a section that is part of this project.' });
      const requestType = String(req.body?.requestType || '').trim();
      const details = String(req.body?.details || '').trim();
      if (!['Content', 'Image', 'Layout', 'Business details', 'Other'].includes(requestType) || details.length < 5 || details.length > MAX_FIELD_LENGTH) {
        return res.status(400).json({ error: 'Choose a change type and describe the requested change.' });
      }
      const request = await projectStore.addRequest({ project_id: project.id, section_key: section.key, section_label: `${section.page} — ${section.label}`, request_type: requestType, details, status: 'requested' });
      await Promise.all([
        projectStore.addMessage({ project_id: project.id, sender: 'client', category: 'update', body: details, section_key: section.key }),
        projectStore.updateProject(project.id, { status: project.status === 'active' ? 'active' : 'changes_requested', sections: project.sections.map((item) => item.key === section.key ? { ...item, status: 'revision_requested' } : item) }),
      ]);
      try {
        const email = ownerUpdateEmail({ project, request, ownerPortalUrl: `${publicBaseUrl()}/admin.html#updates` });
        await sendEmail({ ...email, to: process.env.OWNER_EMAIL, reply_to: project.email }, `change-${request.id}`);
      } catch (emailError) { console.error('Change-request notification failed:', emailError.message); }
      return res.status(201).json({ success: true, request });
    } catch (error) {
      console.error('Change request failed:', error.message);
      return res.status(500).json({ error: 'We could not save your change request. Please try again.' });
    }
  });

  app.post('/api/project-message', async (req, res) => {
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid.' });
      const body = String(req.body?.message || '').trim();
      if (body.length < 2 || body.length > MAX_FIELD_LENGTH) return res.status(400).json({ error: 'Enter a message of up to 5,000 characters.' });
      const message = await projectStore.addMessage({ project_id: project.id, sender: 'client', category: project.paid_at ? 'update' : 'new_build', body });
      try {
        await sendEmail({ to: process.env.OWNER_EMAIL, reply_to: project.email, subject: `[${project.paid_at ? 'Update' : 'New Build'}] Message — ${project.business_name}`, text: `${project.client_name} wrote:\n\n${body}\n\nOpen ${publicBaseUrl()}/admin.html` }, `project-message-${message.id}`);
      } catch (emailError) { console.error('Project-message notification failed:', emailError.message); }
      return res.status(201).json({ success: true, message });
    } catch (error) {
      console.error('Project message failed:', error.message);
      return res.status(500).json({ error: 'We could not save your message.' });
    }
  });

  app.post('/api/project-approval', async (req, res) => {
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid.' });
      if (!project.preview_url || project.status !== 'draft_ready') return res.status(409).json({ error: 'The draft must be marked ready before it can be approved.' });
      await projectStore.updateProject(project.id, { status: 'approved', approved_at: new Date().toISOString() });
      await projectStore.addMessage({ project_id: project.id, sender: 'client', category: 'new_build', body: 'Draft approved. The project is ready for checkout.' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Project approval failed:', error.message);
      return res.status(500).json({ error: 'We could not record your approval.' });
    }
  });

  app.post('/api/create-project-checkout-session', async (req, res) => {
    const stripe = configuredStripe();
    if (!stripe) return res.status(503).json({ error: 'Checkout is not configured yet.' });
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid.' });
      if (project.status !== 'approved') return res.status(409).json({ error: 'Approve the completed draft before checkout.' });
      const requestId = String(req.body?.requestId || '');
      if (!/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'Refresh the page and try checkout again.' });
      const token = String(req.body.token);
      const baseUrl = publicBaseUrl();
      const plan = PLANS[project.plan_slug];
      const session = await stripe.checkout.sessions.create(checkoutSessionParams(plan, {
        projectId: project.id, customerEmail: project.email,
        successUrl: `${baseUrl}/portal.html?token=${encodeURIComponent(token)}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/portal.html?token=${encodeURIComponent(token)}`,
      }), { idempotencyKey: `project_checkout_${project.id}_${requestId}` });
      return res.json({ url: session.url });
    } catch (error) {
      console.error('Project checkout failed:', error.message);
      return res.status(500).json({ error: 'We could not start checkout. Please try again.' });
    }
  });

  app.post('/api/confirm-project-payment', async (req, res) => {
    const stripe = configuredStripe();
    if (!stripe) return res.status(503).json({ error: 'Checkout verification is unavailable.' });
    try {
      const project = await projectFromRequest(req);
      if (!project) return res.status(404).json({ error: 'This private project link is invalid.' });
      const sessionId = String(req.body?.sessionId || '');
      if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(sessionId)) return res.status(400).json({ error: 'The checkout session is invalid.' });
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer', 'subscription'] });
      if (session.metadata?.project_id !== project.id || !verifiedCheckout(session, project.email)) return res.status(403).json({ error: 'We could not verify this project payment.' });
      await projectStore.updateProject(project.id, { status: 'active', paid_at: new Date().toISOString(), stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id, stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id });
      await projectStore.addMessage({ project_id: project.id, sender: 'system', category: 'update', body: 'Payment confirmed. Hosting and the monthly update allowance are now active.' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Project payment verification failed:', error.message);
      return res.status(500).json({ error: 'We could not verify payment yet. Refresh in a moment.' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    if (!auditRateAllowed(`owner-login:${req.ip || 'unknown'}`)) return res.status(429).json({ error: 'Please wait before requesting another sign-in link.' });
    if (!process.env.OWNER_PORTAL_SECRET || !process.env.OWNER_EMAIL || !process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) return res.status(503).json({ error: 'Owner login is not configured.' });
    let submitted;
    try { submitted = normalizeEmail(req.body?.email); } catch { return res.json({ success: true }); }
    let owner;
    try { owner = normalizeEmail(process.env.OWNER_EMAIL); } catch { return res.status(503).json({ error: 'Owner login is not configured.' }); }
    if (safeEqual(submitted, owner)) {
      const loginUrl = `${publicBaseUrl()}/admin.html?login=${encodeURIComponent(ownerToken())}`;
      const email = ownerLoginEmail(loginUrl);
      try { await sendEmail({ ...email, to: owner }, `owner-login-${crypto.randomUUID()}`); }
      catch (error) { console.error('Owner login email failed:', error.message); return res.status(502).json({ error: 'The sign-in email could not be sent.' }); }
    }
    return res.json({ success: true });
  });

  app.post('/api/admin/session', (req, res) => {
    const token = String(req.body?.token || '');
    if (!validOwnerToken(token)) return res.status(401).json({ error: 'This sign-in link is invalid or expired.' });
    const sessionToken = ownerToken(8 * 60 * 60 * 1000);
    res.cookie('edge_owner', sessionToken, { httpOnly: true, sameSite: 'strict', secure: publicBaseUrl().startsWith('https:'), maxAge: 8 * 60 * 60 * 1000, path: '/' });
    return res.json({ success: true });
  });

  app.delete('/api/admin/session', (req, res) => {
    res.clearCookie('edge_owner', { httpOnly: true, sameSite: 'strict', secure: publicBaseUrl().startsWith('https:'), path: '/' });
    return res.json({ success: true });
  });

  app.get('/api/admin/projects', requireOwner, async (req, res) => {
    try {
      const [projects, requests] = await Promise.all([projectStore.listProjects(), projectStore.listAllRequests()]);
      res.set('Cache-Control', 'private, no-store');
      return res.json({ projects, requests });
    } catch (error) { console.error('Owner project list failed:', error.message); return res.status(503).json({ error: 'The owner portal is temporarily unavailable.' }); }
  });

  app.get('/api/admin/projects/:id', requireOwner, async (req, res) => {
    try {
      const project = await projectStore.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      const [requests, messages] = await Promise.all([projectStore.listRequests(project.id), projectStore.listMessages(project.id)]);
      return res.json({ project, requests, messages });
    } catch (error) { return res.status(500).json({ error: 'The project could not be loaded.' }); }
  });

  app.patch('/api/admin/projects/:id', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1') return res.status(403).json({ error: 'Invalid owner request.' });
    try {
      const project = await projectStore.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      const updates = {};
      if (req.body?.status !== undefined) {
        if (!validProjectStatus(req.body.status)) return res.status(400).json({ error: 'Invalid project status.' });
        updates.status = req.body.status;
      }
      if (req.body?.previewUrl !== undefined) {
        const previewUrl = String(req.body.previewUrl || '').trim();
        if (previewUrl && !/^https:\/\//i.test(previewUrl)) return res.status(400).json({ error: 'Preview URL must use HTTPS.' });
        updates.preview_url = previewUrl || null;
      }
      let nextSections = project.sections || [];
      if (Array.isArray(req.body?.builtSections)) {
        const normalized = normalizeBuiltSections(project, req.body.builtSections);
        nextSections = normalized.sections;
        updates.site_structure = normalized.siteStructure;
      }
      if (Array.isArray(req.body?.sections)) {
        const statuses = new Map(req.body.sections.map((item) => [String(item.key), String(item.status)]));
        if ([...statuses.values()].some((status) => !validSectionStatus(status))) return res.status(400).json({ error: 'Invalid section status.' });
        nextSections = nextSections.map((section) => statuses.has(section.key) ? { ...section, status: statuses.get(section.key) } : section);
      }
      if (Array.isArray(req.body?.builtSections) || Array.isArray(req.body?.sections)) updates.sections = nextSections;
      const saved = await projectStore.updateProject(project.id, updates);
      return res.json({ success: true, project: saved });
    } catch (error) {
      if (/^Include the built areas|^List between/.test(error.message)) return res.status(400).json({ error: error.message });
      console.error('Owner project update failed:', error.message);
      return res.status(500).json({ error: 'The project could not be updated.' });
    }
  });

  app.post('/api/admin/projects/:id/message', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1') return res.status(403).json({ error: 'Invalid owner request.' });
    try {
      const project = await projectStore.getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      const body = String(req.body?.message || '').trim();
      if (body.length < 2 || body.length > MAX_FIELD_LENGTH) return res.status(400).json({ error: 'Enter a message of up to 5,000 characters.' });
      const category = req.body?.category === 'update' ? 'update' : 'new_build';
      const message = await projectStore.addMessage({ project_id: project.id, sender: 'owner', category, body });
      try {
        const email = clientOwnerReplyEmail({ project, body });
        await sendEmail({ ...email, to: project.email, reply_to: process.env.OWNER_EMAIL }, `owner-reply-${message.id}`);
      } catch (emailError) { console.error('Owner reply notification failed:', emailError.message); }
      return res.status(201).json({ success: true, message });
    } catch (error) { return res.status(500).json({ error: 'The reply could not be saved.' }); }
  });

  app.patch('/api/admin/projects/:projectId/requests/:requestId', requireOwner, async (req, res) => {
    if (req.headers['x-edge-admin'] !== '1') return res.status(403).json({ error: 'Invalid owner request.' });
    const status = String(req.body?.status || '');
    if (!['requested', 'reviewing', 'scheduled', 'complete', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid request status.' });
    try {
      const request = await projectStore.updateRequest(req.params.requestId, req.params.projectId, { status });
      return res.json({ success: true, request });
    } catch (error) { return res.status(500).json({ error: 'The request could not be updated.' }); }
  });

  app.get('/api/reddit-leads', async (req, res) => {
    if (String(process.env.REDDIT_LEAD_FEED_ENABLED || '').trim().toLowerCase() !== 'true') {
      return res.status(404).json({ enabled: false });
    }
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 25) : 10;
    const industry = String(req.query.industry || '').trim().toLowerCase();
    if (!process.env.REDDIT_LEAD_FEED_URL) {
      const routedLeads = routeLeadsToIndustry(redditLeadSnapshot, industry);
      return res.json({
        enabled: true,
        leads: routedLeads.slice(0, limit),
        stats: leadStats(routedLeads),
        refreshedAt: new Date().toISOString(),
        source: 'reddit-scraper-snapshot',
        industry: industry || null,
      });
    }
    try {
      const leads = await fetchContractorLeads({
        endpoint: process.env.REDDIT_LEAD_FEED_URL,
        token: process.env.REDDIT_LEAD_FEED_TOKEN,
        limit,
      });
      const routedLeads = routeLeadsToIndustry(leads, industry);
      res.set('Cache-Control', 'private, no-store');
      return res.json({
        enabled: true,
        leads: routedLeads,
        stats: { ...leadStats(routedLeads), complete: false },
        refreshedAt: new Date().toISOString(),
        source: 'google-sheets-live',
        industry: industry || null,
      });
    } catch (error) {
      console.error('Reddit lead feed error:', error.message);
      const routedLeads = routeLeadsToIndustry(redditLeadSnapshot, industry);
      return res.json({
        enabled: true,
        leads: routedLeads.slice(0, limit),
        stats: leadStats(routedLeads),
        refreshedAt: new Date().toISOString(),
        source: 'reddit-scraper-snapshot',
      });
    }
  });

  app.post('/api/create-checkout-session', async (req, res) => {
    return res.status(410).json({ error: 'Complete the free build brief and approve your draft before checkout.' });
  });

  app.post('/api/onboarding', async (req, res) => {
    const fields = ['sessionId', 'businessName', 'ownerName', 'email', 'phone', 'businessType', 'goals', 'requiredPages'];
    const data = Object.fromEntries(Object.entries(req.body || {}).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : '']));
    const missing = fields.filter((field) => !data[field]);
    if (missing.length) return res.status(400).json({ error: 'Please complete all required onboarding fields.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    data.email = data.email.toLowerCase();
    if (!/^cs_(test_|live_)?[a-zA-Z0-9]+$/.test(data.sessionId)) return res.status(400).json({ error: 'The checkout session is invalid.' });
    if (Object.values(data).some((value) => value.length > MAX_FIELD_LENGTH)) return res.status(400).json({ error: 'Please shorten your response to 5,000 characters per field.' });
    const stripe = configuredStripe();
    if (!stripe || !process.env.OWNER_EMAIL) return res.status(503).json({ error: 'Onboarding is not configured yet. Please contact us directly.' });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(data.sessionId, { expand: ['customer', 'subscription'] });
    } catch (error) {
      return res.status(403).json({ error: 'We could not verify your completed checkout.' });
    }
    if (!verifiedCheckout(session, data.email)) return res.status(403).json({ error: 'Your onboarding details must match a completed Edge Landings checkout.' });
    const selectedPlan = PLANS[session.metadata.plan_slug];
    if (session.metadata?.onboarding_status === 'complete') return res.json({ success: true, alreadyReceived: true });
    if (session.metadata?.onboarding_status === 'processing') return res.status(409).json({ error: 'Your onboarding details are already being processed. Please wait a moment before trying again.' });

    const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]));
    const submittedAt = new Date().toISOString();
    const ownerEmail = ownerOnboardingEmail({ safe, selectedPlan, submittedAt });
    const customerEmail = customerOnboardingEmail({ safe, selectedPlan });
    try {
      await stripe.checkout.sessions.update(data.sessionId, { metadata: { ...session.metadata, onboarding_status: 'processing' } });
      await sendEmail({ ...ownerEmail, to: process.env.OWNER_EMAIL, reply_to: data.email }, `onboarding-owner-${data.sessionId}`);
      await sendEmail({ ...customerEmail, to: data.email, reply_to: process.env.OWNER_EMAIL }, `onboarding-customer-${data.sessionId}`);
      await stripe.checkout.sessions.update(data.sessionId, { metadata: { ...session.metadata, onboarding_status: 'complete', onboarding_completed_at: submittedAt } });
      return res.json({ success: true });
    } catch (error) {
      console.error('Onboarding delivery error:', error.message);
      try { await stripe.checkout.sessions.update(data.sessionId, { metadata: { ...session.metadata, onboarding_status: 'failed' } }); } catch (metadataError) { console.error('Onboarding status reset error:', metadataError.message); }
      return res.status(502).json({ error: 'We could not deliver your onboarding details. Please try again or contact us directly.' });
    }
  });
  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
    console.error(`Unhandled request error ${res.locals.requestId}:`, error?.message || error);
    return res.status(500).json({ error: 'The service is temporarily unavailable.' });
  });
  return app;
}

const app = createApp();

if (require.main === module) app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Vercel's Node runtime invokes the exported Express application directly.
// Keep helpers attached so the lean-launch contract can be tested without a
// second production app instance.
module.exports = app;
module.exports.createApp = createApp;
module.exports.PLANS = PLANS;
module.exports.checkoutSessionParams = checkoutSessionParams;
module.exports.verifiedCheckout = verifiedCheckout;
module.exports.auditRateAllowed = auditRateAllowed;
module.exports.routeLeadsToIndustry = routeLeadsToIndustry;
module.exports.leadStats = leadStats;
