'use client';
import { useEffect, useMemo, useState } from 'react';
import { bestWindow, scoreWindow, type GameState, type PlayerId } from '@doorway/engine';
import { DOMAIN, DOMAIN_ORDER } from '@/lib/domains';
import { ordinal } from '@/lib/format';
import { DomainIcon } from './primitives';
import { ScoreTiles } from './score';
import { DoorwayArch } from './track';

export function scoreWhy(state: GameState, tower: string[], start: number, end: number) {
  const kept = tower.slice(start, end + 1).map((id) => state.cards[id]);
  const counts: Record<string, number> = {};
  for (const c of kept) counts[c.color] = (counts[c.color] ?? 0) + 1;
  let best = 0,
    run = 0,
    bestDom = '',
    prev = '';
  for (const c of kept) {
    run = c.color === prev ? run + 1 : 1;
    prev = c.color;
    if (run > best) {
      best = run;
      bestDom = c.color;
    }
  }
  const sets = Math.min(...DOMAIN_ORDER.map((d) => counts[d] ?? 0));
  const missing = DOMAIN_ORDER.filter((d) => !counts[d]).map((d) => DOMAIN[d].name);
  const refl = kept
    .filter((c) => c.reflection)
    .map((c) => `${c.name} × ${counts[c.reflection!] ?? 0} ${DOMAIN[c.reflection!].name}`);
  return {
    cards: `${kept.length} cards kept`,
    fullLife: sets
      ? `${sets} complete set${sets > 1 ? 's' : ''} of all five`
      : `Missing ${missing.join(', ')}`,
    passion:
      best >= 3
        ? `${best} ${DOMAIN[bestDom as keyof typeof DOMAIN].name} in a row`
        : `Longest run is ${best}`,
    reflection: refl.length ? refl.join(' · ') : 'No Reflection card kept',
  };
}

