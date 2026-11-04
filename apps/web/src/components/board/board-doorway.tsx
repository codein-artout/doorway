'use client';
// The Doorway moment, Board style (Board-Doorway.dc.html): the tower as chips with a lamplight rail on the kept
// stretch, the open door, score stubs, a rotated total stamp and "Every stretch you could take".

import { useEffect, useMemo, useState } from 'react';
import { bestWindow, scoreWindow, windowScores, type GameState, type PlayerId } from '@doorway/engine';
import { DOMAIN } from '@/lib/domains';
import { ordinal } from '@/lib/format';
import { scoreWhy } from '../doorway';
import { Chip, ChipLabel, INK } from './pieces';

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function BoardDoorway({
  state,
  playerId,
  hintAllowed,
  onLock,
  othersLine,
}: {
  state: GameState;
  playerId: PlayerId;
  hintAllowed: boolean;
  onLock: (start: number, end: number) => void;
  othersLine?: string;
}) {
  const p = state.players.find((x) => x.id === playerId)!;
  const tower = p.tower;
  const keep = Math.min(p.doorwayAllowance ?? 0, tower.length);
  const maxStart = Math.max(0, tower.length - keep);
  const bw = useMemo(() => bestWindow(state, playerId), [state, playerId]);
  const [start, setStart] = useState(maxStart);
  const [showHint, setShowHint] = useState(false);
  const [locked, setLocked] = useState(false);
  const end = start + keep - 1;
  const sc = scoreWindow(state, playerId, start, end);
  const why = scoreWhy(state, tower, start, end);
  const n = state.players.length;
  const base =
    n === 1
      ? state.ruleset.solo.doorway
      : (state.ruleset.doorway[String(n)]?.[(p.arrivalOrder ?? 1) - 1] ?? 0);
  const bonus = (p.doorwayAllowance ?? 0) - base;
  const windows = windowScores(state, tower, p.doorwayAllowance ?? 0);
  const maxTotal = Math.max(1, ...windows.map((w) => w.total));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowUp') {
        setStart((x) => Math.min(maxStart, x + 1));
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setStart((x) => Math.max(0, x - 1));
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, maxStart]);
  const jump = (i: number) => {
    if (locked) return;
    let st = Math.max(0, Math.min(maxStart, i));
    if (i > end) st = Math.max(0, Math.min(maxStart, i - keep + 1));
    setStart(st);
  };
  const lock = () => {
    setLocked(true);
    setTimeout(() => onLock(start, end), reduced() ? 0 : 900);
  };
  const best = showHint && hintAllowed ? [bw.start, bw.end] : null;
  const parts: { label: string; value: number; why: string; rot: string }[] = [
    { label: 'Cards', value: sc.cards, why: why.cards, rot: '-1.5deg' },
    { label: 'Full life', value: sc.fullLife, why: why.fullLife, rot: '1deg' },
    { label: 'Passion', value: sc.passion, why: why.passion, rot: '1.2deg' },
    { label: 'Reflection', value: sc.reflection, why: why.reflection, rot: '-0.8deg' },
  ];
  const dropped = tower.length - keep;
  return (
    <div className="text-on-felt" data-testid="doorway-select">
      <div className="mt-1.5 mb-[18px] flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="m-0 font-display text-[34px] leading-[1.02] font-normal md:text-[46px]">
          {p.isBot ? `${p.name} reached the Doorway.` : "You've reached the Doorway."}
        </h1>
        <p className="m-0 mb-1.5 font-hand text-[23px] text-[#DCE3DE]">
          {p.name}, you arrived {ordinal(p.arrivalOrder ?? 1)}. Only one unbroken stretch of {keep} fits
          through.
        </p>
      </div>
      <div className="flex flex-wrap items-stretch gap-6">
        <section
          aria-label="Your tower"
          className="flex min-w-0 flex-[1_1_520px] flex-wrap gap-6 rounded-3xl px-6 py-[22px] text-ink"
          style={{
            background: 'var(--paper)',
            border: `4px solid ${INK}`,
            boxShadow: '0 12px 0 -4px var(--drop)',
          }}
        >
          <div className="min-w-0 flex-[1_1_340px]">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 font-display text-[24px] font-normal">Your life, stacked</h2>
              <span className="font-hand text-[18px] text-ink-soft">newest on top</span>
            </div>
            <div
              className="mt-3 flex flex-col"
              role="group"
              aria-label="Tap a memory to start the stretch there"
            >
              {tower
                .map((id, i) => ({ id, i }))
                .reverse()
                .map(({ id, i }) => {
                  const c = state.cards[id];
                  const kept = i >= start && i <= end;
                  const isBest = !!best && i >= best[0] && i <= best[1];
                  const note = kept
                    ? c.reflection
                      ? `+1 per ${DOMAIN[c.reflection].name}`
                      : c.power?.type === 'doorway_bonus'
                        ? 'gave +1 disc'
                        : ''
                    : 'stays behind';
                  return (
                    <div key={i} className="flex h-[34px] items-stretch gap-2.5" data-disc={i}>
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          flex: 'none',
                          background: kept
                            ? 'var(--lamplight)'
                            : isBest
                              ? `repeating-linear-gradient(0deg, ${INK} 0 4px, transparent 4px 8px)`
                              : 'transparent',
                          borderLeft: kept ? `${locked ? 3.5 : 2.5}px solid ${INK}` : '0',
                          borderRight: kept ? `${locked ? 3.5 : 2.5}px solid ${INK}` : '0',
                          borderTop: kept && i === end ? `2.5px solid ${INK}` : '0',
                          borderBottom: kept && i === start ? `2.5px solid ${INK}` : '0',
                          borderRadius:
                            kept && i === end && i === start
                              ? 6
                              : kept && i === end
                                ? '6px 6px 0 0'
                                : kept && i === start
                                  ? '0 0 6px 6px'
                                  : 0,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => jump(i)}
                        disabled={locked}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent p-0 text-left"
                        style={{
                          transform: kept
                            ? locked
                              ? 'translateY(-2px)'
                              : 'none'
                            : locked
                              ? 'translateX(28px) rotate(4deg)'
                              : 'translateX(10px)',
                          transition: reduced()
                            ? 'none'
                            : `transform .5s ease ${locked && !kept ? Math.min(Math.abs(i - start), Math.abs(i - end)) * 40 : 0}ms`,
                        }}
                      >
                        <Chip
                          domain={c.color}
                          w={128}
                          h={28}
                          label={<ChipLabel domain={c.color} />}
                          style={
                            kept
                              ? undefined
                              : {
                                  background: `color-mix(in srgb, ${DOMAIN[c.color].css} 35%, var(--paper))`,
                                  boxShadow: 'none',
                                  borderStyle: 'dashed',
                                }
                          }
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-[14px] font-extrabold"
                          style={{ color: kept ? INK : 'var(--ink-soft)' }}
                        >
                          {c.name}
                        </span>
                        <span
                          className="font-hand text-[17px] whitespace-nowrap"
                          style={{ color: 'var(--ink-soft)' }}
                        >
                          {note}
                        </span>
                        <span className="w-[34px] text-right font-display text-[15px]">{c.points}</span>
                        <span className="sr-only">{`, disc ${i + 1}${kept ? ', kept' : ', stays behind'}. Start the stretch here.`}</span>
                      </button>
                    </div>
                  );
                })}
              <span
                aria-hidden
                className="mt-1 ml-[22px] h-3 w-[156px] rounded"
                style={{ background: INK }}
              />
            </div>
            <div className="mt-[18px] flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setStart(Math.min(maxStart, start + 1))}
                disabled={start >= maxStart || locked}
                className="min-h-[46px] cursor-pointer rounded-xl px-4 font-black text-ink disabled:opacity-45"
                style={{
                  border: `2.5px solid ${INK}`,
                  background: 'var(--paper-card)',
                  boxShadow: `0 3px 0 ${INK}`,
                }}
              >
                Slide up ↑
              </button>
              <button
                type="button"
                onClick={() => setStart(Math.max(0, start - 1))}
                disabled={start <= 0 || locked}
                className="min-h-[46px] cursor-pointer rounded-xl px-4 font-black text-ink disabled:opacity-45"
                style={{
                  border: `2.5px solid ${INK}`,
                  background: 'var(--paper-card)',
                  boxShadow: `0 3px 0 ${INK}`,
                }}
              >
                Slide down ↓
              </button>
              <button
                type="button"
                onClick={() => hintAllowed && setShowHint(!showHint)}
                aria-pressed={showHint}
                disabled={!hintAllowed}
                className="min-h-[46px] cursor-pointer rounded-xl bg-transparent px-4 font-extrabold text-ink disabled:opacity-60"
                style={{ border: `2.5px dashed ${INK}` }}
                data-testid="best-hint"
              >
                {hintAllowed
                  ? showHint
                    ? 'Hide the best stretch'
                    : 'Show me the best stretch'
                  : 'Hint off (blind test)'}
              </button>
            </div>
          </div>
          <div className="flex min-w-[240px] flex-[0_1_300px] flex-col items-center justify-end gap-1.5">
            <svg
              width="100%"
              style={{ maxWidth: 270, overflow: 'visible' }}
              viewBox="0 0 270 380"
              role="img"
              aria-label="An open doorway, with warm light spilling out"
            >
              <g className={locked ? 'dw-swell-svg' : 'dw-breathe'}>
                <path
                  d="M60 372L-10 372M210 372L280 372M80 150L20 110M190 150L250 110M70 250L5 250M200 250L265 250"
                  style={{ stroke: '#E9B94A', strokeWidth: 4, strokeLinecap: 'round' }}
                />
              </g>
              <path
                d="M30 372V150a105 105 0 0 1 210 0v222z"
                style={{ fill: '#E3D3B5', stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' }}
              />
              <path
                d="M58 372V152a77 77 0 0 1 154 0v220z"
                style={{ fill: 'var(--lamplight)', stroke: INK, strokeWidth: 4 }}
              />
              <path
                d="M58 372V152l64 -26v272z"
                style={{ fill: 'var(--door-leaf)', stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }}
              />
              <circle
                cx="106"
                cy="266"
                r="5"
                style={{ fill: 'var(--lamplight)', stroke: INK, strokeWidth: 2 }}
              />
              <path
                d="M152 172c8 -14 22 -14 30 0"
                style={{ fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' }}
              />
              <path d="M14 376h242" style={{ stroke: INK, strokeWidth: 5, strokeLinecap: 'round' }} />
              <text
                x="167"
                y="110"
                textAnchor="middle"
                style={{ font: '400 26px var(--f-display)', fill: INK }}
              >
                {keep}
              </text>
              <text x="167" y="132" textAnchor="middle" style={{ font: '700 13px var(--f-body)', fill: INK }}>
                fit through
              </text>
            </svg>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span
                className="rounded-lg px-2.5 py-1 text-[13px] font-black"
                style={{
                  border: `2.5px solid ${INK}`,
                  background: 'var(--paper-card)',
                  transform: 'rotate(-2deg)',
                }}
              >
                {n === 1 ? 'Solo tile' : `${ordinal(p.arrivalOrder ?? 1)} tile`} · {base}
              </span>
              {bonus > 0 && (
                <span
                  className="rounded-lg px-2.5 py-1 text-[13px] font-black"
                  style={{
                    border: `2.5px solid ${INK}`,
                    background: 'var(--paper-card)',
                    transform: 'rotate(1.5deg)',
                  }}
                >
                  +{bonus} Make peace with it
                </span>
              )}
            </div>
          </div>
        </section>
        <aside
          aria-label="What you carry through"
          className="flex max-w-[470px] min-w-0 flex-[1_1_380px] flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {parts.map((pt) => (
              <div
                key={pt.label}
                className="rounded-[10px] px-3.5 py-3 text-ink"
                style={{
                  background: 'var(--paper-card)',
                  border: `2.5px solid ${INK}`,
                  borderLeftStyle: 'dashed',
                  transform: `rotate(${pt.rot})`,
                  boxShadow: '0 4px 0 var(--drop)',
                }}
                data-testid={`score-${pt.label === 'Full life' ? 'fullLife' : pt.label.toLowerCase()}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-black tracking-[0.05em] uppercase">{pt.label}</span>
                  <span className="font-display text-[30px] leading-none">{pt.value}</span>
                </div>
                <div className="font-hand text-[17px] leading-[1.1] text-ink-soft">{pt.why}</div>
              </div>
            ))}
          </div>
          <div
            className="flex items-center gap-[18px] rounded-[18px] px-[18px] py-4"
            style={{ border: '2px dashed #5E6B67' }}
          >
            <div
              key={locked ? 'l' : 'u'}
              className={`${locked ? 'dw-thud' : ''} grid h-28 w-28 flex-none place-items-center rounded-full text-center`}
              style={{ border: '4px solid var(--lamplight)', transform: 'rotate(-6deg)' }}
            >
              <div>
                <div
                  className="font-display text-[44px] leading-none text-lamplight"
                  data-testid="doorway-total"
                >
                  {sc.total}
                </div>
                <div className="text-[11px] font-black tracking-[0.1em] text-lamplight">POINTS</div>
              </div>
            </div>
            <div>
              <div className="font-display text-[22px]">
                Keeping memories {start + 1}–{end + 1}
              </div>
              <div className="font-hand text-[19px] text-[#DCE3DE]">
                {dropped === 0
                  ? 'Everything fits through.'
                  : `${dropped} ${dropped === 1 ? 'stays' : 'stay'} behind on this side of the door.`}
              </div>
            </div>
          </div>
          <div className="rounded-[18px] border-2 border-felt-line bg-felt-2 px-4 py-3.5">
            <div className="font-display text-[18px]">Every stretch you could take</div>
            <div className="mt-2.5 flex h-24 items-end gap-2.5">
              {windows.map((w) => {
                const on = w.start === start;
                const isB = !!best && w.start === best[0];
                return (
                  <button
                    key={w.start}
                    type="button"
                    onClick={() => !locked && setStart(w.start)}
                    aria-pressed={on}
                    aria-label={`Memories ${w.start + 1} to ${w.end + 1}: ${w.total} points`}
                    className="flex h-24 flex-1 cursor-pointer flex-col items-center justify-end gap-1 border-none bg-transparent p-0 text-on-felt"
                  >
                    <span className="font-display text-[15px]">{w.total}</span>
                    <span
                      className="dw-tween w-full"
                      style={{
                        height: `${Math.max(8, (w.total / maxTotal) * 70)}px`,
                        borderRadius: '8px 8px 3px 3px',
                        border: `2.5px solid ${on ? 'var(--lamplight)' : isB ? 'var(--on-felt)' : 'var(--felt-line)'}`,
                        borderStyle: isB && !on ? 'dashed' : 'solid',
                        background: on ? 'var(--lamplight)' : '#3B4845',
                      }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex gap-2.5">
              {windows.map((w) => (
                <span key={w.start} className="flex-1 text-center text-[12px] text-on-felt-muted">
                  {w.start + 1}–{w.end + 1}
                </span>
              ))}
            </div>
          </div>
          {!locked ? (
            <>
              <button
                type="button"
                onClick={lock}
                className="min-h-16 cursor-pointer rounded-[18px] font-display text-[24px] text-ink"
                style={{
                  border: `3px solid ${INK}`,
                  background: 'var(--lamplight)',
                  boxShadow: '0 6px 0 var(--drop)',
                }}
                data-testid="walk-through"
              >
                Walk through with {start + 1}–{end + 1}
              </button>
              <p className="m-0 text-center font-hand text-[18px] text-on-felt-muted">
                No rush — nobody else is waiting on this choice.
              </p>
            </>
          ) : (
            <div
              role="status"
              className="rounded-[18px] px-[18px] py-4 font-hand text-[21px] text-ink"
              style={{ background: 'var(--on-felt)', border: `3px solid ${INK}` }}
            >
              Through the door with {sc.total} points. {dropped} {dropped === 1 ? 'memory' : 'memories'}{' '}
              stayed behind.
            </div>
          )}
          {othersLine && <p className="m-0 font-hand text-[18px] text-on-felt-muted">{othersLine}</p>}
        </aside>
      </div>
    </div>
  );
}
