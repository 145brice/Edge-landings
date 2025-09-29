# Email & SMS Setup Instructions

## Quick Setup for Email & SMS Notifications

### Option 1: Use Zapier (Recommended - Free)

1. **Go to:** https://zapier.com
2. **Create account** (free)
3. **Create new Zap**
4. **Choose trigger:** "Webhooks by Zapier" → "Catch Hook"
5. **Copy the webhook URL** (looks like: https://hooks.zapier.com/hooks/catch/123456/abcdef/)

### Set up Actions:

**Action 1 - Email:**
- Choose "Email by Zapier"
- To: nashvillemobilecuts@gmail.com
- Subject: New Contractor Signup - Nashville Mobile Cuts
- Body: New contractor signup: {{firstName}} {{lastName}} - Phone: {{phone}}

**Action 2 - SMS:**
- Choose "SMS by Zapier" or "Twilio"
- To: 6159229650
- Message: New contractor signup: {{firstName}} {{lastName}} - {{phone}}

### Option 2: Simple Email-Only Setup

If you just want email for now, I can set up a simple email form that works immediately.

## Current Status
- Form is ready and working
- Just needs webhook URL to be connected
- Once you get webhook URL, I'll update the form
