# Edge Landings

The umbrella brand for websites and business tools. The root homepage is a
project hub; `site/websites.html` holds the website-service homepage and is
served at the root of `websites.edgelandings.com` once connected to Vercel.
See `docs/domain-setup.md` for the remaining DNS and application setup.

The beta website offer is Basic
at $49/month (regularly $99) and Growth at $99/month (regularly $199). Customers pay at checkout, complete
onboarding, review a draft, and approve launch.

## Current scope

- Basic: one page, up to six sections, three small updates per billing month.
- Growth: up to five pages, ten small updates, ongoing SEO and priority support.
- Both: hosting, mobile-friendly design, an inquiry form, two pre-launch revision
  rounds, and a first draft within three business days of receiving the content.
- The full scope, exclusions, billing, and cancellation process are published in
  `site/pricing.html`. Concept demos are labeled and do not send inquiries.

## Run locally

Use Node.js 20.6 or later. Install with `npm install`, copy `.env.example` to
`.env`, fill in your configuration, then run:

```sh
node --env-file=.env server.js
```

`npm start` uses environment variables already provided by your shell or host.
`npm test` runs the JavaScript suite. The static pages work without external
credentials; checkout, onboarding, and contact delivery require configuration.

## Structure

- `site/`: the only browser-served directory; pages, demos, CSS, and browser JS.
- `server.js`: Express app, checkout, onboarding, contact, and website audit.
- `api/`: Stripe signature handler and authenticated internal catalog endpoint.
- `lib/`: email formatting, website audits, catalog, and estimation logic.
- `test/`: JavaScript tests, including the public-file security boundary.
- `service-catalog.sql`: current Supabase catalog schema and plan seed data.
- `lead_scraper/`, `dashboard.py`, `templates/`, `scripts/`, `tests/`: separate
  internal Python lead-research tools. See `lead_scraper/README.md`.
- `archive/`: recoverable legacy pages, account code, builds, and documentation.
  Excluded from deployment and never publicly served.

## Configuration

Use `.env.example` for the complete variable list. Checkout needs `APP_URL`,
`STRIPE_SECRET_KEY`, and `STRIPE_PRICE_MAP`. Onboarding and contact use
`EMAIL_API_KEY`, `EMAIL_FROM`, and `OWNER_EMAIL`. Configure the Stripe webhook
with `STRIPE_WEBHOOK_SECRET`. Catalog storage uses `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Internal catalog jobs require
`ESTIMATOR_WEBHOOK_SECRET` and `CRON_SECRET`.

The obsolete Google Sheets account integration has been retired. Website clients
complete a pre-payment build brief and receive a private tokenized portal. The
owner uses an email-link login at `/admin.html`; new builds and updates are kept
in separate queues. Email sends notifications while the portal remains the
project record. See `docs/client-portal.md` for setup and workflow details.

## Public routes

- `POST /api/create-project-checkout-session`: creates checkout only for an approved portal draft.
- `POST /api/confirm-project-payment`: verifies an approved project's completed Stripe checkout.
- `POST /api/contact`: sends a validated inquiry to the owner.
- `POST /api/project-intake`: creates a no-payment project and private client portal.
- `GET /api/client-project`: loads a token-authorized project, structure, requests, and messages.
- `POST /api/change-request`: attaches a client request to an actual built section.
- `/api/admin/*`: email-link owner login and authenticated build/update management.
- `POST /api/site-audit`: audits a public website URL.
- `POST /api/webhook`: verifies Stripe signatures over the original request body.
- `GET /api/health`: configuration readiness, not an external-service health test.
- `/api/catalog-webhook`: authenticated internal estimates and scheduled refresh.

Vercel routes all requests through Express so HTML receives the same security
headers and static-file boundary. The build explicitly includes `site/**`.
See `PRODUCTION_CHECKLIST.md` for configuration and a live checkout/email test.

Contact and audit rate limits are per-process safeguards. A distributed rate
limiter is needed if sustained abuse or multi-instance traffic warrants it.
Live payment, email delivery, and third-party account access must be verified
in the configured environment; passing local tests does not establish these.
