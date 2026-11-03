/// <reference lib="webworker" />
// Bots compute here so the table stays responsive (spec §6, BUILD_PROMPT §6).

import type { GameState, PlayerId } from '@doorway/engine';
import { chooseBotMove } from '../lib/bot-move';

self.onmessage = (e: MessageEvent<{ id: number; state: GameState; playerId: PlayerId }>) => {
  const { id, state, playerId } = e.data;
  try {
    const move = chooseBotMove(state, playerId);
    (self as unknown as Worker).postMessage({ id, move });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
