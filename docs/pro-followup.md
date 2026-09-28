# Growth / Pro follow-up system

The Growth / Pro website plan includes one owner approval dashboard for three event types:

1. A new review creates an OpenAI-assisted reply draft.
2. An unanswered Twilio call is logged and creates an urgent SMS draft.
3. A new website lead creates an initial message and a next-day follow-up draft.

No message is posted or sent when an event arrives. The owner can edit, approve, or reject every draft in `/admin.html`. Approving a due SMS or email sends it immediately. Approving a next-day draft early leaves it scheduled. Marking a lead booked, closed, or do-not-contact cancels its unsent drafts. Review replies remain manual: approve, copy, post from the client's review account, then mark posted.

## Per-client setup

Open **Pro follow-up** in the owner dashboard and configure:

- the business name, type, and city used in review drafts;
- the public callback number and HTTPS booking URL;
- the client's Twilio number in E.164 format;
- a verified outbound email address;
- text-first or email-first lead follow-up;
- owner voice notes for review replies.

The project stays inactive until the owner checks **Activate automation intake for this client**.

Configure Twilio's call status callback with the exact canonical URL `https://www.edgelandings.com/api/missed-call`. Twilio signs that request; the server rejects invalid signatures.

The client's form handler or trusted automation sends review and lead events server-to-server. Never put `PRO_AUTOMATION_WEBHOOK_SECRET` in browser JavaScript.

## Event shapes

Send `Authorization: Bearer <PRO_AUTOMATION_WEBHOOK_SECRET>` and JSON.

`POST /api/review-reply`

```json
{
  "projectId": "client-project-uuid",
  "reviewerName": "Jordan",
  "starRating": 5,
  "reviewText": "They completed a clean repair the same day."
}
```

`POST /api/lead-followup`

```json
{
  "projectId": "client-project-uuid",
  "name": "Jordan",
  "phone": "+16155551212",
  "email": "jordan@example.com",
  "source": "website estimate form"
}
```

`POST /api/lead-booked` cancels remaining unsent follow-ups:

```json
{ "leadId": "lead-uuid" }
```

## Provider boundary

Edge Landings stores workflow state in Supabase. OpenAI produces review text drafts. Twilio receives call events and sends approved texts. Resend sends approved email follow-ups. Booking, phone, messaging, email, and model usage remain third-party services and are billed separately from the website plan.

The Vercel Hobby schedule checks approved next-day messages once daily and may run within the scheduled hour. Immediate drafts send when the owner approves them. Precise or more frequent scheduled delivery requires a higher-frequency scheduler.
