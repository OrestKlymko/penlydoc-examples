export type PenlyLanguage = 'en' | 'sk' | 'cs' | 'uk' | 'fr';

export type PenlyEvent =
  | { source: 'penly'; type: 'ready'; status: string }
  | { source: 'penly'; type: 'completed'; envelopeStatus: 'PARTIALLY_SIGNED' | 'COMPLETED' }
  | { source: 'penly'; type: 'declined'; envelopeStatus: 'DECLINED' }
  | { source: 'penly'; type: 'error'; code: string };

export interface PenlyMountOptions {
  /** The signing link from your backend: POST /v1/envelopes/{id}/recipients/{rid}/signing-url */
  url: string;
  language?: PenlyLanguage;
  /** Any CSS length, default 80vh */
  height?: string;
  hideHeader?: boolean;
  hideLanguagePicker?: boolean;
  /** #rrggbb, for this embed only */
  accentColor?: string;
  /** Frame title for screen readers */
  title?: string;
  onReady?: (e: Extract<PenlyEvent, { type: 'ready' }>) => void;
  onCompleted?: (e: Extract<PenlyEvent, { type: 'completed' }>) => void;
  onDeclined?: (e: Extract<PenlyEvent, { type: 'declined' }>) => void;
  onError?: (e: Extract<PenlyEvent, { type: 'error' }>) => void;
  onEvent?: (e: PenlyEvent) => void;
}

export interface PenlySigning {
  iframe: HTMLIFrameElement;
  setHeight(css: string): void;
  destroy(): void;
}

export interface PenlyGlobal {
  mount(target: string | Element, options: PenlyMountOptions): PenlySigning;
  version: string;
}

/** Loads embed.js from the PenlyDoc address (default https://penlydoc.com) and resolves with window.Penly. */
export function loadPenly(baseUrl?: string): Promise<PenlyGlobal>;

/** Loads embed.js if needed and mounts the signing page into target. */
export function mount(target: string | Element, options: PenlyMountOptions): Promise<PenlySigning>;

declare global {
  interface Window { Penly?: PenlyGlobal }
}
