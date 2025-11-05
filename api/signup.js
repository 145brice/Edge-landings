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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    // If customer exists in Stripe but not in our system, create account
    // If customer doesn't exist, create in Stripe
    let customerId;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      // Create customer in Stripe
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          accountCreated: new Date().toISOString(),
        },
      });
      customerId = customer.id;
    }

    // Hash password (simple hash for demo - use bcrypt in production)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Check if user already exists
    if (users.exists(email)) {
      return res.status(400).json({ error: 'An account with this email already exists. Please login instead.' });
    }

    // Store user account (in production, use a database like MongoDB, PostgreSQL, or Vercel KV)
    users.set(email, {
      email: email,
      passwordHash: passwordHash,
      customerId: customerId,
      createdAt: new Date().toISOString(),
    });

    // Send welcome emails
    try {
      await sendWelcomeEmails(email, password);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail signup if email fails, but log it
    }

    res.json({
      success: true,
      message: 'Account created successfully. Check your email for login details.',
      customerId: customerId,
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: error.message });
  }
};

// Email sending function
async function sendWelcomeEmails(email, password) {
  // You'll need to configure email service
  // Options: SendGrid, Resend, Nodemailer with SMTP, etc.
  
  // For now, using a simple approach - you can integrate with:
  // 1. Resend API (recommended for Vercel)
  // 2. SendGrid
  // 3. Nodemailer with SMTP
  
  // Example using fetch to an email service:
  const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'https://api.resend.com/emails';
  const emailApiKey = process.env.EMAIL_API_KEY;

  if (!emailApiKey) {
    console.warn('EMAIL_API_KEY not set - skipping email sending');
    return;
  }

  // Email 1: Login information
  const loginEmail = {
    from: 'Edge Websites <noreply@edgelandings.com>',
    to: email,
    subject: 'Welcome to Edge Websites - Your Login Information',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">Welcome to Edge Websites!</h2>
        <p>Your account has been created successfully.</p>
        <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <p><strong>Your Login Email:</strong></p>
          <p style="font-size: 1.2rem; color: #00ff88;">${email}</p>
        </div>
        <p>You can now log in to your dashboard at: <a href="https://edgelandings.com/login.html">https://edgelandings.com/login.html</a></p>
        <p>You'll receive your password in a separate email for security.</p>
        <p>Best regards,<br>Edge Websites Team</p>
      </div>
    `,
  };

  // Email 2: Password information
  const passwordEmail = {
    from: 'Edge Websites <noreply@edgelandings.com>',
    to: email,
    subject: 'Edge Websites - Your Account Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00ff88;">Your Account Password</h2>
        <p>Here is your account password as requested:</p>
        <div style="background: #1a1a1a; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <p><strong>Your Password:</strong></p>
          <p style="font-size: 1.2rem; color: #00ff88; font-family: monospace;">${password}</p>
        </div>
        <p style="color: #ff6b6b; font-weight: bold;">⚠️ Keep this password secure. For security, consider changing it after your first login.</p>
        <p>Login at: <a href="https://edgelandings.com/login.html">https://edgelandings.com/login.html</a></p>
        <p>Best regards,<br>Edge Websites Team</p>
      </div>
    `,
  };

  // Send both emails using Resend API
  if (emailApiKey) {
    try {
      // Email 1: Login information
      const loginResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: loginEmail.from,
          to: loginEmail.to,
          subject: loginEmail.subject,
          html: loginEmail.html,
        }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(`Email 1 failed: ${errorData.message || 'Unknown error'}`);
      }

      // Email 2: Password information
      const passwordResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: passwordEmail.from,
          to: passwordEmail.to,
          subject: passwordEmail.subject,
          html: passwordEmail.html,
        }),
      });

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json();
        throw new Error(`Email 2 failed: ${errorData.message || 'Unknown error'}`);
      }

      console.log('Welcome emails sent successfully to:', email);
    } catch (error) {
      console.error('Failed to send emails via Resend:', error);
      // Don't throw - account creation succeeded even if email fails
      // Log for manual follow-up
    }
  } else {
    // Fallback: Log emails (for development/testing)
    console.log('=== EMAIL 1: Login Info ===');
    console.log('To:', email);
    console.log('Subject:', loginEmail.subject);
    console.log('Body:', loginEmail.html);
    console.log('=== EMAIL 2: Password ===');
    console.log('To:', email);
    console.log('Subject:', passwordEmail.subject);
    console.log('Body:', passwordEmail.html);
    console.log('\n⚠️ EMAIL_API_KEY not set. Set up Resend API to send emails.');
  }
}

