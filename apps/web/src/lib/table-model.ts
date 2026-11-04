// Pure view-model for the game table: statuses, previews, banner and log copy (DESIGN.md §5 voice).
// Game rules stay in the engine; this only asks the engine questions and phrases the answers.

import {
  ageOf,
  apply,
  checkQuest,
  costBreakdown,
  currentPlayer,
  experienceDiscount,
  turnOrder,
  type Age,
  type Card,
  type GameEvent,
  type GameState,
  type Move,
  type PlayerId,
  type PlayerState,
} from '@doorway/engine';
import { AGE_NAME, DOMAIN, DOMAIN_ORDER } from './domains';

export const P = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;
export const nameOf = (s: GameState, id: PlayerId) => P(s, id).name;

export type Choice =
  | { kind: 'quest'; cardId: string; useAgeReach?: boolean; useIgnoreReq?: boolean }
  | { kind: 'rush'; discardCardId?: string }
  | null;

export function choiceToMove(c: Choice): Move | null {
  if (!c) return null;
  if (c.kind === 'rush')
    return c.discardCardId ? { type: 'rush', discardCardId: c.discardCardId } : { type: 'rush' };
  const m: Move = { type: 'quest', cardId: c.cardId };
  if (c.useAgeReach) m.useAgeReach = true;
  if (c.useIgnoreReq) m.useIgnoreReq = true;
  return m;
}

/** Where a move would land and who would move next (swaps don't move pawns, so they're skipped). */
export function simulate(
  s: GameState,
  pid: PlayerId,
  move: Move,
): { landing: number; next: PlayerId | null; state: GameState } | null {
  try {
    let t = apply(s, move, pid).state;
    let guard = 0;
    while (t.phase === 'pending_choice' && guard++ < 10)
      t = apply(t, { type: 'skip_swap' }, t.pending!.playerId).state;
    return { landing: P(t, pid).position, next: t.phase === 'playing' ? currentPlayer(t) : null, state: t };
  } catch {
    return null;
  }
}

export function rushLanding(s: GameState, pid: PlayerId): number | null {
  return simulate(s, pid, { type: 'rush' })?.landing ?? null;
}

export function powerText(c: Card): string | null {
  if (c.reflection) return `Reflection: +1 per kept ${DOMAIN[c.reflection].name} disc.`;
  if (c.power?.text) return `Power: ${c.power.text}`;
  return null;
}

export type CardView = {
  id: string;
  card: Card;
  printed: number;
  cost: number;
  discounted: boolean;
  status: string;
  tone: 'door' | 'muted' | 'alert';
  takeable: boolean;
  needsAgeReach: boolean;
  needsIgnoreReq: boolean;
  reason: string | null;
  landing: number | null;
  aria: string;
};

export function cardView(
  s: GameState,
  viewer: PlayerId | null,
  id: string,
  o: { myTurn: boolean; rushMode: boolean; discarding: boolean },
): CardView {
  const card = s.cards[id];
  const cb = viewer
    ? costBreakdown(s, viewer, id)
    : { printed: card.years, cost: card.years, experience: 0, power: 0, nextQuest: 0 };
  const chk = viewer ? checkQuest(s, viewer, id) : null;
  const takeable = !!chk && chk.ok;
  const me = viewer ? P(s, viewer) : null;
  const landing = me ? Math.min(s.ruleset.trackLength, me.position + cb.cost) : null;
  let status: string;
  let tone: CardView['tone'] = 'muted';
  if (!o.myTurn) status = chk && !chk.ok ? chk.message : 'Waiting for your turn';
  else if (o.rushMode) {
    status = o.discarding ? 'Will be discarded' : 'Tap to discard';
    tone = o.discarding ? 'alert' : 'muted';
  } else if (chk && !chk.ok) status = chk.message;
  else {
    status = `Lands on ${landing}`;
    tone = 'door';
  }
  const reqText = card.requires ? `Needs ${card.requires.count} ${DOMAIN[card.requires.color].name}` : null;
  return {
    id,
    card,
    printed: cb.printed,
    cost: cb.cost,
    discounted: cb.cost < cb.printed,
    status,
    tone,
    takeable,
    needsAgeReach: !!chk && chk.ok && chk.useAgeReach,
    needsIgnoreReq: !!chk && chk.ok && chk.useIgnoreReq,
    reason: chk && !chk.ok ? chk.message : null,
    landing,
    aria: `${card.name}, ${DOMAIN[card.color].name}, ${card.age}, ${cb.cost} years, ${card.points} points${reqText ? ', ' + reqText.toLowerCase() : ''}. ${status}`,
  };
}

