// Row formats written by every simulation run (CSV), built inside workers.

import type { GameResult } from '@doorway/bots';

export const GAME_COLUMNS = [
  'run',
  'value',
  'game',
  'seed',
  'players',
  'policies',
  'turns',
  'winners',
  'arrival',
  'totals',
  'kept',
  'lost',
  'heights',
  'allowances',
  'rushes',
] as const;

export const PLAYER_COLUMNS = [
  'run',
  'value',
  'game',
  'players',
  'seat',
  'policy',
  'total',
  'cards',
  'full_life',
  'sets',
  'passion',
  'passion_run',
  'reflection',
  'kept',
  'tower',
  'lost',
  'arrival',
  'allowance',
  'win_share',
  'rank',
  'turns',
  'quests',
  'rushes',
  'rush_discards',
  'rush_dist',
  'extra_turns',
  'no_quest_turns',
  'years_spent',
  'saved_exp',
  'saved_pow',
  'swaps_made',
  'swaps_declined',
  'swaps_auto',
  'powers_gained',
  'used_age_reach',
  'used_ignore_req',
  'used_next_quest',
  'cost_b0',
  'cost_b1',
  'cost_b2',
  'cost_b3',
  'n_b0',
  'n_b1',
  'n_b2',
  'n_b3',
] as const;

export const PICK_COLUMNS = [
  'run',
  'value',
  'game',
  'players',
  'seat',
  'policy',
  'card',
  'turn',
  'position',
  'win_share',
] as const;

/** Per-card aggregate within a chunk: visible-and-takeable count, picks, and the picker's results. */
export type CardAgg = {
  takeable: number;
  picked: number;
  /** player-games in which the card was picked */
  pg: number;
  winSum: number;
  winSq: number;
  fairSum: number;
};

const csvCell = (v: unknown) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csvLine = (vals: unknown[]) => vals.map(csvCell).join(',');

export function gameRows(run: string, value: string, game: number, policies: string[], r: GameResult) {
  const sc = r.scores;
  const st = r.state;
  const n = st.players.length;
  const seatOf = (pid: string) => st.players.findIndex((p) => p.id === pid) + 1;
  const g = csvLine([
    run,
    value,
    game,
    r.seed,
    n,
    policies.join(';'),
    r.turns,
    sc
      .filter((x) => x.winner)
      .map((x) => seatOf(x.playerId))
      .join(';'),
    st.arrivals.map(seatOf).join(';'),
    sc.map((x) => x.total).join(';'),
    sc.map((x) => x.kept).join(';'),
    sc.map((x) => x.discsLost).join(';'),
    sc.map((x) => x.towerHeight).join(';'),
    st.players.map((p) => p.doorwayAllowance).join(';'),
    st.players.map((p) => r.stats[p.id].rushes).join(';'),
  ]);
  const players: string[] = [];
  st.players.forEach((p, i) => {
    const s = sc[i];
    const t = r.stats[p.id];
    const cb = [0, 0, 0, 0];
    const nb = [0, 0, 0, 0];
    const L = st.ruleset.trackLength;
    t.questCosts.forEach((c, k) => {
      const b = Math.min(3, Math.floor((t.questPositions[k] / L) * 4));
      cb[b] += c;
      nb[b]++;
    });
    players.push(
      csvLine([
        run,
        value,
        game,
        n,
        i + 1,
        policies[i],
        s.total,
        s.cards,
        s.fullLife,
        s.fullLifeSets,
        s.passion,
        s.passionRun,
        s.reflection,
        s.kept,
        s.towerHeight,
        s.discsLost,
        s.arrivalOrder,
        p.doorwayAllowance,
        +s.winShare.toFixed(4),
        s.rank,
        t.turns,
        t.quests,
        t.rushes,
        t.rushDiscards,
        t.rushDistance,
        t.extraTurns,
        t.noQuestTurns,
        t.yearsSpent,
        t.yearsSavedExperience,
        t.yearsSavedPowers,
        t.swapsMade,
        t.swapsDeclined,
        t.swapsAuto,
        t.powersGained.join('|'),
        t.oncePowersUsed.ageReach ? 1 : 0,
        t.oncePowersUsed.ignoreReq ? 1 : 0,
        t.oncePowersUsed.nextQuest,
        ...cb,
        ...nb,
      ]),
    );
  });
  const picks = r.picks.map((pk) => {
    const seat = seatOf(pk.playerId);
    return csvLine([
      run,
      value,
      game,
      n,
      seat,
      policies[seat - 1],
      pk.cardId,
      pk.turn,
      pk.position,
      +sc[seat - 1].winShare.toFixed(4),
    ]);
  });
  return { game: g, players, picks };
}

export function addCardAgg(agg: Record<string, CardAgg>, r: GameResult): void {
  const n = r.state.players.length;
  r.state.players.forEach((p, i) => {
    const ws = r.scores[i].winShare;
    const picked = new Set(r.picks.filter((x) => x.playerId === p.id).map((x) => x.cardId));
    for (const [cardId, rec] of Object.entries(r.seen[p.id])) {
      const a = (agg[cardId] ??= { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 });
      a.takeable += rec.takeable;
      a.picked += rec.picked;
    }
    for (const cardId of picked) {
      const a = (agg[cardId] ??= { takeable: 0, picked: 0, pg: 0, winSum: 0, winSq: 0, fairSum: 0 });
      a.pg++;
      a.winSum += ws;
      a.winSq += ws * ws;
      a.fairSum += 1 / n;
    }
  });
}
