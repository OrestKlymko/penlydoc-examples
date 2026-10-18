const $ = id => document.getElementById(id);
const me = () => $('me').value.trim().toLowerCase();
const api = async (method, path, body) => {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Demo-User': me() }, body: body && JSON.stringify(body) });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || res.statusText);
  return data;
};
const el = (tag, attrs = {}, ...kids) => { const e = Object.assign(document.createElement(tag), attrs); e.append(...kids.filter(Boolean)); return e; };

let signing = null, current = null;

$('newLease').onsubmit = async ev => {
  ev.preventDefault();
  $('newErr').textContent = '';
  try { await api('POST', '/api/leases', Object.fromEntries(new FormData(ev.target))); refresh(); }
  catch (e) { $('newErr').textContent = e.message; }
};

async function refresh() {
  const leases = await api('GET', '/api/leases');
  $('list').replaceChildren(...leases.map(l => {
    const mine = l.email === me(), open = l.status === 'waiting for tenant';
    return el('tr', {},
      el('td', {}, el('strong', {}, l.id), el('div', { className: 'muted' }, `${l.address} · ${l.rent}`)),
      el('td', {}, l.name, el('div', { className: 'muted' }, l.email)),
      el('td', {}, el('span', { className: 'pill ' + l.status.split(' ')[0] }, l.status)),
      el('td', { className: 'actions' },
        mine && open ? el('button', { className: 'primary', onclick: () => openSign(l) }, 'Sign here') : null,
        mine && open ? el('button', { onclick: () => fullPage(l) }, 'Sign on a full page') : null,
        l.hasPdf ? el('a', { className: 'btn', href: `/api/leases/${l.id}/signed.pdf`, target: '_blank' }, 'Signed PDF') : null,
        l.status.startsWith('waiting') ? el('button', { onclick: async () => { await api('POST', `/api/leases/${l.id}/cancel`); refresh(); } }, 'Cancel') : null));
  }));
  const hooks = await api('GET', '/api/webhook-log');
  $('hooks').replaceChildren(...hooks.map(h => el('li', {}, `${h.at.slice(11, 19)}  ${h.type}  ${h.signatureOk ? '✓ signature' : '✗ BAD signature'}`)));
}

function options() {
  const o = { height: '75vh', hideHeader: $('optHeader').checked, hideLanguagePicker: $('optLangs').checked };
  if ($('optLang').value) o.language = $('optLang').value;
  if ($('optAccentOn').checked) o.accentColor = $('optAccent').value;
  return o;
}

async function openSign(lease) {
  current = lease;
  $('signCard').hidden = false;
  $('signTitle').textContent = `Sign your lease · ${lease.address}`;
  $('signMsg').textContent = '';
  $('events').replaceChildren();
  signing?.destroy();
  try {
    const { url } = await api('POST', `/api/leases/${lease.id}/sign-link`);
    signing = window.Penly.mount('#sign', {
      url, ...options(), title: 'Sign your lease',
      onEvent: e => $('events').prepend(el('li', {}, `${new Date().toTimeString().slice(0, 8)}  ${e.type}  ${JSON.stringify(e)}`)),
      onCompleted: () => waitForWebhook(lease.id),
      onDeclined: () => { $('signMsg').textContent = 'You declined. We will contact you.'; setTimeout(refresh, 1500); }
    });
    $('signCard').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { $('signMsg').textContent = e.message; }
}

// The browser event only updates the screen; the status comes from the webhook.
async function waitForWebhook(id) {
  $('signMsg').textContent = 'Thank you! Confirming your signature…';
  for (let i = 0; i < 20; i++) {
    const l = await api('GET', `/api/leases/${id}`);
    if (l.status !== 'waiting for tenant') { $('signMsg').textContent = `Confirmed by PenlyDoc: ${l.status}.`; refresh(); return; }
    await new Promise(r => setTimeout(r, 1000));
  }
  $('signMsg').textContent = 'Signed. Confirmation is taking longer than usual.';
}

async function fullPage(lease) {
  const { url } = await api('POST', `/api/leases/${lease.id}/sign-link`, { fullPage: true });
  location.assign(url);
}

$('remount').onclick = () => current && openSign(current);
$('close').onclick = () => { signing?.destroy(); signing = null; $('signCard').hidden = true; };
$('me').onchange = refresh;
refresh();
setInterval(refresh, 4000);
