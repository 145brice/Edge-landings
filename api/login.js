const crypto = require('crypto');

// Look up a user row from Google Sheet via Apps Script
async function getUserFromSheet(email) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    console.warn('GOOGLE_SCRIPT_URL not set');
    return null;
  }

  const url = `${scriptUrl}?action=getUser&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.found ? data.user : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getUserFromSheet(email.trim().toLowerCase());

    if (!user) {
      return res.status(404).json({
        error: 'No account found. Please sign up via our pricing page first.',
      });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.status(200).json({
      success: true,
      email: user.email,
      plan: user.plan,
      customerId: user.customerId,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};
