const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
      return_url: `${req.headers.origin || 'https://edgelandings.com'}/dashboard.html`,
    });

    res.json({
      email: email,
      customerId: customerId,
      subscription: subscriptionData,
      portalUrl: portalSession.url,
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

