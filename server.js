const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

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

// Login endpoint - verify customer and return info
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please check your email or sign up first.' });
    }

    const customerId = customers.data[0].id;

    res.json({ 
      customerId: customerId,
      email: email,
      success: true 
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard endpoint - get customer subscription and website info
app.post('/api/dashboard', async (req, res) => {
  try {
    const { email, customerId } = req.body;

    if (!email || !customerId) {
      return res.status(400).json({ error: 'Email and customer ID are required' });
    }

    // Get customer from Stripe
    const customer = await stripe.customers.retrieve(customerId);
    
    // Get subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
    });

    let subscriptionData = null;
    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0].price.id;
      const price = await stripe.prices.retrieve(priceId);
      
      subscriptionData = {
        status: subscription.status,
        planName: price.nickname || `$${price.unit_amount / 100}/month`,
        amount: price.unit_amount / 100,
        nextBillingDate: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
          : null,
      };
    }

    // Create portal session URL
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.protocol}://${req.get('host')}/dashboard.html`,
    });

    res.json({
      email: email,
      customerId: customerId,
      subscription: subscriptionData,
      portalUrl: portalSession.url,
      website: {
        status: 'Active',
        url: 'https://edgelandings.com', // Update with actual website URLs
      }
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ error: error.message });
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

// Webhook to handle subscription events
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
      console.log('New subscription created:', event.data.object.id);
      // Send welcome email or setup customer
      break;
    case 'customer.subscription.updated':
      console.log('Subscription updated:', event.data.object.id);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription cancelled:', event.data.object.id);
      // Handle cancellation
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'edge-landings.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

