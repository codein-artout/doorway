// Ruleset helpers: validation (R43), dotted-path overrides (RULINGS §0), derived values.

import type { Age, Ruleset } from './types';
import { AGES, InvalidRulesetError } from './types';

export const SUPPORTED_PLAYER_COUNTS = [2, 3, 4] as const;

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/** Semantic validation (R43). Returns readable problems; empty = valid. Never throws. */
export function validateRuleset(r: unknown): string[] {
  const p: string[] = [];
  if (!r || typeof r !== 'object') return ['Ruleset must be an object.'];
  const rs = r as Partial<Ruleset> & Record<string, unknown>;
  if (typeof rs.id !== 'string' || rs.id.length === 0) p.push('id must be a non-empty string.');
  if (!isInt(rs.trackLength) || rs.trackLength < 3) p.push('trackLength must be an integer ≥ 3.');
  const L = isInt(rs.trackLength) ? rs.trackLength : NaN;

  // Age bands tile 0..trackLength-1 with no gaps (R43)
  const bands = rs.ageBands as Record<Age, [number, number]> | undefined;
  if (!bands || typeof bands !== 'object') p.push('ageBands is missing.');
  else {
    let expectStart = 0;
    for (const age of AGES) {
      const b = bands[age];
      if (!Array.isArray(b) || b.length !== 2 || !isInt(b[0]) || !isInt(b[1])) {
        p.push(`ageBands.${age} must be [start, end] integers.`);
        expectStart = NaN;
        continue;
      }
      if (b[0] !== expectStart)
        p.push(`ageBands.${age} must start at ${expectStart} so the bands tile the track with no gaps.`);
      if (b[1] < b[0]) p.push(`ageBands.${age} ends before it starts.`);
      expectStart = b[1] + 1;
    }
    if (!Number.isNaN(expectStart) && !Number.isNaN(L) && expectStart !== L)
      p.push(`ageBands must end at trackLength − 1 (${L - 1}); old ends at ${expectStart - 1}.`);
  }

  // Milestones inside the track
  if (!Array.isArray(rs.milestones)) p.push('milestones must be an array.');
  else {
    for (const m of rs.milestones)
      if (!isInt(m) || m <= 0 || (!Number.isNaN(L) && m >= L))
        p.push(
          `Milestone ${String(m)} must be an integer inside the track (1 to ${Number.isNaN(L) ? 'trackLength − 1' : L - 1}).`,
        );
    if (new Set(rs.milestones).size !== rs.milestones.length) p.push('milestones must be unique.');
  }

  const market = rs.market as Record<Age, number> | undefined;
  if (!market || typeof market !== 'object') p.push('market is missing.');
  else
    for (const age of AGES)
      if (!isInt(market[age]) || market[age] < 0) p.push(`market.${age} must be an integer ≥ 0.`);

  if (!isInt(rs.experienceStep) || rs.experienceStep < 1) p.push('experienceStep must be an integer ≥ 1.');
  if (!isInt(rs.experienceCap) || rs.experienceCap < 0) p.push('experienceCap must be an integer ≥ 0.');
  if (!isInt(rs.minCost) || rs.minCost < 0) p.push('minCost must be an integer ≥ 0.');
  if (!isInt(rs.rushNoPawnAhead) || rs.rushNoPawnAhead < 1)
    p.push('rushNoPawnAhead must be an integer ≥ 1 (Rush always moves, R11).');
  if (typeof rs.rushDiscard !== 'boolean') p.push('rushDiscard must be true or false.');

  // doorway[n] has exactly n entries for every supported player count (R43)
  const door = rs.doorway as Record<string, number[]> | undefined;
  if (!door || typeof door !== 'object') p.push('doorway is missing.');
  else
    for (const n of SUPPORTED_PLAYER_COUNTS) {
      const arr = door[String(n)];
      if (!Array.isArray(arr)) p.push(`doorway.${n} is missing.`);
      else {
        if (arr.length !== n) p.push(`doorway.${n} must have exactly ${n} entries (has ${arr.length}).`);
        if (arr.some((x) => !isInt(x) || x < 0)) p.push(`doorway.${n} entries must be integers ≥ 0.`);
      }
    }

  if (typeof rs.fullLifeBonus !== 'number' || !Number.isFinite(rs.fullLifeBonus))
    p.push('fullLifeBonus must be a number.');
  const passion = rs.passion as Record<string, number> | undefined;
  if (!passion || typeof passion !== 'object' || Object.keys(passion).length === 0)
    p.push('passion must have at least one key (R43).');
  else
    for (const [k, v] of Object.entries(passion)) {
      if (!/^\d+$/.test(k) || Number(k) < 1) p.push(`passion key "${k}" must be a run length ≥ 1.`);
      if (typeof v !== 'number' || !Number.isFinite(v)) p.push(`passion.${k} must be a number.`);
    }
  if (typeof rs.reflectionPerDisc !== 'number' || !Number.isFinite(rs.reflectionPerDisc))
    p.push('reflectionPerDisc must be a number.');
  const solo = rs.solo as Ruleset['solo'] | undefined;
  if (!solo || typeof solo !== 'object') p.push('solo is missing.');
  else {
    if (!isInt(solo.doorway) || solo.doorway < 0) p.push('solo.doorway must be an integer ≥ 0.');
    if (!isInt(solo.rush) || solo.rush < 1) p.push('solo.rush must be an integer ≥ 1.');
  }
  const hints = rs.hints as Ruleset['hints'] | undefined;
  if (!hints || typeof hints.bestWindow !== 'boolean') p.push('hints.bestWindow must be true or false.');
  if (typeof rs.cardsFile !== 'string') p.push('cardsFile must be a string.');
  return p;
}

