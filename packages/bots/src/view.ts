import { bestWindow, legalMoves, type GameState, type Move, type PlayerId } from '@doorway/engine';
import type { BotView } from './types';

/** Build the public view for `me` (R15: deck order is never exposed). */
export function makeBotView(state: GameState, me: PlayerId): BotView {
  const decks = {
    young: state.decks.young.slice().sort(),
    middle: state.decks.middle.slice().sort(),
    old: state.decks.old.slice().sort(),
  };
  const pub: GameState = { ...state, decks, rngState: 'hidden', log: [] };
  return {
    me,
    state: pub,
    unseen: decks,
    deckCounts: { young: decks.young.length, middle: decks.middle.length, old: decks.old.length },
    legal: legalMoves(pub, me),
  };
}

/** The optimal window for `me` (spec §6: every bot picks its Doorway window optimally). */
export function bestWindowMove(state: GameState, me: PlayerId): Move {
  const b = bestWindow(state, me);
  return { type: 'choose_window', start: b.start, end: b.end };
}
