import type { GameState, Move, PlayerId, Rng } from '@doorway/engine';

/**
 * Everything public about the game, from one player's seat (R15, RB-12.P1).
 * `state` is a GameState whose decks are sorted by card id (the *set* of unseen cards is public,
 * the order is not) and whose RNG state is blanked. Engine queries (legalMoves, costBreakdown, …)
 * work on it unchanged; only drawing from a deck would differ, and bots never draw.
 */
export type BotView = {
  me: PlayerId;
  state: GameState;
  /** cards not yet seen, per age (sorted; order unknown) */
  unseen: GameState['decks'];
  deckCounts: { young: number; middle: number; old: number };
  /** legal moves for `me` right now (convenience; equals engine.legalMoves(state, me)) */
  legal: Move[];
};

export interface BotPolicy {
  id: string;
  label: string;
  params: Record<string, number>;
  choose(view: BotView, rng: Rng): Move;
}
