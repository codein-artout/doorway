'use client';
// Analyst game report (design/v2/screens/Analyst-Results.dc.html, DESIGN-v2 §4).

import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '@doorway/engine';
import { turnPoints } from '@/lib/analyst-model';
import { download } from '@/lib/import-export';
import {
  economy,
  finalTable,
  kpis,
  playedMostLike,
  turningPoints,
  vsStudy,
  type FinalRow,
  type StudySummary,
} from '@/lib/report-model';
import { AnalystButton, Panel } from './panel';

const SPLIT = [
  { key: 'cards', label: 'cards', bg: 'var(--ink)' },
  { key: 'fullLife', label: 'full life', bg: 'var(--line-arun)' },
  { key: 'passion', label: 'passion', bg: '#B9AE9A' },
  {
    key: 'reflection',
    label: 'reflection',
    bg: 'repeating-linear-gradient(45deg, var(--ink) 0 2px, var(--panel) 2px 5px)',
  },
] as const;

/** Fetch the trimmed bot-study numbers (static route over reports/data/summary.json). */
export function useStudy() {
  const [study, setStudy] = useState<StudySummary | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/study')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setStudy(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return study;
}

function csvOf(rows: FinalRow[]) {
  const head =
    'rank,player,role,arrived,tower,allowed,kept,lost,cards,full_life,passion,reflection,total,window';
  const q = (x: string | number) =>
    typeof x === 'string' && /[",]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  return [
    head,
    ...rows.map((r) =>
      [
        r.rank,
        r.name,
        r.role,
        r.arrived,
        r.tower,
        r.allowed,
        r.kept,
        r.lost,
        r.cards,
        r.fullLife,
        r.passion,
        r.reflection,
        r.total,
        r.win,
      ]
        .map(q)
        .join(','),
    ),
  ].join('\n');
}

