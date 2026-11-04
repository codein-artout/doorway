// The v2 demo position (DESIGN-v2 §2): turn 22, Priya 11, Arun 12, Meera 13, Kavi 15, Priya to move.
// Built by playing HIST0 from Analyst-Table.dc.html through the real engine, so it is reachable under the rules.

import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { applyInPlace, scenario, type GameState, type Move, type PlayerSetup } from '@doorway/engine';

/** [seat initial, Q(uest)|R(ush), space after, card] — HIST0 verbatim. */
export const HIST0: [string, 'Q' | 'R', number, string | null][] = [
  ['P', 'Q', 2, 'PU-Y2'],
  ['A', 'Q', 2, 'GR-Y2'],
  ['M', 'R', 3, null],
  ['K', 'Q', 3, 'GD-Y3'],
  ['A', 'Q', 4, 'GR-Y1'],
  ['P', 'Q', 4, 'GD-Y1'],
  ['K', 'Q', 6, 'GD-Y4'],
  ['M', 'Q', 5, 'PU-Y1'],
  ['P', 'Q', 7, 'PK-Y4'],
  ['A', 'Q', 6, 'OR-Y1'],
  ['M', 'Q', 7, 'PK-Y1'],
  ['A', 'Q', 8, 'GR-Y3'],
  ['K', 'R', 8, null],
  ['M', 'R', 9, null],
  ['P', 'Q', 11, 'PK-Y5'],
  ['K', 'Q', 11, 'OR-Y4'],
  ['A', 'Q', 10, 'OR-Y2'],
  ['M', 'Q', 11, 'PK-Y2'],
  ['A', 'Q', 12, 'GR-Y4'],
  ['M', 'Q', 13, 'GD-Y2'],
  ['K', 'Q', 15, 'PU-Y5'],
];

export const DEMO_SEATS: PlayerSetup[] = [
  { id: 'p1', name: 'Priya' },
  { id: 'p2', name: 'Arun', isBot: true, botPolicy: 'tempo' },
  { id: 'p3', name: 'Meera' },
  { id: 'p4', name: 'Kavi', isBot: true, botPolicy: 'specialist' },
];
const SEAT: Record<string, string> = { P: 'p1', A: 'p2', M: 'p3', K: 'p4' };

/** The demo game after HIST0 (21 turns; turn 22 is Priya's). Milestone swaps on the way are skipped. */
export function demoState(): GameState {
  const taken = HIST0.filter((h) => h[3]).map((h) => h[3]!);
  const young = [...taken, 'PK-Y3', 'OR-Y5', 'PU-Y3', 'GR-Y5', 'OR-Y3', 'PU-Y4', 'GD-Y5'];
  const s = scenario(DEFAULT_RULESET, CARDS, DEMO_SEATS, {
    seed: 'v2-demo',
    market: { young: young.slice(0, 3), middle: ['PU-M2', 'GR-M2'], old: ['PK-O2', 'OR-O3'] },
    decks: { young: young.slice(3), middle: ['OR-M2', 'GR-M3'], old: ['PU-O1'] },
  });
  for (const [who, kind, to, card] of HIST0) {
    const pid = SEAT[who];
    const move: Move = kind === 'Q' ? { type: 'quest', cardId: card! } : { type: 'rush' };
    applyInPlace(s, move, pid, s.log, true);
    while (s.phase === 'pending_choice')
      applyInPlace(s, { type: 'skip_swap' }, s.pending!.playerId, s.log, true);
    const p = s.players.find((x) => x.id === pid)!;
    if (p.position !== to) throw new Error(`demo: ${who} expected on ${to}, is on ${p.position}`);
  }
  return s;
}
