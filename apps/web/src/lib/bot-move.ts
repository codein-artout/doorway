import { getPolicy, makeBotView } from '@doorway/bots';
import { botSeed, Rng, type GameState, type Move, type PlayerId } from '@doorway/engine';

/** Choose a bot move deterministically: the bot's own stream, seeded per decision (R30). */
export function chooseBotMove(state: GameState, playerId: PlayerId): Move {
  const p = state.players.find((x) => x.id === playerId)!;
  const policy = getPolicy(p.botPolicy ?? 'greedy');
  const rng = Rng.fromSeed(`${botSeed(state.seed, p.seat, p.botPolicy ?? 'greedy')}|m${state.moves.length}`);
  return policy.choose(makeBotView(state, playerId), rng);
}
