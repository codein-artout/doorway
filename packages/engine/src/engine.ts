// Doorway rules engine — public API (build spec §5.1) and turn resolution (§5.4, RULINGS R5–R29).

import { Rng } from './rng';
import { ageIndex, ageOf, assertValidRuleset, baseAllowance, experienceDiscount } from './ruleset';
import { scoreAll } from './scoring';
import { canonicalJson, sha256 } from './sha256';
import type {
  Age,
  Card,
  GameEvent,
  GameState,
  Move,
  PendingAfter,
  PendingSwap,
  PlayerId,
  PlayerSetup,
  PlayerState,
  QuestOptions,
  Ruleset,
  ScoreBreakdown,
  UsedPower,
} from './types';
import { AGES, DOMAINS, IllegalMoveError } from './types';

// ---------------------------------------------------------------- hashing

export function rulesetHash(ruleset: Ruleset): string {
  return sha256(canonicalJson(ruleset));
}

export function cardsHash(cards: Card[]): string {
  return sha256(canonicalJson(cards));
}

// ---------------------------------------------------------------- setup

export function init(ruleset: Ruleset, cards: Card[], players: PlayerSetup[], seed: string): GameState {
  assertValidRuleset(ruleset);
  const n = players.length;
  if (n < 1 || n > 4) throw new Error(`Doorway needs 1–4 players (got ${n}).`);
  if (n > 1 && !ruleset.doorway[String(n)]) throw new Error(`Ruleset has no doorway.${n} allowances.`);
  const byId: Record<string, Card> = {};
  for (const c of cards) {
    if (byId[c.id]) throw new Error(`Duplicate card id ${c.id}`);
    byId[c.id] = c;
  }
  const ids = new Set<string>();
  const ps: PlayerState[] = players.map((p, i) => {
    const id = p.id ?? `p${i + 1}`;
    if (ids.has(id)) throw new Error(`Duplicate player id ${id}`);
    ids.add(id);
    return {
      id,
      name: p.name,
      isBot: !!p.isBot,
      ...(p.botPolicy !== undefined ? { botPolicy: p.botPolicy } : {}),
      seat: i + 1,
      position: 0,
      tower: [],
      milestonesUsed: [],
      oncePowersUsed: { ageReach: false, ignoreReq: false },
      pendingNextQuestDiscount: 0,
      arrivalOrder: null,
      doorwayAllowance: null,
      keptRange: null,
    };
  });

  // R14: shuffle each age deck with the game stream, then deal Young, Middle, Old.
  const rng = Rng.fromSeed(seed);
  const decks = {} as Record<Age, string[]>;
  for (const age of AGES) decks[age] = rng.shuffle(cards.filter((c) => c.age === age).map((c) => c.id));
  const market = {} as Record<Age, (string | null)[]>;
  for (const age of AGES) {
    market[age] = [];
    for (let i = 0; i < ruleset.market[age]; i++) market[age].push(decks[age].shift() ?? null);
  }

  // R6: seat 1 on top; bottom → top is seat N … seat 1.
  const stacks: Record<number, PlayerId[]> = { 0: ps.map((p) => p.id).reverse() };

  const state: GameState = {
    rulesetId: ruleset.id,
    ruleset,
    cards: byId,
    seed,
    rngState: rng.toString(),
    phase: 'playing',
    pending: null,
    players: ps,
    stacks,
    market,
    decks,
    discard: [],
    arrivals: [],
    turn: 0,
    lastActor: null,
    log: [],
    moves: [],
    rulesetHash: rulesetHash(ruleset),
    cardsHash: cardsHash(cards),
  };
  state.log.push({
    type: 'game_started',
    seed,
    rulesetId: ruleset.id,
    seats: ps.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      ...(p.botPolicy ? { botPolicy: p.botPolicy } : {}),
    })),
  });
  return state;
}

// ---------------------------------------------------------------- cloning

