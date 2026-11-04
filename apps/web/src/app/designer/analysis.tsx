'use client';
import { useState } from 'react';
import { buildModel, COLORS as C, fx, label, ordinal, pct, TARGETS, type Summary } from '@doorway/sim/model';
import { answers } from '@doorway/sim/report-answers';
import { diverging, seatBars, winChart } from '@doorway/sim/html';
import { DesignerNav } from '@/components/designer-nav';
import { DOMAIN } from '@/lib/domains';

const panel = 'min-w-0 rounded-2xl border border-line bg-surface p-5';

export function Analysis({ summary }: { summary: Summary | null }) {
  const avail = summary ? [4, 3, 2].filter((k) => summary.groups[`main-${k}p`]) : [];
  const [n, setN] = useState(avail[0] ?? 4);
  if (!summary)
    return (
      <div className="mx-auto max-w-[1440px]">
        <DesignerNav />
        <main className="p-7">
          <h1 className="font-display text-4xl">What the bots found</h1>
          <p className="text-muted">No study data yet. Run pnpm sim:study, then pnpm sim:report.</p>
        </main>
      </div>
    );
  const m = buildModel(summary);
  const ans = answers(m);
  const g = summary.groups[`main-${n}p`];
  const strat = g
    ? Object.entries(g.byPolicy)
        .map(([id, p]: [string, any]) => ({ id, label: label(summary, id), win: p.win, lo: p.lo, hi: p.hi }))
        .sort((a, b) => b.win - a.win)
    : [];
  const d = m.doorway.find((x) => x.players === n) ?? m.d4;
  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <DesignerNav
        right={
          <label className="inline-flex items-center gap-2 text-[13px] text-muted">
            Players
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="min-h-[40px] rounded-[10px] border border-line bg-surface px-2 text-text"
              data-testid="players"
            >
              {m.counts
                .slice()
                .reverse()
                .map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
            </select>
          </label>
        }
      />
      <header className="px-4 pt-[22px] pb-1.5 md:px-7">
        <h1 className="m-0 font-display text-[38px] font-extrabold tracking-[-0.015em]">
          What the bots found
        </h1>
        <p className="mt-1 mb-0 text-muted">
          {m.totals.games.toLocaleString()} games · {Object.keys(summary.strategies).length} strategies +
          noisy variants · 1–4 players · every seat order · ruleset {summary.ruleset.id} · generated{' '}
          {String(summary.generatedAt).slice(0, 10)}
        </p>
      </header>
      <section aria-label="Headline answers" className="grid gap-3 px-4 py-3.5 md:grid-cols-4 md:px-7">
        {ans.slice(0, 4).map((a) => (
          <div
            key={a.q}
            className="flex flex-col gap-2 rounded-2xl bg-surface p-[18px]"
            style={{ border: `1px solid ${a.chip === 'HEADLINE' ? 'var(--alert)' : 'var(--line)'}` }}
          >
            <span className="text-[13px] text-muted">{a.q}</span>
            <span className="font-display text-2xl leading-tight font-extrabold">{a.a.split('. ')[0]}.</span>
            <span className="text-[13px]">{a.a.split('. ').slice(1).join('. ')}</span>
            <span
              className="self-start rounded-full px-2 py-1 font-mono text-[11px] font-bold text-ink"
              style={{ background: 'var(--highlight)' }}
            >
              {a.chip}
            </span>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-4 px-4 py-1 md:px-7">
        <section aria-label="Win rate by strategy" className={`${panel} flex-[1_1_560px]`}>
          <h2 className="m-0 font-display text-[19px]">Win rate by strategy · {n} players</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">
            Dot = win rate, line = 95% confidence interval. Dashed line = fair share ({pct(1 / n, 0)}).
            {n === 4 ? ' Red line = the 35% "ready to print" ceiling.' : ''}
          </p>
          <div
            dangerouslySetInnerHTML={{
              __html: winChart(strat, 1 / n, n === 4 ? TARGETS.maxStrategyWin4p : null),
            }}
          />
        </section>
        <section aria-label="Head to head" className={`${panel} flex-[1_1_560px]`}>
          <h2 className="m-0 font-display text-[19px]">Head to head · 2 players</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">
            Row strategy&apos;s win rate against column strategy, both seat orders. Orange = row wins more,
            blue = row loses more.
          </p>
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[560px] gap-0.5 font-mono text-[11px] font-medium"
              style={{ gridTemplateColumns: `112px repeat(${m.matrix.length}, minmax(34px, 1fr))` }}
            >
              <span />
              {m.matrix.map((r) => (
                <span key={r.id} className="pb-1 text-center text-muted" title={r.label}>
                  {r.short}
                </span>
              ))}
              {m.matrix.map((r) => [
                <span key={r.id} className="self-center pr-1.5 text-right font-body text-xs">
                  {r.label}
                </span>,
                ...r.cells.map((c: { vs: string; v: number | null }) => {
                  const col =
                    c.v === null ? { bg: 'var(--ground)', fg: 'var(--grey)' } : diverging(c.v, 0.5, 0.35);
                  return (
                    <span
                      key={r.id + c.vs}
                      className="grid h-[30px] place-items-center rounded-[3px]"
                      style={{ background: col.bg, color: col.fg }}
                      title={`${r.label} vs ${label(summary, c.vs)}: ${pct(c.v)}`}
                    >
                      {c.v === null ? '—' : Math.round(c.v * 100)}
                    </span>
                  );
                }),
              ])}
            </div>
          </div>
        </section>
      </div>
      <div className="grid gap-4 px-4 pt-4 pb-1 md:grid-cols-3 md:px-7">
        <section aria-label="The Doorway question" className={panel} style={{ borderColor: 'var(--door)' }}>
          <h2 className="m-0 font-display text-[19px]">Does arriving first make the Doorway irrelevant?</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">
            Average tower at arrival vs. tile size, by arrival order ({d?.players}p).
          </p>
          <div className="flex flex-col gap-3">
            {d?.rows.map((r: any) => {
              const max = Math.max(...d.rows.map((x: any) => x.tower)) * 1.1;
              return (
                <div key={r.order}>
                  <div className="flex justify-between gap-2 text-[13px]">
                    <b>
                      {ordinal(r.order)} · keeps {fx(r.allowance, 0)}
                    </b>
                    <span>
                      loses <b className="font-mono">{fx(r.lost, 1)}</b> discs · {pct(r.shareLostAny, 0)} lose
                      any
                    </span>
                  </div>
                  <div className="relative mt-1 h-4 rounded bg-ground">
                    <span
                      className="absolute top-0 bottom-0 left-0 rounded"
                      style={{ width: `${(r.tower / max) * 100}%`, background: C.grey }}
                    />
                    <span
                      className="absolute top-0 bottom-0 left-0 rounded bg-door"
                      style={{ width: `${(Math.min(r.allowance, r.tower) / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 mb-0 text-xs text-muted">
            Light = discs that fit through. Grey beyond it = discs left behind. Non-first arrivals lose{' '}
            {fx(d?.nonFirstLost)} on average (target ≥ 2).
          </p>
        </section>
        <section aria-label="Seat advantage" className={panel}>
          <h2 className="m-0 font-display text-[19px]">Seat advantage</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">
            Win rate minus fair share, by starting stack position. Target: within ±5 points.
          </p>
          {m.seats.map((x) => (
            <div key={x.players} className="mb-3">
              <div className="mb-1 text-[13px] font-bold">
                {x.players} players · worst {fx(x.worstPP, 1)} pts
              </div>
              <div dangerouslySetInnerHTML={{ __html: seatBars(x) }} />
            </div>
          ))}
        </section>
        <section aria-label="Where points come from" className={panel}>
          <h2 className="m-0 font-display text-[19px]">Where winning points come from</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">
            Share of all 4p points, plus how well each part predicts a win (logistic β, point-biserial r).
          </p>
          <div className="flex flex-col gap-2.5">
            {m.components.map((c) => (
              <div
                key={c.key}
                className="grid items-center gap-2.5 text-[13px]"
                style={{ gridTemplateColumns: '90px minmax(0,1fr) 110px' }}
              >
                <span>{c.name}</span>
                <span className="h-3.5 overflow-hidden rounded bg-ground">
                  <span
                    className="block h-full"
                    style={{ width: `${(c.share ?? 0) * 100}%`, background: c.color }}
                  />
                </span>
                <span className="font-mono text-xs">
                  {pct(c.share, 0)} · r={fx(c.r, 2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-line-soft pt-3 text-[13px]">
            <div>
              <b className="font-display text-[22px] font-extrabold">{fx(m.g4?.turnsPerGame.mean, 0)}</b>
              <br />
              <span className="text-muted">turns per game (4p)</span>
            </div>
            <div>
              <b className="font-display text-[22px] font-extrabold">{fx(m.g4?.extraTurns.mean, 1)}</b>
              <br />
              <span className="text-muted">extra back-to-back turns per player</span>
            </div>
            <div>
              <b className="font-display text-[22px] font-extrabold">{pct(m.rushShare, 1)}</b>
              <br />
              <span className="text-muted">of moves are Rush</span>
            </div>
            <div>
              <b className="font-display text-[22px] font-extrabold">{fx(m.g4?.savedExperience.mean, 1)}</b>
              <br />
              <span className="text-muted">years saved by experience, per player</span>
            </div>
          </div>
        </section>
      </div>
      <div className="flex flex-wrap gap-4 px-4 pt-3 pb-1 md:px-7">
        <section aria-label="Card balance" className={`${panel} flex-[1_1_560px]`}>
          <h2 className="m-0 font-display text-[19px]">Cards to look at</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-muted">
            Pick rate when visible and takeable, and the win share of players who took it relative to fair
            (1.00 = fair).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="border-b border-line-soft py-1.5 font-normal">ID</th>
                  <th className="border-b border-line-soft font-normal">Card</th>
                  <th className="border-b border-line-soft font-normal">Picked</th>
                  <th className="border-b border-line-soft font-normal">Win when taken</th>
                  <th className="border-b border-line-soft font-normal">Flag</th>
                </tr>
              </thead>
              <tbody>
                {m.lookAt.map((c: any) => (
                  <tr key={c.id}>
                    <td className="border-b border-[var(--row-line)] py-2 font-mono">{c.id}</td>
                    <td className="border-b border-[var(--row-line)]">
                      <span
                        className="mr-2 inline-block h-3.5 w-3.5 rounded-full align-[-2px]"
                        style={{ background: DOMAIN[c.domain as keyof typeof DOMAIN].css }}
                      />
                      {c.name}
                    </td>
                    <td className="border-b border-[var(--row-line)] font-mono">{pct(c.pickRate)}</td>
                    <td className="border-b border-[var(--row-line)] font-mono">{fx(c.relWin)}×</td>
                    <td className="border-b border-[var(--row-line)]">
                      {c.flag && (
                        <span
                          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold text-ink"
                          style={{ background: c.flag === 'strong' ? C.passion : C.fullLife }}
                        >
                          {c.flag.toUpperCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section aria-label="Sensitivity sweeps" className={`${panel} flex-[1_1_560px]`}>
          <h2 className="m-0 font-display text-[19px]">If we turn one dial…</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-muted">
            Top strategy&apos;s win rate (bar) and discs lost by non-first arrivals (number), per value.
            Baseline outlined.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {m.sweeps.map((w) => {
              const max = Math.max(0.4, ...w.values.map((v: any) => v.topWin));
              return (
                <div key={w.key} className="rounded-xl bg-ground p-3">
                  <div className="mb-2 font-mono text-xs font-bold">{w.key}</div>
                  <div className="flex h-[92px] items-end gap-2">
                    {w.values.map((v: any) => (
                      <div
                        key={v.label}
                        className="flex h-[92px] flex-1 flex-col items-center justify-end gap-[3px]"
                      >
                        <span className="font-mono text-[10px] font-medium text-muted">
                          {fx(v.nonFirstLost, 1)}
                        </span>
                        <span
                          className="w-full rounded-[3px]"
                          title={`${label(summary, v.topPolicy)} ${pct(v.topWin)}`}
                          style={{
                            height: `${(v.topWin / max) * 72}px`,
                            background: v.base ? C.door : C.grey,
                            outline: v.base ? `2px solid ${C.door}` : 'none',
                            outlineOffset: 2,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    {w.values.map((v: any) => (
                      <span key={v.label} className="flex-1 text-center font-mono text-[10px] font-medium">
                        {v.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section
        aria-label="Suggested rule tweaks"
        className="mx-4 mt-4 rounded-2xl border border-door bg-sunk p-[22px] md:mx-7"
      >
        <h2 className="m-0 mb-1 font-display text-[22px]">Suggested rule tweaks</h2>
        <p className="m-0 mb-3.5 text-[13px] text-muted">
          Each one links to the sweep that backs it. Nothing changes in the rules until you accept it in the
          sandbox.
        </p>
        <ol className="m-0 flex flex-col gap-2.5 pl-5">
          {m.tweaks.map((t) => (
            <li key={t.title}>
              <b>{t.title}</b> <span className="text-muted">— {t.why} </span>
              <a
                className="underline"
                href={`/designer/sandbox?set=${encodeURIComponent(`${t.sweep}=${t.value}`)}`}
              >
                Try it in the sandbox
              </a>
              <div className="text-xs text-muted">{t.evidence}</div>
            </li>
          ))}
          {!m.tweaks.length && <li>No sweep value beat the baseline by the stated margins.</li>}
        </ol>
      </section>
      <section aria-label="Ready to print" className={`${panel} mx-4 mt-4 md:mx-7`}>
        <h2 className="m-0 mb-2 font-display text-[19px]">&ldquo;Ready to print&rdquo; signals</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {m.readyToPrint.map((r) => (
                <tr key={r.signal}>
                  <td className="border-b border-[var(--row-line)] py-2 pr-3">{r.signal}</td>
                  <td className="border-b border-[var(--row-line)] pr-3 text-muted">{r.target}</td>
                  <td className="border-b border-[var(--row-line)] pr-3 font-mono text-xs">{r.value}</td>
                  <td className="border-b border-[var(--row-line)]">
                    {r.verdict === 'n/a' ? (
                      <span className="text-muted">human playtests</span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold text-ink"
                        style={{ background: r.verdict === 'pass' ? C.door : C.passion }}
                      >
                        {r.verdict.toUpperCase()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
