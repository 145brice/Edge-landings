# Edge Landings lean-launch configuration

This launch sells two month-to-month offers: **Basic at $99/month** and **Growth at $199/month**. Each creates the matching Stripe Checkout subscription, then collects onboarding on `success.html`.

Legacy account, dashboard, and AI-assistant endpoints are postponed and disabled from the public lean-launch funnel. Do not direct customers to those legacy pages.

## Required environment variables

Set these in the deployment environment (and in a local `.env` file if you use one):

- `APP_URL` — the canonical HTTPS site URL, without a trailing slash (for example, `https://example.com`).
- `STRIPE_SECRET_KEY` — Stripe secret API key.
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (`whsec_...`).
- `EMAIL_API_KEY` — Resend API key.
- `EMAIL_FROM` — a Resend-verified sender, such as `Edge Landings <onboarding@example.com>`.
- `OWNER_EMAIL` — inbox that receives each completed onboarding form.

Optional:

- `GOOGLE_SCRIPT_URL` — Apps Script endpoint that receives an `addOnboarding` JSON record. If set, a failed Sheets delivery makes the form report an error rather than claim success.

## Stripe setup

1. Create recurring monthly Stripe Prices for **Basic at $99 USD** and **Growth at $199 USD**. Map both Price IDs with `STRIPE_PRICE_MAP`; checkout reads the synchronized catalog records.
2. Create a webhook endpoint at `https://YOUR_DOMAIN/api/webhook`.
3. Subscribe it to at least `checkout.session.completed`. `customer.subscription.updated` and `customer.subscription.deleted` are useful if subscription status will later be tracked.
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

The webhook uses Stripe's official signature verification over the untouched raw request body. Do not place JSON body parsing before that route.

## Launch check

Use Stripe test mode first: pay with a Stripe test card, complete onboarding, and confirm both the owner notification and customer receipt reach their inboxes. Then repeat in live mode before announcing the service.
