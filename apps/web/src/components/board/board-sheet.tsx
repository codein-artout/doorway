'use client';
// The illustrated board (Board-Table.dc.html): a 980 × 600 paper sheet with three serpentine stage rows,
// Bezier bends, doodles, rosettes on the Milestones, the Doorway arch and the tiles. Scales down below 1040 px.

import { useEffect, useRef, useState } from 'react';
import { AGES, type Age, type GameState, type PlayerId } from '@doorway/engine';
import { initialOf } from '@/lib/ui-rules';
import { INK, PawnFigure } from './pieces';

const W = 980;
const H = 600;
const LEFT = 54;
const TOPS = [92, 278, 464];
const CELL_W = 62;
const CELL_H = 78;
const ROW_MAX_W = 868;

const STAGE: Record<Age, { bg: string; pattern: string; size: string }> = {
  young: {
    bg: 'var(--stage-young)',
    pattern: 'radial-gradient(rgba(43,37,48,.13) 1.2px, transparent 1.7px)',
    size: '10px 10px',
  },
  middle: {
    bg: 'var(--stage-middle)',
    pattern: 'repeating-linear-gradient(45deg, rgba(43,37,48,.09) 0 1.5px, transparent 1.5px 9px)',
    size: 'auto',
  },
  old: {
    bg: 'var(--stage-old)',
    pattern:
      'repeating-linear-gradient(45deg, rgba(43,37,48,.08) 0 1.2px, transparent 1.2px 10px), repeating-linear-gradient(-45deg, rgba(43,37,48,.08) 0 1.2px, transparent 1.2px 10px)',
    size: 'auto',
  },
};

export type Bubble = { text: string; thinking: boolean } | null;

export function boardGeometry(state: GameState) {
  const r = state.ruleset;
  return AGES.map((age, i) => {
    const [a, b] = r.ageBands[age];
    const n = b - a + 1;
    const cw = Math.min(CELL_W, ROW_MAX_W / n);
    return { age, from: a, to: b, n, cw, width: cw * n, top: TOPS[i], dir: i === 1 ? 'row-reverse' : 'row' };
  });
}

function useScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / (W + 8))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