export function assertValidRuleset(r: unknown): asserts r is Ruleset {
  const problems = validateRuleset(r);
  if (problems.length) throw new InvalidRulesetError(problems);
}

// ---------- dotted-path overrides ----------

export type OverrideValue = number | boolean | string | number[] | Record<string, number>;

/**
 * Parse a CLI/sandbox override value.
 * - "10,7,5,3" or "10/7/5/3" → [10,7,5,3]
 * - "3:2,4:4,5:7" → { "3": 2, "4": 4, "5": 7 }
 * - "true"/"false" → boolean; numeric → number; anything else → string
 */
export function parseOverrideValue(raw: string): OverrideValue {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^\d+:-?\d+(\.\d+)?([,/]\d+:-?\d+(\.\d+)?)*$/.test(s)) {
    const o: Record<string, number> = {};
    for (const part of s.split(/[,/]/)) {
      const [k, v] = part.split(':');
      o[k] = Number(v);
    }
    return o;
  }
  if (/^-?\d+(\.\d+)?([,/]-?\d+(\.\d+)?)+$/.test(s)) return s.split(/[,/]/).map(Number);
  return s;
}

/** Deep-clones `ruleset` and sets `path` (e.g. "doorway.4.0") to `value`. */
export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const out = JSON.parse(JSON.stringify(obj)) as T;
  const keys = path.split('.');
  let cur: Record<string, unknown> = out as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    if (next === undefined || next === null || typeof next !== 'object')
      throw new Error(`Unknown ruleset path "${path}" (no "${keys.slice(0, i + 1).join('.')}")`);
    cur = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0) throw new Error(`Bad array index in "${path}"`);
    cur[idx] = value;
  } else {
    if (!(last in cur) && keys.length === 1) throw new Error(`Unknown ruleset key "${path}"`);
    // passion as a plain list maps onto the existing thresholds in ascending order
    const existing = cur[last];
    if (Array.isArray(value) && existing && typeof existing === 'object' && !Array.isArray(existing)) {
      const ks = Object.keys(existing).sort((a, b) => Number(a) - Number(b));
      if (ks.length !== value.length)
        throw new Error(`"${path}" has ${ks.length} keys (${ks.join(',')}); got ${value.length} values`);
      const o: Record<string, unknown> = {};
      ks.forEach((k, i) => (o[k] = value[i]));
      cur[last] = o;
    } else cur[last] = value;
  }
  return out;
}

export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Apply several overrides; values may be raw strings (parsed) or already-typed. */
export function applyOverrides(
  ruleset: Ruleset,
  overrides: Record<string, unknown>,
  newId?: string,
): Ruleset {
  let r: Ruleset = ruleset;
  for (const [path, v] of Object.entries(overrides))
    r = setByPath(r, path, typeof v === 'string' ? parseOverrideValue(v) : v);
  if (newId) r = { ...r, id: newId };
  return r;
}

// ---------- derived values ----------

export function ageOf(ruleset: Ruleset, position: number): Age | null {
  for (const age of AGES) {
    const [a, b] = ruleset.ageBands[age];
    if (position >= a && position <= b) return age;
  }
  return null;
}

export function ageIndex(age: Age): number {
  return age === 'young' ? 0 : age === 'middle' ? 1 : 2;
}

/** R1: min(cap, floor(discs / step)) */
export function experienceDiscount(ruleset: Ruleset, discsOfDomain: number): number {
  return Math.min(ruleset.experienceCap, Math.floor(discsOfDomain / ruleset.experienceStep));
}

/** R2: value of the largest threshold ≤ run length; 0 below the smallest key. */
export function passionPoints(ruleset: Ruleset, run: number): number {
  let best = 0;
  let bestKey = -1;
  for (const [k, v] of Object.entries(ruleset.passion)) {
    const key = Number(k);
    if (key <= run && key > bestKey) {
      bestKey = key;
      best = v;
    }
  }
  return best;
}

/** Base Doorway allowance for the n-th arrival (1-based) — R12, R29. */
export function baseAllowance(ruleset: Ruleset, playerCount: number, arrivalOrder: number): number {
  if (playerCount === 1) return ruleset.solo.doorway;
  const arr = ruleset.doorway[String(playerCount)];
  if (!arr) throw new InvalidRulesetError([`doorway.${playerCount} is missing.`]);
  return arr[arrivalOrder - 1] ?? 0;
}
