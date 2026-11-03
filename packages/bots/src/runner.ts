// Headless game driver shared by tests, the simulator and the browser worker.

import {
  applyInPlace,
  botSeed,
  checkQuest,
  currentPlayer,
  init,
  scoreAll,
  AGES,
  Rng,
  type Card,
  type GameEvent,
  type GameState,
  type Move,
  type PlayerId,
  type Ruleset,
  type ScoreBreakdown,
} from '@doorway/engine';
import { getPolicy } from './policies';
import type { BotPolicy } from './types';
import { bestWindowMove, makeBotView } from './view';

export type SeatSpec = { name?: string; policy: string };

export type PlayerStats = {
  quests: number;
  rushes: number;
  rushDiscards: number;
  turns: number;
  /** turns taken immediately after one's own previous turn (furthest-back extra turns) */
  extraTurns: number;
  noQuestTurns: number;
  yearsSpent: number;
  yearsSavedExperience: number;
  yearsSavedPowers: number;
  rushDistance: number;
  swapsMade: number;
  swapsDeclined: number;
  swapsAuto: number;
  powersGained: string[];
  oncePowersUsed: { ageReach: boolean; ignoreReq: boolean; nextQuest: number };
  towerAtArrival: number;
  /** (turn index, years paid) per quest, for engine-acceleration curves */
  questCosts: number[];
  questPositions: number[];
};

export type CardPick = { cardId: string; playerId: PlayerId; turn: number; position: number };
export type CardSeen = Record<string, { takeable: number; picked: number }>;

export type GameResult = {
  seed: string;
  state: GameState;
  scores: ScoreBreakdown[];
  stats: Record<PlayerId, PlayerStats>;
  picks: CardPick[];
  /** per player: how often each card was visible & takeable on that player's turn, and picked */
  seen: Record<PlayerId, CardSeen>;
  turns: number;
  events?: GameEvent[];
};

export type PlayOptions = {
  ruleset: Ruleset;
  cards: Card[];
  seats: SeatSpec[];
  seed: string;
  /** collect per-turn stats (default true) */
  stats?: boolean;
  /** keep the event log (default false, for speed) */
  events?: boolean;
  policies?: BotPolicy[];
  check?: (s: GameState) => void;
};

function emptyStats(): PlayerStats {
  return {
    quests: 0,
    rushes: 0,
    rushDiscards: 0,
    turns: 0,
    extraTurns: 0,
    noQuestTurns: 0,
    yearsSpent: 0,
    yearsSavedExperience: 0,
    yearsSavedPowers: 0,
    rushDistance: 0,
    swapsMade: 0,
    swapsDeclined: 0,
    swapsAuto: 0,
    powersGained: [],
    oncePowersUsed: { ageReach: false, ignoreReq: false, nextQuest: 0 },
    towerAtArrival: 0,
    questCosts: [],
    questPositions: [],
  };
}

export function playGame(o: PlayOptions): GameResult {
  const seats = o.seats.map((x, i) => ({
    id: `p${i + 1}`,
    name: x.name ?? `Seat ${i + 1}`,
    isBot: true,
    botPolicy: x.policy,
  }));
  const s = init(o.ruleset, o.cards, seats, o.seed);
  const policies = o.policies ?? o.seats.map((x) => getPolicy(x.policy));
  const rngs = o.seats.map((x, i) => Rng.fromSeed(botSeed(o.seed, i + 1, x.policy)));
  const withStats = o.stats !== false;
  const stats: Record<PlayerId, PlayerStats> = {};
  const seen: Record<PlayerId, CardSeen> = {};
  for (const p of s.players) {
    stats[p.id] = emptyStats();
    seen[p.id] = {};
  }
  const picks: CardPick[] = [];
  const events: GameEvent[] = [];
  let guard = 0;
  let lastTurnActor: PlayerId | null = null;
  while (s.phase !== 'over') {
    if (++guard > 5000) throw new Error(`Game ${o.seed} did not end`);
    const pid = currentPlayer(s)!;
    const idx = s.players.findIndex((p) => p.id === pid);
    const view = makeBotView(s, pid);
    const move: Move = policies[idx].choose(view, rngs[idx]);
    const ev: GameEvent[] = [];
    if (withStats && s.phase === 'playing') {
      const st = stats[pid];
      st.turns++;
      if (lastTurnActor === pid) st.extraTurns++;
      lastTurnActor = pid;
      let anyQuest = false;
      for (const age of AGES)
        for (const id of s.market[age]) {
          if (!id) continue;
          if (checkQuest(s, pid, id).ok) {
            anyQuest = true;
            const rec = (seen[pid][id] ??= { takeable: 0, picked: 0 });
            rec.takeable++;
            if (move.type === 'quest' && move.cardId === id) rec.picked++;
          }
        }
      if (!anyQuest) st.noQuestTurns++;
    }
    applyInPlace(s, move, pid, ev, true);
    if (withStats) collect(s, ev, stats, picks);
    if (o.events) events.push(...ev);
    // R25: bots choose their window as soon as they arrive
    for (const p of s.players)
      if (p.arrivalOrder !== null && p.keptRange === null) {
        const wev: GameEvent[] = [];
        applyInPlace(s, bestWindowMove(s, p.id), p.id, wev, true);
        if (o.events) events.push(...wev);
      }
    o.check?.(s);
  }
  return {
    seed: o.seed,
    state: s,
    scores: scoreAll(s),
    stats,
    picks,
    seen,
    turns: s.turn,
    ...(o.events ? { events } : {}),
  };
}

function collect(
  s: GameState,
  ev: GameEvent[],
  stats: Record<PlayerId, PlayerStats>,
  picks: CardPick[],
): void {
  for (const e of ev) {
    switch (e.type) {
      case 'quest_taken': {
        const st = stats[e.playerId];
        st.quests++;
        st.yearsSpent += e.cost;
        const printed = s.cards[e.cardId].years;
        // attribute savings: experience first, then powers (only what was actually saved above the floor)
        const saved = printed - e.cost;
        const exp = Math.min(e.experienceDiscount, saved);
        st.yearsSavedExperience += exp;
        st.yearsSavedPowers += Math.max(0, saved - exp);
        if (e.usedPowers.includes('age_reach')) st.oncePowersUsed.ageReach = true;
        if (e.usedPowers.includes('ignore_requirement')) st.oncePowersUsed.ignoreReq = true;
        if (e.usedPowers.includes('next_quest_discount')) st.oncePowersUsed.nextQuest++;
        st.questCosts.push(e.cost);
        st.questPositions.push(e.from);
        picks.push({ cardId: e.cardId, playerId: e.playerId, turn: s.turn, position: e.from });
        break;
      }
      case 'rushed': {
        const st = stats[e.playerId];
        st.rushes++;
        st.rushDistance += e.to - e.from;
        st.yearsSpent += e.to - e.from;
        if (e.discardedCardId) st.rushDiscards++;
        break;
      }
      case 'swap_made':
        stats[e.playerId].swapsMade++;
        break;
      case 'swap_skipped':
        if (e.reason === 'nothing_to_swap') stats[e.playerId].swapsAuto++;
        else stats[e.playerId].swapsDeclined++;
        break;
      case 'power_gained':
        stats[e.playerId].powersGained.push(e.power);
        break;
      case 'arrived':
        stats[e.playerId].towerAtArrival = s.players.find((p) => p.id === e.playerId)!.tower.length;
        break;
    }
  }
}
