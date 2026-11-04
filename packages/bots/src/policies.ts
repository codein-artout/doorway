import { costBreakdown, type Move } from '@doorway/engine';
import strategies from '../strategies.json';
import {
  chooseSwap,
  DEFAULT_POWER_VALUES,
  makeContext,
  questFeatures,
  rushFeatures,
  targetDomains,
  type Feature,
  type FeatureVec,
} from './features';
import type { BotPolicy, BotView, ExplainedCandidate, Explanation } from './types';
import { bestWindowMove } from './view';
import { makeLookahead } from './lookahead';

export type StrategyConfig = {
  label: string;
  kind: 'random' | 'greedy' | 'weighted' | 'lookahead';
  params?: Record<string, number>;
  weights?: Partial<Record<Feature, number>>;
  powerValues?: Record<string, number>;
};

export const STRATEGIES = Object.fromEntries(
  Object.entries(strategies as Record<string, unknown>).filter(([k]) => !k.startsWith('$')),
) as Record<string, StrategyConfig>;

/** The 11 strategy ids, in config order. */
export const STRATEGY_IDS = Object.keys(STRATEGIES);

const sameMove = (a: Move | undefined, b: Move) => !!a && JSON.stringify(a) === JSON.stringify(b);

/** Sort best first, mark `chosen` (the played move if given, else the top eligible one). */
export function finishExplanation(
  e: Omit<Explanation, 'candidates'>,
  cands: ExplainedCandidate[],
  chosen?: Move,
  limit = 8,
): Explanation {
  cands.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.total - a.total);
  const pick = chosen ? cands.findIndex((c) => sameMove(chosen, c.move)) : cands.findIndex((c) => c.eligible);
  if (pick >= 0) cands[pick].chosen = true;
  const top = cands.slice(0, limit);
  if (pick >= limit) top.push(cands[pick]);
  return { ...e, candidates: top };
}

/** Common handling: windows are always optimal, pending swaps use the projected-window chooser. */
function common(view: BotView, avgYears = 3.2): Move | null {
  const s = view.state;
  if (view.legal.length === 0) throw new Error(`Bot ${view.me} has no legal move`);
  const p = s.players.find((x) => x.id === view.me)!;
  if (p.arrivalOrder !== null) return bestWindowMove(s, view.me);
  if (s.phase === 'pending_choice') return chooseSwap(s, view.me, avgYears);
  return null;
}

export function randomPolicy(): BotPolicy {
  return {
    id: 'random',
    label: STRATEGIES.random?.label ?? 'Random',
    params: {},
    choose(view, rng) {
      const p = view.state.players.find((x) => x.id === view.me)!;
      if (p.arrivalOrder !== null) return bestWindowMove(view.state, view.me); // spec §6: windows chosen optimally
      return rng.pick(view.legal);
    },
    /** a uniform random choice has no reasons */
    explain() {
      return null;
    },
  };
}

/** Best immediate points per year spent; rushes (without discarding) only if there is no quest. */
export function greedyPolicy(): BotPolicy {
  return {
    id: 'greedy',
    label: STRATEGIES.greedy?.label ?? 'Greedy',
    params: {},
    choose(view) {
      const c = common(view);
      if (c) return c;
      const s = view.state;
      let best: Move | null = null;
      let bestV = -Infinity;
      let bestPts = -Infinity;
      for (const m of view.legal) {
        if (m.type !== 'quest') continue;
        const card = s.cards[m.cardId];
        const v = card.points / Math.max(1, costBreakdown(s, view.me, m.cardId).cost);
        if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && card.points > bestPts)) {
          best = m;
          bestV = v;
          bestPts = card.points;
        }
      }
      return best ?? { type: 'rush' };
    },
    explain(view, chosen) {
      if (pendingOrArrived(view)) return null;
      const s = view.state;
      const cands: ExplainedCandidate[] = [];
      for (const m of view.legal) {
        if (m.type !== 'quest') continue;
        const card = s.cards[m.cardId];
        const v = card.points / Math.max(1, costBreakdown(s, view.me, m.cardId).cost);
        cands.push({
          move: m,
          total: v,
          parts: [{ feature: 'ppy', value: v, weight: 1, contribution: v }],
          eligible: true,
          chosen: false,
        });
      }
      if (!cands.length)
        cands.push({ move: { type: 'rush' }, total: 0, parts: [], eligible: true, chosen: false });
      return finishExplanation(
        {
          strategy: 'greedy',
          label: STRATEGIES.greedy?.label ?? 'Greedy',
          options: view.legal.length,
          kind: 'ppy',
        },
        cands,
        chosen,
      );
    },
  };
}

