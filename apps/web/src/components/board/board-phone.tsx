'use client';
// Board table at phone width (Board-Phone.dc.html), working down to 360 px. R38: the market shows one age at a
// time as tabs, defaulting to the player's own age.

import { useEffect, useState } from 'react';
import { AGES, scoreCards, type Age } from '@doorway/engine';
import { AGE_NAME, DOMAIN } from '@/lib/domains';
import { cardView, P } from '@/lib/table-model';
import type { TableController } from '@/lib/use-table';
import { initialOf, marketTabs } from '@/lib/ui-rules';
import { ViewSwitch } from '../view-switch';
import {
  blockTextFor,
  BoardSwap,
  bubbleFor,
  ErrorNote,
  MoveLogDrawer,
  RulesPanel,
  TipNote,
  WindowNudge,
} from './board-table';
import { BoardCard, ChipLabel, INK, PawnFigure, pawnColors, ROT, TrayButton } from './pieces';

const STAGE_BG: Record<Age, [string, string, string]> = {
  young: ['var(--stage-young)', 'radial-gradient(rgba(43,37,48,.13) 1.2px, transparent 1.7px)', '8px 8px'],
  middle: [
    'var(--stage-middle)',
    'repeating-linear-gradient(45deg, rgba(43,37,48,.09) 0 1.5px, transparent 1.5px 7px)',
    'auto',
  ],
  old: [
    'var(--stage-old)',
    'repeating-linear-gradient(45deg, rgba(43,37,48,.08) 0 1.2px, transparent 1.2px 8px), repeating-linear-gradient(-45deg, rgba(43,37,48,.08) 0 1.2px, transparent 1.2px 8px)',
    'auto',
  ],
};