export function discountSummary(s: GameState, p: PlayerState): string[] {
  const counts: Record<string, number> = {};
  for (const id of p.tower) counts[s.cards[id].color] = (counts[s.cards[id].color] ?? 0) + 1;
  return DOMAIN_ORDER.filter((d) => experienceDiscount(s.ruleset, counts[d] ?? 0) > 0).map(
    (d) => `${DOMAIN[d].name} −${experienceDiscount(s.ruleset, counts[d] ?? 0)} (${counts[d]} discs)`,
  );
}

export function powersOf(s: GameState, p: PlayerState) {
  return p.tower
    .map((id) => s.cards[id])
    .filter((c) => c.power)
    .map((c) => {
      const t = c.power!.type;
      const state =
        t === 'age_reach_once'
          ? p.oncePowersUsed.ageReach
            ? 'used'
            : 'ready (once per game)'
          : t === 'ignore_requirement_once'
            ? p.oncePowersUsed.ignoreReq
              ? 'used'
              : 'ready (once per game)'
            : t === 'next_quest_discount'
              ? p.pendingNextQuestDiscount > 0
                ? 'waiting for your next quest'
                : 'used'
              : 'active';
      return { card: c, state };
    });
}

export function ageName(s: GameState, pos: number): string {
  const a = ageOf(s.ruleset, pos);
  return a ? AGE_NAME[a] : 'At the Doorway';
}

/** Preview copy for the action bar: "You move 11 → 13. You're still furthest back — you move again." */
export function preview(
  s: GameState,
  viewer: PlayerId,
  choice: Choice,
): { text: string; next: string; landing: number | null } {
  const me = P(s, viewer);
  const cp = currentPlayer(s);
  if (cp !== viewer || s.phase !== 'playing')
    return {
      text: 'Not your turn yet.',
      next: cp ? `${nameOf(s, cp)} is furthest back.` : '',
      landing: null,
    };
  const rt = rushLanding(s, viewer);
  if (!choice)
    return {
      text: 'Pick a quest card, or Rush.',
      next: rt !== null ? `Rushing now lands you on ${rt}.` : '',
      landing: null,
    };
  const move = choiceToMove(choice)!;
  const sim = simulate(s, viewer, move);
  if (!sim) return { text: 'You can’t take that one.', next: '', landing: null };
  const L = s.ruleset.trackLength;
  let text: string;
  if (choice.kind === 'rush')
    text = `Rush ${me.position} → ${sim.landing}${choice.discardCardId ? `, discarding ${s.cards[choice.discardCardId].name}.` : '. Tap a card to discard it first (optional).'}`;
  else {
    const cb = costBreakdown(s, viewer, choice.cardId);
    const c = s.cards[choice.cardId];
    const parts: string[] = [];
    if (cb.experience) parts.push(`${DOMAIN[c.color].name} −${cb.experience}`);
    if (cb.power) parts.push(`powers −${cb.power}`);
    if (cb.nextQuest) parts.push(`Quit the good job −${cb.nextQuest}`);
    text = `${c.name}: ${parts.length ? `${cb.printed} → ${cb.cost} years (${parts.join(', ')})` : `${cb.cost} ${cb.cost === 1 ? 'year' : 'years'}`}. You move ${me.position} → ${sim.landing}.`;
  }
  let next: string;
  if (sim.landing >= L) next = 'You reach the Doorway and take the top tile.';
  else if (sim.next === viewer) {
    const stack = sim.state.stacks[sim.landing] ?? [];
    next =
      stack.length > 1
        ? `You land on ${nameOf(s, stack[stack.length - 2])} and go on top — you move again.`
        : 'You’re still furthest back — you move again.';
  } else if (sim.next) next = `${nameOf(s, sim.next)} (space ${P(sim.state, sim.next).position}) moves next.`;
  else next = '';
  return { text, next, landing: sim.landing };
}

