'use client';
import { useEffect } from 'react';
import { loadSettings } from '@/lib/storage';
import { applyPalette } from '@/lib/ui-rules';

/** Applies the saved colour palette (R41) on every page. */
export function PaletteBoot() {
  useEffect(() => {
    applyPalette(loadSettings().palette);
  }, []);
  return null;
}
