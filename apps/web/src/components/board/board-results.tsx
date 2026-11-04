'use client';
// End of game, Board style (Board-Results.dc.html).

import { score, type GameState, type ScoreBreakdown } from '@doorway/engine';
import { soloRating } from '@doorway/content';
import { DOMAIN } from '@/lib/domains';
import { ordinal } from '@/lib/format';
import { initialOf } from '@/lib/ui-rules';
import { badgeFor } from '../turn';
import { INK, PawnFigure } from './pieces';

const RANKBG = ['var(--lamplight)', '#E3D9C6', '#E3C2A3', '#E3D9C6'];
const ROT = ['-1deg', '0.8deg', '-0.6deg', '1.2deg'];

/** One line of story per player, from what actually happened (Gochi narrator). */
export function storyFor(state: GameState, s: ScoreBreakdown, last: boolean): string {
  const p = state.players.find((x) => x.id === s.playerId)!;
  const [a, b] = p.keptRange ?? [0, -1];
  const kept = p.tower.slice(a, b + 1);
  let run = 0,
    best = 0,
    dom = '',
    prev = '';
  for (const id of kept) {
    const c = state.cards[id].color;
    run = c === prev ? run + 1 : 1;
    prev = c;
    if (run > best) {
      best = run;
      dom = c;
    }
  }
  const everyOne = s.discsLost === 0 && s.towerHeight > 0;
  if (best >= 4)
    return `${['', '', '', '', 'four', 'five', 'six', 'seven', 'eight'][Math.min(best, 8)]} ${DOMAIN[dom as keyof typeof DOMAIN].name} in a row${everyOne ? ', and kept every one' : ''}`;
  if (everyOne) return 'kept every memory they lived';
  if (s.discsLost >= 5) return `lived ${s.towerHeight} memories, lost ${s.discsLost} at the door`;
  if (last && state.players.length > 1) return `arrived last; only ${p.doorwayAllowance} fit`;
  if (s.fullLifeSets >= 1) {
    const mid = a > 0 && b < p.tower.length - 1;
    return `${s.fullLifeSets > 1 ? `${s.fullLifeSets} full lives` : 'a full life'}${mid ? ' in the middle years' : a === 0 ? ' from the early years' : ' in the later years'}`;
  }
  if (s.reflection > 0) return 'looked back, and it counted';
  return s.towerHeight === 0 ? 'walked straight to the door' : 'carried what mattered most';
}

