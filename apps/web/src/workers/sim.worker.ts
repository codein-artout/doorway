/// <reference lib="webworker" />
// Sandbox simulations run here (same engine and bots as the CLI).
import { CARDS } from '@doorway/content';
import type { Ruleset } from '@doorway/engine';
import { runBatch, type BotMix } from '../lib/sandbox';

self.onmessage = (e: MessageEvent<{ id: number; ruleset: Ruleset; players: number; mix: BotMix; seed: string; from: number; to: number }>) => {
  const { id, ...o } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, agg: runBatch({ ...o, cards: CARDS }) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
