// WCAG contrast of the v2 token sets (DESIGN-v2 §3–4), read straight from globals.css.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(__dirname, '../src/app/globals.css'), 'utf8');

/** Custom properties declared in the first block whose selector list starts with `selector`. */
function block(selector: string): Record<string, string> {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`no block ${selector}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const domains = block(':root {\n  --love');
const board = { ...domains, ...block(":root,\n[data-view='board']") };
const analyst = { ...board, ...block("[data-view='analyst'] {") };

function resolve(vars: Record<string, string>, name: string, depth = 0): string {
  const v = vars[name];
  if (!v) throw new Error(`missing ${name}`);
  const m = v.match(/^var\((--[\w-]+)\)$/);
  if (m && depth < 10) return resolve(vars, m[1], depth + 1);
  return v;
}
const rgb = (c: string): number[] => {
  const h = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(h)) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const m = h.match(/^rgba?\(([^)]+)\)$/);
  if (m) return m[1].split(',').map((x) => Number(x.trim()));
  throw new Error(`not a colour: ${c}`);
};
/** Composite an rgba colour over an opaque one. */
const over = (fg: number[], bg: number[]) =>
  fg.length === 4 ? bg.map((b, i) => Math.round(fg[i] * fg[3] + b * (1 - fg[3]))) : fg.slice(0, 3);
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
function check(vars: Record<string, string>, fg: string, bg: string, under?: string) {
  const b = over(rgb(resolve(vars, bg)), under ? rgb(resolve(vars, under)) : [255, 255, 255]);
  return ratio(over(rgb(resolve(vars, fg)), b), b);
}

const TEXT = 4.5;

describe('Board token set (DESIGN-v2 §3)', () => {
  const pairs: [string, string][] = [
    ['--on-felt', '--felt'],
    ['--on-felt', '--felt-2'],
    ['--on-felt-muted', '--felt'],
    ['--on-felt-muted', '--felt-2'],
    ['--ink', '--paper'],
    ['--ink', '--paper-card'],
    ['--ink', '--paper-mat'],
    ['--ink', '--sticky'],
    ['--ink-soft', '--paper'],
    ['--ink-soft', '--paper-card'],
    ['--ink', '--lamplight'],
    ['--on-door', '--door'],
    ['--text', '--ground'],
    ['--muted', '--ground'],
    ['--text', '--surface'],
    ['--on-domain', '--love'],
    ['--on-domain', '--work'],
    ['--on-domain', '--play'],
    ['--on-domain', '--family'],
    ['--on-domain', '--wonder'],
  ];
  for (const [fg, bg] of pairs)
    it(`${fg} on ${bg} ≥ ${TEXT}:1`, () => expect(check(board, fg, bg)).toBeGreaterThanOrEqual(TEXT));
});

describe('Analyst token set (DESIGN-v2 §4)', () => {
  const pairs: [string, string, string?][] = [
    ['--ink', '--sheet'],
    ['--ink', '--panel'],
    ['--muted', '--panel'],
    ['--muted', '--sheet'],
    ['--muted', '--young'],
    ['--muted', '--middle'],
    ['--muted', '--old'],
    ['--good', '--panel'],
    ['--bad', '--panel'],
    ['--ink', '--highlight'],
    ['--ink', '--highlight-soft', '--panel'],
    ['--muted', '--highlight-soft', '--panel'],
    ['--on-door', '--door'],
    ['--sheet', '--ink'],
    ['--panel', '--good'],
    ['--panel', '--bad'],
    ['--line-arun', '--panel'],
    ['--on-domain', '--love'],
    ['--on-domain', '--work'],
    ['--on-domain', '--play'],
    ['--on-domain', '--family'],
    ['--on-domain', '--wonder'],
  ];
  for (const [fg, bg, under] of pairs)
    it(`${fg} on ${bg}${under ? ` over ${under}` : ''} ≥ ${TEXT}:1`, () =>
      expect(check(analyst, fg, bg, under)).toBeGreaterThanOrEqual(TEXT));

  it('DESIGN-v2 values are the ones in the stylesheet', () => {
    expect(resolve(analyst, '--sheet')).toBe('#f4f0e6');
    expect(resolve(analyst, '--panel')).toBe('#fbf9f4');
    expect(resolve(analyst, '--muted')).toBe('#6b6475');
    expect(resolve(board, '--felt')).toBe('#2c3836');
    expect(resolve(board, '--lamplight')).toBe('#f7d47a');
  });
});
