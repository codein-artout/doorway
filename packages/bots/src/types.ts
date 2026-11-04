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

/** One scored candidate move, with how each feature contributed to its total (BUILD_PROMPT-v2 §N3). */
export type ExplainedCandidate = {
  move: Move;
  total: number;
  /** contribution = weight × feature value, in the order the strategy adds them */
  parts: { feature: string; value: number; weight: number; contribution: number }[];
  /** false when the strategy would not pick this move at all (e.g. a quest while it has decided to rush) */
  eligible: boolean;
  /** the move `choose` returned (when the caller passes it) or the deterministic top choice */
  chosen: boolean;
};

export type Explanation = {
  strategy: string;
  label: string;
  /** number of legal moves considered */
  options: number;
  /** 'features' for weighted scorers, 'value' for lookahead (mean outcome per candidate), 'ppy' for greedy */
  kind: 'features' | 'value' | 'ppy';
  /** candidates, best first */
  candidates: ExplainedCandidate[];
  note?: string;
};

export interface BotPolicy {
  id: string;
  label: string;
  params: Record<string, number>;
  choose(view: BotView, rng: Rng): Move;
  /**
   * Optional and pure: why this policy would choose what it chooses here. Never consumes the RNG passed to
   * `choose` and never changes what `choose` returns. `chosen` (the move actually played) marks the row.
   */
  explain?(view: BotView, chosen?: Move): Explanation | null;
}
