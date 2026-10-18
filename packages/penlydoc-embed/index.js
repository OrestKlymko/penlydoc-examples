// Loads https://penlydoc.com/embed.js once (it must come from PenlyDoc: it accepts links and events only from there)
// and mounts the signing page. Guide: https://penlydoc.com/docs/embed
const loading = new Map();

/** Loads embed.js from the PenlyDoc address and resolves with window.Penly. */
export function loadPenly(baseUrl = 'https://penlydoc.com') {
  if (typeof window === 'undefined') return Promise.reject(new Error('penlydoc-embed runs in the browser'));
  const origin = new URL(baseUrl).origin;
  if (window.Penly && loading.has(origin)) return loading.get(origin);
  if (!loading.has(origin)) {
    loading.set(origin, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = origin + '/embed.js';
      s.async = true;
      s.onload = () => (window.Penly ? resolve(window.Penly) : reject(new Error('PenlyDoc embed.js did not load')));
      s.onerror = () => { loading.delete(origin); reject(new Error('Could not load ' + s.src)); };
      document.head.append(s);
    }));
  }
  return loading.get(origin);
}

/** Mounts the signing page into target (selector or element). The link comes from your backend (signing-url). */
export async function mount(target, options) {
  if (!options || !options.url) throw new Error('PenlyDoc: url is required (ask your backend for /signing-url)');
  const Penly = await loadPenly(new URL(options.url).origin);
  return Penly.mount(target, options);
}
