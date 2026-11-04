// /designer renders the study charts built by @doorway/sim (v1 dark palette) on the Analyst sheet.
// The sim package and reports/ stay untouched; the designer maps the v1 colours to Analyst ones here.

import { COLORS as C } from '@doorway/sim/model';

/** v1 report colour → Analyst colour (DESIGN-v2 §4). */
export const ANALYST_FOR: Record<string, string> = {
  [C.ink]: '#FBF9F4',
  [C.surface]: '#FBF9F4',
  [C.surface2]: '#EFE9DC',
  [C.sunk]: '#F4F0E6',
  [C.line]: '#CFC6B3',
  [C.lineSoft]: '#E2DACA',
  [C.text]: '#23202A',
  [C.muted]: '#6B6475',
  [C.door]: '#23202A',
  [C.alert]: '#B4443A',
  [C.fullLife]: '#4F7290',
  [C.passion]: '#B4443A',
  [C.reflection]: '#9A7A4A',
  [C.blue]: '#4F7290',
  [C.orange]: '#C0602F',
  [C.grey]: '#B9AE9A',
};

/** Replace every v1 colour in a sim SVG/HTML string with its Analyst equivalent. */
export function analystSvg(svg: string): string {
  let out = svg;
  for (const [from, to] of Object.entries(ANALYST_FOR))
    out = out.split(from).join(to).split(from.toLowerCase()).join(to);
  return out;
}

/** One colour of the analyst palette by v1 key (for inline styles in the designer). */
export const ac = (v1: string) => ANALYST_FOR[v1] ?? v1;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Diverging cell on the light sheet: panel → orange (row wins more) or → blue (row loses more). */
export function lightDiverging(v: number, mid: number, span: number) {
  let t = Math.min(1, Math.abs(v - mid) / span);
  const from = hex('#FBF9F4');
  const to = hex(v >= mid ? '#9E4A1C' : '#3D5D78');
  const ink = hex('#23202A');
  const paper = hex('#FBF9F4');
  const mix = (k: number) => from.map((f, i) => Math.round(f + (to[i] - f) * k));
  // nudge mid-strength cells until one text colour clears 4.5:1 (as the v1 report does)
  while (t < 1 && Math.max(contrast(mix(t), ink), contrast(mix(t), paper)) < 4.5) t = Math.min(1, t + 0.05);
  const rgb = mix(t);
  const fg = contrast(rgb, ink) >= contrast(rgb, paper) ? '#23202A' : '#FBF9F4';
  return { bg: `rgb(${rgb.join(',')})`, fg };
}
