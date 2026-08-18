const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ONE_PLAN_NAME = 'Edge Landings - Website Care';

function configuredStripe() {
  return process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
}

function publicBaseUrl() {
  if (!process.env.APP_URL) throw new Error('APP_URL is not configured.');
  return process.env.APP_URL.replace(/\/$/, '');
}

function checkoutSessionParams() {
  const baseUrl = publicBaseUrl();
  return {
    mode: 'subscription', payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing.html`, metadata: { service: ONE_PLAN_NAME },
  };
}

function verifiedCheckout(session, submittedEmail) {
  const checkoutEmail = session.customer_details?.email || session.customer?.email || session.customer_email;
  return session.mode === 'subscription'
    && session.status === 'complete'
    && ['paid', 'no_payment_required'].includes(session.payment_status)
    && Boolean(session.subscription)
    && Boolean(session.customer)
    && session.metadata?.service === ONE_PLAN_NAME
    && checkoutEmail?.toLowerCase() === submittedEmail.toLowerCase();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

async function sendEmail(message) {
  if (!process.env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}): ${await response.text()}`);
}

function createApp() {
  const app = express();
  // Stripe requires the untouched request body for signature verification.
  // This route must be registered before express.json().
  app.post('/api/webhook', express.raw({ type: 'application/json' }), require('./api/webhook'));
  app.use(express.json({ limit: '100kb' }));
  app.all('/api/catalog-webhook', require('./api/catalog-webhook'));
  app.use(express.static(path.join(__dirname), { extensions: ['html'] }));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  app.post('/api/create-checkout-session', async (req, res) => {
    const stripe = configuredStripe();
    if (!stripe || !process.env.STRIPE_PRICE_ID) {
      return res.status(503).json({ error: 'Checkout is not configured yet. Please contact us directly.' });
    }
    try {
      const session = await stripe.checkout.sessions.create(checkoutSessionParams());
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
    const stripe = configuredStripe();
    if (!stripe || !process.env.OWNER_EMAIL) return res.status(503).json({ error: 'Onboarding is not configured yet. Please contact us directly.' });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(data.sessionId, { expand: ['customer', 'subscription'] });
    } catch (error) {
      return res.status(403).json({ error: 'We could not verify your completed checkout.' });
    }
    if (!verifiedCheckout(session, data.email)) return res.status(403).json({ error: 'Your onboarding details must match a completed Edge Landings checkout.' });

    const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]));
    const submittedAt = new Date().toISOString();
    const details = [
      ['Business name', safe.businessName], ['Owner name', safe.ownerName], ['Email', safe.email], ['Phone', safe.phone],
      ['Existing URL', safe.existingUrl || 'Not provided'], ['Business type', safe.businessType], ['Goals', safe.goals],
      ['Required pages', safe.requiredPages], ['Notes', safe.notes || 'None'],
    ].map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join('');
    try {
      await sendEmail({ from: process.env.EMAIL_FROM || 'Edge Landings <onboarding@edgelandings.com>', to: process.env.OWNER_EMAIL, reply_to: data.email, subject: `New Edge Landings onboarding: ${data.businessName}`, html: `<h1>New paid-customer onboarding</h1>${details}<p><strong>Submitted:</strong> ${submittedAt}</p>` });
      await sendEmail({ from: process.env.EMAIL_FROM || 'Edge Landings <onboarding@edgelandings.com>', to: data.email, subject: 'We received your Edge Landings onboarding details', html: `<p>Thanks, ${safe.ownerName}. We received the onboarding details for ${safe.businessName}.</p><p>Your first site draft is due within 3 business days after we receive the content needed for your site.</p>` });
      if (process.env.GOOGLE_SCRIPT_URL) {
        const sheetResponse = await fetch(process.env.GOOGLE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'addOnboarding', plan: ONE_PLAN_NAME, submittedAt, ...data }) });
        if (!sheetResponse.ok) throw new Error(`Onboarding record delivery failed (${sheetResponse.status}).`);
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Onboarding delivery error:', error.message);
      return res.status(502).json({ error: 'We could not deliver your onboarding details. Please try again or contact us directly.' });
    }
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
module.exports.ONE_PLAN_NAME = ONE_PLAN_NAME;
module.exports.checkoutSessionParams = checkoutSessionParams;
module.exports.verifiedCheckout = verifiedCheckout;