export function BoardResults({
  state,
  replayHref,
  onUndo,
  canUndo,
}: {
  state: GameState;
  replayHref: string;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
  const sc = score(state);
  const rows = state.players
    .map((p, i) => ({ p, s: sc[i] }))
    .sort((x, y) => x.s.rank - y.s.rank || (x.p.arrivalOrder ?? 9) - (y.p.arrivalOrder ?? 9));
  const winners = rows.filter((r) => r.s.winner).map((r) => r.p.name);
  const solo = state.players.length === 1;
  const headline = solo
    ? `${soloRating(rows[0].s.total)}.`
    : `${winners.join(' and ')} brought the most through.`;
  const lastOrder = Math.max(...state.players.map((p) => p.arrivalOrder ?? 0));
  return (
    <div className="text-on-felt" data-testid="results">
      <div className="mt-2.5 mb-[26px] text-center">
        <p className="m-0 font-hand text-[24px] text-[#DCE3DE]">
          Everyone is through the Doorway · {state.turn} turns
          {solo ? ` · ${rows[0].p.name} scored ${rows[0].s.total}` : ''}
        </p>
        <h1 className="mt-1 mb-0 font-display text-[38px] leading-[1.02] font-normal md:text-[54px]">
          {headline}
        </h1>
      </div>
      <section
        aria-label="Final scores"
        className="grid items-end gap-[22px]"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(230px, 1fr))` }}
      >
        {rows.map(({ p, s }, i) => {
          const [a, b] = p.keptRange ?? [0, -1];
          const above = p.tower.slice(b + 1).reverse();
          const kept = p.tower.slice(a, b + 1).reverse();
          const below = p.tower.slice(0, a).reverse();
          const paper = i === 0 ? '#FBF3DF' : '#EDE3CE';
          return (
            <article
              key={p.id}
              className="flex flex-col items-center gap-3 rounded-[22px] px-4 pt-[22px] pb-[18px] text-ink"
              style={{
                background: paper,
                border: `3.5px solid ${INK}`,
                boxShadow: '0 8px 0 var(--drop)',
                transform: `rotate(${ROT[i % 4]})`,
              }}
              data-testid={`result-${p.id}`}
            >
              <div className="flex items-center gap-2.5 self-stretch">
                <span
                  className="grid h-12 w-12 flex-none place-items-center rounded-full font-display text-[20px]"
                  style={{
                    border: `3px solid ${INK}`,
                    background: RANKBG[Math.min(3, s.rank - 1)],
                    boxShadow: `0 0 0 4px ${paper}, 0 0 0 6.5px ${INK}`,
                  }}
                  aria-label={`rank ${s.rank}`}
                >
                  {s.rank}
                </span>
                <div className="ml-1.5 min-w-0 flex-1">
                  <div className="font-display text-[24px] leading-[1.05]">{p.name}</div>
                  <div className="text-[12.5px] font-extrabold text-ink-soft">
                    {badgeFor(p)} · arrived {ordinal(p.arrivalOrder ?? 1)}
                  </div>
                </div>
                <PawnFigure
                  initial={initialOf(p.name)}
                  seat={p.seat}
                  isBot={p.isBot}
                  w={34}
                  h={48}
                  smile
                  spot={false}
                />
              </div>
              <div
                className="mt-1 flex flex-col items-center"
                role="img"
                aria-label={`${p.name} kept memories ${a + 1} to ${b + 1} of ${p.tower.length}`}
              >
                {above.map((id, k) => (
                  <span
                    key={`a${k}`}
                    title={`${DOMAIN[state.cards[id].color].name} (left behind)`}
                    style={{
                      width: 92,
                      height: 18,
                      marginBottom: -3,
                      borderRadius: 999,
                      border: '2px dashed #8E8590',
                      background: `color-mix(in srgb, ${DOMAIN[state.cards[id].color].css} 30%, ${paper})`,
                      transform: 'translateX(10px) rotate(4deg)',
                    }}
                  />
                ))}
                <div
                  className="my-2 flex flex-col items-center px-[18px] pt-[30px] pb-2.5"
                  style={{
                    borderRadius: '70px 70px 8px 8px',
                    border: `3px solid ${INK}`,
                    background: '#F8E5AE',
                  }}
                >
                  {kept.map((id, k) => (
                    <span
                      key={`k${k}`}
                      title={DOMAIN[state.cards[id].color].name}
                      style={{
                        width: 104,
                        height: 20,
                        marginBottom: -3,
                        borderRadius: 999,
                        border: `2.5px solid ${INK}`,
                        background: DOMAIN[state.cards[id].color].css,
                        boxShadow: 'inset 0 -5px 0 rgba(43,37,48,.18)',
                      }}
                    />
                  ))}
                  {kept.length === 0 && <span className="font-hand text-[16px]">nothing</span>}
                </div>
                {below.map((id, k) => (
                  <span
                    key={`b${k}`}
                    title={`${DOMAIN[state.cards[id].color].name} (left behind)`}
                    style={{
                      width: 92,
                      height: 18,
                      marginBottom: -3,
                      borderRadius: 999,
                      border: '2px dashed #8E8590',
                      background: `color-mix(in srgb, ${DOMAIN[state.cards[id].color].css} 30%, ${paper})`,
                      transform: 'translateX(-10px) rotate(-4deg)',
                    }}
                  />
                ))}
              </div>
              <div className="font-hand text-[18px] text-ink-soft">
                kept {s.kept} of {s.towerHeight} memories
              </div>
              <div
                className="grid grid-cols-4 gap-1 self-stretch pt-2.5 text-center"
                style={{ borderTop: '2px dashed #B9AB92' }}
              >
                {(
                  [
                    ['cards', s.cards],
                    ['full life', s.fullLife],
                    ['passion', s.passion],
                    ['reflection', s.reflection],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <div className="font-display text-[20px]">{v}</div>
                    <div className="text-[11px] font-extrabold text-ink-soft">{l}</div>
                  </div>
                ))}
              </div>
              <div className="font-display text-[48px] leading-none" data-testid={`total-${p.id}`}>
                {s.total}
              </div>
              <div className="text-center font-hand text-[18px] leading-[1.15] text-ink-soft">
                {storyFor(state, s, p.arrivalOrder === lastOrder)}
              </div>
            </article>
          );
        })}
      </section>
      <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
        <a
          href="/"
          className="inline-flex min-h-[58px] items-center rounded-2xl px-7 font-display text-[22px] text-ink no-underline"
          style={{
            border: `3px solid ${INK}`,
            background: 'var(--lamplight)',
            boxShadow: '0 6px 0 var(--drop)',
          }}
        >
          Play again
        </a>
        <a
          href={replayHref}
          className="inline-flex min-h-[58px] items-center rounded-2xl px-[22px] font-display text-[20px] text-ink no-underline"
          style={{
            border: `3px solid ${INK}`,
            background: 'var(--on-felt)',
            boxShadow: '0 6px 0 var(--drop)',
          }}
        >
          Watch the replay
        </a>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="min-h-[58px] cursor-pointer rounded-2xl bg-transparent px-[22px] font-extrabold text-on-felt disabled:opacity-45"
            style={{ border: '2px dashed #8A9792' }}
          >
            Undo the last move
          </button>
        )}
      </div>
    </div>
  );
}
