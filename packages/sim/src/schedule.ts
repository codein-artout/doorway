// Deterministic game schedules: seat assignment and seeds per game index.

import { Rng } from '@doorway/engine';

export type SeatMode = 'rotate' | 'fixed' | 'all-permutations' | 'field';

export function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

/**
 * Policies for game `g`:
 * - fixed: the bots list in seat order (cycled to the player count)
 * - rotate: the list rotated by g (each bot visits every seat)
 * - all-permutations: every ordering of the list, game g uses ordering g mod P
 * - field: each seat drawn uniformly from the list (seeded per game)
 */
export function seatsFor(mode: SeatMode, bots: string[], players: number, g: number, seed: string): string[] {
  const base = Array.from({ length: players }, (_, i) => bots[i % bots.length]);
  switch (mode) {
    case 'fixed':
      return base;
    case 'rotate': {
      const k = g % players;
      return [...base.slice(k), ...base.slice(0, k)];
    }
    case 'all-permutations': {
      const perms = permutations(base);
      return perms[g % perms.length];
    }
    case 'field': {
      const rng = Rng.fromSeed(`field|${seed}|${g}`);
      return Array.from({ length: players }, () => rng.pick(bots));
    }
  }
}

/** Seeds are shared across sweep values, so variants are compared on the same deals (paired). */
export function gameSeed(seed: string, g: number): string {
  return `${seed}|g${g}`;
}