export function cloneState(s: GameState): GameState {
  const stacks: Record<number, PlayerId[]> = {};
  for (const k of Object.keys(s.stacks)) stacks[Number(k)] = s.stacks[Number(k)].slice();
  return {
    ...s,
    pending: s.pending
      ? {
          playerId: s.pending.playerId,
          queue: s.pending.queue.map((q) => ({ ...q })),
          after: {
            ...s.pending.after,
            refill: s.pending.after.refill ? { ...s.pending.after.refill } : null,
          },
        }
      : null,
    players: s.players.map((p) => ({
      ...p,
      tower: p.tower.slice(),
      milestonesUsed: p.milestonesUsed.slice(),
      oncePowersUsed: { ...p.oncePowersUsed },
      keptRange: p.keptRange ? [p.keptRange[0], p.keptRange[1]] : null,
    })),
    stacks,
    market: { young: s.market.young.slice(), middle: s.market.middle.slice(), old: s.market.old.slice() },
    decks: { young: s.decks.young.slice(), middle: s.decks.middle.slice(), old: s.decks.old.slice() },
    discard: s.discard.slice(),
    arrivals: s.arrivals.slice(),
    log: s.log,
    moves: s.moves,
  };
}

// ---------------------------------------------------------------- queries

export function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
}

export const isSolo = (state: GameState): boolean => state.players.length === 1;

/** R5: lowest position among non-arrived players; ties → top pawn of that space. */
export function turnPlayer(state: GameState): PlayerId | null {
  let best = Infinity;
  for (const p of state.players) if (p.arrivalOrder === null && p.position < best) best = p.position;
  if (best === Infinity) return null;
  const stack = state.stacks[best];
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = getPlayer(state, stack[i]);
    if (p.arrivalOrder === null) return p.id;
  }
  return null;
}

/** Turn order of non-arrived players: who moves now, next, … if nobody moved (for the queue UI). */
export function turnOrder(state: GameState): PlayerId[] {
  const active = state.players.filter((p) => p.arrivalOrder === null);
  const height = (p: PlayerState) => state.stacks[p.position].indexOf(p.id);
  return active
    .slice()
    .sort((a, b) => a.position - b.position || height(b) - height(a))
    .map((p) => p.id);
}

export function currentPlayer(state: GameState): PlayerId | null {
  switch (state.phase) {
    case 'over':
      return null;
    case 'pending_choice':
      return state.pending!.playerId;
    case 'playing':
      return turnPlayer(state);
    case 'doorway_selection': {
      for (const id of state.arrivals) if (getPlayer(state, id).keptRange === null) return id;
      return null;
    }
  }
}

export function isOver(state: GameState): boolean {
  return state.phase === 'over';
}

export function playerAge(state: GameState, id: PlayerId): Age | null {
  return ageOf(state.ruleset, getPlayer(state, id).position);
}

export function domainCounts(state: GameState, tower: string[]): Record<string, number> {
  const c: Record<string, number> = { pink: 0, gold: 0, green: 0, orange: 0, purple: 0 };
  for (const id of tower) c[state.cards[id].color]++;
  return c;
}

function hasPower(state: GameState, p: PlayerState, type: string): boolean {
  for (const id of p.tower) if (state.cards[id].power?.type === type) return true;
  return false;
}

function sumPower(state: GameState, p: PlayerState, type: 'rush_bonus' | 'doorway_bonus'): number {
  let s = 0;
  for (const id of p.tower) {
    const pw = state.cards[id].power;
    if (pw && pw.type === type) s += pw.amount;
  }
  return s;
}

export type CostBreakdown = {
  printed: number;
  experience: number;
  power: number;
  nextQuest: number;
  cost: number;
};

/** R21: cost = max(minCost, years − experience − crossDomain − pendingNextQuestDiscount). */
export function costBreakdown(state: GameState, playerId: PlayerId, cardId: string): CostBreakdown {
  const p = getPlayer(state, playerId);
  const card = state.cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  let count = 0;
  let power = 0;
  for (const id of p.tower) {
    const c = state.cards[id];
    if (c.color === card.color) count++;
    const pw = c.power;
    if (pw && pw.type === 'discount' && pw.color === card.color) power += pw.amount;
  }
  const experience = experienceDiscount(state.ruleset, count);
  const nextQuest = p.pendingNextQuestDiscount;
  const cost = Math.max(state.ruleset.minCost, card.years - experience - power - nextQuest);
  return { printed: card.years, experience, power, nextQuest, cost };
}

export function cost(state: GameState, playerId: PlayerId, cardId: string, _options?: QuestOptions): number {
  return costBreakdown(state, playerId, cardId).cost;
}

export type QuestCheck =
  | { ok: true; useAgeReach: boolean; useIgnoreReq: boolean }
  | { ok: false; reason: 'not_in_market' | 'too_young' | 'requirement'; message: string };

