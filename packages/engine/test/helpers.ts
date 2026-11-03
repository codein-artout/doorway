import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import {
  applyOverrides,
  apply,
  currentPlayer,
  legalMoves,
  scenario,
  init,
  type GameState,
  type Move,
  type PlayerSetup,
  type Ruleset,
  type ScenarioSpec,
} from '../src/index';

export { CARDS, DEFAULT_RULESET };

export const seats = (n: number): PlayerSetup[] =>
  ['Priya', 'Arun', 'Meera', 'Kavi'].slice(0, n).map((name, i) => ({ id: `p${i + 1}`, name }));

export const rules = (o: Record<string, unknown> = {}): Ruleset => applyOverrides(DEFAULT_RULESET, o);

export const game = (n: number, seed = 'test', r: Ruleset = DEFAULT_RULESET): GameState =>
  init(r, CARDS, seats(n), seed);

export const scen = (n: number, spec: ScenarioSpec, r: Ruleset = DEFAULT_RULESET): GameState =>
  scenario(r, CARDS, seats(n), spec);

/** Apply a move for the current player (or `pid`) and return the new state. */
export function play(s: GameState, move: Move, pid?: string): GameState {
  return apply(s, move, pid).state;
}

export const q = (cardId: string, extra: Partial<Extract<Move, { type: 'quest' }>> = {}): Move => ({
  type: 'quest',
  cardId,
  ...extra,
});
export const rush = (discardCardId?: string): Move =>
  discardCardId ? { type: 'rush', discardCardId } : { type: 'rush' };

export const P = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;
export const cur = (s: GameState) => currentPlayer(s);
export const hasMove = (s: GameState, pid: string, m: Move) =>
  legalMoves(s, pid).some((x) => JSON.stringify(x) === JSON.stringify(m));

/** Skip every pending swap for the current player. */
export function skipSwaps(s: GameState): GameState {
  while (s.phase === 'pending_choice') s = play(s, { type: 'skip_swap' });
  return s;
}
