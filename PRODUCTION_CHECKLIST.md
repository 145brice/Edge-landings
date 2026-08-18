# Edge Landings production checklist

Complete these dashboard tasks after the code is deployed. Never paste secret values into source files.

## 1. Create the catalog tables in Supabase

1. Sign in to Supabase and open the Edge Landings project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Open `service-catalog.sql` from this repository and copy its entire contents.
5. Paste it into the query editor.
6. Click **Run**.
7. In the left sidebar, click **Table Editor** and confirm these tables exist: `service_catalog`, `market_baselines`, `estimate_events`, and `completed_jobs`.
8. Open `service_catalog` and confirm the `Website Care` row exists.

## 2. Configure Stripe

1. Sign in to Stripe and turn on **Test mode**.
2. Click **Product catalog**, then **Add product**.
3. Name it `Edge Landings Website Care`.
4. Set pricing to **Recurring**, **Monthly**, and **$199 USD**, then save.
5. Open the new price and copy its `price_...` ID.
6. Click **Developers**, then **Webhooks**, then **Add endpoint**.
7. Enter `https://edge-landings.vercel.app/api/webhook`.
8. Select `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`, then create the endpoint.
9. Open the endpoint, reveal its signing secret, and copy the `whsec_...` value.

## 3. Verify the sending domain in Resend

1. Sign in to Resend.
2. Click **Domains**, then **Add domain**.
3. Enter the domain used in `EMAIL_FROM`.
4. Add each DNS record shown by Resend at your DNS provider.
5. Return to Resend and click **Verify** until the domain shows **Verified**.
6. Click **API Keys**, create a production sending key, and copy it once.

## 4. Add production variables in Vercel

1. Sign in to Vercel and open the `edge-landings` project.
2. Click **Settings**, then **Environment Variables**.
3. Add each variable below to **Production**:
   - `APP_URL` = `https://edge-landings.vercel.app`
   - `STRIPE_SECRET_KEY` = the Stripe test secret for the test pass, then the live secret at launch
   - `STRIPE_WEBHOOK_SECRET` = the endpoint `whsec_...` value
   - `EMAIL_API_KEY` = the Resend production key
   - `EMAIL_FROM` = a sender on the verified domain
   - `OWNER_EMAIL` = the inbox that should receive onboarding details
   - `SUPABASE_URL` = Supabase **Project URL**
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service-role secret
   - `ESTIMATOR_WEBHOOK_SECRET` = a unique random value of at least 32 characters
   - `CRON_SECRET` = a different unique random value of at least 32 characters
   - `STRIPE_PRICE_MAP` = `{"website-care":"price_your_actual_id"}`
4. Click **Save** after each entry.
5. Open **Deployments**, select the newest deployment, click the three-dot menu, and click **Redeploy**.

## 5. Run the launch test

1. Open `https://edge-landings.vercel.app/api/health` and confirm `status` is `ok`, `catalog` is `true`, and `scheduledBaselines` is `true`.
2. Open the pricing page and click **Start for $199/month**.
3. In Stripe test mode, use card `4242 4242 4242 4242`, any future expiration, and any CVC.
4. Complete the onboarding form.
5. Confirm the owner and customer emails arrive once.
6. In Stripe, confirm the Checkout Session contains `onboarding_status=complete` metadata.
7. In Vercel, click **Logs** and confirm there are no errors for the checkout, onboarding, or webhook requests.
8. Repeat steps 2-7 with Stripe live keys and a real low-risk payment before announcing the service.
