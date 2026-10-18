// React: show the PenlyDoc signing page for one contract.  npm install penlydoc-embed
import { useEffect, useRef } from 'react';
import { mount } from 'penlydoc-embed';

export function SignContract({ contractId, onSigned, onDeclined }) {
  const box = useRef(null);

  useEffect(() => {
    let signing, cancelled = false;
    (async () => {
      // your backend checks the logged-in user and asks PenlyDoc for a fresh one-hour link
      const res = await fetch(`/api/contracts/${contractId}/sign-link`, { method: 'POST' });
      const { url } = await res.json();
      if (cancelled) return;
      signing = await mount(box.current, {
        url, height: '80vh', hideHeader: true,
        onCompleted: e => onSigned?.(e.envelopeStatus),   // screen only: the webhook is the source of truth
        onDeclined: () => onDeclined?.()
      });
      if (cancelled) signing.destroy();
    })();
    return () => { cancelled = true; signing?.destroy(); };
  }, [contractId]);

  return <div ref={box} />;
}
