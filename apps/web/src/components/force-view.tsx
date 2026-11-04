'use client';
import { useEffect } from 'react';
import type { View } from '@/lib/view';

/** Pins <html data-view> for routes that have a single style (/designer → Analyst). Not persisted. */
export function ForceView({ view }: { view: View }) {
  useEffect(() => {
    const prev = document.documentElement.dataset.view;
    document.documentElement.dataset.view = view;
    return () => {
      if (prev) document.documentElement.dataset.view = prev;
    };
  }, [view]);
  return null;
}
