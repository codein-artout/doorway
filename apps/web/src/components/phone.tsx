'use client';
import { useEffect, useRef, useState } from 'react';
import type { Age, GameState, PlayerId } from '@doorway/engine';
import { AGE_BG, AGE_RULE, DOMAIN } from '@/lib/domains';
import { cardView, type QueueEntry } from '@/lib/table-model';
import { initialOf, marketTabs } from '@/lib/ui-rules';
import { ageAt } from './track';
import { DomainIcon, Pawn } from './primitives';

/** 0–40 overview bar with pawn dots and the arch (TablePhone.dc.html). */
export function OverviewBar({ state, current }: { state: GameState; current: PlayerId | null }) {
  const r = state.ruleset;
  const L = r.trackLength;
  return (
    <div>
      <div className="relative h-[34px]">
        <div className="absolute top-[14px] right-0 left-0 flex h-1.5 overflow-hidden rounded-[3px]">
          {(['young', 'middle', 'old'] as Age[]).map((a) => (
            <span
              key={a}
              style={{ flex: r.ageBands[a][1] - r.ageBands[a][0] + 1, background: AGE_RULE[a] }}
            />
          ))}
        </div>
        {r.milestones.map((m) => (
          <span
            key={m}
            className="absolute top-2.5 h-3.5 w-0.5 bg-door"
            style={{ left: `${(m / L) * 100}%` }}
          />
        ))}
        <span
          className="absolute top-0.5 -right-0.5 h-[30px] w-[22px] bg-door"
          style={{ borderRadius: '11px 11px 3px 3px' }}
        />
        {state.players.map((p) => (
          <span
            key={p.id}
            className={`absolute top-1.5 -ml-[11px] grid h-[22px] w-[22px] place-items-center rounded-full bg-text font-mono text-[10px] font-bold text-ink ${p.id === current ? 'dw-pulse' : ''}`}
            style={{
              left: `${(Math.min(p.position, L) / L) * 100}%`,
              outline: p.isBot ? '2px dashed var(--muted)' : 'none',
              outlineOffset: 1,
            }}
            title={`${p.name} · space ${p.position}`}
          >
            {initialOf(p.name)}
          </span>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-[10px] font-medium text-muted">
        <span>0 Young</span>
        <span>{r.ageBands.middle[0]} Middle</span>
        <span>{r.ageBands.old[0]} Old</span>
        <span>{L}</span>
      </div>
    </div>
  );
}

/** A swipeable strip of the spaces near the viewer. */
export function NearStrip({
  state,
  viewer,
  current,
  ghost,
}: {
  state: GameState;
  viewer: PlayerId | null;
  current: PlayerId | null;
  ghost: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const L = state.ruleset.trackLength;
  const me = viewer ? state.players.find((p) => p.id === viewer)! : null;
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(
      `[data-near="${Math.max(0, (me?.position ?? 0) - 2)}"]`,
    );
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - ref.current.offsetLeft;
  }, [me?.position]);
  return (
    <div
      ref={ref}
      tabIndex={0}
      className="mt-2.5 flex gap-0.5 overflow-x-auto pb-1"
      aria-label="Spaces near you, swipe for the whole path"
    >
      {Array.from({ length: L + 1 }, (_, i) => {
        const stack = (state.stacks[i] ?? []).slice().reverse();
        const isM = state.ruleset.milestones.includes(i);
        return (
          <div
            key={i}
            data-near={i}
            className="box-border flex h-[74px] w-8 flex-none flex-col items-center justify-end gap-1 rounded-[5px] pb-1"
            style={{
              background: i === L ? 'var(--door)' : AGE_BG[ageAt(state.ruleset, i)],
              border: isM ? '1px solid var(--door)' : 'none',
            }}
          >
            {ghost === i && <Pawn initial={me ? initialOf(me.name) : '?'} ghost size={22} />}
            {stack.slice(0, 2).map((id) => (
              <Pawn
                key={id}
                initial={initialOf(byId[id].name)}
                isBot={byId[id].isBot}
                current={id === current}
                size={22}
              />
            ))}
            {stack.length > 2 && <span className="font-mono text-[9px] text-text">+{stack.length - 2}</span>}
            <span
              className="font-mono text-[10px] font-medium"
              style={{ color: i === L ? 'var(--ink)' : 'var(--muted)' }}
            >
              {i}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function QueueChips({ entries, thinking }: { entries: QueueEntry[]; thinking: PlayerId | null }) {
  return (
    <section aria-label="Who moves next" className="flex gap-1.5 overflow-x-auto px-4 pt-3">
      {entries.map((e) => (
        <div
          key={e.player.id}
          className="min-w-[76px] flex-none rounded-xl px-2.5 py-2"
          style={{
            background: e.current ? 'var(--surface-2)' : 'var(--surface)',
            border: `1px solid ${e.current ? 'var(--door)' : 'var(--line)'}`,
          }}
        >
          <div className="font-mono text-[10px] font-bold text-muted">{e.slot}</div>
          <div className="text-sm font-bold">{e.player.name}</div>
          <div className="text-[11px] text-muted">
            {thinking === e.player.id
              ? 'thinking…'
              : e.player.arrivalOrder
                ? 'through'
                : `space ${e.player.position}`}
          </div>
        </div>
      ))}
    </section>
  );
}

/** R38: one age per tab; default = the viewer's age; unreached tabs say where they open. */
export function PhoneMarket({
  state,
  viewer,
  myTurn,
  rushMode,
  selected,
  discard,
  onPick,
  armed,
}: {
  state: GameState;
  viewer: PlayerId | null;
  myTurn: boolean;
  rushMode: boolean;
  selected: string | null;
  discard: string | null;
  onPick: (id: string) => void;
  armed: { ageReach: boolean; ignoreReq: boolean };
}) {
  const pos = viewer ? state.players.find((p) => p.id === viewer)!.position : 0;
  const mt = marketTabs(state.ruleset, pos);
  const [tab, setTab] = useState<Age>(mt.defaultTab);
  useEffect(() => setTab(mt.defaultTab), [mt.defaultTab]);
  const row = state.market[tab].filter((x): x is string => !!x);
  return (
    <section aria-label="Quest market" className="px-4 pt-3.5">
      <div role="tablist" aria-label="Card age" className="flex rounded-xl border border-line bg-surface p-1">
        {mt.tabs.map((t) => (
          <button
            key={t.age}
            type="button"
            role="tab"
            aria-selected={tab === t.age}
            onClick={() => setTab(t.age)}
            className="min-h-[40px] flex-1 cursor-pointer rounded-[9px] border-none text-sm"
            style={{
              background: tab === t.age ? 'var(--door)' : 'transparent',
              color: tab === t.age ? 'var(--ink)' : 'var(--muted)',
              fontWeight: tab === t.age ? 700 : 400,
            }}
          >
            {t.open ? `${t.label} · ${state.market[t.age].filter(Boolean).length}` : t.label}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-col gap-2" role="tabpanel">
        {row.length === 0 && (
          <p className="m-0 text-sm text-muted">
            No cards left in this row. {state.decks[tab].length} in the deck.
          </p>
        )}
        {row.map((id) => {
          const v = cardView(state, viewer, id, { myTurn, rushMode, discarding: discard === id });
          const powerOk = (!v.needsAgeReach || armed.ageReach) && (!v.needsIgnoreReq || armed.ignoreReq);
          const clickable = myTurn && (rushMode ? state.ruleset.rushDiscard : v.takeable && powerOk);
          const on = selected === id || discard === id;
          const tone =
            v.tone === 'door' ? 'var(--door)' : v.tone === 'alert' ? 'var(--alert)' : 'var(--muted)';
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-disabled={!clickable}

              data-card={id}
              onClick={clickable ? () => onPick(id) : undefined}
              className="grid items-center gap-2.5 rounded-[14px] bg-card p-3 text-left text-text"
              style={{
                gridTemplateColumns: '40px minmax(0,1fr) auto',
                border: `2px ${discard === id ? 'dashed' : 'solid'} ${selected === id ? 'var(--door)' : discard === id ? 'var(--alert)' : 'var(--line-soft)'}`,
                opacity: clickable || on ? 1 : 0.55,
              }}
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: DOMAIN[v.card.color].css }}
              >
                <DomainIcon domain={v.card.color} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] text-muted">
                  {DOMAIN[v.card.color].name} · {DOMAIN[v.card.color].code} · {id}
                </span>
                <span className="block font-display text-[15px] leading-tight font-bold">{v.card.name}</span>
                <span className="block text-xs" style={{ color: tone }}>
                  {!powerOk && v.takeable
                    ? `Needs ${v.needsAgeReach ? 'Old friends' : 'Say yes more'} — tick it below`
                    : v.status}
                </span>
              </span>
              <span className="text-right font-mono text-xs leading-normal">
                <span className="block">
                  {v.discounted && <s className="text-muted">{v.printed} </s>}
                  <b className="text-base">{v.cost}</b> yrs
                </span>
                <span className="block">
                  <b className="text-base">{v.card.points}</b> pts
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 759px)');
    const f = () => setPhone(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return phone;
}