const pendingOrArrived = (view: BotView) => {
  const p = view.state.players.find((x) => x.id === view.me)!;
  return p.arrivalOrder !== null || view.state.phase === 'pending_choice';
};

export function weightedPolicy(id: string, cfg: StrategyConfig): BotPolicy {
  const w = cfg.weights ?? {};
  const params = {
    avgYears: 3.2,
    targetDomains: 0,
    rushIfBestPpyBelow: 0,
    neverRush: 0,
    discardMin: 0.15,
    ...(cfg.params ?? {}),
  };
  const powerValues = { ...DEFAULT_POWER_VALUES, ...(cfg.powerValues ?? {}) };
  const dot = (f: FeatureVec) => {
    let v = 0;
    for (const k in f) v += (w[k as Feature] ?? 0) * (f[k as Feature] ?? 0);
    return v;
  };
  return {
    id,
    label: cfg.label,
    params,
    choose(view, rng) {
      const c = common(view, params.avgYears);
      if (c) return c;
      const s = view.state;
      const me = s.players.find((x) => x.id === view.me)!;
      const targets = targetDomains(s, me, params.targetDomains);
      const ctx = makeContext(s, view.me, targets, params.avgYears, powerValues);
      const quests = view.legal.filter((m): m is Extract<Move, { type: 'quest' }> => m.type === 'quest');
      const rushes = view.legal.filter((m): m is Extract<Move, { type: 'rush' }> => m.type === 'rush');
      let best: Move | null = null;
      let bestV = -Infinity;
      let bestPpy = 0;
      const consider = (m: Move, v: number) => {
        if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && rng.next() < 0.5)) {
          best = m;
          bestV = v;
        }
      };
      for (const m of quests) {
        const f = questFeatures(ctx, m);
        bestPpy = Math.max(bestPpy, f.ppy ?? 0);
        consider(m, dot(f));
      }
      const forcedRush = quests.length === 0;
      const wantRush = params.rushIfBestPpyBelow > 0 && bestPpy < params.rushIfBestPpyBelow;
      if (forcedRush || !params.neverRush) {
        if (wantRush) {
          best = null;
          bestV = -Infinity;
        }
        for (const m of rushes) {
          const f = rushFeatures(ctx, m);
          if (m.discardCardId && (f.rushDeny ?? 0) < params.discardMin) continue; // don't discard for nothing
          consider(m, dot(f));
        }
      }
      return best ?? { type: 'rush' };
    },
    explain(view, chosen) {
      if (pendingOrArrived(view)) return null;
      const s = view.state;
      const me = s.players.find((x) => x.id === view.me)!;
      const ctx = makeContext(
        s,
        view.me,
        targetDomains(s, me, params.targetDomains),
        params.avgYears,
        powerValues,
      );
      const parts = (f: FeatureVec) =>
        Object.keys(f).map((k) => {
          const weight = w[k as Feature] ?? 0;
          const value = f[k as Feature] ?? 0;
          return { feature: k, value, weight, contribution: weight * value };
        });
      const cands: ExplainedCandidate[] = [];
      let bestPpy = 0;
      const quests = view.legal.filter((m): m is Extract<Move, { type: 'quest' }> => m.type === 'quest');
      for (const m of quests) {
        const f = questFeatures(ctx, m);
        bestPpy = Math.max(bestPpy, f.ppy ?? 0);
        cands.push({ move: m, total: dot(f), parts: parts(f), eligible: true, chosen: false });
      }
      const forcedRush = quests.length === 0;
      const wantRush = params.rushIfBestPpyBelow > 0 && bestPpy < params.rushIfBestPpyBelow;
      if (wantRush) for (const c of cands) c.eligible = false;
      for (const m of view.legal) {
        if (m.type !== 'rush') continue;
        const f = rushFeatures(ctx, m);
        const allowed =
          (forcedRush || !params.neverRush) && !(m.discardCardId && (f.rushDeny ?? 0) < params.discardMin);
        cands.push({ move: m, total: dot(f), parts: parts(f), eligible: allowed, chosen: false });
      }
      const note = wantRush
        ? `best quest is under ${params.rushIfBestPpyBelow} pts/yr, so it rushes`
        : params.neverRush && !forcedRush
          ? 'never rushes unless forced'
          : undefined;
      return finishExplanation(
        {
          strategy: id,
          label: cfg.label,
          options: view.legal.length,
          kind: 'features',
          ...(note ? { note } : {}),
        },
        cands,
        chosen,
      );
    },
  };
}