/** Can `playerId` take this face-up card now, and which once-per-game powers would it need? (R16–R18) */
export function checkQuest(state: GameState, playerId: PlayerId, cardId: string): QuestCheck {
  const p = getPlayer(state, playerId);
  const card = state.cards[cardId];
  const inMarket = !!card && state.market[card.age].includes(cardId);
  if (!inMarket) return { ok: false, reason: 'not_in_market', message: 'Not in the market.' };
  const myAge = ageOf(state.ruleset, p.position);
  if (myAge === null) return { ok: false, reason: 'too_young', message: 'Already at the Doorway.' };
  const diff = ageIndex(card.age) - ageIndex(myAge);
  let useAgeReach = false;
  if (diff > 0) {
    const canReach = diff === 1 && !p.oncePowersUsed.ageReach && hasPower(state, p, 'age_reach_once');
    if (!canReach) {
      const from = state.ruleset.ageBands[card.age][0];
      return {
        ok: false,
        reason: 'too_young',
        message: `Too young — ${card.age[0].toUpperCase() + card.age.slice(1)} from space ${from}.`,
      };
    }
    useAgeReach = true;
  }
  let useIgnoreReq = false;
  if (card.requires) {
    let have = 0;
    for (const id of p.tower) if (state.cards[id].color === card.requires.color) have++;
    if (have < card.requires.count) {
      const canIgnore = !p.oncePowersUsed.ignoreReq && hasPower(state, p, 'ignore_requirement_once');
      if (!canIgnore)
        return {
          ok: false,
          reason: 'requirement',
          message: `Needs ${card.requires.count} ${DOMAIN_NAMES[card.requires.color]}.`,
        };
      useIgnoreReq = true;
    }
  }
  return { ok: true, useAgeReach, useIgnoreReq };
}

export const DOMAIN_NAMES: Record<string, string> = {
  pink: 'Love',
  gold: 'Work',
  green: 'Play',
  orange: 'Family',
  purple: 'Wonder',
};

/** Quest moves for the turn player (one per takeable face-up card, flags set exactly when needed). */
export function questMoves(state: GameState, playerId: PlayerId): Move[] {
  const out: Move[] = [];
  for (const age of AGES)
    for (const id of state.market[age]) {
      if (id === null) continue;
      const chk = checkQuest(state, playerId, id);
      if (!chk.ok) continue;
      const m: Move = { type: 'quest', cardId: id };
      if (chk.useAgeReach) m.useAgeReach = true;
      if (chk.useIgnoreReq) m.useIgnoreReq = true;
      out.push(m);
    }
  return out;
}

export function rushMoves(state: GameState): Move[] {
  const out: Move[] = [{ type: 'rush' }];
  if (state.ruleset.rushDiscard)
    for (const age of AGES)
      for (const id of state.market[age]) if (id !== null) out.push({ type: 'rush', discardCardId: id });
  return out;
}

export function windowMoves(state: GameState, playerId: PlayerId, maximalOnly = false): Move[] {
  const p = getPlayer(state, playerId);
  if (p.arrivalOrder === null || p.keptRange !== null) return [];
  const h = p.tower.length;
  const a = p.doorwayAllowance ?? 0;
  const out: Move[] = [];
  if (maximalOnly) {
    const len = Math.min(a, h);
    for (let s = 0; s + len <= h; s++) out.push({ type: 'choose_window', start: s, end: s + len - 1 });
    return out;
  }
  for (let s = 0; s < h; s++)
    for (let e = s; e < h && e - s + 1 <= a; e++) out.push({ type: 'choose_window', start: s, end: e });
  return out;
}

export function legalMoves(state: GameState, playerId: PlayerId): Move[] {
  if (state.phase === 'over') return [];
  const out: Move[] = [];
  if (state.phase === 'pending_choice' && state.pending!.playerId === playerId) {
    const h = getPlayer(state, playerId).tower.length;
    for (let i = 0; i + 1 < h; i++) out.push({ type: 'swap', index: i });
    out.push({ type: 'skip_swap' });
  } else if (state.phase === 'playing' && turnPlayer(state) === playerId) {
    out.push(...questMoves(state, playerId), ...rushMoves(state));
  }
  out.push(...windowMoves(state, playerId));
  return out;
}

// ---------------------------------------------------------------- apply

export type ApplyResult = { state: GameState; events: GameEvent[] };

export function apply(state: GameState, move: Move, playerId?: PlayerId): ApplyResult {
  const s = cloneState(state);
  const events: GameEvent[] = [];
  applyInPlace(s, move, playerId, events);
  s.log = state.log.concat(events);
  return { state: s, events };
}

