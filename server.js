const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const anthroModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY is not set. Claude assistant endpoint is disabled.');
}

// Middleware
app.use(express.json());

// EXPLICIT ROUTE FOR REALTOR-PRO.HTML - MUST BE BEFORE STATIC
app.get('/realtor-pro.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(__dirname, 'realtor-pro.html'), { 
    etag: false,
    lastModified: false 
  });
});

// Add no-cache headers for HTML files
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static files with correct MIME types
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create checkout session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        service: 'Edge Landings Website',
      },
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Login and dashboard — delegate to api/ modules
app.post('/api/login',     require('./api/login'));
app.post('/api/dashboard', require('./api/dashboard'));

app.post('/api/claude', async (req, res) => {
  if (!anthropicClient) {
    return res.status(503).json({ error: 'Claude assistant is not configured on this server.' });
  }

  const { prompt, conversation = [], system } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const history = [];

  if (Array.isArray(conversation)) {
    conversation.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const role = entry.role === 'assistant' ? 'assistant' : 'user';
      const text = typeof entry.content === 'string' ? entry.content.trim() : '';
      if (!text) return;
      history.push({
        role,
        content: [{ type: 'text', text }],
      });
    });
  }

  history.push({
    role: 'user',
    content: [{ type: 'text', text: prompt.trim() }],
  });

  const messages = history.filter((message, index) => {
    if (index === 0 && message.role !== 'user') {
      return false;
    }
    return true;
  });

  try {
    const response = await anthropicClient.messages.create({
      model: anthroModel,
      max_tokens: 1024,
      system: typeof system === 'string' && system.trim() ? system.trim() : undefined,
      messages,
    });

    const replyText = (response?.content || [])
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
      .trim();

    res.json({
      reply: replyText,
      model: response?.model || anthroModel,
      usage: response?.usage || null,
      stop_reason: response?.stop_reason || null,
    });
  } catch (error) {
    console.error('Error calling Claude:', error);
    const status = error?.status || error?.statusCode || 500;
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      'Failed to reach Claude assistant.';
    res.status(status).json({ error: message });
  }
});

// Create customer portal session - lookup by email
app.post('/create-portal-session', async (req, res) => {
  try {
    const { email, returnUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this email' });
    }

    const customerId = customers.data[0].id;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${req.protocol}://${req.get('host')}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook — writes new customers to Google Sheets
app.post('/api/webhook', require('./api/webhook'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

