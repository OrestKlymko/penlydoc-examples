# Northwind Rentals: a tenant portal with embedded signing

A small Node.js portal that does everything from the [embedding guide](https://penlydoc.com/docs/embed):
a template with roles and data, the tenant signing inside the portal, the landlord signing by e-mail, browser
events, webhooks checked with HMAC, full-page mode with a return address, cancelling, and the signed PDF
downloaded automatically when everyone has signed.

## Run it

You need Node.js 18 or newer and a free PenlyDoc organisation with an API key (Console → Developers).
PenlyDoc must reach your webhook, so expose port 3000 with any HTTPS tunnel and use that address as `SITE_URL`.

```bash
npm install
PENLY_API_KEY=sk_… SITE_URL=https://your-tunnel.example npm run setup
npm start            # open the SITE_URL (or http://localhost:3000)
```

`setup.mjs` sets your branding and the allowed website, the webhook URL, and uploads the lease template.
Everything it needs later is written to `data/config.json` (git-ignored, keep it private: it holds your API key and
webhook secret). Use a test organisation: setup changes its branding and webhook.

Against a self-hosted PenlyDoc, add `PENLY_URL=http://localhost:8090`.

## What to try

| Step | What happens |
|---|---|
| Send lease | One envelope per lease, `externalRef` = lease ID, `Idempotency-Key` on the request. |
| Sign here | The portal asks its own backend for a 1-hour link and mounts it with `embed.js`. Options above the frame change the look. |
| Sign on a full page | The link carries a `returnUrl`; after signing the person lands on `done.html?penly_event=…`. |
| Landlord e-mail | The landlord gets an e-mail and signs; the portal downloads the sealed PDF on `envelope.completed`. |
| Decline / Cancel | The status comes from `recipient.declined` / `envelope.voided` webhooks, not from the browser. |
| "Signed in as" | Change it to someone else: the portal refuses to hand out that lease's link (`403`). |

The demo keeps leases in memory; restart = empty list. A real portal stores the envelope and recipient IDs next to
its own record (see section 4 of the guide).