/**
 * Mutating apply for simulations and search. Validates exactly like `apply`.
 * Pushes events into `events` when given; does not touch `state.log` (the caller owns logging).
 * Appends to `state.moves` unless `recordMove` is false.
 */
export function applyInPlace(
  s: GameState,
  move: Move,
  playerId?: PlayerId,
  events?: GameEvent[],
  recordMove = true,
): void {
  const ev = events ?? [];
  const pid = playerId ?? currentPlayer(s);
  if (pid === null) throw new IllegalMoveError('The game is over.');
  const p = getPlayer(s, pid);
  switch (move.type) {
    case 'quest':
      doQuest(s, p, move, ev);
      break;
    case 'rush':
      doRush(s, p, move, ev);
      break;
    case 'swap':
    case 'skip_swap':
      doSwap(s, p, move, ev);
      break;
    case 'choose_window':
      doWindow(s, p, move, ev, false);
      break;
    default:
      throw new IllegalMoveError(`Unknown move type ${(move as { type: string }).type}`);
  }
  if (recordMove) s.moves = s.moves.concat({ playerId: pid, move });
}

function requireTurn(s: GameState, p: PlayerState): void {
  if (s.phase !== 'playing') throw new IllegalMoveError(`Not a quest/rush moment (phase ${s.phase}).`);
  if (turnPlayer(s) !== p.id) throw new IllegalMoveError(`It is not ${p.name}'s turn.`);
}

function movePawn(s: GameState, p: PlayerState, to: number, ev: GameEvent[]): void {
  const from = p.position;
  const st = s.stacks[from];
  st.splice(st.indexOf(p.id), 1);
  if (st.length === 0) delete s.stacks[from];
  p.position = to;
  (s.stacks[to] ??= []).push(p.id); // R12/§4: land on top
  const a0 = ageOf(s.ruleset, from);
  const a1 = ageOf(s.ruleset, to);
  if (a1 !== null && a1 !== a0) ev.push({ type: 'age_changed', playerId: p.id, age: a1 });
}

/** R7: every unused Milestone m with from < m ≤ to, ascending. */
function queueMilestones(
  s: GameState,
  p: PlayerState,
  from: number,
  to: number,
  queue: PendingSwap[],
  ev: GameEvent[],
): void {
  const ms = s.ruleset.milestones.slice().sort((a, b) => a - b);
  for (const m of ms) {
    if (from < m && m <= to && !p.milestonesUsed.includes(m)) {
      p.milestonesUsed.push(m);
      ev.push({ type: 'milestone_reached', playerId: p.id, space: m });
      queue.push({ kind: 'swap', source: 'milestone', space: m });
    }
  }
}

function refillSlot(s: GameState, age: Age, slot: number, ev: GameEvent[]): void {
  const next = s.decks[age].shift() ?? null;
  s.market[age][slot] = next;
  ev.push({ type: 'market_refilled', age, slot, cardId: next });
}

function doQuest(
  s: GameState,
  p: PlayerState,
  move: Extract<Move, { type: 'quest' }>,
  ev: GameEvent[],
): void {
  requireTurn(s, p);
  const chk = checkQuest(s, p.id, move.cardId);
  if (!chk.ok) throw new IllegalMoveError(`${p.name} can't take ${move.cardId}: ${chk.message}`);
  if (!!move.useAgeReach !== chk.useAgeReach)
    throw new IllegalMoveError(
      chk.useAgeReach
        ? 'This quest needs Old friends (useAgeReach).'
        : 'Old friends is only used on a card one age older (R17).',
    );
  if (!!move.useIgnoreReq !== chk.useIgnoreReq)
    throw new IllegalMoveError(
      chk.useIgnoreReq
        ? 'This quest needs Say yes more (useIgnoreReq).'
        : 'Say yes more is only used on an unmet requirement (R18).',
    );
  const card = s.cards[move.cardId];
  const cb = costBreakdown(s, p.id, card.id);
  const used: UsedPower[] = [];
  if (chk.useAgeReach) {
    p.oncePowersUsed.ageReach = true;
    used.push('age_reach');
  }
  if (chk.useIgnoreReq) {
    p.oncePowersUsed.ignoreReq = true;
    used.push('ignore_requirement');
  }
  if (p.pendingNextQuestDiscount > 0) {
    used.push('next_quest_discount');
    p.pendingNextQuestDiscount = 0; // R20: consumed even if partly wasted
  }
  // take the card out of its slot
  const row = s.market[card.age];
  const slot = row.indexOf(card.id);
  row[slot] = null;

  s.turn++;
  // R8.1 pay and move
  const from = p.position;
  const to = Math.min(from + cb.cost, s.ruleset.trackLength);
  ev.push({
    type: 'quest_taken',
    playerId: p.id,
    cardId: card.id,
    cost: cb.cost,
    from,
    to,
    usedPowers: used,
    experienceDiscount: cb.experience,
    powerDiscount: cb.power + cb.nextQuest,
  });
  movePawn(s, p, to, ev);
  // R8.2 push the disc
  p.tower.push(card.id);
  // R8.3 mark powers (R19: they start after this quest)
  const queue: PendingSwap[] = [];
  if (card.power) {
    ev.push({ type: 'power_gained', playerId: p.id, cardId: card.id, power: card.power.type });
    if (card.power.type === 'next_quest_discount') p.pendingNextQuestDiscount += card.power.amount;
    // R8.4 Keep a diary
    if (card.power.type === 'swap_now') queue.push({ kind: 'swap', source: 'diary' });
  }
  // R8.5 Milestones, ascending
  queueMilestones(s, p, from, to, queue, ev);
  s.lastActor = p.id;
  startPending(s, p, queue, { refill: { age: card.age, slot }, endTurn: true }, ev);
}

