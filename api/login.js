const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');
const users = require('./users');

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
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find customer by email in Stripe
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
    }

    const customerId = customers.data[0].id;

    // Verify password if provided (for accounts with passwords)
    if (password) {
      // Check if user exists in our system
      const user = users.get(email);
      if (!user) {
        // If customer exists in Stripe but not in our system, allow login
        // (for customers who signed up via Stripe payment links)
        // But we should still verify they have an account
        return res.status(401).json({ error: 'Invalid email or password. Please use the email you used when signing up.' });
      }

      // Verify password
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (user.passwordHash !== passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    res.json({ 
      customerId: customerId,
      email: email,
      success: true 
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
};