/** The window bracket rows: tower top → bottom, kept stretch bracketed, best-window hint dashed. */
function Rows({
  state,
  tower,
  start,
  end,
  best,
  locked,
  onJump,
}: {
  state: GameState;
  tower: string[];
  start: number;
  end: number;
  best: [number, number] | null;
  locked: boolean;
  onJump: (i: number) => void;
}) {
  const idx = tower.map((_, i) => i).reverse();
  return (
    <div role="listbox" aria-label="Choose the stretch you keep" className="flex flex-col gap-[3px]">
      {idx.map((i) => {
        const id = tower[i];
        const c = state.cards[id];
        const kept = i >= start && i <= end;
        const isBest = !!best && i >= best[0] && i <= best[1];
        const note = kept
          ? c.reflection
            ? `Reflection: +1 per kept ${DOMAIN[c.reflection].name}`
            : c.power?.type === 'doorway_bonus'
              ? 'Power: keep 1 extra (active anyway)'
              : ''
          : 'stays behind';
        return (
          <div
            key={i}
            role="option"
            aria-selected={kept}
            className={`grid items-center gap-2.5 dw-tween ${locked && !kept ? 'dw-left-behind' : ''}`}
            style={{
              gridTemplateColumns: '14px 26px minmax(0,220px) minmax(0,1fr) 54px',
              opacity: kept ? 1 : 0.32,
              transform: locked && !kept ? 'translateX(-18px)' : locked && kept ? 'translateY(-4px)' : 'none',
              transitionDelay:
                locked && !kept ? `${Math.min(Math.abs(i - start), Math.abs(i - end)) * 30}ms` : '0ms',
            }}
            data-disc={i}
          >
            <span
              className="-my-0.5 self-stretch"
              style={{
                borderLeft: kept
                  ? `${locked ? 4 : 3}px solid var(--door)`
                  : isBest
                    ? '3px dashed var(--muted)'
                    : '3px solid transparent',
                borderTop:
                  kept && i === end
                    ? '3px solid var(--door)'
                    : isBest && i === best![1] && !kept
                      ? '3px dashed var(--muted)'
                      : '0',
                borderBottom:
                  kept && i === start
                    ? '3px solid var(--door)'
                    : isBest && i === best![0] && !kept
                      ? '3px dashed var(--muted)'
                      : '0',
                transition: 'border-width 120ms',
              }}
            />
            <span className="text-right font-mono text-[11px] font-medium text-muted">{i + 1}</span>
            <button
              type="button"
              onClick={() => !locked && onJump(i)}
              disabled={locked}
              aria-label={`Disc ${i + 1}, ${DOMAIN[c.color].name}, ${c.name}${kept ? ', kept' : ', stays behind'}. Start the stretch here.`}
              className="flex h-[34px] min-w-0 cursor-pointer items-center gap-2 rounded-[17px] border-none px-3.5 text-ink"
              style={{ background: DOMAIN[c.color].css, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.18)' }}
            >
              <DomainIcon domain={c.color} size={16} />
              <span className="font-mono text-xs font-bold">{DOMAIN[c.color].code}</span>
              <span className="truncate text-[13px] font-bold">{c.name}</span>
            </button>
            <span className="text-xs" style={{ color: kept ? 'var(--text)' : 'var(--muted)' }}>
              {note}
            </span>
            <span className="text-right font-mono text-[13px] font-bold">{c.points} pt</span>
          </div>
        );
      })}
      <div className="mt-1.5 ml-[50px] h-2.5 w-[236px] max-w-[60%] rounded-[3px] bg-base" aria-hidden />
    </div>
  );
}

/** The Doorway moment (Doorway.dc.html): slide the stretch, live score, compare windows, best hint, lock in. */
export function DoorwaySelect({
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
  const base =
    state.players.length === 1
      ? state.ruleset.solo.doorway
      : (state.ruleset.doorway[String(state.players.length)]?.[(p.arrivalOrder ?? 1) - 1] ?? 0);
  const bonus = (p.doorwayAllowance ?? 0) - base;
  const windows = Array.from({ length: maxStart + 1 }, (_, s) => ({
    s,
    total: scoreWindow(state, playerId, s, s + keep - 1).total,
  })).reverse();
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
    let st = Math.max(0, Math.min(maxStart, i));
    if (i > end) st = Math.max(0, Math.min(maxStart, i - keep + 1));
    setStart(st);
  };
  const lock = () => {
    setLocked(true);
    setTimeout(
      () => onLock(start, end),
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 900,
    );
  };
  return (
    <div className="flex flex-col gap-5" data-testid="doorway-select">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex-[1_1_520px]">
          <div className="font-mono text-xs font-bold tracking-[0.06em] text-muted uppercase">
            {p.name} arrived · {ordinal(p.arrivalOrder ?? 1)} of {state.players.length}
          </div>
          <h1 className="mt-1 mb-1.5 font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.015em] md:text-[40px]">
            The Doorway is small.
          </h1>
          <p className="m-0 max-w-[620px]">
            You lived {tower.length} memories. You can carry <b>one unbroken stretch of {keep}</b> through.
            Everything outside it stays behind.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-[10px] bg-door px-3 py-2 text-sm text-ink">
            <b>
              {state.players.length === 1 ? 'Solo tile' : `${ordinal(p.arrivalOrder ?? 1)} tile`} · {base}
            </b>
          </span>
          {bonus > 0 && (
            <span className="rounded-[10px] bg-surface-2 px-3 py-2 text-sm">
              +{bonus} from <b>Make peace with it</b>
            </span>
          )}
          <span className="rounded-[10px] border border-door px-3 py-2 text-sm">
            = keep <b>{p.doorwayAllowance}</b>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Your tower"
          className="min-w-0 flex-[1_1_460px] rounded-[18px] border border-line bg-surface p-5"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 font-display text-xl font-bold">Your tower</h2>
            <span className="text-[13px] text-muted">top = most recent</span>
          </div>
          <Rows
            state={state}
            tower={tower}
            start={start}
            end={end}
            best={showHint && hintAllowed ? [bw.start, bw.end] : null}
            locked={locked}
            onJump={jump}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStart(Math.min(maxStart, start + 1))}
              disabled={start >= maxStart || locked}
              className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text disabled:opacity-45"
            >
              Slide up ↑
            </button>
            <button
              type="button"
              onClick={() => setStart(Math.max(0, start - 1))}
              disabled={start <= 0 || locked}
              className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text disabled:opacity-45"
            >
              Slide down ↓
            </button>
            <button
              type="button"
              onClick={() => hintAllowed && setShowHint(!showHint)}
              aria-pressed={showHint}
              disabled={!hintAllowed}
              className="min-h-[44px] cursor-pointer rounded-xl border border-dashed border-muted bg-transparent px-4 text-text disabled:opacity-60"
              data-testid="best-hint"
            >
              {hintAllowed ? (showHint ? 'Hide best stretch' : 'Show best stretch') : 'Hint off (blind test)'}
            </button>
          </div>
          <p className="mt-2.5 mb-0 text-[13px] text-muted">
            Tap any disc to start the stretch there. The stretch must be unbroken. Arrow keys slide it.
          </p>
        </section>
        <section aria-label="Score preview" className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <div className="flex items-center gap-5 rounded-[18px] border border-door bg-surface p-[22px]">
            <DoorwayArch width={120} height={150} swell={locked}>
              <span
                className="font-display text-[44px] leading-none font-extrabold"
                data-testid="doorway-total"
              >
                {sc.total}
              </span>
              <span className="text-xs">points</span>
            </DoorwayArch>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-muted">
                Keeping discs {start + 1}–{end + 1}
              </div>
              <div className="mt-2.5">
                <ScoreTiles sc={sc} size="lg" why={why} />
              </div>
            </div>
          </div>
          <div className="rounded-[18px] border border-line bg-surface px-5 py-[18px]">
            <h2 className="m-0 mb-1 font-display text-[17px] font-bold">Every stretch you could keep</h2>
            <p className="m-0 mb-3 text-[13px] text-muted">
              {showHint && hintAllowed
                ? 'Best stretch is outlined. Hint is off in blind playtests.'
                : 'Bars update as you slide. Taller is better.'}
            </p>
            <div className="flex flex-col gap-1.5">
              {windows.map((w) => {
                const on = w.s === start;
                const best = showHint && hintAllowed && w.s === bw.start;
                return (
                  <button
                    key={w.s}
                    type="button"
                    onClick={() => !locked && setStart(w.s)}
                    aria-pressed={on}
                    className="grid min-h-9 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-left text-text"
                    style={{
                      gridTemplateColumns: '76px minmax(0,1fr) 40px',
                      border: `1px solid ${on ? 'var(--door)' : best ? 'var(--muted)' : 'var(--line-soft)'}`,
                      background: on ? 'var(--surface-2)' : 'transparent',
                    }}
                  >
                    <span className="font-mono text-xs font-medium">
                      discs {w.s + 1}–{w.s + keep}
                    </span>
                    <span className="h-3 overflow-hidden rounded-md bg-ink">
                      <span
                        className="dw-tween block h-full rounded-md"
                        style={{
                          width: `${Math.round((w.total / maxTotal) * 100)}%`,
                          background: on ? 'var(--door)' : 'var(--grey)',
                        }}
                      />
                    </span>
                    <b className="text-right font-mono text-sm">{w.total}</b>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {!locked ? (
              <>
                <button
                  type="button"
                  onClick={lock}
                  className="min-h-[52px] cursor-pointer rounded-[14px] border-none bg-door px-[26px] text-[17px] font-bold text-ink"
                  data-testid="walk-through"
                >
                  Walk through with discs {start + 1}–{end + 1}
                </button>
                <span className="text-[13px] text-muted">
                  You can also wait — nobody else is affected by your choice.
                </span>
              </>
            ) : (
              <div role="status" className="rounded-[14px] border border-door bg-surface-2 px-[18px] py-3.5">
                Through the Doorway with {sc.total} points. {tower.length - keep}{' '}
                {tower.length - keep === 1 ? 'memory' : 'memories'} stayed behind.
              </div>
            )}
          </div>
          {othersLine && (
            <div className="rounded-[14px] bg-sunk px-[18px] py-3.5 text-[13px] text-muted">{othersLine}</div>
          )}
        </section>
      </div>
    </div>
  );
}

export function WindowBracketDemo({ state }: { state: GameState }) {
  const p = state.players[1];
  return (
    <Rows state={state} tower={p.tower} start={1} end={4} best={[0, 3]} locked={false} onJump={() => {}} />
  );
}
