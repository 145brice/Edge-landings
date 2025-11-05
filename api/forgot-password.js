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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user exists in our system
    const userExists = users.exists(email);
    
    // Also check if customer exists in Stripe (for users who signed up via Stripe directly)
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    const customerExists = customers.data.length > 0;

    // For security, don't reveal if email exists or not
    // Always return success, but only send email if account exists
    if (userExists || customerExists) {
      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Store reset token
      users.setResetToken(resetToken, email, expiresAt.toISOString());

      // Create reset URL
      const baseUrl = req.headers.origin || 'https://edgelandings.com';
      const resetUrl = `${baseUrl}/reset-password.html?token=${resetToken}`;

      // Send reset email
      await sendResetEmail(email, resetUrl);
    }

    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    // Still return success for security
    res.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.',
    });
  }
};

async function sendResetEmail(email, resetUrl) {
  const emailApiKey = process.env.EMAIL_API_KEY;

  if (!emailApiKey) {
    console.warn('EMAIL_API_KEY not set - skipping email sending');
    console.log('=== PASSWORD RESET EMAIL ===');
    console.log('To:', email);
    console.log('Reset URL:', resetUrl);
    return;
  }

  const resetEmail = {
    from: 'Edge Websites <noreply@edgelandings.com>',
    to: email,
    subject: 'Reset Your Edge Websites Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">Reset Your Password</h2>
        <p>You requested to reset your password for your Edge Websites account.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
        <div style="text-align: center; margin: 2rem 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #00ff88, #00cc6a); color: #000000; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 700;">Reset Password</a>
        </div>
        <p style="color: #ff6b6b; font-weight: bold;">⚠️ If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #00ff88;">${resetUrl}</p>
        <p style="margin-top: 2rem; color: #999; font-size: 0.9rem;">This link expires in 1 hour.</p>
        <p>Best regards,<br>Edge Websites Team</p>
      </div>
    `,
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resetEmail.from,
        to: resetEmail.to,
        subject: resetEmail.subject,
        html: resetEmail.html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Email failed: ${errorData.message || 'Unknown error'}`);
    }

    console.log('Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

