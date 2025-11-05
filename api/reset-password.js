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
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Get token data
    const tokenData = users.getResetToken(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new password reset link.' });
    }

    const email = tokenData.email;

    // Check if user exists
    if (!users.exists(email)) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Hash new password
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Update user password
    const user = users.get(email);
    user.passwordHash = passwordHash;
    users.set(email, user);

    // Delete used token
    users.deleteResetToken(token);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ error: error.message });
  }
};

