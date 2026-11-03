// Export / import of replays and full states (JSON files). Hash checks follow R31.

import { CARDS, BUILTIN_RULESETS } from '@doorway/content';
import {
  deserialize,
  replay as engineReplay,
  serialize,
  toReplay,
  type GameState,
  type PlayerSetup,
  type Replay,
  type Ruleset,
} from '@doorway/engine';
import type { GameSetup, SeatConfig } from './game-client';
import { saveCurrent, loadRulesets } from './storage';
import type { Skill } from '@doorway/bots';

export function download(name: string, data: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function seatFromPlayer(p: PlayerSetup): SeatConfig {
  if (!p.isBot) return { name: p.name, kind: 'human' };
  const [strategy, eps] = (p.botPolicy ?? 'greedy').split('@eps');
  const e = eps === undefined ? 0 : Number(eps);
  const skill: Skill = e === 0 ? 'sharp' : e >= 0.2 ? 'casual' : 'normal';
  return { name: p.name, kind: 'bot', strategy, skill };
}

export function rulesetFor(id: string, embedded?: Ruleset): Ruleset | null {
  return embedded ?? BUILTIN_RULESETS[id] ?? loadRulesets().find((r) => r.ruleset.id === id)?.ruleset ?? null;
}

export type ImportResult =
  { ok: true; id: string; replay: Replay; setup: GameSetup } | { ok: false; error: string };

/** Accepts a replay (`doorway-replay@1`, optionally with `setup`) or a full serialized GameState. */
export function importJson(text: string): ImportResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not JSON.' };
  }
  let rep: Replay;
  let setupExtra: Partial<GameSetup> = {};
  if (data.format === 'doorway-replay@1') {
    rep = data as unknown as Replay;
    if (data.setup && typeof data.setup === 'object') setupExtra = data.setup as Partial<GameSetup>;
  } else if (
    Array.isArray((data as { players?: unknown }).players) &&
    (data as { ruleset?: unknown }).ruleset
  ) {
    try {
      rep = toReplay(deserialize(text), true);
    } catch (e) {
      return { ok: false, error: `Not a Doorway game state: ${(e as Error).message}` };
    }
  } else return { ok: false, error: 'Not a Doorway replay or game state.' };
  const ruleset = rulesetFor(rep.rulesetId, rep.ruleset);
  if (!ruleset)
    return { ok: false, error: `Unknown ruleset "${rep.rulesetId}" and none was embedded in the file.` };
  try {
    engineReplay(rep, { ruleset, cards: CARDS });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const setup: GameSetup = {
    seats: rep.seats.map(seatFromPlayer),
    ruleset,
    seed: rep.seed,
    botSpeed: setupExtra.botSpeed ?? 'normal',
    blind: setupExtra.blind ?? false,
  };
  const id = `g${Date.now().toString(36)}`;
  saveCurrent({ id, savedAt: new Date().toISOString(), setup, replay: rep });
  return { ok: true, id, replay: rep, setup };
}

export async function importFile(f: File): Promise<ImportResult> {
  return importJson(await f.text());
}

export function exportReplayJson(state: GameState, setup: GameSetup): string {
  const { ruleset: _r, ...rest } = setup;
  return JSON.stringify({ ...toReplay(state, true), setup: rest }, null, 1);
}

export function exportStateJson(state: GameState): string {
  return serialize(state);
}
