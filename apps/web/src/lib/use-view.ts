'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_VIEW, otherView, readStoredView, resolveView, storeView, type View } from './view';

/**
 * The current view. Setting it updates <html data-view>, the ?view= URL parameter (replaceState, so the
 * page — and the game — never reloads) and localStorage. Every useView() instance stays in sync through a
 * window event. Pass { keyboard: true } in exactly one place per page (the switch) to bind the V key.
 */
const VIEW_EVENT = 'doorway:view';
export function useView(opts: { forced?: View; keyboard?: boolean } = {}): [View, (v: View) => void] {
  const [view, setViewState] = useState<View>(opts.forced ?? DEFAULT_VIEW);
  useEffect(() => {
    const v = opts.forced ?? resolveView(window.location.search, readStoredView());
    setViewState(v);
    document.documentElement.dataset.view = v;
    const sync = (e: Event) => setViewState((e as CustomEvent<View>).detail);
    window.addEventListener(VIEW_EVENT, sync);
    return () => window.removeEventListener(VIEW_EVENT, sync);
  }, [opts.forced]);
  const setView = useCallback(
    (v: View) => {
      if (opts.forced) return;
      setViewState(v);
      document.documentElement.dataset.view = v;
      storeView(v);
      const u = new URL(window.location.href);
      u.searchParams.set('view', v);
      window.history.replaceState(window.history.state, '', u.toString());
      window.dispatchEvent(new CustomEvent<View>(VIEW_EVENT, { detail: v }));
    },
    [opts.forced],
  );
  useEffect(() => {
    if (!opts.keyboard || opts.forced) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        const cur = (document.documentElement.dataset.view as View) ?? DEFAULT_VIEW;
        setView(otherView(cur));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts.keyboard, opts.forced, setView]);
  return [view, setView];
}