function doRush(s: GameState, p: PlayerState, move: Extract<Move, { type: 'rush' }>, ev: GameEvent[]): void {
  requireTurn(s, p);
  // R10: optional discard, before moving
  if (move.discardCardId !== undefined) {
    if (!s.ruleset.rushDiscard) throw new IllegalMoveError('Rush discard is off in this ruleset.');
    const card = s.cards[move.discardCardId];
    const slot = card ? s.market[card.age].indexOf(card.id) : -1;
    if (!card || slot < 0) throw new IllegalMoveError(`${move.discardCardId} is not face up in the market.`);
    s.market[card.age][slot] = null;
    s.discard.push(card.id);
    ev.push({ type: 'card_discarded', cardId: card.id, age: card.age, slot, reason: 'rush' });
    refillSlot(s, card.age, slot, ev);
  }
  s.turn++;
  const from = p.position;
  let target: number;
  if (isSolo(s)) target = from + s.ruleset.solo.rush;
  else {
    // R9: nearest pawn strictly ahead, ignoring arrived pawns
    let ahead = Infinity;
    for (const o of s.players)
      if (o.id !== p.id && o.arrivalOrder === null && o.position > from && o.position < ahead)
        ahead = o.position;
    target = ahead === Infinity ? from + s.ruleset.rushNoPawnAhead : ahead + 1;
  }
  target += sumPower(s, p, 'rush_bonus');
  const to = Math.min(Math.max(target, from + 1), s.ruleset.trackLength);
  ev.push({
    type: 'rushed',
    playerId: p.id,
    from,
    to,
    ...(move.discardCardId ? { discardedCardId: move.discardCardId } : {}),
  });
  movePawn(s, p, to, ev);
  const queue: PendingSwap[] = [];
  queueMilestones(s, p, from, to, queue, ev);
  s.lastActor = p.id;
  startPending(s, p, queue, { refill: null, endTurn: true }, ev);
}

function startPending(
  s: GameState,
  p: PlayerState,
  queue: PendingSwap[],
  after: PendingAfter,
  ev: GameEvent[],
): void {
  s.pending = { playerId: p.id, queue, after };
  s.phase = 'pending_choice';
  drainPending(s, ev);
}

/** Auto-skip swaps with nothing to swap (R3); finish the turn once the queue is empty. */
function drainPending(s: GameState, ev: GameEvent[]): void {
  const pend = s.pending!;
  const p = getPlayer(s, pend.playerId);
  while (pend.queue.length > 0 && p.tower.length < 2) {
    const sw = pend.queue.shift()!;
    ev.push({ type: 'swap_skipped', playerId: p.id, source: sw.source, reason: 'nothing_to_swap' });
  }
  if (pend.queue.length > 0) return; // wait for the player's choice
  s.pending = null;
  finishTurn(s, p, pend.after, ev);
}

function finishTurn(s: GameState, p: PlayerState, after: PendingAfter, ev: GameEvent[]): void {
  // R8.6 refill
  if (after.refill) refillSlot(s, after.refill.age, after.refill.slot, ev);
  // R8.7 arrival
  if (p.position >= s.ruleset.trackLength && p.arrivalOrder === null) arrive(s, p, ev);
  // R29 solo drift at the end of every turn
  if (after.endTurn && isSolo(s)) soloDrift(s, ev);
  updatePhase(s, ev);
}

