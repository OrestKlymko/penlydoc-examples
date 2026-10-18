# penlydoc-embed

Show the [PenlyDoc](https://penlydoc.com) signing page inside your web app. The package loads `embed.js` from PenlyDoc
(so you always get the current version) and mounts the signing frame. TypeScript types included.

```bash
npm install penlydoc-embed
```

```js
import { mount } from 'penlydoc-embed';

// your backend asks PenlyDoc for a one-hour link: POST /v1/envelopes/{id}/recipients/{rid}/signing-url
const { url } = await (await fetch('/api/contracts/lease-2291/sign-link', { method: 'POST' })).json();

const signing = await mount('#sign', {
  url,
  language: 'en',
  height: '80vh',
  hideHeader: true,
  onCompleted: e => showDone(e.envelopeStatus),   // update the screen; your webhook updates the database
  onDeclined: () => showDeclined(),
});
// later: signing.destroy();
```

Your website must be in the organisation's embed list (Console → Settings), otherwise the browser refuses the frame.
The full guide, with backend code and webhooks: [penlydoc.com/docs/embed](https://penlydoc.com/docs/embed).

MIT licensed.
