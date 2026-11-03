// Serialization, state hashing and replays (R31).

import { apply, applyInPlace, cardsHash, init, rulesetHash } from './engine';
import { canonicalJson, sha256 } from './sha256';
import type { Card, GameEvent, GameState, PlayerMove, PlayerSetup, Ruleset } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || !s.ruleset || !s.cards || !s.market)
    throw new Error('Not a Doorway game state.');
  return s;
}

/** Hash of everything that defines the position (not the event log). */
export function stateHash(state: GameState): string {
  const { log: _log, cards: _cards, ruleset: _ruleset, ...rest } = state;
  return sha256(canonicalJson(rest));
}

export type Replay = {
  format: 'doorway-replay@1';
  rulesetId: string;
  rulesetHash: string;
  cardsHash: string;
  seed: string;
  seats: PlayerSetup[];
  moves: PlayerMove[];
  /** Custom rulesets travel with the replay; the default ones are looked up by id. */
  ruleset?: Ruleset;
};

export function toReplay(state: GameState, embedRuleset = false): Replay {
  return {
    format: 'doorway-replay@1',
    rulesetId: state.rulesetId,
    rulesetHash: state.rulesetHash,
    cardsHash: state.cardsHash,
    seed: state.seed,
    seats: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      ...(p.botPolicy !== undefined ? { botPolicy: p.botPolicy } : {}),
    })),
    moves: state.moves,
    ...(embedRuleset ? { ruleset: state.ruleset } : {}),
  };
}

export class ReplayMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayMismatchError';
  }
}

/** Check a replay's hashes against the content it will run on; throws a readable error (R31). */
export function verifyReplayContent(
  r: Pick<Replay, 'rulesetId' | 'rulesetHash' | 'cardsHash'>,
  ruleset: Ruleset,
  cards: Card[],
): void {
  const rh = rulesetHash(ruleset);
  if (rh !== r.rulesetHash)
    throw new ReplayMismatchError(
      `This replay was recorded with a different ruleset "${r.rulesetId}" (hash ${r.rulesetHash.slice(0, 12)}…); the current one hashes to ${rh.slice(0, 12)}…. Refusing to load.`,
    );
  const ch = cardsHash(cards);
  if (ch !== r.cardsHash)
    throw new ReplayMismatchError(
      `This replay was recorded with different cards (hash ${r.cardsHash.slice(0, 12)}…); the current cards hash to ${ch.slice(0, 12)}…. Refusing to load.`,
    );
}

export type ReplayResult = { state: GameState; events: GameEvent[]; states?: GameState[] };

/**
 * Rebuild a game from `{ rulesetId, rulesetHash, cardsHash, seed, seats, moves }`.
 * `upTo` stops after that many moves. `keepStates` returns every intermediate state (index 0 = start).
 */
export function replay(
  r: Omit<Replay, 'format'> & { format?: string },
  content: { ruleset: Ruleset; cards: Card[] },
  opts: { upTo?: number; keepStates?: boolean } = {},
): ReplayResult {
  verifyReplayContent(r, content.ruleset, content.cards);
  let state = init(content.ruleset, content.cards, r.seats, r.seed);
  const states = opts.keepStates ? [state] : undefined;
  const n = Math.min(opts.upTo ?? r.moves.length, r.moves.length);
  if (!opts.keepStates) {
    // fast path
    const s = state;
    const events: GameEvent[] = s.log.slice();
    for (let i = 0; i < n; i++) applyInPlace(s, r.moves[i].move, r.moves[i].playerId, events);
    s.log = events;
    return { state: s, events };
  }
  for (let i = 0; i < n; i++) {
    state = apply(state, r.moves[i].move, r.moves[i].playerId).state;
    states!.push(state);
  }
  return { state, events: state.log, states };
}
