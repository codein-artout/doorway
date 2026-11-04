// State invariants used by property tests and the simulator's --check mode.

import { turnPlayer } from './engine';
import type { GameState } from './types';
import { AGES } from './types';

/** Returns a list of violated invariants (empty = consistent state). */
export function checkInvariants(s: GameState): string[] {
  const errs: string[] = [];
  const L = s.ruleset.trackLength;
  // every card in exactly one place
  const seen = new Map<string, string>();
  const put = (id: string, where: string) => {
    if (!s.cards[id]) errs.push(`unknown card ${id} in ${where}`);
    if (seen.has(id)) errs.push(`card ${id} in ${seen.get(id)} and ${where}`);
    seen.set(id, where);
  };
  for (const age of AGES) {
    s.decks[age].forEach((id) => put(id, `deck.${age}`));
    if (s.market[age].length !== s.ruleset.market[age])
      errs.push(`market.${age} has ${s.market[age].length} slots`);
    s.market[age].forEach((id) => id && put(id, `market.${age}`));
    for (const id of [...s.decks[age], ...s.market[age]])
      if (id && s.cards[id]?.age !== age) errs.push(`${id} in wrong age row`);
  }
  s.discard.forEach((id) => put(id, 'discard'));
  for (const p of s.players) p.tower.forEach((id) => put(id, `tower.${p.id}`));
  if (seen.size !== Object.keys(s.cards).length)
    errs.push(`card count ${seen.size} ≠ ${Object.keys(s.cards).length}`);
  // pawns and stacks
  const inStacks = new Map<string, number>();
  for (const [k, ids] of Object.entries(s.stacks)) {
    if (ids.length === 0) errs.push(`empty stack at ${k}`);
    for (const id of ids) {
      if (inStacks.has(id)) errs.push(`pawn ${id} in two stacks`);
      inStacks.set(id, Number(k));
    }
  }
  for (const p of s.players) {
    if (p.position < 0 || p.position > L) errs.push(`${p.id} position ${p.position} off track`);
    if (inStacks.get(p.id) !== p.position)
      errs.push(`${p.id} stack ${inStacks.get(p.id)} ≠ position ${p.position}`);
    const arrived = p.arrivalOrder !== null;
    const arrivingNow = s.phase === 'pending_choice' && s.pending?.playerId === p.id && p.position === L; // R8: swaps before arrival
    if (arrived !== (p.position === L) && !arrivingNow)
      errs.push(`${p.id} arrival ${p.arrivalOrder} vs position ${p.position}`);
    if (arrived && s.arrivals[p.arrivalOrder! - 1] !== p.id) errs.push(`${p.id} arrival order mismatch`);
    if (arrived !== (p.doorwayAllowance !== null)) errs.push(`${p.id} allowance without arrival`);
    if (p.keptRange) {
      const [a, b] = p.keptRange;
      if (!arrived) errs.push(`${p.id} window before arrival`);
      if (p.tower.length === 0 ? !(a === 0 && b === -1) : a < 0 || b < a || b >= p.tower.length)
        errs.push(`${p.id} bad window ${a}-${b}`);
      if (b - a + 1 > (p.doorwayAllowance ?? 0)) errs.push(`${p.id} window larger than allowance`);
    }
    if (new Set(p.milestonesUsed).size !== p.milestonesUsed.length) errs.push(`${p.id} milestone used twice`);
    for (const m of p.milestonesUsed) if (m > p.position) errs.push(`${p.id} milestone ${m} ahead of pawn`);
    if (p.pendingNextQuestDiscount < 0) errs.push(`${p.id} negative pending discount`);
  }
  if (s.arrivals.length !== new Set(s.arrivals).size) errs.push('duplicate arrivals');
  // phase consistency
  const allArrived = s.players.every((p) => p.arrivalOrder !== null);
  const allChosen = s.players.every((p) => p.keptRange !== null);
  if (s.phase === 'pending_choice') {
    if (!s.pending || s.pending.queue.length === 0) errs.push('pending phase without a queue');
    else if (s.players.find((p) => p.id === s.pending!.playerId)!.tower.length < 2)
      errs.push('pending swap with < 2 discs');
  } else if (s.pending) errs.push('pending set outside pending phase');
  if (s.phase === 'playing' && (allArrived || turnPlayer(s) === null))
    errs.push('playing with nobody to play');
  if (s.phase === 'doorway_selection' && (!allArrived || allChosen)) errs.push('bad doorway_selection phase');
  if (s.phase === 'over' && !(allArrived && allChosen)) errs.push('over before everyone chose');
  return errs;
}
