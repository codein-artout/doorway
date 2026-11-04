// Analyst window scorer (DESIGN-v2 §4): every maximal window, its score parts, why, and allowance sensitivity.

import {
  baseAllowance,
  DOMAIN_NAMES,
  DOMAINS,
  windowScores,
  type GameState,
  type PlayerId,
  type WindowRow,
} from '@doorway/engine';
import { DOMAIN_CODE } from './analyst-model';
import { ordinal } from './format';

export type WindowDetail = {
  label: string;
  total: number;
  domCounts: string;
  setsWhy: string;
  passionWhy: string;
  reflectionWhy: string;
  lost: string;
};

const label = (w: { start: number; end: number }) =>
  w.end < w.start ? 'none' : `${w.start + 1}–${w.end + 1}`;
export const windowLabel = label;

export function windowTable(s: GameState, pid: PlayerId): { rows: WindowRow[]; allowance: number } {
  const p = s.players.find((x) => x.id === pid)!;
  const allowance = p.doorwayAllowance ?? p.tower.length;
  return { rows: windowScores(s, p.tower, allowance), allowance };
}

/** Why a window scores what it scores. */
export function windowDetail(s: GameState, pid: PlayerId, w: WindowRow): WindowDetail {
  const p = s.players.find((x) => x.id === pid)!;
  const kept = w.end < w.start ? [] : p.tower.slice(w.start, w.end + 1);
  const cnt: Record<string, number> = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  let run = 0;
  let best = 0;
  let bestDom = '';
  let prev = '';
  for (const id of kept) {
    const c = s.cards[id].color;
    cnt[c]++;
    run = c === prev ? run + 1 : 1;
    prev = c;
    if (run > best) {
      best = run;
      bestDom = c;
    }
  }
  const missing = DOMAINS.filter((d) => !cnt[d]).map((d) => DOMAIN_NAMES[d]);
  const refl = kept
    .filter((id) => s.cards[id].reflection)
    .map((id) => {
      const c = s.cards[id];
      const n = cnt[c.reflection!] * s.ruleset.reflectionPerDisc;
      return `${c.name} × ${cnt[c.reflection!]} ${DOMAIN_NAMES[c.reflection!]} = +${n}`;
    });
  const lostIds = p.tower.filter((_, i) => i < w.start || i > w.end);
  return {
    label: label(w),
    total: w.total,
    domCounts: DOMAINS.map((d) => `${DOMAIN_CODE[d]} ${cnt[d]}`).join(' · '),
    setsWhy: w.fullLifeSets
      ? `${w.fullLifeSets} complete set${w.fullLifeSets > 1 ? 's' : ''} × ${s.ruleset.fullLifeBonus} = +${w.fullLife}`
      : `no set — missing ${missing.join(', ')}`,
    passionWhy:
      w.passion > 0 ? `run of ${best} ${DOMAIN_NAMES[bestDom]} = +${w.passion}` : `longest run ${best} = +0`,
    reflectionWhy: refl.length ? refl.join('; ') : 'none kept',
    lost: lostIds.length
      ? `${lostIds.length}: ${lostIds.map((id) => s.cards[id].name).join(', ')}`
      : 'nothing',
  };
}

export type SensitivityRow = { keep: number; means: string; win: string; score: number; mine: boolean };

/** Best window and score for each allowance from `hi` down to `lo`, with the same tower (DESIGN-v2 §4). */
export function sensitivity(s: GameState, pid: PlayerId, hi = 10, lo = 6): SensitivityRow[] {
  const p = s.players.find((x) => x.id === pid)!;
  const n = s.players.length;
  const mine = p.doorwayAllowance ?? p.tower.length;
  const order = p.arrivalOrder ?? 1;
  const bonus = p.arrivalOrder !== null ? mine - baseAllowance(s.ruleset, n, order) : 0;
  const out: SensitivityRow[] = [];
  for (let k = hi; k >= lo; k--) {
    const rows = windowScores(s, p.tower, k);
    const b = rows.find((r) => r.best)!;
    const means: string[] = [];
    for (let o = 1; o <= n; o++) {
      const tile = baseAllowance(s.ruleset, n, o);
      const you = o === order ? 'you · ' : '';
      if (bonus && tile + bonus === k) means.push(`${you}${ordinal(o)} + ${bonus}`);
      else if (tile === k)
        means.push(`${o === order && !bonus ? 'you · ' : ''}${ordinal(o)}${bonus ? ', no bonus' : ''}`);
    }
    out.push({ keep: k, means: means.join(' / ') || '—', win: label(b), score: b.total, mine: k === mine });
  }
  return out;
}

/** Header line: "Priya arrived 2nd · tile 8 + 1 (Make peace with it) = keep 9 of 13". */
export function allowanceLine(s: GameState, pid: PlayerId): string {
  const p = s.players.find((x) => x.id === pid)!;
  const allow = p.doorwayAllowance ?? p.tower.length;
  if (p.arrivalOrder === null) return `${p.name} has not arrived`;
  const tile = baseAllowance(s.ruleset, s.players.length, p.arrivalOrder);
  const bonusCards = p.tower
    .map((id) => s.cards[id])
    .filter((c) => c.power?.type === 'doorway_bonus')
    .map((c) => c.name);
  const bonus = allow - tile;
  return `${p.name} arrived ${ordinal(p.arrivalOrder)} · tile ${tile}${
    bonus ? ` + ${bonus}${bonusCards.length ? ` (${bonusCards.join(', ')})` : ''}` : ''
  } = keep ${Math.min(allow, p.tower.length)} of ${p.tower.length}`;
}
