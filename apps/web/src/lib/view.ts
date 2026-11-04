// Board / Analyst view switch (DESIGN-v2 §1): ?view= in the URL, then localStorage, default Board.
// The choice is per browser (hot-seat players share it). /designer always renders in Analyst style.

export type View = 'board' | 'analyst';
export const VIEW_KEY = 'doorway.view.v2';
export const DEFAULT_VIEW: View = 'board';

export const isView = (v: unknown): v is View => v === 'board' || v === 'analyst';

/** Resolve the view from a URL search string and a stored value. */
export function resolveView(search: string, stored: string | null): View {
  const q = new URLSearchParams(search).get('view');
  if (isView(q)) return q;
  if (isView(stored)) return stored;
  return DEFAULT_VIEW;
}

export const otherView = (v: View): View => (v === 'board' ? 'analyst' : 'board');

/** Inline script for <head>: applies the view before React hydrates (no flash). A ?view= link is remembered. */
export const VIEW_BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get('view');var s=null;try{s=localStorage.getItem('${VIEW_KEY}')}catch(e){}var v=(q==='board'||q==='analyst')?q:((s==='board'||s==='analyst')?s:'${DEFAULT_VIEW}');if(location.pathname.indexOf('/designer')===0)v='analyst';else if(q===v){try{localStorage.setItem('${VIEW_KEY}',v)}catch(e){}}document.documentElement.setAttribute('data-view',v);}catch(e){}})();`;

export function readStoredView(): string | null {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

export function storeView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* storage unavailable */
  }
}