function arrive(s: GameState, p: PlayerState, ev: GameEvent[]): void {
  s.arrivals.push(p.id);
  p.arrivalOrder = s.arrivals.length;
  p.doorwayAllowance =
    baseAllowance(s.ruleset, s.players.length, p.arrivalOrder) + sumPower(s, p, 'doorway_bonus');
  ev.push({ type: 'arrived', playerId: p.id, order: p.arrivalOrder, allowance: p.doorwayAllowance });
  // R24: a tower no taller than the allowance is kept whole, without a choice
  if (p.tower.length <= p.doorwayAllowance) {
    p.keptRange = [0, p.tower.length - 1];
    ev.push({ type: 'window_chosen', playerId: p.id, start: 0, end: p.tower.length - 1, auto: true });
  }
}

function soloDrift(s: GameState, ev: GameEvent[]): void {
  ev.push({ type: 'solo_drift' });
  for (const age of AGES) {
    const row = s.market[age];
    const left = row.findIndex((x) => x !== null);
    if (left < 0) continue;
    const gone = row[left]!;
    s.discard.push(gone);
    ev.push({ type: 'card_discarded', cardId: gone, age, slot: left, reason: 'solo_drift' });
    const rest = row.filter((x, i) => x !== null && i !== left) as string[];
    const next: (string | null)[] = rest.slice();
    while (next.length < row.length) {
      const slot = next.length;
      const c = s.decks[age].shift() ?? null;
      next.push(c);
      ev.push({ type: 'market_refilled', age, slot, cardId: c });
    }
    s.market[age] = next;
  }
}

function updatePhase(s: GameState, ev: GameEvent[]): void {
  if (s.pending) {
    s.phase = 'pending_choice';
    return;
  }
  const allArrived = s.players.every((p) => p.arrivalOrder !== null);
  if (!allArrived) {
    s.phase = 'playing';
    return;
  }
  if (s.players.every((p) => p.keptRange !== null)) {
    if (s.phase !== 'over') {
      s.phase = 'over';
      ev.push({ type: 'game_over', scores: scoreAll(s) });
    }
  } else s.phase = 'doorway_selection';
}

function doSwap(
  s: GameState,
  p: PlayerState,
  move: Extract<Move, { type: 'swap' | 'skip_swap' }>,
  ev: GameEvent[],
): void {
  if (s.phase !== 'pending_choice' || !s.pending || s.pending.playerId !== p.id)
    throw new IllegalMoveError(`${p.name} has no swap to make.`);
  const sw = s.pending.queue[0];
  if (move.type === 'swap') {
    const i = move.index;
    if (!Number.isInteger(i) || i < 0 || i + 1 >= p.tower.length)
      throw new IllegalMoveError(`Swap index ${i} is outside the tower (height ${p.tower.length}).`);
    const t = p.tower[i];
    p.tower[i] = p.tower[i + 1];
    p.tower[i + 1] = t;
    ev.push({ type: 'swap_made', playerId: p.id, index: i, source: sw.source });
  } else {
    ev.push({ type: 'swap_skipped', playerId: p.id, source: sw.source, reason: 'declined' });
  }
  s.pending.queue.shift();
  drainPending(s, ev);
}

function doWindow(
  s: GameState,
  p: PlayerState,
  move: Extract<Move, { type: 'choose_window' }>,
  ev: GameEvent[],
  auto: boolean,
): void {
  if (p.arrivalOrder === null) throw new IllegalMoveError(`${p.name} has not reached the Doorway.`);
  if (p.keptRange !== null) throw new IllegalMoveError(`${p.name} already chose a stretch.`);
  const { start, end } = move;
  const h = p.tower.length;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= h)
    throw new IllegalMoveError(`Window ${start}–${end} is not inside the tower (height ${h}).`);
  if (end - start + 1 > (p.doorwayAllowance ?? 0))
    throw new IllegalMoveError(
      `Window of ${end - start + 1} is larger than the allowance ${p.doorwayAllowance}.`,
    );
  p.keptRange = [start, end];
  ev.push({ type: 'window_chosen', playerId: p.id, start, end, auto });
  updatePhase(s, ev);
}

// ---------------------------------------------------------------- scoring passthrough

export function score(state: GameState): ScoreBreakdown[] {
  return scoreAll(state);
}

export { DOMAINS };