export function BoardSheet({
  state,
  current,
  ghost,
  bubble,
  flash = [],
}: {
  state: GameState;
  current: PlayerId | null;
  ghost: { space: number; initial: string } | null;
  bubble: Bubble;
  flash?: number[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const scale = useScale(wrap);
  const rows = boardGeometry(state);
  const r = state.ruleset;
  const L = r.trackLength;
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const n = state.players.length;
  const tiles = n === 1 ? [r.solo.doorway] : (r.doorway[String(n)] ?? []);
  const xr = LEFT + rows[0].width; // right bend x
  const oldRow = rows[2];
  const arrived = (state.stacks[L] ?? []).map((id) => byId[id]);
  const curP = current ? byId[current] : null;
  return (
    <section aria-label="The board" className="py-1" ref={wrap}>
      <div style={{ height: (H + 26) * scale, position: 'relative' }}>
        <div
          className="absolute top-0 left-1/2 text-ink"
          style={{
            width: W,
            height: H,
            marginLeft: -W / 2,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            borderRadius: 26,
            background: 'var(--paper)',
            border: `4px solid ${INK}`,
            boxShadow: '0 14px 0 -4px var(--drop), 0 22px 40px rgba(0,0,0,.35)',
          }}
          data-testid="board-sheet"
        >
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: -4, top: -4 }}
          >
            <g style={{ fill: 'none', strokeLinecap: 'butt' }}>
              <path
                d={`M ${xr} 131 C ${xr + 54} 131, ${xr + 54} 317, ${xr} 317`}
                style={{ stroke: INK, strokeWidth: 48 }}
              />
              <path
                d={`M ${xr} 131 C ${xr + 54} 131, ${xr + 54} 317, ${xr} 317`}
                style={{ stroke: '#EFE3CB', strokeWidth: 41 }}
              />
              <path d="M 58 317 C 4 317, 4 503, 58 503" style={{ stroke: INK, strokeWidth: 48 }} />
              <path d="M 58 317 C 4 317, 4 503, 58 503" style={{ stroke: '#EDE0CC', strokeWidth: 41 }} />
            </g>
            <Doodles xr={xr} />
          </svg>
          <StageLabel
            style={{ left: LEFT, top: 40 }}
            name="Young"
            range={`spaces ${rows[0].from}–${rows[0].to}`}
          />
          <StageLabel
            style={{ right: LEFT, top: 226 }}
            name="Middle"
            range={`spaces ${rows[1].from}–${rows[1].to}, right to left`}
            reverse
          />
          <StageLabel
            style={{ left: LEFT, top: 412 }}
            name="Old"
            range={`spaces ${rows[2].from}–${rows[2].to}`}
          />
          {rows.map((row) => (
            <div
              key={row.age}
              className="absolute box-border flex rounded-xl"
              style={{
                left: LEFT,
                top: row.top,
                width: row.width,
                height: CELL_H,
                flexDirection: row.dir as 'row' | 'row-reverse',
                border: `3px solid ${INK}`,
                backgroundColor: STAGE[row.age].bg,
                backgroundImage: STAGE[row.age].pattern,
                backgroundSize: STAGE[row.age].size,
              }}
              data-row={row.age}
            >
              {Array.from({ length: row.n }, (_, k) => {
                const sp = row.from + k;
                const isM = r.milestones.includes(sp);
                const stack = (state.stacks[sp] ?? []).map((id) => byId[id]);
                return (
                  <div
                    key={sp}
                    data-space={sp}
                    className="relative flex min-w-0 flex-[1_1_0] flex-col items-center justify-end pb-[3px]"
                    style={{
                      borderLeft: k === 0 ? '0' : `2px solid ${INK}`,
                      background: isM ? 'rgba(247,212,122,.35)' : 'transparent',
                    }}
                  >
                    <span className="absolute top-0.5 left-1 text-[11px] font-black text-ink-soft">{sp}</span>
                    {sp === 0 && <span className="absolute top-3.5 font-display text-[13px]">Start</span>}
                    {isM && (
                      <span
                        title="Rosette: swap two neighbouring discs"
                        className={`${flash.includes(sp) ? 'dw-flash' : ''} absolute top-2 grid h-[30px] w-[30px] place-items-center rounded-full font-display text-[13px]`}
                        style={{
                          border: `2.5px solid ${INK}`,
                          boxShadow: `0 0 0 3px var(--paper), 0 0 0 5px ${INK}`,
                          background: 'var(--paper-card)',
                        }}
                      >
                        {sp}
                      </span>
                    )}
                    {bubble && curP && curP.position === sp && <SpeechBubble bubble={bubble} />}
                    <div className="flex items-end justify-center">
                      {ghost?.space === sp && (
                        <PawnFigure ghost initial={ghost.initial} seat={1} isBot={false} />
                      )}
                      {stack.map((p, i) => (
                        <span
                          key={p.id}
                          style={{ marginLeft: i === 0 ? 0 : -12, position: 'relative', zIndex: i + 1 }}
                        >
                          <PawnFigure
                            initial={initialOf(p.name)}
                            seat={p.seat}
                            isBot={p.isBot}
                            current={p.id === current}
                            title={`${p.name}${p.isBot ? ' (bot)' : ''} — space ${sp}`}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div
            className="absolute"
            style={{ left: LEFT + oldRow.width, top: 372, width: 128, height: 170 }}
            data-space={L}
          >
            <svg
              width="128"
              height="170"
              viewBox="0 0 128 170"
              role="img"
              aria-label={`The Doorway, space ${L}`}
              style={{ overflow: 'visible' }}
              className="dw-breathe"
            >
              <path
                d="M10 166V62a54 54 0 0 1 108 0v104z"
                style={{ fill: '#EADBC0', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' }}
              />
              <path
                d="M24 166V64a40 40 0 0 1 80 0v102z"
                style={{ fill: 'var(--lamplight)', stroke: INK, strokeWidth: 3 }}
              />
              <path
                d="M24 166V64l34 -12v122z"
                style={{ fill: 'var(--door-leaf)', stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' }}
              />
              <circle cx="50" cy="112" r="3" style={{ fill: 'var(--lamplight)' }} />
              <path
                d="M64 70l18 -6M66 92l26 -4M66 116l28 2M66 140l24 6"
                style={{ stroke: '#E9B94A', strokeWidth: 2.5, strokeLinecap: 'round' }}
              />
              <path d="M0 168h128" style={{ stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' }} />
            </svg>
            <span
              className="absolute right-0 left-0 text-center font-display text-[16px]"
              style={{ top: -18 }}
            >
              {L} · Doorway
            </span>
            <div className="absolute flex items-end justify-center" style={{ left: 30, right: 4, bottom: 6 }}>
              {arrived.map((p, i) => (
                <span
                  key={p.id}
                  style={{ marginLeft: i === 0 ? 0 : -12, position: 'relative', zIndex: i + 1 }}
                >
                  <PawnFigure
                    initial={initialOf(p.name)}
                    seat={p.seat}
                    isBot={p.isBot}
                    title={`${p.name} — through the Doorway, ${p.arrivalOrder}${['st', 'nd', 'rd', 'th'][Math.min(3, (p.arrivalOrder ?? 1) - 1)]}`}
                    spot={false}
                  />
                </span>
              ))}
              {ghost?.space === L && (
                <PawnFigure
                  ghost
                  initial={ghost.initial}
                  seat={1}
                  isBot={false}
                  title="You would reach the Doorway"
                />
              )}
            </div>
          </div>
          <div className="absolute flex items-center gap-2" style={{ right: 52, bottom: 12 }}>
            <span className="mr-1 font-hand text-[18px] text-ink-soft">keep this many discs</span>
            {tiles.map((k, i) => {
              const gone = i < state.arrivals.length;
              return (
                <span
                  key={i}
                  className="inline-flex items-baseline gap-1 rounded-lg px-2.5 py-[3px]"
                  style={{
                    border: `2.5px solid ${INK}`,
                    background: gone ? 'transparent' : 'var(--paper-card)',
                    color: gone ? '#7A6F62' : INK,
                    transform: `rotate(${['-3deg', '2deg', '-1deg', '3deg'][i % 4]})`,
                  }}
                  title={gone ? 'taken' : 'waiting at the Doorway'}
                >
                  <span className="text-[11px] font-extrabold">
                    {n === 1 ? 'keep' : ['1st', '2nd', '3rd', '4th'][i]}
                  </span>
                  <b className="font-display text-[17px] font-normal">{k}</b>
                </span>
              );
            })}
          </div>
          <div className="absolute font-hand text-[18px] text-ink-soft" style={{ left: LEFT, bottom: 14 }}>
            rosettes {r.milestones.join(' · ')} let you swap two neighbouring discs
          </div>
        </div>
      </div>
    </section>
  );
}

function StageLabel({
  name,
  range,
  style,
  reverse,
}: {
  name: string;
  range: string;
  style: React.CSSProperties;
  reverse?: boolean;
}) {
  return (
    <div className="absolute flex items-baseline gap-2.5" style={style}>
      {reverse && <span className="font-hand text-[19px] text-ink-soft">{range}</span>}
      <span className="font-display text-[30px] leading-none">{name}</span>
      {!reverse && <span className="font-hand text-[19px] text-ink-soft">{range}</span>}
    </div>
  );
}

export function SpeechBubble({ bubble }: { bubble: NonNullable<Bubble> }) {
  return (
    <div
      role="status"
      className="dw-pop absolute z-20 w-[196px] rounded-2xl px-3 py-2 font-hand text-[19px] leading-[1.15] text-ink"
      style={{ bottom: 84, left: -46, background: 'var(--paper-bubble)', border: `2.5px solid ${INK}` }}
      data-testid="speech-bubble"
    >
      {bubble.text}
      {bubble.thinking && (
        <span className="ml-1 inline-flex gap-[3px]" aria-hidden>
          <span className="dw-dot h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="dw-dot2 h-1.5 w-1.5 rounded-full bg-ink" />
          <span className="dw-dot3 h-1.5 w-1.5 rounded-full bg-ink" />
        </span>
      )}
      <span
        className="absolute h-3.5 w-3.5"
        style={{
          left: 64,
          bottom: -9,
          background: 'var(--paper-bubble)',
          borderRight: `2.5px solid ${INK}`,
          borderBottom: `2.5px solid ${INK}`,
          transform: 'rotate(45deg)',
        }}
      />
    </div>
  );
}

/** One decorative SVG layer: ink line + muted fill, never under cells. */
function Doodles({ xr }: { xr: number }) {
  return (
    <g
      style={{ fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}
    >
      <path d={`M ${xr + 33} 218 L ${xr + 41} 228 L ${xr + 49} 218`} />
      <path d="M 9 404 L 17 414 L 25 404" />
      <g transform="translate(905 44)">
        <circle r="19" style={{ fill: 'var(--lamplight)' }} />
        <path d="M0 -27v-6M0 27v6M-27 0h-6M27 0h6M-19 -19l-4 -4M19 19l4 4M-19 19l-4 4M19 -19l4 -4" />
        <circle cx="-6" cy="-3" r="1.4" style={{ fill: INK }} />
        <circle cx="6" cy="-3" r="1.4" style={{ fill: INK }} />
        <path d="M-6 5q6 5 12 0" />
      </g>
      <g transform="translate(560 30)">
        <path
          d="M0 26h70a14 14 0 0 0 -6 -27a18 18 0 0 0 -32 -6a14 14 0 0 0 -26 9a12 12 0 0 0 -6 24z"
          style={{ fill: 'var(--paper-card)' }}
        />
        <circle cx="28" cy="13" r="1.6" style={{ fill: INK }} />
        <circle cx="40" cy="13" r="1.6" style={{ fill: INK }} />
        <circle cx="22" cy="19" r="3" style={{ fill: 'var(--love)', stroke: 'none' }} />
        <circle cx="46" cy="19" r="3" style={{ fill: 'var(--love)', stroke: 'none' }} />
      </g>
      <g transform="translate(330 22)">
        <path d="M0 18l8 -8 3 3 -8 8zM11 13c10 -10 22 -6 26 4" />
        <path d="M30 14l7 3 -3 -7" />
      </g>
      <g transform="translate(150 196)">
        <path d="M0 0l16 -20 16 20 -16 22z" style={{ fill: 'var(--love)' }} />
        <path d="M0 0h32M16 -20v42" />
        <path d="M16 22c-4 8 6 10 2 18c-3 6 4 8 2 14" />
      </g>
      <g transform="translate(420 200)">
        <path d="M0 20l40 -18 -14 32 -8 -12z" style={{ fill: 'var(--paper-card)' }} />
        <path d="M18 22l22 -20" />
        <path d="M-30 30c10 -4 18 -2 24 -8" style={{ strokeDasharray: '3 6' }} />
      </g>
      <g transform="translate(640 192)">
        <path d="M0 24l24 -20 24 20" style={{ fill: 'var(--family)' }} />
        <path d="M5 22v30h38v-30" style={{ fill: 'var(--paper-card)' }} />
        <path d="M19 52v-14h10v14" />
        <path d="M36 10v-10h6v15" />
      </g>
      <g transform="translate(760 212)">
        <path
          d="M12 22s-11 -7 -11 -14a6 6 0 0 1 11 -3a6 6 0 0 1 11 3c0 7 -11 14 -11 14z"
          style={{ fill: 'var(--love)' }}
        />
      </g>
      <g transform="translate(250 384)">
        <path
          d="M0 8h26v14a10 10 0 0 1 -10 10h-6a10 10 0 0 1 -10 -10z"
          style={{ fill: 'var(--paper-card)' }}
        />
        <path d="M26 12h4a5 5 0 0 1 0 10h-4" />
        <path d="M8 0c0 4 4 4 4 8M16 0c0 4 4 4 4 8" />
      </g>
      <g transform="translate(470 374)">
        <circle cx="18" cy="18" r="18" style={{ fill: 'var(--play)' }} />
        <path d="M18 36v20M10 56h16" />
        <path d="M10 20c4 2 6 -2 10 0" />
      </g>
      <g transform="translate(110 380)">
        <path d="M0 20h40M4 20v12M36 20v12M2 12h36v8H2z" style={{ fill: 'var(--work)' }} />
      </g>
      <g transform="translate(690 404)">
        <path d="M14 0a16 16 0 1 0 14 24a13 13 0 1 1 -14 -24z" style={{ fill: 'var(--paper-card)' }} />
      </g>
      <path d="M640 380l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" style={{ fill: 'var(--lamplight)' }} />
      <path d="M770 360l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" style={{ fill: 'var(--lamplight)' }} />
      <path d="M250 50l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" style={{ fill: 'var(--lamplight)' }} />
      <path d="M840 210l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" style={{ fill: 'var(--lamplight)' }} />
    </g>
  );
}
