// Domain colours, icons and codes (DESIGN.md §1, R33). Icons are the 24-unit stroke paths from Main.dc.html.

import type { Age, Domain } from '@doorway/engine';

export const ICONS: Record<Domain, string> = {
  pink: 'M12 20.5s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4z',
  gold: 'M5 5h8.5L16 7.5 13.5 10H5zM9.5 10v10',
  green: 'M12 2.5l6 7.5-6 8-6-8zM12 18c0 2-2.5 2-2.5 3.5',
  orange: 'M3.5 11.5L12 4.5l8.5 7M6 10v10h12V10M10 20v-5h4v5',
  purple: 'M12 3l2.5 5.4 5.9.6-4.4 4 1.3 5.8L12 15.9l-5.3 2.9L8 13l-4.4-4 5.9-.6z',
};

export const UI_ICONS = {
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  door: 'M6 21V10a6 6 0 0 1 12 0v11M3 21h18M14.5 14.5h.01',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  help: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5h.01',
};

export const DOMAIN: Record<Domain, { name: string; code: string; icon: string; css: string }> = {
  pink: { name: 'Love', code: 'Lv', icon: 'heart', css: 'var(--love)' },
  gold: { name: 'Work', code: 'Wk', icon: 'hammer', css: 'var(--work)' },
  green: { name: 'Play', code: 'Pl', icon: 'kite', css: 'var(--play)' },
  orange: { name: 'Family', code: 'Fm', icon: 'house', css: 'var(--family)' },
  purple: { name: 'Wonder', code: 'Wd', icon: 'star', css: 'var(--wonder)' },
};

export const DOMAIN_ORDER: Domain[] = ['pink', 'gold', 'green', 'orange', 'purple'];

export const PALETTES = {
  standard: { pink: '#EBA6B0', gold: '#E6B84F', green: '#8DB884', orange: '#D9733F', purple: '#A097D6' },
  colorblind: { pink: '#CC79A7', gold: '#F0E442', green: '#009E73', orange: '#E69F00', purple: '#56B4E9' },
} as const;

export const AGE_NAME: Record<Age, string> = { young: 'Young', middle: 'Middle', old: 'Old' };
export const AGE_BG: Record<Age, string> = {
  young: 'var(--young)',
  middle: 'var(--middle)',
  old: 'var(--old)',
};
export const AGE_RULE: Record<Age, string> = {
  young: 'var(--young-rule)',
  middle: 'var(--middle-rule)',
  old: 'var(--old-rule)',
};
