// Pure view-model over reports/data/summary.json. Used by the Markdown/HTML report and the /designer page.
// No Node APIs here: the web app imports it directly.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Summary = any;

export const COLORS = {
  ink: '#12131F',
  surface: '#1B1D2E',
  surface2: '#24273B',
  sunk: '#171928',
  line: '#34374F',
  lineSoft: '#2C2F45',
  text: '#ECE8DF',
  muted: '#A9A8B8',
  door: '#F7EBD0',
  alert: '#5FD3E6',
  cards: '#ECE8DF',
  fullLife: '#6CB6D6',
  passion: '#E7766E',
  reflection: '#8E8FA8',
  blue: '#5B8DEF',
  orange: '#F0A04B',
  grey: '#6B6E8A',
  domains: {
    pink: '#F07AA8',
    gold: '#E9B949',
    green: '#57C785',
    orange: '#F08A3C',
    purple: '#A48BFF',
  } as Record<string, string>,
};

export const TARGETS = { maxStrategyWin4p: 0.35, seatPP: 5, seatRel: 0.05, nonFirstLost: 2 };

export const pct = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`;
export const fx = (x: number | null | undefined, d = 2) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d);
export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export function label(s: Summary, id: string): string {
  return s.strategies?.[id]?.label ?? id;
}

export function shortName(lbl: string): string {
  const w = lbl.split(/[\s_]+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : lbl.slice(0, 2)).toUpperCase();
}

export type Verdict = 'pass' | 'fail' | 'n/a';

export type Model = ReturnType<typeof buildModel>;

export function buildModel(s: Summary) {
  const g4 = s.groups['main-4p'];
  const g3 = s.groups['main-3p'];
  const g2 = s.groups['main-2p'];
  const counts = [g2 && 2, g3 && 3, g4 && 4].filter(Boolean) as number[];
  const group = (n: number) => s.groups[`main-${n}p`];

  // ---- strategies (4p) with CIs
  const strat4 = g4
    ? Object.entries(g4.byPolicy).map(([id, p]: [string, any]) => ({
        id,
        label: label(s, id),
        win: p.win,
        lo: p.lo,
        hi: p.hi,
        n: p.n,
        score: p.score.mean,
        rushes: p.rushes,
        lost: p.lost,
      }))
    : [];
  strat4.sort((a, b) => b.win - a.win);
  const top4 = strat4[0];

  // ---- Doorway headline
  const doorway = counts.map((n) => {
    const g = group(n);
    const rows = Object.entries(g.byArrival)
      .filter(([k]) => k !== 'null')
      .map(([k, a]: [string, any]) => ({ order: Number(k), ...a }))
      .sort((a, b) => a.order - b.order);
    return { players: n, rows, nonFirstLost: g.nonFirstLost, shareLostAny: g.shareLostAny };
  });
  const d4 = doorway.find((d) => d.players === 4);
  const nonFirstAll = (() => {
    let sum = 0,
      w = 0;
    for (const d of doorway)
      for (const r of d.rows)
        if (r.order > 1) {
          sum += r.lost * r.n;
          w += r.n;
        }
    return w ? sum / w : NaN;
  })();
  const firstRows = doorway.map((d) => d.rows.find((r) => r.order === 1)).filter(Boolean) as any[];

  // ---- seats
  const seats = counts.map((n) => {
    const g = group(n);
    const rows = Object.entries(g.bySeat)
      .map(([k, v]: [string, any]) => ({ seat: Number(k), ...v }))
      .sort((a, b) => a.seat - b.seat);
    const worstPP = Math.max(...rows.map((r) => Math.abs(r.diffPP)));
    const worstRel = Math.max(...rows.map((r) => Math.abs(r.diffRel)));
    return {
      players: n,
      rows,
      worstPP,
      worstRel,
      passPP: worstPP <= TARGETS.seatPP,
      passRel: worstRel <= TARGETS.seatRel,
    };
  });

  // ---- components (4p)
  const comp = g4?.components ?? {};
  const pred = s.predictors?.['main-4p'];
  const components = [
    { key: 'cards', name: 'Cards', color: COLORS.cards },
    { key: 'full_life', name: 'Full life', color: COLORS.fullLife },
    { key: 'passion', name: 'Passion', color: COLORS.passion },
    { key: 'reflection', name: 'Reflection', color: COLORS.reflection },
  ].map((c) => ({
    ...c,
    mean: comp[c.key]?.mean,
    share: comp[c.key]?.share,
    beta: pred?.coefficients?.[c.key],
    r: pred?.pointBiserial?.[c.key],
  }));

  // ---- rush
  const rushBuckets = g4
    ? Object.entries(g4.rushBuckets).map(([k, v]: [string, any]) => ({ bucket: k, ...v }))
    : [];
  const rushShare = g4 ? g4.rushes.mean / (g4.rushes.mean + g4.quests.mean) : NaN;
  const noRush = rushBuckets.find((b) => b.bucket === '0');
  const manyRush = (() => {
    const xs = rushBuckets.filter((b) => b.bucket === '3–4' || b.bucket === '5+');
    const n = xs.reduce((a, b) => a + b.n, 0);
    return n
      ? {
          n,
          win: xs.reduce((a, b) => a + b.win * b.n, 0) / n,
          fair: xs.reduce((a, b) => a + b.fair * b.n, 0) / n,
        }
      : null;
  })();

  // ---- cards to look at
  const cards = (s.cards?.table ?? []) as any[];
  const flagged = cards.filter((c) => c.flag);
  const unused = cards.filter((c) => c.pickRate < 0.02);
  const lookAt = [
    ...flagged.sort((a, b) => Math.abs(b.relWin - 1) - Math.abs(a.relWin - 1)),
    ...cards
      .filter((c) => !c.flag)
      .sort((a, b) => Math.abs(b.relWin - 1) - Math.abs(a.relWin - 1))
      .slice(0, Math.max(0, 8 - flagged.length)),
  ].slice(0, 10);

  // ---- matchup matrix
  const mids: string[] = s.matchups?.ids ?? [];
  const matrix = mids.map((a, i) => ({
    id: a,
    label: label(s, a),
    short: shortName(label(s, a)),
    cells: (s.matchups.matrix[i] ?? []).map((v: number | null, j: number) => ({ vs: mids[j], v })),
  }));

  // ---- sweeps
  const sweeps = Object.entries(s.sweeps ?? {})
    .filter(([k]) => k.startsWith('S4:'))
    .map(([scope, vals]: [string, any]) => {
      const key = scope.split(':')[1];
      return {
        scope,
        key,
        values: vals.map((v: any) => {
          const pol = Object.entries(v.summary.byPolicy) as [string, any][];
          const top = pol[0];
          const seat1 = v.summary.bySeat['1'];
          return {
            label: v.value.split('=')[1],
            value: v.value,
            base: v.base,
            games: v.summary.games,
            avgScore: v.summary.score.mean,
            nonFirstLost: v.summary.nonFirstLost,
            shareLostAny: v.summary.shareLostAny,
            firstLost: v.summary.byArrival['1']?.lost,
            lastLost: (Object.values(v.summary.byArrival) as any[]).slice(-1)[0]?.lost,
            topPolicy: top?.[0],
            topWin: top?.[1].win,
            topLo: top?.[1].lo,
            topHi: top?.[1].hi,
            spread: pol.length ? pol[0][1].win - pol[pol.length - 1][1].win : NaN,
            seat1PP: seat1 ? seat1.diffPP : NaN,
            fullLifeShare: v.summary.components.full_life.share,
            passionShare: v.summary.components.passion.share,
            turns: v.summary.turnsPerGame.mean,
          };
        }),
      };
    });
  const confirm = Object.entries(s.sweeps ?? {})
    .filter(([k]) => k.startsWith('S4C:'))
    .map(([scope, vals]: [string, any]) => ({
      scope,
      key: scope.split(':')[1],
      values: vals.map((v: any) => ({
        label: v.value.split('=')[1],
        base: v.base,
        games: v.summary.games,
        lookahead: v.summary.byPolicy.lookahead,
        nonFirstLost: v.summary.nonFirstLost,
        topPolicy: Object.keys(v.summary.byPolicy)[0],
      })),
    }));

  // ---- ready to print
  const readyToPrint: { signal: string; target: string; value: string; verdict: Verdict; note?: string }[] = [
    {
      signal: 'Bot sims, 4p: no single strategy archetype wins more than',
      target: '35% of games',
      value: top4 ? `${top4.label} ${pct(top4.win)} [${pct(top4.lo)}, ${pct(top4.hi)}]` : '—',
      verdict: top4 ? (top4.win <= TARGETS.maxStrategyWin4p ? 'pass' : 'fail') : 'n/a',
    },
    ...seats.map((x) => ({
      signal: `Bot sims, ${x.players}p: first-seat win rate within`,
      target: '±5% of fair share',
      value: (() => {
        const r = x.rows.find((r) => r.seat === 1)!;
        return `${pct(r.win)} vs fair ${pct(r.fair)}: ${r.diffPP >= 0 ? '+' : ''}${fx(r.diffPP, 1)} pts, ${r.diffRel >= 0 ? '+' : ''}${pct(r.diffRel)} relative`;
      })(),
      verdict: ((): Verdict => {
        const r = x.rows.find((r) => r.seat === 1)!;
        return Math.abs(r.diffPP) <= TARGETS.seatPP ? 'pass' : 'fail';
      })(),
      note: 'Pass/fail uses percentage points (R45); the relative reading is shown alongside.',
    })),
    {
      signal: 'Bot sims: average discs lost at the Doorway (non-first arrivals)',
      target: '≥ 2',
      value: fx(nonFirstAll, 2),
      verdict: Number.isFinite(nonFirstAll) ? (nonFirstAll >= TARGETS.nonFirstLost ? 'pass' : 'fail') : 'n/a',
    },
    {
      signal: 'Human games: median length (4p)',
      target: '50–65 min',
      value: 'not measurable by bots',
      verdict: 'n/a',
    },
    {
      signal: 'Human games: "would play again"',
      target: '≥ 80%',
      value: 'not measurable by bots',
      verdict: 'n/a',
    },
    {
      signal: 'Human games: rules questions per game, last 10 games',
      target: '≤ 2',
      value: 'not measurable by bots',
      verdict: 'n/a',
    },
    {
      signal: 'At least 3 different archetypes have won human games',
      target: 'yes',
      value: 'not measurable by bots',
      verdict: 'n/a',
    },
  ];

  const solo = Object.entries(s.solo ?? {})
    .map(([id, v]: [string, any]) => ({ id, label: label(s, id), ...v }))
    .sort((a, b) => b.score.mean - a.score.mean);

  return {
    s,
    counts,
    totals: s.totals,
    strat4,
    top4,
    doorway,
    d4,
    nonFirstAll,
    firstRows,
    seats,
    components,
    pred,
    rushBuckets,
    rushShare,
    noRush,
    manyRush,
    cards,
    flagged,
    unused,
    lookAt,
    matrix,
    sweeps,
    confirm,
    readyToPrint,
    solo,
    g2,
    g3,
    g4,
    noisy: s.groups['noisy-4p'],
    tweaks: suggestTweaks(sweeps),
  };
}

export type Tweak = { title: string; why: string; evidence: string; sweep: string; value: string };

/**
 * Rule-tweak suggestions, each backed by a sweep row. Heuristics:
 * - balance: a value that lowers the top strategy's win rate / the spread between strategies
 * - Doorway: a value that keeps non-first losses ≥ 2 while making first arrival matter (gap first vs last)
 * - scoring mix: a value that raises an under-used scoring path's share without hurting balance
 */
export function suggestTweaks(sweeps: any[]): Tweak[] {
  const out: Tweak[] = [];
  const byKey = Object.fromEntries((sweeps as any[]).map((w) => [w.key, w]));
  const fmt = (v: any) =>
    `${v.label}: top strategy ${v.topPolicy} ${pct(v.topWin)}, spread ${pct(v.spread)}, non-first arrivals lose ${fx(v.nonFirstLost)} (1st ${fx(v.firstLost)}, last ${fx(v.lastLost)}), Full life ${pct(v.fullLifeShare)} of points, ${fx(v.turns, 1)} turns/game`;
  const consider = (
    key: string,
    pick: (vals: any[], base: any) => any | null,
    mk: (v: any, base: any) => { title: string; why: string },
  ) => {
    const w = byKey[key];
    if (!w) return;
    const base = w.values.find((v: any) => v.base);
    if (!base) return;
    const v = pick(
      w.values.filter((x: any) => !x.base),
      base,
    );
    if (!v) return;
    const t = mk(v, base);
    out.push({
      ...t,
      evidence: `${w.key} sweep (S4, ${v.games.toLocaleString()} games per value) — ${fmt(v)}; baseline ${fmt(base)}.`,
      sweep: w.key,
      value: v.label,
    });
  };
  // Doorway tiles: the value with the biggest first-vs-last loss gap (makes arriving first matter more)
  consider(
    'doorway.4',
    (vals, base) => {
      const gap = (v: any) => v.lastLost - v.firstLost;
      const best = vals.slice().sort((a: any, b: any) => gap(b) - gap(a))[0];
      return best && gap(best) > gap(base) + 0.5 ? best : null;
    },
    (v, base) => ({
      title: `Try 4-player Doorway tiles ${v.label}`,
      why: `It widens the gap between arriving first and last (${fx(v.lastLost - v.firstLost)} discs vs ${fx(base.lastLost - base.firstLost)} today), so the race to the Doorway becomes a real decision.`,
    }),
  );
  // Experience cap: the value that most reduces the top strategy's edge
  consider(
    'experienceCap',
    (vals, base) => {
      const best = vals.slice().sort((a: any, b: any) => a.spread - b.spread)[0];
      return best && best.spread < base.spread - 0.01 ? best : null;
    },
    (v, base) => ({
      title: `Consider experienceCap = ${v.label}`,
      why: `Strategies end closer together (spread ${pct(v.spread)} vs ${pct(base.spread)}), which suggests the engine snowball is part of the imbalance.`,
    }),
  );
  // Full life: if sets are a small share of points, a bigger bonus that raises the share without widening the spread
  consider(
    'fullLifeBonus',
    (vals, base) => {
      if (base.fullLifeShare > 0.12) return null;
      const ok = vals.filter(
        (v: any) => v.fullLifeShare > base.fullLifeShare && v.spread <= base.spread + 0.02,
      );
      return ok.sort((a: any, b: any) => b.fullLifeShare - a.fullLifeShare)[0] ?? null;
    },
    (v, base) => ({
      title: `Raise the Full life bonus to ${v.label}`,
      why: `Sets are only ${pct(base.fullLifeShare)} of all points today; at ${v.label} they become ${pct(v.fullLifeShare)} without widening the gap between strategies, so the generalist path stays alive.`,
    }),
  );
  // Passion table: the value with the smallest spread
  consider(
    'passion',
    (vals, base) => {
      const best = vals.slice().sort((a: any, b: any) => a.spread - b.spread)[0];
      return best && best.spread < base.spread - 0.01 ? best : null;
    },
    (v, base) => ({
      title: `Try a Passion table of ${v.label}`,
      why: `It narrows the spread between strategies to ${pct(v.spread)} (from ${pct(base.spread)}).`,
    }),
  );
  // 3p / 2p tiles
  for (const key of ['doorway.3', 'doorway.2'])
    consider(
      key,
      (vals, base) => {
        const best = vals.slice().sort((a: any, b: any) => Math.abs(a.seat1PP) - Math.abs(b.seat1PP))[0];
        return best && Math.abs(best.seat1PP) + 1 < Math.abs(base.seat1PP) ? best : null;
      },
      (v, base) => ({
        title: `Try ${key.endsWith('3') ? '3' : '2'}-player tiles ${v.label}`,
        why: `The first seat's edge shrinks to ${fx(v.seat1PP, 1)} pts (from ${fx(base.seat1PP, 1)}).`,
      }),
    );
  return out.slice(0, 6);
}
