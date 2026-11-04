'use client';
// Analyst window scorer (design/v2/screens/Analyst-Doorway.dc.html, DESIGN-v2 §4).

import { useEffect, useMemo, useState } from 'react';
import type { GameState, PlayerId } from '@doorway/engine';
import { DOMAIN } from '@/lib/domains';
import { sensitivity, windowDetail, windowLabel, windowTable } from '@/lib/window-model';
import { AnalystButton, Panel } from './panel';

export function AnalystDoorway({
  state,
  playerId,
  hintAllowed,
  onLock,
  othersLine,
  start: startProp,
  onStart,
}: {
  state: GameState;
  playerId: PlayerId;
  hintAllowed: boolean;
  onLock: (start: number, end: number) => void;
  othersLine?: string;
  start?: number | null;
  onStart?: (start: number) => void;
}) {
  const p = state.players.find((x) => x.id === playerId)!;
  const { rows: windows, allowance } = useMemo(() => windowTable(state, playerId), [state, playerId]);
  const keep = Math.min(allowance, p.tower.length);
  const maxStart = Math.max(0, p.tower.length - keep);
  const [own, setOwn] = useState(maxStart);
  const start = Math.max(0, Math.min(maxStart, startProp ?? own));
  const setStart = (v: number) => {
    setOwn(v);
    onStart?.(v);
  };
  const [locked, setLocked] = useState(false);
  const sel = windows.find((w) => w.start === start) ?? windows[windows.length - 1];
  const det = windowDetail(state, playerId, sel);
  const sens = useMemo(
    () => (hintAllowed ? sensitivity(state, playerId) : []),
    [state, playerId, hintAllowed],
  );
  const maxSens = Math.max(1, ...sens.map((x) => x.score));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (locked || tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        setOwn(Math.min(maxStart, start + 1));
        onStart?.(Math.min(maxStart, start + 1));
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        setOwn(Math.max(0, start - 1));
        onStart?.(Math.max(0, start - 1));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, maxStart, start, onStart]);
  const lock = () => {
    setLocked(true);
    onLock(sel.start, sel.end);
  };
  const towerRows = p.tower.map((id, i) => ({ id, i })).reverse();
  return (
    <div data-testid="doorway-select">
      <div className="mt-[18px] mb-3.5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">Window scorer</h1>
        <span className="text-[13px] text-muted">
          Every unbroken stretch of {keep} you could keep, scored. Only maximal windows are shown; a shorter
          one never scores more.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel label="Tower by window" title="Tower × windows" className="lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]" data-testid="window-matrix">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-[11.5px] text-muted">
                  <th className="px-1 py-[5px] text-left font-semibold">#</th>
                  <th className="px-1 py-[5px] text-left font-semibold">Memory</th>
                  <th className="px-1 py-[5px] text-right font-semibold">Pts</th>
                  <th className="px-1 py-[5px] text-left font-semibold">Note</th>
                  {windows.map((w) => (
                    <th
                      key={w.start}
                      className="px-0.5 py-[5px] text-center font-semibold"
                      style={{ background: w.start === sel.start ? 'var(--highlight-soft)' : 'transparent' }}
                    >
                      <button
                        type="button"
                        onClick={() => !locked && setStart(w.start)}
                        aria-pressed={w.start === sel.start}
                        aria-label={`Window ${windowLabel(w)}`}
                        className="min-h-[30px] cursor-pointer border-none bg-transparent px-1.5 font-mono text-[11px] font-semibold text-ink"
                      >
                        {windowLabel(w)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {towerRows.map(({ id, i }) => {
                  const c = state.cards[id];
                  const kept = i >= sel.start && i <= sel.end;
                  const note = c.reflection
                    ? `Reflection: ${DOMAIN[c.reflection].name}`
                    : c.power?.type === 'doorway_bonus'
                      ? `+${c.power.amount} allowance (kept or not)`
                      : '';
                  return (
                    <tr
                      key={`${id}-${i}`}
                      className={`border-b border-rule ${kept ? 'text-ink' : 'text-muted'}`}
                    >
                      <td className="px-1 py-[5px] font-mono">{i + 1}</td>
                      <td className="px-1 py-[5px]">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-3 w-9 flex-none rounded-full border-[1.5px] border-ink"
                            style={{ background: DOMAIN[c.color].css }}
                            title={DOMAIN[c.color].name}
                          />
                          {c.name}
                        </span>
                      </td>
                      <td className="px-1 py-[5px] text-right font-mono">{c.points}</td>
                      <td className="px-1 py-[5px] text-[12px]">{note}</td>
                      {windows.map((w) => {
                        const inW = i >= w.start && i <= w.end;
                        const on = w.start === sel.start;
                        return (
                          <td
                            key={w.start}
                            className="px-0.5 py-[3px]"
                            style={{ background: on ? 'var(--highlight-soft)' : 'transparent' }}
                          >
                            <span
                              className="mx-1 block h-4 rounded-[3px]"
                              style={{
                                background: inW ? (on ? 'var(--ink)' : '#B9AE9A') : 'transparent',
                                border: inW ? '0' : '1px dashed var(--panel-border)',
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {othersLine && <p className="mt-2.5 mb-0 text-[12.5px] text-muted">{othersLine}</p>}
        </Panel>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <Panel label="Window totals" title="Scores">
            <table className="w-full text-[13px]" data-testid="window-scores">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-right text-[11.5px] text-muted">
                  <th className="px-1 py-[5px] text-left font-semibold">Window</th>
                  <th className="px-1 py-[5px] font-semibold">Cards</th>
                  <th className="px-1 py-[5px] font-semibold">Life</th>
                  <th className="px-1 py-[5px] font-semibold">Passion</th>
                  <th className="px-1 py-[5px] font-semibold">Refl.</th>
                  <th className="px-1 py-[5px] font-semibold">Total</th>
                  {hintAllowed && <th className="px-1 py-[5px] font-semibold">vs best</th>}
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => {
                  const on = w.start === sel.start;
                  return (
                    <tr
                      key={w.start}
                      className="border-b border-rule text-right font-mono transition-colors duration-[120ms]"
                      style={{ background: on ? 'var(--highlight)' : 'transparent' }}
                    >
                      <td className="px-0.5 py-[3px] text-left">
                        <button
                          type="button"
                          onClick={() => !locked && setStart(w.start)}
                          aria-pressed={on}
                          className="min-h-[30px] cursor-pointer border-none bg-transparent px-1 font-mono font-semibold text-ink"
                          data-testid={`window-${w.start}`}
                        >
                          {windowLabel(w)}
                        </button>
                      </td>
                      <td className="px-1 py-[3px]">{w.cards}</td>
                      <td className="px-1 py-[3px]">{w.fullLife}</td>
                      <td className="px-1 py-[3px]">{w.passion}</td>
                      <td className="px-1 py-[3px]">{w.reflection}</td>
                      <td className="px-1 py-[3px] font-semibold">{w.total}</td>
                      {hintAllowed && (
                        <td
                          className="px-1 py-[3px]"
                          style={{ color: w.best ? 'var(--good)' : 'var(--bad)' }}
                        >
                          {w.best ? '✓ best' : w.vsBest}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <section
            aria-label="Selected window detail"
            className="rounded-[10px] border-[1.5px] border-ink bg-panel px-4 py-3.5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[13px] font-bold tracking-[0.06em] uppercase">Discs {det.label}</h2>
              <span className="font-mono text-[22px] font-semibold" data-testid="doorway-total">
                {det.total}
              </span>
            </div>
            <dl className="mt-2.5 mb-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
              <dt className="text-muted">Domains</dt>
              <dd className="m-0 font-mono">{det.domCounts}</dd>
              <dt className="text-muted">Full life</dt>
              <dd className="m-0">{det.setsWhy}</dd>
              <dt className="text-muted">Passion</dt>
              <dd className="m-0">{det.passionWhy}</dd>
              <dt className="text-muted">Reflection</dt>
              <dd className="m-0">{det.reflectionWhy}</dd>
              <dt className="text-muted">Left behind</dt>
              <dd className="m-0">{det.lost}</dd>
            </dl>
            <AnalystButton primary onClick={lock} disabled={locked} testId="walk-through">
              {locked ? 'Locked' : `Lock in discs ${det.label}`}
            </AnalystButton>
          </section>
          {hintAllowed ? (
            <Panel label="Allowance sensitivity" title="If you had arrived at another time">
              <p className="mt-0 mb-2 text-[12.5px] text-muted">
                Best score for each allowance with this same tower. This is what arriving earlier or later was
                worth.
              </p>
              <table className="w-full font-mono text-[13px]" data-testid="sensitivity">
                <thead>
                  <tr className="border-b-[1.5px] border-ink text-right font-body text-[11.5px] text-muted">
                    <th className="px-1 py-[5px] text-left font-semibold">Keep</th>
                    <th className="px-1 py-[5px] font-semibold">Means</th>
                    <th className="px-1 py-[5px] font-semibold">Best window</th>
                    <th className="px-1 py-[5px] font-semibold">Score</th>
                    <th className="w-[90px] px-1 py-[5px]">
                      <span className="sr-only">Bar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sens.map((x) => (
                    <tr
                      key={x.keep}
                      className="border-b border-rule text-right"
                      style={{ background: x.mine ? 'var(--highlight)' : 'transparent' }}
                    >
                      <td className="px-1 py-[5px] text-left font-semibold">{x.keep}</td>
                      <td
                        className={`px-1 py-[5px] font-body text-[12px] ${x.mine ? 'text-ink' : 'text-muted'}`}
                      >
                        {x.means}
                      </td>
                      <td className="px-1 py-[5px]">{x.win}</td>
                      <td className="px-1 py-[5px] font-semibold">{x.score}</td>
                      <td className="px-1 py-[5px]">
                        <span
                          className="ml-auto block h-2.5 bg-ink"
                          style={{ width: `${Math.round((80 * x.score) / maxSens)}px` }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : (
            <Panel label="Allowance sensitivity" title="If you had arrived at another time">
              <p className="m-0 text-[12.5px] text-muted">
                Hidden in a blind test (best-window hints are off).
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
