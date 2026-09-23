# Client portal and Edge Landings email

## Workflow

1. A prospect chooses Basic or Growth and completes `/start-project.html` before payment.
2. The intake creates a Supabase `client_projects` record, a page-and-section diagram, and a private client portal link.
3. The owner receives a `[New Build]` email and signs in at `/admin.html` through a 15-minute email link.
4. The owner updates section progress, adds the HTTPS draft URL, and marks the project `draft_ready`.
5. The client reviews the draft and submits requests against an actual page and section. These appear in the owner's **Updates** queue and trigger an `[Update]` email.
6. After the client approves the draft, Stripe checkout becomes available. A verified payment changes the project to `active`.
7. Ongoing requests continue through the same section diagram and communication thread.

## Use the Edge Landings mailbox

Keep IONOS as the mailbox provider so incoming mail continues to arrive at `info@edgelandings.com`. Configure:

```text
OWNER_EMAIL=info@edgelandings.com
EMAIL_FROM=Edge Landings <info@edgelandings.com>
EMAIL_API_KEY=<Resend API key>
OWNER_PORTAL_SECRET=<long random secret>
```

Verify the sending address or domain in Resend by adding only the DKIM/SPF records Resend provides. Do not remove the IONOS MX records; those keep incoming mail working. Set `reply_to` to `OWNER_EMAIL`, which the application already does for client notifications.

The mailbox is the notification layer:

- `[New Build]` subjects identify new free-draft requests.
- `[Update]` subjects identify section changes and ongoing requests.
- Owner sign-in links are sent only to `OWNER_EMAIL`.

The portal is the source of truth for messages, section status, and requests. A normal email reply stays in IONOS and is not automatically copied into the portal; reply from the owner portal when the communication needs to remain attached to the project.

## Supabase

Run the complete `service-catalog.sql` in the Supabase SQL editor after deploying this version. The service-role key is used only on the server. Row-level security is enabled and the browser never receives the key.

## Security model

- Client access uses a 256-bit random link token; only its SHA-256 hash is stored.
- Owner access uses an emailed, signed link that expires after 15 minutes and creates an HTTP-only, same-site eight-hour session.
- Owner mutations require the authenticated cookie and a same-origin request header.
- Public pages are excluded from search indexing where they contain portal or owner UI.
