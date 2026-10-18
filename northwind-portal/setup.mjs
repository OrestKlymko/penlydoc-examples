// One-time setup for the demo, the same steps you do in the PenlyDoc console:
//   1. an organisation and an API key      (sign up at penlydoc.com, Console → Developers)
//   2. your website in the embed list       (Console → Settings → Websites allowed to show the signing page)
//   3. the webhook URL                      (Console → Settings → Webhook)
//   4. a lease template with roles and data (Console → Templates → New template)
// Writes data/config.json. Run:  PENLY_API_KEY=sk_… SITE_URL=https://your-tunnel.example node setup.mjs
import fs from 'node:fs';

const PENLY = process.env.PENLY_URL || 'https://penlydoc.com';
const SITE = process.env.SITE_URL || 'http://localhost:3000';
const ADMIN = process.env.PENLY_ADMIN_TOKEN;
let KEY = process.env.PENLY_API_KEY;

async function call(method, path, body, headers = {}) {
  const init = { method, headers: { ...headers } };
  if (KEY) init.headers.Authorization = 'Bearer ' + KEY;
  if (body instanceof FormData) init.body = body;
  else if (body) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
  const res = await fetch(PENLY + path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.code || ''} ${data.detail || ''}`);
  return data;
}

// A plain one-page lease with PenlyDoc tags: {{sig:1}} = first role signs here, {{data:Rent}} = value sent per lease.
function leasePdf() {
  const lines = [
    [18, 72, 730, 'Residential lease agreement'],
    [11, 72, 700, 'Landlord: Northwind Rentals Ltd., 12 Harbour Road, Riverton'],
    [11, 72, 682, 'Property: {{data:Address}}'],
    [11, 72, 664, 'Monthly rent: {{data:Rent}}'],
    [11, 72, 646, 'Lease starts on: {{data:StartDate}}'],
    [11, 72, 610, '1. The tenant pays the rent by the 5th day of each month.'],
    [11, 72, 592, '2. Either party may end the lease with two months written notice.'],
    [11, 72, 574, '3. The deposit equals one monthly rent and is returned within 30 days.'],
    [12, 72, 530, 'Tenant'],
    [11, 72, 470, '{{sig:1}}'],
    [10, 72, 420, 'Name: {{name:1}}'],
    [10, 72, 396, 'Date: {{date:1}}'],
    [12, 330, 530, 'Landlord'],
    [11, 330, 470, '{{sig:2}}'],
    [10, 330, 420, 'Name: {{name:2}}'],
    [10, 330, 396, 'Date: {{date:2}}'],
  ];
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m);
  const content = lines.map(([size, x, y, t]) => `BT /F1 ${size} Tf ${x} ${y} Td (${esc(t)}) Tj ET`).join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

if (!KEY) {
  if (!ADMIN) throw new Error('Set PENLY_API_KEY (from Console → Developers). PENLY_ADMIN_TOKEN is only for a self-hosted PenlyDoc.');
  const org = await call('POST', '/admin/tenants', { name: 'Northwind Rentals' }, { 'X-Admin-Token': ADMIN });
  KEY = org.apiKey;
}
await call('PUT', '/v1/branding', { brandName: 'Northwind Rentals', accentColor: '#0f766e', defaultLanguage: 'en',
  embedOrigins: [new URL(SITE).origin] });
const hook = await call('PUT', '/v1/webhook', { url: SITE + '/webhooks/penly' });

const form = new FormData();
form.append('template', new Blob([JSON.stringify({
  name: 'Residential lease', title: 'Lease agreement', signingOrder: 'SEQUENTIAL', reminderEveryHours: 0,
  message: 'Please review and sign your lease.',
  roles: [{ key: 'tenant', label: 'Tenant', delivery: 'EMBEDDED' }, { key: 'landlord', label: 'Landlord' }]
})], { type: 'application/json' }));
form.append('documents', new Blob([leasePdf()], { type: 'application/pdf' }), 'lease.pdf');
const template = await call('POST', '/v1/templates', form);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/config.json', JSON.stringify({ penlyUrl: PENLY, siteUrl: SITE, apiKey: KEY,
  webhookSecret: hook.secret, templateId: template.id }, null, 2), { mode: 0o600 });
console.log('Template', template.id, 'ready:', template.ready, 'data keys:', template.dataKeys.join(', '));
console.log('Saved data/config.json. Now: npm start');
