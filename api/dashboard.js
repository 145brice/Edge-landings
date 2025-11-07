let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch (error) {
    console.error('Failed to initialize Stripe in dashboard endpoint:', error.message);
    stripe = null;
  }
} else {
  console.warn('STRIPE_SECRET_KEY environment variable is not set - dashboard portal features disabled');
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, customerId } = req.body;

    if (!email || !customerId) {
      return res.status(400).json({ error: 'Email and customer ID are required' });
    }

    let subscriptionData = null;
    let portalUrl = null;
    let portalConfigured = false;
    let portalMessage = null;

    if (!stripe) {
      portalMessage = 'Stripe is not configured. Please add STRIPE_SECRET_KEY in Vercel to enable billing management.';
    } else {
      try {
        const customer = await stripe.customers.retrieve(customerId);

        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: 'all',
        });

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

        try {
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${req.headers.origin || 'https://edgelandings.com'}/dashboard.html`,
          });

          portalUrl = portalSession.url;
          portalConfigured = true;
        } catch (portalError) {
          console.error('Stripe portal creation error:', portalError.message);
          if (portalError.message?.includes('No configuration provided')) {
            portalMessage = 'Stripe customer portal is not configured. Visit https://dashboard.stripe.com/settings/billing/portal in LIVE mode, save the settings to create a default portal configuration, then retry.';
          } else {
            portalMessage = `Unable to create billing portal session: ${portalError.message}`;
          }
        }
      } catch (stripeError) {
        console.error('Stripe error while loading dashboard:', stripeError.message);
        portalMessage = stripeError.message;
      }
    }

    res.json({
      email: email,
      customerId: customerId,
      subscription: subscriptionData,
      portalUrl,
      portalConfigured,
      portalMessage,
      website: {
        status: 'Active',
        url: 'https://edgelandings.com',
      }
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ error: error.message });
  }
};