/** `<id>@eps<ε>`: play uniformly at random with probability ε (human-like slips). */
export function noisy(base: BotPolicy, eps: number): BotPolicy {
  return {
    id: `${base.id}@eps${eps}`,
    label: `${base.label} (ε ${eps})`,
    params: { ...base.params, eps },
    choose(view, rng) {
      const p = view.state.players.find((x) => x.id === view.me)!;
      if (p.arrivalOrder !== null) return bestWindowMove(view.state, view.me);
      if (rng.next() < eps) return rng.pick(view.legal);
      return base.choose(view, rng);
    },
    explain(view, chosen) {
      const e = base.explain?.(view, chosen) ?? null;
      return e
        ? {
            ...e,
            strategy: `${base.id}@eps${eps}`,
            note: [e.note, `plays a random move ${Math.round(eps * 100)}% of the time`]
              .filter(Boolean)
              .join('; '),
          }
        : null;
    },
  };
}

export const SKILL_EPS = { casual: 0.25, normal: 0.08, sharp: 0 } as const;
export type Skill = keyof typeof SKILL_EPS;

export function policyIdFor(strategy: string, skill: Skill): string {
  const e = SKILL_EPS[skill];
  return e > 0 ? `${strategy}@eps${e}` : strategy;
}

/** Resolve any policy id: a strategy from strategies.json, optionally with `@eps<ε>`. */
export function getPolicy(policyId: string, overrides?: Partial<StrategyConfig>): BotPolicy {
  const m = /^([a-z_]+)(?:@eps([0-9.]+))?$/.exec(policyId);
  if (!m) throw new Error(`Bad bot policy id "${policyId}"`);
  const [, id, eps] = m;
  const base = STRATEGIES[id];
  if (!base) throw new Error(`Unknown bot strategy "${id}". Known: ${STRATEGY_IDS.join(', ')}`);
  const cfg: StrategyConfig = {
    ...base,
    ...(overrides ?? {}),
    params: { ...(base.params ?? {}), ...(overrides?.params ?? {}) },
  };
  let p: BotPolicy;
  switch (cfg.kind) {
    case 'random':
      p = randomPolicy();
      break;
    case 'greedy':
      p = greedyPolicy();
      break;
    case 'weighted':
      p = weightedPolicy(id, cfg);
      break;
    case 'lookahead':
      p = makeLookahead(id, cfg);
      break;
    default:
      throw new Error(`Unknown strategy kind ${(cfg as StrategyConfig).kind}`);
  }
  const e = eps !== undefined ? Number(eps) : 0;
  return e > 0 ? noisy(p, e) : p;
}
