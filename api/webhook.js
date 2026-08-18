module.exports = (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook is not configured.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ error: 'Missing Stripe signature.' });

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    // Checkout fulfillment is collected on success.html; this endpoint only
    // verifies and acknowledges Stripe events for the lean launch.
    console.log(`Verified Stripe webhook: ${event.type}`);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid Stripe webhook signature.' });
  }
};
