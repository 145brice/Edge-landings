const crypto = require('crypto');
const users = require('./users');

// Initialize Stripe only if key is available
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch (error) {
    console.error('Failed to initialize Stripe:', error.message);
  }
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
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check local users database FIRST (primary source of truth)
    const user = await users.get(email);
    
    if (!user) {
      // User doesn't exist in local database
      // Check Stripe as fallback (for users who signed up via payment links only)
      if (stripe) {
        try {
          const customers = await stripe.customers.list({
            email: email,
            limit: 1,
          });

          if (customers.data.length === 0) {
            return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
          }
          
          // Customer exists in Stripe but not in local DB
          // This means they signed up via payment link but haven't created a password
          return res.status(401).json({ error: 'Account found but no password set. Please sign up first to create a password.' });
        } catch (stripeError) {
          console.error('Stripe error during login:', stripeError.message);
          // Continue to return not found if Stripe fails
        }
      }
      
      return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
    }

    // User exists in local database - verify password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Password is correct - get customer ID (from user data or Stripe)
    let customerId = user.customerId;
    
    // If no customerId in user data, try to get from Stripe
    if (!customerId && stripe) {
      try {
        const customers = await stripe.customers.list({
          email: email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      } catch (stripeError) {
        console.error('Stripe error getting customer:', stripeError.message);
        // Continue without customerId - login still succeeds
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

