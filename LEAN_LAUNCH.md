# Launch scope

The current source of truth for customer-facing plan details is
`site/pricing.html`. Setup and project structure are in `README.md`; external
account configuration and live checks are in `PRODUCTION_CHECKLIST.md`.

During beta, Basic is $49.50/month (regularly $99) for one page (up to six sections) and three small updates.
Growth is $99.50/month (regularly $199) for up to five pages and ten small updates, plus the
published SEO and support services. The first payment is collected at checkout.
Both plans include two pre-launch revision rounds. First drafts are due within
three business days after the required content is received.

Only `site/` is public. Legacy accounts, dashboards, AI proxies, old pricing,
and duplicate builds are archived and excluded from deployment. The internal
Python research dashboard is separate from the customer-facing website.
