// Northwind Rentals: a tenant portal that sends leases with PenlyDoc and lets tenants sign inside the portal.
// Follows https://penlydoc.com/docs/embed step by step. Data lives in memory + data/ (it is a demo).
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const PORT = Number(process.env.PORT || new URL(cfg.siteUrl).port || 3000);
const leases = new Map();        // leaseId -> lease
const seenEvents = new Set();    // Penly-Event-Id, deliveries can repeat
const webhookLog = [];
const app = express();

// The API key never leaves this server.
async function penly(method, path, body, extraHeaders = {}) {
  const res = await fetch(cfg.penlyUrl + path, {
    method,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.detail || res.statusText), { status: res.status, code: err.code });
  }
  return res.headers.get('content-type')?.includes('json') ? res.json() : Buffer.from(await res.arrayBuffer());
}

// The demo "login": the person picked at the top of the page. A real app uses its own session.
function currentUser(req) {
  return (req.get('X-Demo-User') || '').toLowerCase();
}

// Step 4 of the guide: one envelope per lease, the tenant signs embedded, the landlord by e-mail.
app.post('/api/leases', express.json(), async (req, res) => {
  const { name, email, address, rent, startDate, language, landlordEmail } = req.body || {};
  const id = 'lease-' + crypto.randomBytes(3).toString('hex');
  try {
    const env = await penly('POST', `/v1/templates/${cfg.templateId}/envelopes`, {
      send: true, externalRef: id, metadata: { portal: 'northwind-demo' },
      roles: {
        tenant: { name, email, delivery: 'EMBEDDED', language: language || 'en' },
        landlord: { name: 'Northwind Rentals Ltd.', email: landlordEmail || 'landlord@northwind.example' }
      },
      data: { Address: address, Rent: rent, StartDate: startDate }
    }, { 'Idempotency-Key': id });
    const tenant = env.recipients.find(r => r.email.toLowerCase() === email.toLowerCase());
    leases.set(id, { id, name, email: email.toLowerCase(), address, rent, startDate, envelopeId: env.id,
      recipientId: tenant.id, status: 'waiting for tenant', events: [], hasPdf: false });
    res.status(201).json(leases.get(id));
  } catch (e) {
    res.status(e.status === 400 ? 400 : 502).json({ code: e.code, detail: e.message });
  }
});

app.get('/api/leases', (req, res) => res.json([...leases.values()].reverse()));
app.get('/api/leases/:id', (req, res) => leases.has(req.params.id) ? res.json(leases.get(req.params.id)) : res.sendStatus(404));

// Step 5: hand out a fresh signing link, only to the tenant of this lease, never stored.
app.post('/api/leases/:id/sign-link', express.json(), async (req, res) => {
  const lease = leases.get(req.params.id);
  if (!lease) return res.sendStatus(404);
  if (currentUser(req) !== lease.email) return res.status(403).json({ detail: 'This lease belongs to someone else' });
  try {
    const body = req.body?.fullPage ? { returnUrl: `${cfg.siteUrl}/done.html?lease=${lease.id}` } : undefined;
    const link = await penly('POST', `/v1/envelopes/${lease.envelopeId}/recipients/${lease.recipientId}/signing-url`, body);
    res.set('Cache-Control', 'no-store').json({ url: link.url, expiresAt: link.expiresAt });
  } catch (e) {
    res.status(e.status === 409 ? 409 : 502).json({ code: e.code, detail: e.message });
  }
});

app.post('/api/leases/:id/cancel', async (req, res) => {
  const lease = leases.get(req.params.id);
  if (!lease) return res.sendStatus(404);
  await penly('POST', `/v1/envelopes/${lease.envelopeId}/void`, { reason: 'Cancelled in the portal' });
  res.sendStatus(204);
});

app.get('/api/leases/:id/signed.pdf', (req, res) => {
  const file = `data/${req.params.id.replace(/[^\w-]/g, '')}.pdf`;
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.type('application/pdf').send(fs.readFileSync(file));
});

app.get('/api/webhook-log', (req, res) => res.json(webhookLog.slice(-50).reverse()));

// Step 8: the webhook is the only thing that changes a lease's status.
function validSignature(header, rawBody) {
  const { t, v1 } = Object.fromEntries((header || '').split(',').map(p => p.split('=')));
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(`${t}.${rawBody}`).digest('hex');
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

app.post('/webhooks/penly', express.raw({ type: 'application/json' }), async (req, res) => {
  const ok = validSignature(req.get('Penly-Signature'), req.body);
  webhookLog.push({ at: new Date().toISOString(), type: req.get('Penly-Event-Type'), id: req.get('Penly-Event-Id'), signatureOk: ok });
  if (!ok) return res.sendStatus(401);
  const event = JSON.parse(req.body);
  if (seenEvents.has(event.id)) return res.sendStatus(204);
  seenEvents.add(event.id);
  res.sendStatus(204);                                     // answer fast, work after

  const lease = leases.get(event.data?.externalRef);
  if (!lease) return;
  lease.events.push({ at: event.createdAt, type: event.type, who: event.data.recipient?.email });
  const who = event.data.recipient?.email === lease.email ? 'tenant' : 'landlord';
  switch (event.type) {
    case 'recipient.completed': lease.status = who === 'tenant' ? 'waiting for landlord' : lease.status; break;
    case 'recipient.declined': lease.status = `declined by ${who}: ${event.data.recipient.declineReason || ''}`.trim(); break;
    case 'envelope.voided': lease.status = 'cancelled'; break;
    case 'envelope.expired': lease.status = 'expired'; break;
    case 'envelope.completed': {
      const pdf = await penly('GET', `/v1/envelopes/${event.data.envelopeId}/documents/signed`);
      fs.writeFileSync(`data/${lease.id}.pdf`, pdf);
      lease.hasPdf = true;
      lease.sha256 = crypto.createHash('sha256').update(pdf).digest('hex');
      lease.status = 'signed';
      break;
    }
  }
});

// embed.js must come from PenlyDoc itself (it checks that links point there), so the page loads it from the configured address.
app.get('/', (req, res) => res.type('html').send(fs.readFileSync('public/index.html', 'utf8')
  .replace('PENLY_URL/embed.js', cfg.penlyUrl + '/embed.js')));
app.use(express.static('public'));
app.listen(PORT, () => console.log(`Northwind Rentals on ${cfg.siteUrl}`));
