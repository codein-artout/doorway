import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { getPolicy, playGame, type BotPolicy } from '../src/index';

export { CARDS, DEFAULT_RULESET };

/** Wrap a policy so every chosen move is checked against the view's legal moves. */
export function strict(p: BotPolicy): BotPolicy {
  return {
    ...p,
    choose(view, rng) {
      const m = p.choose(view, rng);
      const k = JSON.stringify(m);
      if (!view.legal.some((x) => JSON.stringify(x) === k))
        throw new Error(`${p.id} chose an illegal move ${k}`);
      return m;
    },
  };
}

/** Head-to-head 2p win share of `a` vs `b`, alternating seats. */
export function winShare2p(
  a: string,
  b: string,
  games: number,
  seedPrefix: string,
  mk = (id: string) => getPolicy(id),
): number {
  let w = 0;
  for (let g = 0; g < games; g++) {
    const aFirst = g % 2 === 0;
    const seats = aFirst ? [{ policy: a }, { policy: b }] : [{ policy: b }, { policy: a }];
    const pols = aFirst ? [mk(a), mk(b)] : [mk(b), mk(a)];
    const r = playGame({
      ruleset: DEFAULT_RULESET,
      cards: CARDS,
      seats,
      seed: `${seedPrefix}${g}`,
      policies: pols,
      stats: false,
    });
    w += r.scores[aFirst ? 0 : 1].winShare;
  }
  return w / games;
}
