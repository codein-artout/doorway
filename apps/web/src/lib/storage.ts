// localStorage helpers. Every read/write is wrapped: private windows and blocked storage must not break the app.

import type { Ruleset } from '@doorway/engine';
import type { Palette, BotSpeed } from './ui-rules';
import type { GameSetup } from './game-client';
import type { Replay } from '@doorway/engine';

const K = {
  settings: 'doorway.settings.v1',
  current: 'doorway.current.v1',
  saved: 'doorway.saved.v1',
  rulesets: 'doorway.rulesets.v1',
  tips: 'doorway.tips.v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable — keep going */
  }
}

export type Settings = { palette: Palette; botSpeed: BotSpeed; reducedMotion?: boolean };
export const loadSettings = (): Settings => ({
  palette: 'standard',
  botSpeed: 'normal',
  ...read<Partial<Settings>>(K.settings, {}),
});
export const saveSettings = (s: Partial<Settings>) => write(K.settings, { ...loadSettings(), ...s });

export type StoredGame = { id: string; savedAt: string; setup: GameSetup; replay: Replay };
export const loadCurrent = (): StoredGame | null => read<StoredGame | null>(K.current, null);
export const saveCurrent = (g: StoredGame) => write(K.current, g);
export const clearCurrent = () => {
  try {
    localStorage.removeItem(K.current);
  } catch {
    /* ignore */
  }
};
export const loadSaved = (): StoredGame[] => read<StoredGame[]>(K.saved, []);
export function saveFinished(g: StoredGame) {
  const all = loadSaved().filter((x) => x.id !== g.id);
  all.unshift(g);
  write(K.saved, all.slice(0, 30));
}
export const findGame = (id: string): StoredGame | null =>
  loadCurrent()?.id === id ? loadCurrent() : (loadSaved().find((g) => g.id === id) ?? null);

export type StoredRuleset = { ruleset: Ruleset; savedAt: string; note?: string };
export const loadRulesets = (): StoredRuleset[] => read<StoredRuleset[]>(K.rulesets, []);
export function saveRuleset(r: Ruleset, note?: string) {
  const all = loadRulesets().filter((x) => x.ruleset.id !== r.id);
  all.unshift({ ruleset: r, savedAt: new Date().toISOString(), note });
  write(K.rulesets, all);
}
export function deleteRuleset(id: string) {
  write(
    K.rulesets,
    loadRulesets().filter((x) => x.ruleset.id !== id),
  );
}

export const loadTipsSeen = (): string[] => read<string[]>(K.tips, []);
export const saveTipsSeen = (t: string[]) => write(K.tips, t);
