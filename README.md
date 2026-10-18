# PenlyDoc examples

Working examples for [PenlyDoc](https://penlydoc.com), an e-signature service from the EU with a REST API, an embeddable
signing page and HMAC-signed webhooks. Free during early access, embedding included.

| Folder | What it shows |
|---|---|
| [`northwind-portal`](northwind-portal) | A complete Node.js tenant portal: template with roles and data, the tenant signs inside the portal, the landlord by e-mail, webhooks, full-page mode, signed PDF saved automatically |
| [`python-flask`](python-flask) | Send from a template, hand out signing links, verify webhooks, keep the signed PDF |
| [`php`](php) | Signing link endpoint and webhook handler in plain PHP |
| [`react`](react), [`vue`](vue) | A `SignContract` component for each |
| [`html`](html) | The smallest page that shows the signing frame |
| [`packages/penlydoc-embed`](packages/penlydoc-embed) | npm package: loads `embed.js` and mounts the frame, with TypeScript types |

For AI assistants there is a Model Context Protocol server: [penlydoc-mcp](https://github.com/OrestKlymko/penlydoc-mcp).

## The flow in four calls

```bash
# 1. Allow your website to show the signing page (once)
curl -X PUT https://penlydoc.com/v1/branding -H "Authorization: Bearer $PENLY_API_KEY" \
  -H "Content-Type: application/json" -d '{"embedOrigins": ["https://app.example.com"]}'

# 2. Create the document from a template; the customer signs inside your app
curl -X POST https://penlydoc.com/v1/templates/$TEMPLATE_ID/envelopes -H "Authorization: Bearer $PENLY_API_KEY" \
  -H "Content-Type: application/json" -H "Idempotency-Key: contract-42" \
  -d '{"send": true, "externalRef": "contract-42",
       "roles": {"customer": {"name": "Mia Novak", "email": "mia@example.com", "delivery": "EMBEDDED"}},
       "data": {"Price": "950 EUR"}}'

# 3. When the customer opens the page, your backend asks for a one-hour link and your page mounts it with embed.js
curl -X POST https://penlydoc.com/v1/envelopes/$ENVELOPE_ID/recipients/$RECIPIENT_ID/signing-url \
  -H "Authorization: Bearer $PENLY_API_KEY"

# 4. PenlyDoc calls your webhook on every step; on envelope.completed download the sealed PDF
curl https://penlydoc.com/v1/envelopes/$ENVELOPE_ID/documents/signed -H "Authorization: Bearer $PENLY_API_KEY" -o signed.pdf
```

Docs: [developer guide](https://penlydoc.com/docs), [embedding A to Z](https://penlydoc.com/docs/embed),
[API reference](https://penlydoc.com/swagger-ui.html).

Every example uses placeholder names and addresses. Keep your API key and webhook secret on your server only.

MIT licensed.
