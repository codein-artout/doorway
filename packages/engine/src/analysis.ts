// v2 analysis helpers (BUILD_PROMPT-v2 §N3). Additive and pure: they read states, never change rules.

import { applyInPlace, cloneState, currentPlayer, getPlayer, init, turnOrder } from './engine';
import { scoreCards, type WindowScore } from './scoring';
import type { Card, GameState, Move, PlayerId, Ruleset } from './types';

export type MovePreview = {
  /** the space the mover ends on (after the move and any rush bonus; capped at the track length) */
  landing: number;
  /** the pawn directly under the mover at the landing space, if any */
  onTopOf: PlayerId | null;
  /** who takes the next turn once this move (and any swaps it grants) is done; null if nobody (game over / everyone through) */
  nextPlayer: PlayerId | null;
  /** turn order of players not yet at the Doorway after the move */
  queueAfter: PlayerId[];
  /** score of tower + card minus score of tower, both as if walking through now with the whole tower kept (0 for a rush) */
  scoreDeltaNow: number;
  /** the mover reaches the Doorway with this move */
  arrives: boolean;
  /** the mover moves again right away (furthest back after the move) */
  again: boolean;
  /** number of swaps (Milestones, Keep a diary) the move grants */
  swaps: number;
};

/** Score of a tower as if walking through now with every disc kept (DESIGN-v2 §4 "Δ now"). */
export function scoreIfWalkedNow(
  state: Pick<GameState, 'ruleset' | 'cards'>,
  tower: readonly string[],
): WindowScore {
  return scoreCards(state.ruleset, state.cards, tower);
}

/**
 * What a move would do, without changing `state`. Pending swaps granted by the move are skipped
 * (swaps never move pawns), so landing / next player / queue are what the table will show.
 * Throws IllegalMoveError for an illegal move, like apply().
 */
export function previewMove(state: GameState, move: Move, playerId?: PlayerId): MovePreview {
  const pid = playerId ?? currentPlayer(state);
  if (pid === null) throw new Error('previewMove: the game is over');
  const s = cloneState(state);
  const before = getPlayer(state, pid);
  applyInPlace(s, move, pid, undefined, false);
  let swaps = 0;
  let guard = 0;
  while (s.phase === 'pending_choice' && s.pending && guard++ < 20) {
    swaps++;
    applyInPlace(s, { type: 'skip_swap' }, s.pending.playerId, undefined, false);
  }
  const after = getPlayer(s, pid);
  const stack = s.stacks[after.position] ?? [];
  const i = stack.indexOf(pid);
  const onTopOf = i > 0 ? stack[i - 1] : null;
  const nextPlayer = s.phase === 'playing' || s.phase === 'pending_choice' ? currentPlayer(s) : null;
  let scoreDeltaNow = 0;
  if (move.type === 'quest') {
    const now = scoreIfWalkedNow(state, before.tower).total;
    scoreDeltaNow = scoreIfWalkedNow(state, [...before.tower, move.cardId]).total - now;
  }
  return {
    landing: after.position,
    onTopOf,
    nextPlayer,
    queueAfter: turnOrder(s),
    scoreDeltaNow,
    arrives: after.arrivalOrder !== null && before.arrivalOrder === null,
    again: nextPlayer === pid,
    swaps,
  };
}

export type WindowRow = WindowScore & { start: number; end: number; best: boolean; vsBest: number };

/**
 * Every maximal window of `tower` under `allowance` (length min(allowance, height)), in start order, with
 * its four score parts and total; `best` marks the top total (lowest start on ties, like bestWindow).
 */
export function windowScores(
  ctx: { ruleset: Ruleset; cards: Record<string, Card> },
  tower: readonly string[],
  allowance: number,
): WindowRow[] {
  const h = tower.length;
  const len = Math.min(Math.max(0, allowance), h);
  if (len === 0)
    return [{ ...scoreCards(ctx.ruleset, ctx.cards, []), start: 0, end: -1, best: true, vsBest: 0 }];
  const rows: WindowRow[] = [];
  for (let s = 0; s + len <= h; s++)
    rows.push({
      ...scoreCards(ctx.ruleset, ctx.cards, tower.slice(s, s + len)),
      start: s,
      end: s + len - 1,
      best: false,
      vsBest: 0,
    });
  let bi = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].total > rows[bi].total) bi = i;
  rows[bi].best = true;
  for (const r of rows) r.vsBest = r.total - rows[bi].total;
  return rows;
}

export type HistoryPoint = {
  /** number of moves applied */
  move: number;
  /** quest/rush turn counter after this move */
  turn: number;
  /** who made this move (null for the start) */
  actor: PlayerId | null;
  positions: Record<PlayerId, number>;
  /** score if each player walked through now with the whole tower kept */
  scoreNow: Record<PlayerId, number>;
  towerHeights: Record<PlayerId, number>;
};

/**
 * Per-move history for charts (position by turn, score-if-walked-now by turn), rebuilt from the state's own
 * seed and move list. One point per quest/rush turn, taken after that turn's swaps resolve.
 */
export function gameHistory(state: GameState): HistoryPoint[] {
  const s = init(
    state.ruleset,
    Object.values(state.cards),
    state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      ...(p.botPolicy ? { botPolicy: p.botPolicy } : {}),
    })),
    state.seed,
  );
  const snap = (move: number, actor: PlayerId | null): HistoryPoint => ({
    move,
    turn: s.turn,
    actor,
    positions: Object.fromEntries(s.players.map((p) => [p.id, p.position])),
    scoreNow: Object.fromEntries(s.players.map((p) => [p.id, scoreIfWalkedNow(s, p.tower).total])),
    towerHeights: Object.fromEntries(s.players.map((p) => [p.id, p.tower.length])),
  });
  const out: HistoryPoint[] = [snap(0, null)];
  let actor: PlayerId | null = null;
  state.moves.forEach((m, i) => {
    applyInPlace(s, m.move, m.playerId, undefined, false);
    if (m.move.type === 'quest' || m.move.type === 'rush') actor = m.playerId;
    else if (m.move.type === 'choose_window') return;
    // one point per turn, taken once the turn's swaps are resolved
    if (actor !== null && s.phase !== 'pending_choice') {
      out.push(snap(i + 1, actor));
      actor = null;
    }
  });
  return out;
}