export function BoardPhone({ t }: { t: TableController }) {
  const s = t.state;
  const shown = t.shown;
  const r = s.ruleset;
  const L = r.trackLength;
  const byId = Object.fromEntries(shown.players.map((p) => [p.id, p]));
  const pos = t.me ? t.me.position : 0;
  const mt = marketTabs(r, Math.min(pos, L - 1));
  const [tab, setTab] = useState<Age>(mt.defaultTab);
  useEffect(() => setTab(mt.defaultTab), [mt.defaultTab]);
  const bubble = bubbleFor(t);
  const speaker = t.cp ? P(s, t.cp) : null;
  const rushMode = t.mode === 'rush';
  const ids = s.market[tab].filter((x): x is string => !!x);
  const me = t.viewer ? P(s, t.viewer) : null;
  const openCount = AGES.flatMap((a) => s.market[a]).filter(
    (id) => id && cardView(s, t.viewer, id, { myTurn: true, rushMode: false, discarding: false }).takeable,
  ).length;
  const total = AGES.flatMap((a) => s.market[a]).filter(Boolean).length;
  let sentence: string;
  if (!t.myTurn)
    sentence = t.cp
      ? t.pendingMine
        ? 'Resolve the swap first.'
        : `${P(s, t.cp).name} is furthest back, so it is their move.`
      : 'Everyone is through.';
  else if (!t.choice) sentence = `Pick a card — or rush to ${t.rushTarget}.`;
  else sentence = `${t.preview.text} ${t.preview.next}`.trim();
  return (
    <div className="pb-4 text-on-felt" data-testid="board-phone">
      <header className="flex items-center gap-1.5 px-4 py-3">
        <a href="/" className="font-wordmark text-[21px] text-on-felt no-underline">
          Doorway
        </a>
        <div className="flex-1" />
        <ViewSwitch compact />
        <button
          type="button"
          aria-label="Rules"
          aria-expanded={t.rulesOpen}
          onClick={() => t.setRulesOpen(!t.rulesOpen)}
          className="h-11 w-11 flex-none cursor-pointer rounded-full border-2 border-felt-line bg-transparent font-display text-[18px] text-on-felt"
        >
          ?
        </button>
      </header>
      <div className="flex flex-col gap-3 px-4">
        <RulesPanel t={t} />
        <TipNote t={t} />
        <ErrorNote t={t} />
        <WindowNudge t={t} />
      </div>
      <section
        aria-label="The board"
        className="mx-4 mt-1 rounded-[18px] p-3 text-ink"
        style={{
          background: 'var(--paper)',
          border: `3px solid ${INK}`,
          boxShadow: '0 8px 0 -2px var(--drop)',
        }}
      >
        {AGES.map((age, ri) => {
          const [a, b] = r.ageBands[age];
          const [bg, pattern, size] = STAGE_BG[age];
          return (
            <div key={age}>
              <div
                className="flex items-center justify-between"
                style={{ margin: ri === 0 ? '0 0 4px' : '10px 0 4px' }}
              >
                <span className="font-display text-[14px]">{AGE_NAME[age]}</span>
                <span className="font-hand text-[14px] text-ink-soft">
                  {a}–{b}
                  {ri === 1 ? ', right to left' : ''}
                </span>
              </div>
              <div className="flex items-stretch">
                <div
                  className="flex h-10 flex-1 overflow-visible rounded-lg"
                  style={{
                    flexDirection: ri === 1 ? 'row-reverse' : 'row',
                    border: `2.5px solid ${INK}`,
                    backgroundColor: bg,
                    backgroundImage: pattern,
                    backgroundSize: size,
                  }}
                >
                  {Array.from({ length: b - a + 1 }, (_, k) => {
                    const sp = a + k;
                    const isM = r.milestones.includes(sp);
                    const st = (shown.stacks[sp] ?? []).map((id) => byId[id]);
                    return (
                      <div
                        key={sp}
                        data-space={sp}
                        className="relative flex min-w-0 flex-[1_1_0] items-end justify-center"
                        style={{
                          borderLeft: k === 0 ? '0' : `1.5px solid ${INK}`,
                          background: isM ? 'rgba(247,212,122,.45)' : 'transparent',
                        }}
                      >
                        <span
                          className="absolute top-px left-0.5 text-[8px] font-black text-ink-soft"
                          aria-hidden
                        >
                          {sp}
                        </span>
                        {st.slice(-2).map((p, i) => {
                          const c = pawnColors(p.seat);
                          return (
                            <span
                              key={p.id}
                              title={`${p.name} — space ${sp}`}
                              className="mb-1 grid h-[15px] w-[15px] flex-none place-items-center rounded-full text-[8px] font-black"
                              style={{
                                marginLeft: i === 0 ? 0 : -7,
                                border: `2px solid ${INK}`,
                                background: c.fill,
                                color: c.eye,
                                boxShadow: p.id === t.cp ? '0 0 0 3px var(--lamplight)' : 'none',
                                position: 'relative',
                                zIndex: i + 1,
                              }}
                            >
                              {initialOf(p.name)}
                            </span>
                          );
                        })}
                        {t.ghost?.space === sp && (
                          <span
                            className="mb-1 h-[15px] w-[15px] rounded-full"
                            style={{ border: `2px dashed ${INK}` }}
                            aria-label="You would land here"
                            role="img"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {ri === 2 && (
                  <svg
                    width="40"
                    height="56"
                    viewBox="0 0 40 56"
                    role="img"
                    aria-label={`Doorway, space ${L}${(shown.stacks[L] ?? []).length ? `: ${(shown.stacks[L] ?? []).map((id) => byId[id].name).join(', ')} through` : ''}`}
                    style={{ margin: '-16px 0 0 4px', overflow: 'visible', flex: 'none' }}
                  >
                    <path
                      d="M3 54V20a17 17 0 0 1 34 0v34z"
                      style={{ fill: 'var(--lamplight)', stroke: INK, strokeWidth: 2.5 }}
                    />
                    <path
                      d="M3 54V20l14 -5v39z"
                      style={{
                        fill: 'var(--door-leaf)',
                        stroke: INK,
                        strokeWidth: 2.5,
                        strokeLinejoin: 'round',
                      }}
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
        <p className="mt-2.5 mb-0 font-hand text-[15px] text-ink-soft">
          snakes left to right, then back · {(shown.stacks[L] ?? []).length} through the door
        </p>
      </section>
      <div className="mx-4 mt-4 flex items-start gap-2.5" data-testid="turn-banner">
        {speaker && (
          <PawnFigure
            initial={initialOf(speaker.name)}
            seat={speaker.seat}
            isBot={speaker.isBot}
            w={34}
            h={48}
            spot={false}
            current
          />
        )}
        <div
          className="flex-1 rounded-2xl px-3.5 py-2.5 font-hand text-[20px] leading-[1.15] text-ink"
          style={{ background: 'var(--paper-bubble)', border: `2.5px solid ${INK}` }}
          role="status"
        >
          <h1 className="sr-only">{t.banner.title}</h1>
          {bubble ? bubble.text : t.banner.title}
          {t.queue[1] && t.queue[1].player.arrivalOrder === null
            ? ` ${t.queue[1].player.name}'s next, at ${t.queue[1].player.position}.`
            : ''}
        </div>
      </div>
      {t.pendingMine ? (
        <div className="px-4 pt-4">
          <BoardSwap t={t} />
        </div>
      ) : (
        <section aria-label="Quest cards" className="mt-[18px]">
          <div className="flex items-baseline justify-between px-4">
            <span className="font-display text-[20px]">On the table</span>
            <span className="font-hand text-[16px] text-on-felt-muted">
              swipe · {openCount} of {total} open to you
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Card age"
            className="mx-4 mt-2 flex rounded-full border-2 border-felt-line bg-felt-2 p-1"
          >
            {mt.tabs.map((tb) => (
              <button
                key={tb.age}
                type="button"
                role="tab"
                aria-selected={tab === tb.age}
                onClick={() => setTab(tb.age)}
                className="min-h-[40px] flex-1 cursor-pointer rounded-full border-none text-[13px]"
                style={{
                  background: tab === tb.age ? 'var(--on-felt)' : 'transparent',
                  color: tab === tb.age ? INK : 'var(--on-felt)',
                  fontWeight: tab === tb.age ? 900 : 700,
                }}
              >
                {tb.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex gap-3 overflow-x-auto px-4 pt-[18px] pb-3">
            {ids.length === 0 && (
              <p className="m-0 font-hand text-[18px] text-on-felt-muted">
                No cards left in this row. {s.decks[tab].length} in the deck.
              </p>
            )}
            {ids.map((id, i) => {
              const v = cardView(s, t.viewer, id, {
                myTurn: t.myTurn,
                rushMode,
                discarding: t.choice?.kind === 'rush' && t.choice.discardCardId === id,
              });
              const powerOk = t.powerOk(id);
              const clickable = t.myTurn && (rushMode ? r.rushDiscard : v.takeable && powerOk);
              const block = !v.takeable
                ? blockTextFor(s, t.viewer, id, v.reason)
                : !powerOk && t.myTurn
                  ? 'tick the token below to use it'
                  : null;
              return (
                <BoardCard
                  key={id}
                  v={v}
                  rot={ROT[i % ROT.length]}
                  selected={t.choice?.kind === 'quest' && t.choice.cardId === id}
                  discarding={t.choice?.kind === 'rush' && t.choice.discardCardId === id}
                  clickable={clickable}
                  blockText={block}
                  rushMode={rushMode}
                  onPick={() => t.pick(id)}
                  small
                />
              );
            })}
          </div>
        </section>
      )}
      <div
        className="sticky bottom-0 z-20 mt-2 rounded-t-[22px] px-4 pt-3.5 pb-4 text-ink"
        style={{ background: 'var(--on-felt)', borderTop: `3px solid ${INK}` }}
      >
        <p role="status" className="m-0 mb-2.5 font-hand text-[19px] leading-[1.15]" data-testid="preview">
          {sentence}
        </p>
        {t.toggles.map((g) => (
          <label key={g.key} className="mb-2 flex min-h-[44px] items-center gap-2 text-[13px] font-extrabold">
            <input
              type="checkbox"
              checked={g.checked}
              onChange={(e) => g.onChange(e.target.checked)}
              className="h-5 w-5"
              style={{ accentColor: 'var(--ink)' }}
            />
            {g.label} <span className="font-semibold text-ink-soft">({g.detail})</span>
          </label>
        ))}
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1.3fr' }}>
          <button
            type="button"
            onClick={t.chooseQuest}
            aria-pressed={t.mode === 'quest'}
            disabled={!t.myTurn}
            data-testid="mode-quest"
            className="min-h-[52px] cursor-pointer rounded-[14px] font-display text-[17px] text-ink disabled:opacity-50"
            style={{
              border: `3px solid ${INK}`,
              background: t.mode === 'quest' ? 'var(--lamplight)' : 'var(--paper-card)',
              boxShadow: `0 4px 0 ${INK}`,
            }}
          >
            Quest
          </button>
          <button
            type="button"
            onClick={t.chooseRush}
            aria-pressed={t.mode === 'rush'}
            disabled={!t.myTurn}
            data-testid="mode-rush"
            className="min-h-[52px] cursor-pointer rounded-[14px] font-display text-[17px] text-ink disabled:opacity-50"
            style={{
              border: `3px solid ${INK}`,
              background: t.mode === 'rush' ? 'var(--lamplight)' : 'var(--paper-card)',
              boxShadow: `0 4px 0 ${INK}`,
            }}
          >
            Rush{t.rushTarget !== null ? ` → ${t.rushTarget}` : ''}
          </button>
          <button
            type="button"
            onClick={t.confirm}
            disabled={!t.myTurn || !t.selectedMove}
            data-testid="confirm"
            className="min-h-[52px] cursor-pointer rounded-[14px] font-display text-[17px] disabled:opacity-50"
            style={{ border: `3px solid ${INK}`, background: INK, color: 'var(--lamplight)' }}
          >
            {t.mode === 'rush' && t.rushTarget !== null
              ? `Rush to ${t.rushTarget}`
              : t.choice?.kind === 'quest'
                ? 'Take it'
                : 'Choose a move'}
          </button>
        </div>
        <div className="mt-2 flex justify-end">
          <TrayButton kind="ghost" onClick={t.undo} disabled={!t.snap.canUndo} testId="undo">
            Undo
          </TrayButton>
        </div>
      </div>
      {me && (
        <section
          aria-label="Your life"
          className="mx-4 mt-3 rounded-[18px] p-3.5 text-ink"
          style={{
            background: 'var(--on-felt)',
            border: `3px solid ${INK}`,
            boxShadow: '0 5px 0 var(--drop)',
          }}
          data-testid="your-life"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[20px]">Your life</span>
            <span className="text-[12.5px] font-extrabold text-ink-soft">
              {me.tower.length} memories · {scoreCards(r, s.cards, me.tower).total} pts if you left now
            </span>
          </div>
          <div className="mt-2.5 flex flex-col">
            {me.tower
              .map((id, i) => ({ id, i }))
              .reverse()
              .map(({ id, i }) => (
                <div key={`${id}-${i}`} className="flex items-center gap-2.5" style={{ marginBottom: -2 }}>
                  <span
                    className="grid h-5 w-[74px] flex-none place-items-center rounded-full"
                    style={{
                      border: `2.5px solid ${INK}`,
                      background: DOMAIN[s.cards[id].color].css,
                      color: 'var(--on-domain)',
                      boxShadow: 'inset 0 -4px 0 rgba(43,37,48,.18)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <ChipLabel domain={s.cards[id].color} iconSize={11} />
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-[13.5px] font-bold">{s.cards[id].name}</span>
                </div>
              ))}
            <span
              aria-hidden
              className="mt-1 -ml-1 h-[9px] w-[84px] rounded-[3px]"
              style={{ background: INK }}
            />
          </div>
        </section>
      )}
      <section aria-label="Others" className="mx-4 mt-3.5 flex gap-2.5">
        {s.players
          .filter((p) => p.id !== t.viewer)
          .map((p) => (
            <div
              key={p.id}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[14px] p-2.5 text-ink"
              style={{ background: 'var(--paper-mat)', border: `2.5px solid ${INK}` }}
            >
              <span className="font-display text-[15px]">{p.name}</span>
              <div
                className="flex flex-col-reverse items-center"
                role="img"
                aria-label={`${p.name}'s tower, bottom to top: ${p.tower.map((x) => DOMAIN[s.cards[x].color].name).join(', ') || 'empty'}`}
              >
                <span className="h-1.5 w-11 rounded-[3px]" style={{ background: INK }} />
                {p.tower.map((id, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-9 rounded-full"
                    style={{
                      marginBottom: -2,
                      border: `1.8px solid ${INK}`,
                      background: DOMAIN[s.cards[id].color].css,
                    }}
                  />
                ))}
              </div>
              <span className="text-[11.5px] font-extrabold text-ink-soft">
                {p.arrivalOrder ? 'through' : `space ${p.position}`}
              </span>
            </div>
          ))}
      </section>
      <div className="mx-4 mt-3.5">
        <MoveLogDrawer t={t} />
      </div>
    </div>
  );
}
