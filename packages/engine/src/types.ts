// Doorway rules engine — data model (build spec §5.2, extended per DECISIONS.md D-ENG-*)

export type Domain = 'pink' | 'gold' | 'green' | 'orange' | 'purple';
export type Age = 'young' | 'middle' | 'old';
export type PlayerId = string;

export const DOMAINS: readonly Domain[] = ['pink', 'gold', 'green', 'orange', 'purple'];
export const AGES: readonly Age[] = ['young', 'middle', 'old'];

export type Power =
  | { type: 'discount'; color: Domain; amount: number; text?: string }
  | { type: 'rush_bonus'; amount: number; text?: string }
  | { type: 'age_reach_once'; text?: string }
  | { type: 'ignore_requirement_once'; text?: string }
  | { type: 'swap_now'; text?: string }
  | { type: 'next_quest_discount'; amount: number; text?: string }
  | { type: 'doorway_bonus'; amount: number; text?: string };

export type Card = {
  id: string;
  name: string;
  color: Domain;
  age: Age;
  years: number;
  points: number;
  requires: { color: Domain; count: number } | null;
  power: Power | null;
  reflection: Domain | null;
};

export type Ruleset = {
  id: string;
  trackLength: number;
  ageBands: Record<Age, [number, number]>;
  milestones: number[];
  market: Record<Age, number>;
  experienceStep: number;
  experienceCap: number;
  minCost: number;
  rushNoPawnAhead: number;
  rushDiscard: boolean;
  doorway: Record<string, number[]>;
  fullLifeBonus: number;
  passion: Record<string, number>;
  reflectionPerDisc: number;
  solo: { doorway: number; rush: number };
  hints: { bestWindow: boolean };
  cardsFile: string;
};

export type PlayerSetup = {
  id?: PlayerId;
  name: string;
  isBot?: boolean;
  botPolicy?: string;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  isBot: boolean;
  botPolicy?: string;
  seat: number; // 1-based seat number (R6)
  position: number; // 0..trackLength
  tower: string[]; // card ids, bottom → top (the card row is the tower, R23)
  milestonesUsed: number[];
  oncePowersUsed: { ageReach: boolean; ignoreReq: boolean };
  pendingNextQuestDiscount: number;
  arrivalOrder: number | null; // 1-based
  doorwayAllowance: number | null;
  keptRange: [number, number] | null; // inclusive tower indices; [0,-1] = empty window
};

/** One queued swap the active player must resolve (Milestone or Keep a diary). */
export type PendingSwap = { kind: 'swap'; source: 'diary' | 'milestone'; space?: number };

/** Work deferred until the pending swaps resolve (R8 steps 6–7). */
export type PendingAfter = {
  refill: { age: Age; slot: number } | null;
  /** true when this turn was a quest or rush (so solo drift + turn-end apply) */
  endTurn: boolean;
};

export type PendingChoice = {
  playerId: PlayerId;
  queue: PendingSwap[];
  after: PendingAfter;
};

export type Phase = 'playing' | 'pending_choice' | 'doorway_selection' | 'over';

export type GameState = {
  rulesetId: string;
  /** The full ruleset this game runs on (embedded so state is self-contained; D-ENG-1). */
  ruleset: Ruleset;
  /** Card data by id (embedded, shared by reference between states; never mutated). */
  cards: Record<string, Card>;
  seed: string;
  rngState: string;
  phase: Phase;
  pending: PendingChoice | null;
  players: PlayerState[];
  stacks: Record<number, PlayerId[]>; // space → pawn order, bottom → top
  market: Record<Age, (string | null)[]>;
  decks: Record<Age, string[]>; // index 0 = top of deck (next card dealt)
  discard: string[];
  arrivals: PlayerId[];
  turn: number;
  /** id of the player who took the previous turn (for "you go again" / extra-turn stats) */
  lastActor: PlayerId | null;
  log: GameEvent[];
  /** The replayable action log: every applied move, in order. */
  moves: PlayerMove[];
  rulesetHash: string;
  cardsHash: string;
};

export type Move =
  | { type: 'quest'; cardId: string; useAgeReach?: boolean; useIgnoreReq?: boolean }
  | { type: 'rush'; discardCardId?: string }
  | { type: 'swap'; index: number }
  | { type: 'skip_swap' }
  | { type: 'choose_window'; start: number; end: number };

/** A move tagged with who made it (the replay log). */
export type PlayerMove = { playerId: PlayerId; move: Move };

export type UsedPower = 'age_reach' | 'ignore_requirement' | 'next_quest_discount';

export type ScoreBreakdown = {
  playerId: PlayerId;
  cards: number;
  fullLife: number;
  fullLifeSets: number;
  passion: number;
  passionRun: number;
  reflection: number;
  total: number;
  kept: number;
  towerHeight: number;
  discsLost: number;
  arrivalOrder: number | null;
  keptRange: [number, number] | null;
  /** true when the window has not been chosen yet (preview score) */
  provisional: boolean;
  rank: number; // 1 = best, after tiebreakers; shared ranks allowed
  winner: boolean;
  /** 1/k for a k-way shared win, 1 for a sole win, 0 otherwise (R28) */
  winShare: number;
};

export type GameEvent =
  | {
      type: 'game_started';
      seed: string;
      rulesetId: string;
      seats: { id: PlayerId; name: string; isBot: boolean; botPolicy?: string }[];
    }
  | {
      type: 'quest_taken';
      playerId: PlayerId;
      cardId: string;
      cost: number;
      from: number;
      to: number;
      usedPowers: UsedPower[];
      experienceDiscount: number;
      powerDiscount: number;
    }
  | { type: 'rushed'; playerId: PlayerId; from: number; to: number; discardedCardId?: string }
  | { type: 'card_discarded'; cardId: string; age: Age; slot: number; reason: 'rush' | 'solo_drift' }
  | { type: 'market_refilled'; age: Age; slot: number; cardId: string | null }
  | { type: 'milestone_reached'; playerId: PlayerId; space: number }
  | { type: 'swap_made'; playerId: PlayerId; index: number; source: 'diary' | 'milestone' }
  | {
      type: 'swap_skipped';
      playerId: PlayerId;
      source: 'diary' | 'milestone';
      reason?: 'nothing_to_swap' | 'declined';
    }
  | { type: 'age_changed'; playerId: PlayerId; age: Age }
  | { type: 'power_gained'; playerId: PlayerId; cardId: string; power: Power['type'] }
  | { type: 'arrived'; playerId: PlayerId; order: number; allowance: number }
  | { type: 'window_chosen'; playerId: PlayerId; start: number; end: number; auto: boolean }
  | { type: 'solo_drift' }
  | { type: 'game_over'; scores: ScoreBreakdown[] };

export type QuestOptions = { useAgeReach?: boolean; useIgnoreReq?: boolean };

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

export class InvalidRulesetError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid ruleset: ${problems.join('; ')}`);
    this.name = 'InvalidRulesetError';
    this.problems = problems;
  }
}
