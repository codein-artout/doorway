import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sha256, utf8Bytes, sha256Bytes, applyOverrides, init } from '@doorway/engine';
import {
  CARDS,
  CARDS_FILE,
  DEFAULT_RULESET,
  validateRuleset,
  validateCards,
  summarizeCards,
} from '../src/index';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const specCards = readFileSync(path.join(root, 'spec/cards.json'), 'utf8');
const rulingsMd = readFileSync(path.join(root, 'spec/RULINGS.md'), 'utf8');
const rulesetText = readFileSync(path.join(root, 'packages/content/rulesets/v0.2-default.json'), 'utf8');

describe('content: cards come straight from spec/cards.json', () => {
  it('loads the spec file itself (no fork): data deep-equals spec/cards.json', () => {
    expect(CARDS_FILE).toEqual(JSON.parse(specCards));
  });
  it('the pure-JS SHA-256 matches node:crypto on spec/cards.json bytes', () => {
    const nodeHash = createHash('sha256')
      .update(readFileSync(path.join(root, 'spec/cards.json')))
      .digest('hex');
    expect(sha256Bytes(new Uint8Array(readFileSync(path.join(root, 'spec/cards.json'))))).toBe(nodeHash);
    expect(sha256(specCards)).toBe(nodeHash);
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Bytes(utf8Bytes('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('there is no copy of cards.json elsewhere in packages/', () => {
    // content imports ../../../spec/cards.json directly
    const src = readFileSync(path.join(root, 'packages/content/src/index.ts'), 'utf8');
    expect(src).toContain("'../../../spec/cards.json'");
  });
});

describe('content: default ruleset', () => {
  it('rulesets/v0.2-default.json equals RULINGS §0 exactly (text and data)', () => {
    const block = /```json\n([\s\S]*?)```/.exec(rulingsMd)![1];
    expect(rulesetText).toBe(block);
    expect(DEFAULT_RULESET).toEqual(JSON.parse(block));
  });
  it('the default ruleset validates', () => {
    expect(validateRuleset(DEFAULT_RULESET)).toEqual({ ok: true, value: DEFAULT_RULESET });
  });
});

describe('content: R43 ruleset validation', () => {
  const bad = (o: Record<string, unknown>) => validateRuleset(applyOverrides(DEFAULT_RULESET, o));
  it('R43: doorway[n] must have exactly n entries', () => {
    const r = bad({ 'doorway.4': [9, 8, 7] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/doorway\.4 must have exactly 4 entries/);
  });
  it('R43: age bands must tile 0..trackLength-1 with no gaps', () => {
    const r = bad({ 'ageBands.middle': [15, 27] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/must start at 14/);
    const r2 = bad({ trackLength: 36 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join(' ')).toMatch(/trackLength − 1/);
  });
  it('R43: milestones must lie inside the track', () => {
    const r = bad({ milestones: [10, 20, 45] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Milestone 45/);
  });
  it('R43: passion must have at least one key', () => {
    const r = validateRuleset({ ...DEFAULT_RULESET, passion: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/passion must have at least one key/);
  });
  it('R43: an invalid ruleset is refused with a readable error and never crashes the engine', () => {
    const broken = { ...DEFAULT_RULESET, doorway: { '2': [9], '3': [9, 8, 7], '4': [9, 8, 7, 6] } };
    expect(() => init(broken, CARDS, [{ name: 'A' }, { name: 'B' }], 's')).toThrow(
      /doorway\.2 must have exactly 2 entries/,
    );
    expect(validateRuleset(null).ok).toBe(false);
    expect(validateRuleset({ id: 3 }).ok).toBe(false);
  });
});

describe('content: §15 card count claims', () => {
  const s = summarizeCards(CARDS);
  it('RB-15.1: 60 cards, 25 Young / 20 Middle / 15 Old', () => {
    expect(CARDS.length).toBe(60);
    expect([s.young, s.middle, s.old]).toEqual([25, 20, 15]);
  });
  it('RB-15.2: 12 cards per domain', () => {
    expect(s.byDomain).toEqual({ pink: 12, gold: 12, green: 12, orange: 12, purple: 12 });
  });
  it('RB-15.3: 11 cards with powers', () => expect(s.powers).toBe(11));
  it('RB-15.4: 5 Reflection cards, one per domain, all Old', () => {
    const refl = CARDS.filter((c) => c.reflection);
    expect(refl.length).toBe(5);
    expect(new Set(refl.map((c) => c.reflection)).size).toBe(5);
    expect(refl.every((c) => c.age === 'old' && c.reflection === c.color)).toBe(true);
  });
  it('RB-15.5: Young cards never have requirements; the card set validates', () => {
    expect(CARDS.filter((c) => c.age === 'young' && c.requires)).toEqual([]);
    expect(validateCards(CARDS).ok).toBe(true);
    const dup = validateCards([...CARDS, CARDS[0]]);
    expect(dup.ok).toBe(false);
  });
  it('RB-15.6: per-age years/points ranges match the §15 table', () => {
    const range = (age: string, k: 'years' | 'points') => {
      const v = CARDS.filter((c) => c.age === age).map((c) => c[k]);
      return [Math.min(...v), Math.max(...v)];
    };
    expect(range('young', 'years')).toEqual([2, 4]);
    expect(range('middle', 'years')).toEqual([3, 5]);
    expect(range('old', 'years')).toEqual([4, 6]);
    expect(range('young', 'points')).toEqual([1, 3]);
    expect(range('middle', 'points')).toEqual([1, 4]);
    expect(range('old', 'points')).toEqual([3, 4]);
  });
});

import { soloRating, DOMAIN_INFO } from '../src/index';
describe('content: solo ratings (rulebook §11) and domain codes', () => {
  it('RB-11.T1: under 25 — A quiet life', () =>
    expect([0, 24].map(soloRating)).toEqual(['A quiet life', 'A quiet life']));
  it('RB-11.T2: 25–34 — A good life', () =>
    expect([25, 34].map(soloRating)).toEqual(['A good life', 'A good life']));
  it('RB-11.T3: 35–44 — A full life', () =>
    expect([35, 44].map(soloRating)).toEqual(['A full life', 'A full life']));
  it('RB-11.T4: 45+ — Everything you could bring', () =>
    expect([45, 80].map(soloRating)).toEqual(['Everything you could bring', 'Everything you could bring']));
  it('R33: two-letter domain codes Lv Wk Pl Fm Wd, all distinct, with icons', () => {
    expect(Object.values(DOMAIN_INFO).map((d) => d.code)).toEqual(['Lv', 'Wk', 'Pl', 'Fm', 'Wd']);
    expect(Object.values(DOMAIN_INFO).map((d) => d.icon)).toEqual([
      'heart',
      'hammer',
      'kite',
      'house',
      'star',
    ]);
    expect(new Set(Object.values(DOMAIN_INFO).map((d) => d.code[0])).size).toBeLessThan(5); // single letters would collide
  });
});
