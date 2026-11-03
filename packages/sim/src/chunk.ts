import { getPolicy, playGame } from '@doorway/bots';
import { CARDS } from '@doorway/content';
import { toReplay, type Ruleset } from '@doorway/engine';
import { addCardAgg, gameRows, type CardAgg } from './rows';

export type ChunkTask = {
  id: string;
  run: string;
  value: string;
  ruleset: Ruleset;
  games: { index: number; seed: string; policies: string[] }[];
  /** keep full move logs (replays) for games with index < this */
  logsBelow: number;
  /** strategy overrides, e.g. a cheaper lookahead budget */
  policyParams?: Record<string, Record<string, number>>;
};

export type ChunkResult = {
  id: string;
  games: string[];
  players: string[];
  picks: string[];
  cards: Record<string, CardAgg>;
  logs: string[];
  ms: number;
};

export function playChunk(t: ChunkTask): ChunkResult {
  const t0 = performance.now();
  const out: ChunkResult = { id: t.id, games: [], players: [], picks: [], cards: {}, logs: [], ms: 0 };
  for (const g of t.games) {
    const policies = g.policies.map((p) => {
      const base = p.split('@')[0];
      const params = t.policyParams?.[base];
      return getPolicy(p, params ? { params } : undefined);
    });
    const r = playGame({
      ruleset: t.ruleset,
      cards: CARDS,
      seats: g.policies.map((p) => ({ policy: p, name: p })),
      seed: g.seed,
      policies,
    });
    const rows = gameRows(t.run, t.value, g.index, g.policies, r);
    out.games.push(rows.game);
    out.players.push(...rows.players);
    out.picks.push(...rows.picks);
    addCardAgg(out.cards, r);
    if (g.index < t.logsBelow)
      out.logs.push(
        JSON.stringify({ run: t.run, value: t.value, game: g.index, replay: toReplay(r.state, true) }),
      );
  }
  out.ms = performance.now() - t0;
  return out;
}