export type QueueEntry = { player: PlayerState; slot: string; current: boolean };

export function queue(s: GameState): QueueEntry[] {
  const order = turnOrder(s);
  const cp = currentPlayer(s);
  const names = ['Now', 'Next', '3rd', '4th'];
  const active = order.map((id, i) => ({
    player: P(s, id),
    slot: names[i] ?? `${i + 1}th`,
    current: id === cp,
  }));
  const arrived = s.arrivals.map((id) => ({
    player: P(s, id),
    slot: `Through · ${P(s, id).arrivalOrder}${['st', 'nd', 'rd', 'th'][Math.min(3, P(s, id).arrivalOrder! - 1)]}`,
    current: id === cp,
  }));
  return [...active, ...arrived];
}

export function banner(s: GameState, viewer: PlayerId | null, again: boolean, thinking: boolean) {
  const cp = currentPlayer(s);
  const order = turnOrder(s);
  const whyOrder = order.map((id) => `${nameOf(s, id)} ${P(s, id).position}`).join(' → ');
  const turnNo = s.turn + 1;
  if (s.phase === 'over')
    return {
      eyebrow: 'Game over',
      title: 'Everyone is through the Doorway.',
      why: '',
      whyWho: 'nobody’s',
      whyOrder,
      mine: false,
    };
  if (!cp)
    return {
      eyebrow: 'The Doorway',
      title: 'Choosing what to carry through.',
      why: '',
      whyWho: 'nobody’s',
      whyOrder,
      mine: false,
    };
  const c = P(s, cp);
  if (s.phase === 'pending_choice') {
    const src = s.pending!.queue[0];
    const what = src.source === 'diary' ? 'Keep a diary' : `Milestone ${src.space}`;
    return {
      eyebrow: `Turn ${s.turn} · ${what}`,
      title: c.isBot ? `${c.name} is thinking…` : `${what}: you may swap, ${c.name}.`,
      why: 'Swap two adjacent discs in your tower, or skip.',
      whyWho: cp === viewer ? 'my' : `${c.name}’s`,
      whyOrder,
      mine: !c.isBot,
    };
  }
  if (s.phase === 'doorway_selection')
    return {
      eyebrow: 'The Doorway',
      title: `${c.name} is choosing a stretch.`,
      why: 'Everyone else is through.',
      whyWho: `${c.name}’s`,
      whyOrder,
      mine: !c.isBot,
    };
  const next = order[1];
  if (!c.isBot) {
    return {
      eyebrow: `Turn ${turnNo} · ${c.name}’s move`,
      title: again ? `You go again, ${c.name}.` : `Your turn, ${c.name}.`,
      why: `You’re furthest back, on space ${c.position}.${next ? ` ${nameOf(s, next)} is next, at ${P(s, next).position}.` : ''}`,
      whyWho: 'my',
      whyOrder,
      mine: true,
    };
  }
  return {
    eyebrow: `Turn ${turnNo} · bot move`,
    title: thinking ? `${c.name} is thinking…` : `${c.name} moves next.`,
    why: `${c.name} is furthest back now, on space ${c.position}.${viewer && viewer !== cp ? ` You are at ${P(s, viewer).position}.` : ''}`,
    whyWho: `${c.name}’s`,
    whyOrder,
    mine: false,
  };
}

