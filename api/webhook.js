const crypto = require('crypto');

// Verify Stripe webhook signature
function verifyStripeSignature(payload, signature, secret) {
  const elements = signature.split(',');
  const timestamp = elements.find(e => e.startsWith('t=')).split('=')[1];
  const v1 = elements.find(e => e.startsWith('v1=')).split('=')[1];
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return expected === v1;
}

// Generate a simple readable temp password
function generateTempPassword() {
  const words = ['Eagle', 'Stone', 'River', 'Cedar', 'Forge', 'Blaze', 'Ridge', 'Creek'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}${num}`;
}

// Post a new customer row to Google Sheets via Apps Script
async function addToSheet(data) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    console.warn('GOOGLE_SCRIPT_URL not set — skipping sheet write');
    return;
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'addCustomer', ...data }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheet write failed: ${text}`);
  }
  return response.json();
}

// Send welcome email with temp password via Resend
async function sendWelcomeEmail(email, tempPassword, plan) {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.warn('EMAIL_API_KEY not set — skipping welcome email');
    return;
  }

  const loginUrl = 'https://edge-landings.vercel.app/login.html';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Edge Websites <noreply@edgelandings.com>',
      to: email,
      subject: 'Welcome to Edge Websites — your login info',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #040711; color: #eef3ff; padding: 2rem; border-radius: 12px;">
          <h2 style="color: #00f18c; margin-bottom: 0.5rem;">You're in. 🎉</h2>
          <p>Thanks for signing up for the <strong>${plan}</strong> plan. Your 24-hour build slot is reserved.</p>
          <p>Here are your login credentials:</p>
          <div style="background: #0b1220; border: 1px solid #1e3a5f; border-radius: 8px; padding: 1rem 1.4rem; margin: 1.2rem 0;">
            <p style="margin: 0.3rem 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0.3rem 0;"><strong>Temp Password:</strong> <span style="color: #00f18c; font-family: monospace; font-size: 1.1rem;">${tempPassword}</span></p>
          </div>
          <p>Log in at: <a href="${loginUrl}" style="color: #00f18c;">${loginUrl}</a></p>
          <p style="color: #8fa3c5; font-size: 0.88rem; margin-top: 1.5rem;">You can change your password after logging in. If you didn't sign up, ignore this email.</p>
          <p style="margin-top: 1.5rem;">— The Edge Websites team</p>
        </div>
      `,
    }),
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  // Verify signature if webhook secret is configured
  if (webhookSecret && signature) {
    try {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const valid = verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Signature verification failed' });
    }
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const customerId = session.customer;
      const amountTotal = session.amount_total; // in cents
      const amount = amountTotal ? amountTotal / 100 : null;

      // Determine plan from amount
      let plan = 'Unknown';
      if (amount === 59) plan = 'Basic';
      else if (amount === 99) plan = 'Pro';

      const tempPassword = generateTempPassword();
      const passwordHash = crypto.createHash('sha256').update(tempPassword).digest('hex');

      // Write to Google Sheet
      try {
        await addToSheet({
          email,
          plan,
          amount,
          customerId,
          passwordHash,
          createdAt: new Date().toISOString(),
          status: 'active',
        });
        console.log(`✅ Added ${email} (${plan}) to sheet`);
      } catch (sheetErr) {
        console.error('Sheet write error:', sheetErr.message);
        // Don't fail the webhook — Stripe needs a 200
      }

      // Send welcome email with temp password
      try {
        await sendWelcomeEmail(email, tempPassword, plan);
        console.log(`✅ Welcome email sent to ${email}`);
      } catch (emailErr) {
        console.error('Email error:', emailErr.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
