import { score, type GameState } from '@doorway/engine';
import { soloRating } from '@doorway/content';
import { DOMAIN, ICONS } from '@/lib/domains';
import { ordinal } from '@/lib/format';
import { badgeFor } from './turn';

/** Final scores (Results.dc.html): kept stretches highlighted, component bars, totals. */
export function Results({ state, actions }: { state: GameState; actions?: React.ReactNode }) {
  const sc = score(state);
  const rows = state.players
    .map((p, i) => ({ p, s: sc[i] }))
    .sort((a, b) => a.s.rank - b.s.rank || (a.p.arrivalOrder ?? 9) - (b.p.arrivalOrder ?? 9));
  const winners = rows.filter((r) => r.s.winner).map((r) => r.p.name);
  const solo = state.players.length === 1;
  const max = Math.max(1, ...rows.map((r) => r.s.total));
  const headline = solo
    ? `${soloRating(rows[0].s.total)}.`
    : winners.length > 1
      ? `${winners.join(' and ')} brought the most through.`
      : `${winners[0]} brought the most through.`;
  return (
    <div data-testid="results">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3.5">
        <div className="flex-[1_1_560px]">
          <div className="font-mono text-xs font-bold tracking-[0.06em] text-muted uppercase">
            Game over · {state.turn} turns · {state.players.length}{' '}
            {state.players.length === 1 ? 'player' : 'players'} · seed {state.seed}
          </div>
          <h1 className="my-1.5 font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.015em] md:text-[44px]">
            {headline}
          </h1>
          <p className="m-0 text-muted">
            {solo ? `${rows[0].p.name} scored ${rows[0].s.total}. ` : ''}Points come only from the stretch
            each of you kept. Faded discs stayed behind.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <section
        aria-label="Final scores"
        className="mt-[26px] overflow-x-auto rounded-[18px] border border-line bg-surface py-2"
      >
        <div style={{ minWidth: 1080 }}>
          <div
            className="grid gap-4 border-b border-line-soft px-[22px] py-2.5 text-xs text-muted"
            style={{ gridTemplateColumns: '52px 200px 110px minmax(0,1fr) 360px 80px' }}
          >
            <span>Rank</span>
            <span>Player</span>
            <span>Arrived</span>
            <span>Life lived → stretch kept</span>
            <span>Where the points came from</span>
            <span className="text-right">Total</span>
          </div>
          {rows.map(({ p, s }) => {
            const [a, b] = p.keptRange ?? [0, -1];
            const w = (x: number) => `${(x / max) * 100}%`;
            return (
              <div
                key={p.id}
                className="grid items-center gap-4 border-b border-[var(--row-line)] px-[22px] py-4"
                style={{
                  gridTemplateColumns: '52px 200px 110px minmax(0,1fr) 360px 80px',
                  background: s.winner ? 'var(--surface-2)' : 'transparent',
                }}
                data-testid={`result-${p.id}`}
              >
                <span className="font-display text-[26px] font-extrabold">{s.rank}</span>
                <div>
                  <div className="text-[17px] font-bold">{p.name}</div>
                  <div className="text-xs text-muted">{badgeFor(p)}</div>
                </div>
                <div className="text-[13px]">
                  <b>{p.arrivalOrder ? ordinal(p.arrivalOrder) : '—'}</b>
                  <br />
                  <span className="text-muted">
                    kept {s.kept} of {s.towerHeight}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div
                    className="flex flex-wrap items-center gap-[3px]"
                    aria-label={`${p.name}: ${s.towerHeight} memories, kept discs ${a + 1}–${b + 1}`}
                  >
                    {p.tower.map((id, i) => {
                      const c = state.cards[id];
                      const kept = i >= a && i <= b;
                      return (
                        <span key={i} className="flex flex-col items-center gap-[3px]">
                          <span
                            title={`${DOMAIN[c.color].name}: ${c.name}${kept ? '' : ' (stayed behind)'}`}
                            className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full"
                            style={{ background: DOMAIN[c.color].css, opacity: kept ? 1 : 0.28 }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              aria-hidden
                              style={{
                                fill: 'none',
                                stroke: 'var(--on-domain)',
                                strokeWidth: 2.6,
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                              }}
                            >
                              <path d={ICONS[c.color]} />
                            </svg>
                          </span>
                          <span
                            className="h-[3px] w-[22px] rounded-sm"
                            style={{ background: kept ? 'var(--door)' : 'transparent' }}
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div
                    className="flex h-[18px] overflow-hidden rounded-[9px] bg-ground"
                    role="img"
                    aria-label={`Cards ${s.cards}, Full life ${s.fullLife}, Passion ${s.passion}, Reflection ${s.reflection}`}
                  >
                    <span style={{ width: w(s.cards), background: 'var(--c-cards)' }} />
                    <span style={{ width: w(s.fullLife), background: 'var(--c-fulllife)' }} />
                    <span style={{ width: w(s.passion), background: 'var(--c-passion)' }} />
                    <span style={{ width: w(s.reflection), background: 'var(--c-reflection)' }} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-xs">
                    <span>
                      <b className="font-mono">{s.cards}</b> <span className="text-muted">cards</span>
                    </span>
                    <span>
                      <b className="font-mono">{s.fullLife}</b> <span className="text-muted">full life</span>
                    </span>
                    <span>
                      <b className="font-mono">{s.passion}</b> <span className="text-muted">passion</span>
                    </span>
                    <span>
                      <b className="font-mono">{s.reflection}</b>{' '}
                      <span className="text-muted">reflection</span>
                    </span>
                  </div>
                </div>
                <span
                  className="text-right font-display text-[32px] font-extrabold"
                  data-testid={`total-${p.id}`}
                >
                  {s.total}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