/** One readable line per event ("Priya took Fall in love (4 years) and moved to 4."). */
export function logLine(s: GameState, e: GameEvent): string | null {
  const n = (id: PlayerId) => nameOf(s, id);
  switch (e.type) {
    case 'quest_taken': {
      const c = s.cards[e.cardId];
      const disc =
        c.years !== e.cost ? `${c.years} → ${e.cost} years` : `${e.cost} ${e.cost === 1 ? 'year' : 'years'}`;
      const used = e.usedPowers.includes('age_reach')
        ? ' with Old friends'
        : e.usedPowers.includes('ignore_requirement')
          ? ' with Say yes more'
          : '';
      return `${n(e.playerId)} took ${c.name} (${disc})${used} and moved to ${e.to}.`;
    }
    case 'rushed':
      return `${n(e.playerId)} rushed ${e.from} → ${e.to}${e.discardedCardId ? `, discarding ${s.cards[e.discardedCardId].name}` : ''}.`;
    case 'milestone_reached':
      return `${n(e.playerId)} reached Milestone ${e.space}.`;
    case 'swap_made':
      return `${n(e.playerId)} swapped discs ${e.index + 1} and ${e.index + 2}.`;
    case 'swap_skipped':
      return e.reason === 'nothing_to_swap'
        ? `${n(e.playerId)} had nothing to swap yet.`
        : `${n(e.playerId)} kept the tower as it was.`;
    case 'age_changed':
      return `${n(e.playerId)} is now ${AGE_NAME[e.age as Age]}.`;
    case 'arrived':
      return `${n(e.playerId)} reached the Doorway ${['first', 'second', 'third', 'fourth'][e.order - 1] ?? `#${e.order}`} and may keep ${e.allowance}.`;
    case 'window_chosen':
      return e.end < e.start
        ? `${n(e.playerId)} walked through with nothing.`
        : `${n(e.playerId)} walked through with discs ${e.start + 1}–${e.end + 1}.`;
    case 'game_over':
      return 'Everyone is through the Doorway.';
    default:
      return null;
  }
}

export function fullLog(s: GameState): string[] {
  return s.log.map((e) => logLine(s, e)).filter((x): x is string => !!x);
}

/** First-game tips (spec §8.5): the first Quest, Rush, age change, Milestone and arrival of a human. */
export type TipKind = 'quest' | 'rush' | 'age' | 'milestone' | 'arrival';
export const TIPS: Record<TipKind, string> = {
  quest: 'Your disc goes on top of your tower. Two discs of a domain make that domain one year cheaper.',
  rush: 'A Rush jumps you just past the nearest pawn ahead — and hands the next turn to whoever you passed.',
  age: 'You are older now: a new row of the market opens to you. Age is checked at the start of each turn.',
  milestone: 'Milestone: you may swap two neighbouring discs. Use it to join a run of one colour.',
  arrival: 'You are at the Doorway. Pick one unbroken stretch of your tower; everything else stays behind.',
};

export function tipsFrom(events: GameEvent[], humans: Set<PlayerId>): TipKind[] {
  const out: TipKind[] = [];
  for (const e of events) {
    if (!('playerId' in e) || !humans.has(e.playerId)) continue;
    if (e.type === 'quest_taken') out.push('quest');
    if (e.type === 'rushed') out.push('rush');
    if (e.type === 'age_changed') out.push('age');
    if (e.type === 'milestone_reached') out.push('milestone');
    if (e.type === 'arrived') out.push('arrival');
  }
  return out;
}

/** "Already through: … Still on the path: …" under the Doorway screens. */
export function othersLine(state: GameState, pid: PlayerId): string {
  const ord = (n: number) => `${n}${['st', 'nd', 'rd', 'th'][Math.min(3, n - 1)]}`;
  const through = state.players
    .filter((p) => p.id !== pid && p.arrivalOrder !== null)
    .map(
      (p) =>
        `${p.name} (${ord(p.arrivalOrder!)}${p.keptRange ? `, kept ${p.keptRange[1] - p.keptRange[0] + 1} of ${p.tower.length}` : ''})`,
    );
  const path = state.players.filter((p) => p.arrivalOrder === null).map((p) => `${p.name} at ${p.position}`);
  return `${through.length ? `Already through: ${through.join(', ')}. ` : ''}${path.length ? `Still on the path: ${path.join(', ')}.` : 'Everyone else is through.'}`;
}
