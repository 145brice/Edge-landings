const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PLANS = {
  basic: { slug: 'basic', name: 'Edge Landings Basic' },
  growth: { slug: 'growth', name: 'Edge Landings Growth' },
};
const MAX_FIELD_LENGTH = 5000;

function configuredStripe() {
  return process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
}

function publicBaseUrl() {
  if (!process.env.APP_URL) throw new Error('APP_URL is not configured.');
  return process.env.APP_URL.replace(/\/$/, '');
}

function checkoutSessionParams(plan, priceId) {
  const baseUrl = publicBaseUrl();
  return {
    mode: 'subscription', payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing.html`, metadata: { service: plan.name, plan_slug: plan.slug },
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
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(message), signal: AbortSignal.timeout(10000),
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
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
  app.use(express.static(path.join(__dirname), { extensions: ['html'] }));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.get('/api/health', (req, res) => {
    const required = ['APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'EMAIL_API_KEY', 'EMAIL_FROM', 'OWNER_EMAIL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_PRICE_MAP'];
    const missing = required.filter((name) => !process.env[name]);
    return res.status(missing.length ? 503 : 200).json({
      status: missing.length ? 'configuration_required' : 'ok', missing,
      systems: {
        catalog: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ESTIMATOR_WEBHOOK_SECRET),
        scheduledBaselines: Boolean(process.env.CRON_SECRET),
      },
    });
  });

  app.post('/api/create-checkout-session', async (req, res) => {
    const stripe = configuredStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'Checkout is not configured yet. Please contact us directly.' });
    }
    try {
      const requestId = String(req.body?.requestId || '');
      if (!/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'Please refresh the page and try checkout again.' });
      const plan = PLANS[String(req.body?.planSlug || '')];
      if (!plan) return res.status(400).json({ error: 'Please choose a valid website plan.' });
      const catalog = require('./lib/catalog-store');
      let priceId;
      try {
        priceId = (await catalog.getService(plan.slug))?.price_id;
      } catch (catalogError) {
        console.error(`Catalog lookup failed for ${plan.slug}; using validated server mapping:`, catalogError.message);
      }
      priceId ||= catalog.configuredPriceMap()[plan.slug];
      if (!priceId) return res.status(503).json({ error: 'Checkout is not configured yet. Please contact us directly.' });
      const session = await stripe.checkout.sessions.create(checkoutSessionParams(plan, priceId), { idempotencyKey: `checkout_${plan.slug}_${requestId}` });
      return res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout session error:', error.message);
      return res.status(500).json({ error: 'We could not start checkout. Please try again or contact us directly.' });
    }
  });

  app.post('/api/onboarding', async (req, res) => {
    const fields = ['sessionId', 'businessName', 'ownerName', 'email', 'phone', 'businessType', 'goals', 'requiredPages'];
    const data = Object.fromEntries(Object.entries(req.body || {}).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : '']));
    const missing = fields.filter((field) => !data[field]);
    if (missing.length) return res.status(400).json({ error: 'Please complete all required onboarding fields.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
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
    const details = [
      ['Business name', safe.businessName], ['Owner name', safe.ownerName], ['Email', safe.email], ['Phone', safe.phone],
      ['Existing URL', safe.existingUrl || 'Not provided'], ['Business type', safe.businessType], ['Goals', safe.goals],
      ['Required pages', safe.requiredPages], ['Notes', safe.notes || 'None'],
    ].map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join('');
    try {
      await stripe.checkout.sessions.update(data.sessionId, { metadata: { ...session.metadata, onboarding_status: 'processing' } });
      await sendEmail({ from: process.env.EMAIL_FROM || 'Edge Landings <onboarding@edgelandings.com>', to: process.env.OWNER_EMAIL, reply_to: data.email, subject: `New Edge Landings onboarding: ${data.businessName}`, html: `<h1>New paid-customer onboarding</h1>${details}<p><strong>Submitted:</strong> ${submittedAt}</p>` }, `onboarding-owner-${data.sessionId}`);
      await sendEmail({ from: process.env.EMAIL_FROM || 'Edge Landings <onboarding@edgelandings.com>', to: data.email, subject: 'We received your Edge Landings onboarding details', html: `<p>Thanks, ${safe.ownerName}. We received the onboarding details for ${safe.businessName}.</p><p>Your first site draft is due within 3 business days after we receive the content needed for your site.</p>` }, `onboarding-customer-${data.sessionId}`);
      if (process.env.GOOGLE_SCRIPT_URL) {
        const sheetResponse = await fetch(process.env.GOOGLE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addOnboarding', eventId: `onboarding-${data.sessionId}`, plan: selectedPlan.name, planSlug: selectedPlan.slug, submittedAt, ...data }), signal: AbortSignal.timeout(10000) });
        if (!sheetResponse.ok) throw new Error(`Onboarding record delivery failed (${sheetResponse.status}).`);
      }
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
