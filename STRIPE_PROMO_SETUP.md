# Stripe Promotional Pricing Setup

## Update Pro Plan to $199/month with 3-month $99 promo

You need to update your Stripe Payment Link to include the promotional pricing.

### Option 1: Create New Price with Promotional Period (Recommended)

1. **Go to Stripe Dashboard** → **Products**
2. Find your "Pro" product (or create new one)
3. **Create a new price:**
   - Amount: **$199/month** (regular price)
   - Billing: **Recurring monthly**
   - Save the Price ID (starts with `price_`)

4. **Create promotional price:**
   - Go to **Products** → Your Pro product
   - Click **"Add another price"**
   - Amount: **$99/month**
   - Billing: **Recurring monthly**
   - **Promotional period**: Set to **3 months**
   - After promotional period: Use the $199 price ID from step 3
   - Save

5. **Update Payment Link:**
   - Go to **Payment Links** in Stripe
   - Find your Pro plan link: `https://buy.stripe.com/aFa14p0iYauv866cLl63K03`
   - Edit it to use the new promotional price
   - Or create a new Payment Link with the promotional price

### Option 2: Use Stripe Promotion Codes

1. **Create a promotion code:**
   - Go to **Products** → **Coupons**
   - Create new coupon:
     - Type: **Amount off**
     - Amount: **$100** (to make $199 → $99)
     - Duration: **3 months**
     - Applies to: Your Pro product
   - Create promotion code (e.g., `PRO99`)

2. **Update Payment Link:**
   - Edit your Payment Link
   - Add the promotion code as default
   - Or include it in the link URL

### Option 3: Use Subscription Schedules (Advanced)

This requires API changes but gives full control:
- Create subscription with $99/month
- Schedule change to $199/month after 3 months
- Requires updating your API code

## Quick Test:

After updating:
1. Click the Payment Link
2. Verify it shows $99/month for first 3 months
3. Check that it shows $199/month after that

## Current Payment Link:
`https://buy.stripe.com/aFa14p0iYauv866cLl63K03`

**Note:** You'll need to update this link in Stripe to reflect the new pricing structure.