export function AnalystResults({
  state,
  timeline,
  viewer,
  replayHref,
  storedId,
  onUndo,
  canUndo,
}: {
  state: GameState;
  timeline: { states: GameState[]; thinkMs: (number | null)[] };
  viewer: string | null;
  replayHref: string;
  storedId?: string;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
  const points = useMemo(() => turnPoints(timeline), [timeline]);
  const rows = useMemo(() => finalTable(state, viewer), [state, viewer]);
  const k = useMemo(() => kpis(state, points), [state, points]);
  const eco = useMemo(() => economy(state, points, timeline.states), [state, points, timeline.states]);
  const styles = useMemo(() => playedMostLike(state, points), [state, points]);
  const moments = useMemo(() => turningPoints(timeline.states, points), [timeline.states, points]);
  const study = useStudy();
  const vs = vsStudy(state, points, study);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const href = (move: number) => (storedId ? `/replay?id=${storedId}&move=${move}` : replayHref);
  const n = state.players.length;
  return (
    <div data-testid="results">
      <h1 className="sr-only">Game report</h1>
      <section aria-label="Summary" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="kpis">
        {k.map((x) => (
          <div
            key={x.label}
            className="rounded-[10px] border-[1.5px] border-panel-border bg-panel px-3.5 py-3"
          >
            <div className="text-[11.5px] font-semibold tracking-[0.05em] text-muted uppercase">
              {x.label}
            </div>
            <div className="mt-0.5 font-mono text-[22px] font-semibold md:text-[24px]">{x.value}</div>
            <div className="text-[12px] text-muted">{x.note}</div>
          </div>
        ))}
      </section>

      <Panel label="Final scores" title="Final scores" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]" data-testid="final-table">
            <thead>
              <tr className="border-b-[1.5px] border-ink text-right text-[11.5px] text-muted">
                <th className="px-1.5 py-1.5 text-left font-semibold">#</th>
                <th className="px-1.5 py-1.5 text-left font-semibold">Player</th>
                <th className="px-1.5 py-1.5 font-semibold">Arrived</th>
                <th className="px-1.5 py-1.5 font-semibold">Tower</th>
                <th className="px-1.5 py-1.5 font-semibold">Allowed</th>
                <th className="px-1.5 py-1.5 font-semibold">Kept</th>
                <th className="px-1.5 py-1.5 font-semibold">Lost</th>
                <th className="px-1.5 py-1.5 font-semibold">Cards</th>
                <th className="px-1.5 py-1.5 font-semibold">Life</th>
                <th className="px-1.5 py-1.5 font-semibold">Passion</th>
                <th className="px-1.5 py-1.5 font-semibold">Refl.</th>
                <th className="px-1.5 py-1.5 font-semibold">Total</th>
                <th className="w-[180px] px-1.5 py-1.5 text-left font-semibold">Split</th>
                <th className="px-1.5 py-1.5 text-left font-semibold">Window vs best</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-rule text-right font-mono"
                  style={{ background: r.id === viewer ? 'var(--highlight-soft)' : 'transparent' }}
                >
                  <td className="px-1.5 py-2 text-left">{r.rank}</td>
                  <td className="px-1.5 py-2 text-left font-body">
                    <b className="font-semibold">{r.name}</b>{' '}
                    <span className="text-[12px] text-muted">{r.role}</span>
                  </td>
                  <td className="px-1.5 py-2">{r.arrived}</td>
                  <td className="px-1.5 py-2">{r.tower}</td>
                  <td className="px-1.5 py-2">{r.allowed}</td>
                  <td className="px-1.5 py-2">{r.kept}</td>
                  <td className="px-1.5 py-2" style={{ color: r.lost >= 5 ? 'var(--bad)' : 'var(--ink)' }}>
                    {r.lost ? `−${r.lost}` : 0}
                  </td>
                  <td className="px-1.5 py-2">{r.cards}</td>
                  <td className="px-1.5 py-2">{r.fullLife}</td>
                  <td className="px-1.5 py-2">{r.passion}</td>
                  <td className="px-1.5 py-2">{r.reflection}</td>
                  <td className="px-1.5 py-2 font-semibold" data-testid={`total-${r.id}`}>
                    {r.total}
                  </td>
                  <td className="px-1.5 py-2">
                    <div
                      role="img"
                      aria-label={`cards ${r.cards}, full life ${r.fullLife}, passion ${r.passion}, reflection ${r.reflection}`}
                      className="flex h-3.5 border border-ink bg-panel"
                    >
                      {SPLIT.map((x) => (
                        <span
                          key={x.key}
                          style={{ width: `${(100 * r[x.key]) / maxTotal}%`, background: x.bg }}
                        />
                      ))}
                    </div>
                  </td>
                  <td
                    className="px-1.5 py-2 text-left text-[12px]"
                    style={{ color: r.winBest ? 'var(--good)' : 'var(--bad)' }}
                  >
                    {r.winBest ? '✓ ' : '✗ '}
                    {r.win}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {SPLIT.map((x) => (
            <span key={x.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5" style={{ background: x.bg }} /> {x.label}
            </span>
          ))}
          <span>tiebreak: most discs kept, then earlier arrival</span>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel label="Turn economy" title="Turn economy" className="lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[13px]" data-testid="economy">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-right text-[11.5px] text-muted">
                  <th className="px-1 py-[5px] text-left font-semibold">Player</th>
                  <th className="px-1 py-[5px] font-semibold">Turns</th>
                  <th className="px-1 py-[5px] font-semibold">Back-to-back</th>
                  <th className="px-1 py-[5px] font-semibold">Rushes</th>
                  <th className="px-1 py-[5px] font-semibold">Yrs / quest</th>
                  <th className="px-1 py-[5px] font-semibold">Yrs saved</th>
                  <th className="px-1 py-[5px] font-semibold">Swaps used</th>
                  <th className="px-1 py-[5px] font-semibold">Think (median)</th>
                </tr>
              </thead>
              <tbody>
                {eco.map((e) => (
                  <tr key={e.id} className="border-b border-rule text-right font-mono">
                    <td className="px-1 py-[5px] text-left font-body">{e.name}</td>
                    <td className="px-1 py-[5px]">{e.turns}</td>
                    <td className="px-1 py-[5px]">{e.b2b}</td>
                    <td className="px-1 py-[5px]">{e.rushes}</td>
                    <td className="px-1 py-[5px]">{e.ypq}</td>
                    <td className="px-1 py-[5px]">{e.saved}</td>
                    <td className="px-1 py-[5px]">{e.swaps}</td>
                    <td className="px-1 py-[5px]">{e.think}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 mb-0 text-[12px] text-muted">
            Back-to-back = moved again straight away (still furthest back). Years saved = printed years minus
            what was paid (experience, powers, next-quest discounts). Swaps used = made / offered.
          </p>
        </Panel>

        <Panel
          label="Played most like"
          title="Played most like"
          className="lg:col-span-5"
          testId="played-like"
        >
          <p className="mt-0 mb-2.5 text-[12.5px] text-muted">
            Agreement = share of each player&apos;s decisions where that strategy, given the same state, would
            have chosen the same move (0–1). Top three of the study strategies (Lookahead and Random not
            rerun).
          </p>
          <div className="flex flex-col gap-3">
            {styles.map((st) => (
              <div key={st.id}>
                <div className="text-[13px]">
                  <b className="font-semibold">{st.name}</b>{' '}
                  <span className="text-muted">
                    — {st.bars[0]?.label ?? '—'} · {st.decisions} decisions
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {st.bars.map((b, i) => (
                    <div
                      key={b.id}
                      className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[12px]"
                    >
                      <span>{b.label}</span>
                      <span className="h-2 bg-sheet">
                        <span
                          className="block h-full"
                          style={{
                            width: `${Math.round(b.v * 100)}%`,
                            background: i === 0 ? 'var(--ink)' : '#B9AE9A',
                          }}
                        />
                      </span>
                      <span className="text-right font-mono">{b.v.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          label="Turning points"
          title="Turning points"
          className="lg:col-span-7"
          testId="turning-points"
        >
          {moments.length === 0 ? (
            <p className="m-0 text-[12.5px] text-muted">No single move swung the game by 5 or more.</p>
          ) : (
            <table className="w-full text-[13px]">
              <tbody>
                {moments.map((m, i) => (
                  <tr key={i} className="border-b border-rule align-top">
                    <td className="px-1 py-1.5 font-mono text-muted">{m.t}</td>
                    <td className="px-1 py-1.5">{m.text}</td>
                    <td
                      className="px-1 py-1.5 text-right font-mono font-semibold whitespace-nowrap"
                      style={{
                        color:
                          m.tone === 'good' ? 'var(--good)' : m.tone === 'bad' ? 'var(--bad)' : 'var(--ink)',
                      }}
                    >
                      {m.effect}
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      <a href={href(m.move)} aria-label={`Replay ${m.t} (move ${m.move})`}>
                        replay
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          label="Against the bot study"
          title="This game vs the bot study"
          className="lg:col-span-5"
          testId="vs-study"
        >
          <p className="mt-0 mb-2 text-[12.5px] text-muted">
            {n}-player averages from the committed study
            {study?.groups[`${n}p`] ? ` (${study.groups[`${n}p`].games.toLocaleString('en')} games)` : ''},
            read from <code className="font-mono">reports/data/summary.json</code>.
          </p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-[1.5px] border-ink text-right text-[11.5px] text-muted">
                <th className="px-1 py-[5px] text-left font-semibold">Measure</th>
                <th className="px-1 py-[5px] font-semibold">This game</th>
                <th className="px-1 py-[5px] font-semibold">Study</th>
              </tr>
            </thead>
            <tbody>
              {vs.map((v) => (
                <tr key={v.m} className="border-b border-rule text-right font-mono">
                  <td className="px-1 py-[5px] text-left font-body">{v.m}</td>
                  <td className="px-1 py-[5px] font-semibold">{v.g}</td>
                  <td className="px-1 py-[5px]">{v.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <a
          href="/"
          className="inline-flex min-h-[38px] items-center rounded-lg border-[1.5px] border-ink bg-ink px-4 font-semibold text-sheet no-underline"
        >
          Play again
        </a>
        <a
          href={replayHref}
          className="inline-flex min-h-[38px] items-center rounded-lg border-[1.5px] border-ink px-4 font-semibold text-ink no-underline"
        >
          Watch the replay
        </a>
        <AnalystButton onClick={() => download(`doorway-report-${state.seed}.csv`, csvOf(rows))}>
          CSV
        </AnalystButton>
        {onUndo && (
          <AnalystButton onClick={onUndo} disabled={!canUndo}>
            Undo the last move
          </AnalystButton>
        )}
      </div>
    </div>
  );
}
