# Stripe Setup Instructions

## 1. Create a Stripe Account
1. Go to https://stripe.com and create an account
2. Complete the account setup process
3. Get your API keys from the Stripe Dashboard

## 2. Get Your API Keys
1. In Stripe Dashboard, go to "Developers" > "API keys"
2. Copy your:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)

## 3. Create a Product and Price
1. In Stripe Dashboard, go to "Products"
2. Click "Add product"
3. Name: "Edge Landings Website"
4. Description: "Professional website with hosting and updates"
5. Pricing model: "Recurring"
6. Price: $300.00
7. Billing period: Monthly
8. Copy the Price ID (starts with `price_`)

## 4. Update Your Code
1. Replace `pk_test_YOUR_PUBLISHABLE_KEY` in edge-landings.html with your actual publishable key
2. Replace `price_YOUR_PRICE_ID` in edge-landings.html with your actual price ID
3. Create a `.env` file with:
   ```
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   PORT=3000
   ```

## 5. Install Dependencies and Run
```bash
npm install
npm start
```

## 6. Test Payments
- Use Stripe's test card numbers:
  - Success: 4242 4242 4242 4242
  - Decline: 4000 0000 0000 0002
- Any future date for expiry
- Any 3-digit CVC

## 7. Go Live
1. Switch to live mode in Stripe Dashboard
2. Update your keys to live keys (remove `_test` suffix)
3. Update your domain in Stripe settings
4. Deploy your application

## Customer Portal
Customers can manage their subscriptions at:
`https://yourdomain.com/customer-portal`

This allows them to:
- Update payment methods
- Cancel subscriptions
- View billing history
- Download invoices
