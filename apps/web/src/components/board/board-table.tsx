'use client';
// Board mode table (design/v2/screens/Board-Table.dc.html). Renders the shared table controller; holds no rules.

import { useState } from 'react';
import { AGES, scoreCards, type GameState, type PlayerId, type PlayerState } from '@doorway/engine';
import { AGE_NAME, DOMAIN, DOMAIN_ORDER, ICONS } from '@/lib/domains';
import { download, exportReplayJson, exportStateJson } from '@/lib/import-export';
import { cardView, discountSummary, fullLog, P, powersOf, TIPS } from '@/lib/table-model';
import type { TableController } from '@/lib/use-table';
import { BOT_SPEEDS, initialOf, type BotSpeed } from '@/lib/ui-rules';
import { saveSettings } from '@/lib/storage';
import { experienceDiscount } from '@doorway/engine';
import { ViewSwitch } from '../view-switch';
import { badgeFor } from '../turn';
import { RulesReference } from '../rules-ref';
import { BoardSheet, type Bubble } from './board-sheet';
import { BoardCard, Chip, ChipLabel, INK, PawnFigure, ROT, StrokeIcon, TrayButton } from './pieces';

export function BoardHeader({ t, compact = false }: { t: TableController; compact?: boolean }) {
  const s = t.state;
  const names = s.players.map((p) => p.name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4 pb-3.5">
      <a href="/" className="flex items-center gap-2.5 text-on-felt no-underline">
        <svg
          width="30"
          height="36"
          viewBox="0 0 30 36"
          aria-hidden="true"
          style={{
            fill: 'none',
            stroke: 'var(--on-felt)',
            strokeWidth: 2.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d="M3 34V15a12 12 0 0 1 24 0v19z" style={{ fill: 'var(--lamplight)' }} />
          <path d="M3 34h24" />
          <path d="M10 34V17l9-3v20" style={{ fill: INK }} />
        </svg>
        <span className="font-wordmark text-[30px] leading-none">Doorway</span>
      </a>
      {!compact && (
        <span className="font-hand text-[19px] text-on-felt-muted">
          turn {s.turn + 1} · {who}
          {t.client.setup.blind ? ' · blind test' : ''}
        </span>
      )}
      <div className="flex-1" />
      <ViewSwitch />
      <button
        type="button"
        onClick={() => t.setRulesOpen(!t.rulesOpen)}
        aria-expanded={t.rulesOpen}
        data-testid="rules-toggle"
        className="min-h-[44px] cursor-pointer rounded-full border-2 border-felt-line bg-transparent px-[18px] font-extrabold text-on-felt"
      >
        Rules
      </button>
      {!compact && (
        <details className="relative">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center rounded-full border-2 border-felt-line px-[18px] font-extrabold text-on-felt">
            Game ▾
          </summary>
          <div
            className="absolute right-0 z-30 mt-2 flex w-[220px] flex-col gap-1 rounded-2xl p-2 text-ink"
            style={{
              background: 'var(--paper)',
              border: `3px solid ${INK}`,
              boxShadow: '0 5px 0 var(--drop)',
            }}
          >
            <button
              type="button"
              className="min-h-[40px] cursor-pointer rounded-xl border-none bg-transparent px-3 text-left font-bold text-ink hover:bg-paper-mat"
              onClick={() => download(`doorway-replay-${s.seed}.json`, exportReplayJson(s, t.client.setup))}
              data-testid="export-replay"
            >
              Export replay
            </button>
            <button
              type="button"
              className="min-h-[40px] cursor-pointer rounded-xl border-none bg-transparent px-3 text-left font-bold text-ink hover:bg-paper-mat"
              onClick={() => download(`doorway-state-${s.seed}-m${s.moves.length}.json`, exportStateJson(s))}
            >
              Export state
            </button>
            <a
              href={`/replay?id=${t.stored.id}&move=${s.moves.length}`}
              className="flex min-h-[40px] items-center rounded-xl px-3 font-bold text-ink no-underline hover:bg-paper-mat"
            >
              Replay this game
            </a>
            <a
              href="/"
              className="flex min-h-[40px] items-center rounded-xl px-3 font-bold text-ink no-underline hover:bg-paper-mat"
            >
              New game
            </a>
          </div>
        </details>
      )}
    </header>
  );
}

export function bubbleFor(t: TableController): Bubble {
  const s = t.state;
  if (!t.cp || s.phase === 'over') return null;
  const p = P(s, t.cp);
  if (s.phase === 'pending_choice')
    return { text: p.isBot ? 'Hmm, a swap…' : 'A rosette — swap two discs?', thinking: p.isBot };
  if (p.isBot) return { text: 'Hmm, let me think', thinking: !!t.thinkingId };
  if (t.humans.size > 1 && t.viewer !== t.cp) return { text: 'Choosing…', thinking: false };
  return {
    text: t.again ? 'Me again — still furthest back!' : "My turn — I'm furthest back!",
    thinking: false,
  };
}

export function RulesPanel({ t }: { t: TableController }) {
  if (!t.rulesOpen) return null;
  return (
    <div
      className="rounded-2xl px-5 py-4 text-[14px] text-ink"
      style={{ background: 'var(--on-felt)', border: `3px solid ${INK}` }}
    >
      <RulesReference r={t.state.ruleset} players={t.state.players.length} />
    </div>
  );
}

export function TipNote({ t }: { t: TableController }) {
  if (!t.tip) return null;
  return (
    <div
      role="status"
      className="dw-pop flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-ink"
      style={{ background: 'var(--sticky)', border: `2.5px solid ${INK}`, transform: 'rotate(-0.6deg)' }}
      data-testid="tip"
    >
      <span className="flex-1 font-hand text-[19px] leading-tight">{TIPS[t.tip]}</span>
      <button
        type="button"
        onClick={() => t.setTip(null)}
        className="min-h-[44px] cursor-pointer rounded-xl bg-transparent px-3 font-extrabold text-ink"
        style={{ border: `2.5px solid ${INK}` }}
      >
        Got it
      </button>
    </div>
  );
}

export function blockTextFor(
  state: GameState,
  viewer: PlayerId | null,
  cardId: string,
  reason: string | null,
): string | null {
  if (!reason) return null;
  const c = state.cards[cardId];
  if (reason.startsWith('Too young')) return `too young — opens at space ${state.ruleset.ageBands[c.age][0]}`;
  if (reason.startsWith('Needs') && c.requires)
    return `needs ${c.requires.count} ${DOMAIN[c.requires.color].name} first`;
  void viewer;
  return reason;
}

/** Young, Middle and Old card groups side by side (DESIGN-v2 §3). */
export function CardGroups({
  t,
  small = false,
  ages = AGES as unknown as ('young' | 'middle' | 'old')[],
}: {
  t: TableController;
  small?: boolean;
  ages?: ('young' | 'middle' | 'old')[];
}) {
  const s = t.state;
  const rushMode = t.mode === 'rush';
  let idx = 0;
  return (
    <section aria-label="Quest cards" className="flex flex-wrap justify-center gap-x-6 gap-y-3.5">
      {ages.map((age) => {
        const ids = s.market[age].filter((x): x is string => !!x);
        const vpos = t.me ? t.me.position : 0;
        const open = s.ruleset.ageBands[age][0] <= vpos || age === 'young';
        return (
          <div key={age} className="flex flex-col gap-1.5" data-row={age}>
            <div className="flex items-baseline gap-2 pl-1">
              <span className="font-display text-[20px]">{AGE_NAME[age]}</span>
              <span className="font-hand text-[17px] text-on-felt-muted">
                {open ? 'open to you' : `opens at ${s.ruleset.ageBands[age][0]}`} · {s.decks[age].length} in
                the deck
              </span>
            </div>
            <div className="flex gap-2.5 pt-4">
              {ids.length === 0 && (
                <span className="grid h-[196px] w-[128px] place-items-center rounded-xl border-2 border-dashed border-felt-line font-hand text-[17px] text-on-felt-muted">
                  no cards left
                </span>
              )}
              {ids.map((id) => {
                const v = cardView(s, t.viewer, id, {
                  myTurn: t.myTurn,
                  rushMode,
                  discarding: t.choice?.kind === 'rush' && t.choice.discardCardId === id,
                });
                const powerOk = t.powerOk(id);
                const clickable = t.myTurn && (rushMode ? s.ruleset.rushDiscard : v.takeable && powerOk);
                const block = !v.takeable
                  ? blockTextFor(s, t.viewer, id, v.reason)
                  : !powerOk && t.myTurn
                    ? 'tick the token below to use it'
                    : null;
                return (
                  <BoardCard
                    key={id}
                    v={v}
                    rot={ROT[idx++ % ROT.length]}
                    selected={t.choice?.kind === 'quest' && t.choice.cardId === id}
                    discarding={t.choice?.kind === 'rush' && t.choice.discardCardId === id}
                    clickable={clickable}
                    blockText={block}
                    rushMode={rushMode}
                    onPick={() => t.pick(id)}
                    cardRef={(el) => t.registerCard(id, el)}
                    tabIndex={t.focusId === null ? undefined : t.focusId === id ? 0 : -1}
                    onKeyDown={(e) => t.onCardKey(e, id)}
                    small={small}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** The action tray (DESIGN-v2 §3): Quest / Rush, tokens, the narrated preview, Undo, Take it. */
export function ActionTray({ t, sticky = false }: { t: TableController; sticky?: boolean }) {
  const s = t.state;
  const b = t.banner;
  let sentence: string;
  if (!t.myTurn)
    sentence = t.cp
      ? t.pendingMine
        ? 'Resolve the swap first.'
        : `${P(s, t.cp).name} is furthest back, so it is their move.`
      : 'Everyone is through.';
  else if (!t.choice) sentence = `Pick a card from the table — or rush to ${t.rushTarget}.`;
  else sentence = `${t.preview.text} ${t.preview.next}`.trim();
  return (
    <section
      aria-label="Your move"
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] px-4 py-3.5 text-ink ${sticky ? 'sticky bottom-2 z-20' : ''}`}
      style={{ background: 'var(--on-felt)', border: `3px solid ${INK}`, boxShadow: '0 5px 0 var(--drop)' }}
      data-testid="turn-banner"
    >
      <h1 className="m-0 w-full font-display text-[22px] leading-tight font-normal" aria-live="polite">
        {b.title}
        {t.thinkingId && (
          <span className="ml-2 inline-flex gap-[3px] align-middle" aria-hidden>
            <span className="dw-dot h-1.5 w-1.5 rounded-full bg-ink" />
            <span className="dw-dot2 h-1.5 w-1.5 rounded-full bg-ink" />
            <span className="dw-dot3 h-1.5 w-1.5 rounded-full bg-ink" />
          </span>
        )}
      </h1>
      <div role="group" aria-label="Quest or rush" className="flex gap-2.5">
        <TrayButton
          onClick={t.chooseQuest}
          pressed={t.mode === 'quest'}
          disabled={!t.myTurn}
          rot="-1.5deg"
          testId="mode-quest"
        >
          Quest
        </TrayButton>
        <TrayButton
          onClick={t.chooseRush}
          pressed={t.mode === 'rush'}
          disabled={!t.myTurn}
          rot="1deg"
          testId="mode-rush"
        >
          Rush{t.rushTarget !== null ? ` → ${t.rushTarget}` : ''}
        </TrayButton>
      </div>
      {t.toggles.map((g) => (
        <label key={g.key} className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-extrabold">
          <input
            type="checkbox"
            checked={g.checked}
            disabled={g.disabled || !t.myTurn}
            onChange={(e) => g.onChange(e.target.checked)}
            className="h-5 w-5"
            style={{ accentColor: 'var(--ink)' }}
          />
          <span>
            {g.label} <span className="font-semibold text-ink-soft">({g.detail})</span>
          </span>
        </label>
      ))}
      <p
        role="status"
        className="m-0 min-w-0 flex-[1_1_300px] font-hand text-[21px] leading-[1.15]"
        data-testid="preview"
      >
        {sentence}
      </p>
      <TrayButton kind="ghost" onClick={t.undo} disabled={!t.snap.canUndo} testId="undo">
        Undo
      </TrayButton>
      <TrayButton kind="ink" onClick={t.confirm} disabled={!t.myTurn || !t.selectedMove} testId="confirm">
        {t.mode === 'rush' && t.rushTarget !== null
          ? `Rush to ${t.rushTarget}`
          : t.choice?.kind === 'quest'
            ? 'Take it'
            : 'Choose a move'}
      </TrayButton>
    </section>
  );
}

export function TurnOrder({ t }: { t: TableController }) {
  const [why, setWhy] = useState(false);
  const order = t.queue.filter((e) => e.player.arrivalOrder === null);
  return (
    <section
      className="rounded-[18px] px-4 pt-3.5 pb-3"
      style={{ border: '2px dashed #5E6B67' }}
      aria-label="Turn order"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 mb-2 font-display text-[21px] font-normal">Furthest back goes next</h2>
        <button
          type="button"
          onClick={() => setWhy(!why)}
          aria-expanded={why}
          className="min-h-[36px] cursor-pointer border-none bg-transparent font-hand text-[17px] text-on-felt-muted underline"
        >
          why?
        </button>
      </div>
      {why && (
        <p className="m-0 mb-2 font-hand text-[18px] leading-tight text-on-felt-muted">
          No rounds. Whoever is furthest back moves next — even several times in a row. On a shared space, the
          pawn on top goes first. Right now: {t.banner.whyOrder || 'everyone is through'}.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-1">
        {order.map((e, i) => (
          <div key={e.player.id} className="flex items-end gap-1">
            <div className="flex w-[62px] flex-col items-center">
              <PawnFigure
                initial={initialOf(e.player.name)}
                seat={e.player.seat}
                isBot={e.player.isBot}
                w={30}
                h={44}
                outline="var(--on-felt)"
                spot={false}
                current={e.current}
              />
              <span
                className="mt-1 text-[13px] font-black"
                style={{ color: e.current ? 'var(--lamplight)' : 'var(--on-felt)' }}
              >
                {e.player.id === t.viewer && t.humans.size === 1 ? 'You' : e.player.name}
              </span>
              <span className="text-[12px] text-on-felt-muted">space {e.player.position}</span>
            </div>
            {i < order.length - 1 && (
              <span className="mb-[26px] font-hand text-[22px] text-[#8A9792]">→</span>
            )}
          </div>
        ))}
        {order.length === 0 && (
          <span className="font-hand text-[18px] text-on-felt-muted">everyone is through</span>
        )}
      </div>
    </section>
  );
}

export function ChipStack({
  state,
  p,
  w = 46,
  h = 12,
}: {
  state: GameState;
  p: PlayerState;
  w?: number;
  h?: number;
}) {
  return (
    <div
      className="flex flex-col-reverse items-center"
      aria-label={`${p.name}'s tower, bottom to top: ${p.tower.map((x) => DOMAIN[state.cards[x].color].name).join(', ') || 'empty'}`}
      role="img"
    >
      <span className="rounded" style={{ width: w + 8, height: 8, background: INK }} />
      {p.tower.map((id, i) => (
        <Chip key={i} domain={state.cards[id].color} w={w} h={h} style={{ marginBottom: -2 }} />
      ))}
    </div>
  );
}

export function PlayerMat({ t, p }: { t: TableController; p: PlayerState }) {
  const s = t.state;
  const ex = discountSummary(s, p).map((x) => x.replace(/ \(\d+ discs\)/, ''));
  return (
    <section
      aria-label={`${p.name}, ${badgeFor(p)}`}
      className="flex items-end gap-3 rounded-2xl px-3.5 py-3 text-ink"
      style={{ background: 'var(--paper-mat)', border: `3px solid ${INK}`, boxShadow: '0 5px 0 var(--drop)' }}
      data-testid={`queue-${p.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[19px]">{p.name}</span>
          <span className="text-[12px] font-extrabold text-ink-soft">{badgeFor(p)}</span>
        </div>
        <div className="text-[13px] text-ink-soft">
          {p.arrivalOrder
            ? `through the Doorway · keeps ${p.doorwayAllowance}`
            : `space ${p.position} · ${ageWord(s, p.position)}`}{' '}
          · {p.tower.length} memories
        </div>
        <div className="mt-1 text-[12.5px] text-ink-soft">
          {ex.length ? `cheaper: ${ex.join(', ')}` : 'no discounts yet'}
        </div>
        {t.thinkingId === p.id && <div className="mt-1.5 font-hand text-[18px]">thinking it over…</div>}
      </div>
      <ChipStack state={s} p={p} />
    </section>
  );
}

function ageWord(s: GameState, pos: number) {
  for (const a of AGES)
    if (pos >= s.ruleset.ageBands[a][0] && pos <= s.ruleset.ageBands[a][1]) return AGE_NAME[a];
  return 'Old';
}

export function YourLife({ t, p }: { t: TableController; p: PlayerState }) {
  const s = t.state;
  const sc = scoreCards(s.ruleset, s.cards, p.tower);
  const newest = t.snap.events.some((e) => e.type === 'quest_taken' && e.playerId === p.id)
    ? p.tower.length - 1
    : -1;
  const exp = DOMAIN_ORDER.map((d) => ({
    d,
    n: p.tower.filter((id) => s.cards[id].color === d).length,
  })).filter((x) => experienceDiscount(s.ruleset, x.n) > 0);
  const powers = powersOf(s, p);
  return (
    <section
      aria-label="Your life"
      className="rounded-[18px] p-4 text-ink"
      style={{ background: 'var(--on-felt)', border: `3px solid ${INK}`, boxShadow: '0 6px 0 var(--drop)' }}
      data-testid="your-life"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 font-display text-[24px] font-normal">Your life, {p.name}</h2>
        <span className="text-[13px] font-extrabold text-ink-soft">
          space {p.position} · {p.arrivalOrder ? 'through' : ageWord(s, p.position)}
        </span>
      </div>
      <p className="mt-0.5 mb-3 font-hand text-[18px] text-ink-soft">
        {p.arrivalOrder
          ? `through the Doorway · keeps ${p.doorwayAllowance}`
          : `${s.ruleset.trackLength - p.position} years to the Doorway · newest on top`}
      </p>
      <div className="flex flex-col">
        {p.tower
          .map((id, i) => ({ id, i }))
          .reverse()
          .map(({ id, i }) => {
            const c = s.cards[id];
            return (
              <div
                key={`${id}-${i}`}
                className={`flex items-center gap-2.5 ${i === newest ? 'dw-drop' : ''}`}
                style={{ marginBottom: -2 }}
              >
                <Chip domain={c.color} w={92} h={22} label={<ChipLabel domain={c.color} />} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{c.name}</span>
                <span className="font-display text-[14px]">{c.points} pt</span>
              </div>
            );
          })}
        <span className="mt-1 -ml-1.5 h-2.5 w-[104px] rounded" style={{ background: INK }} aria-hidden />
        {p.tower.length === 0 && (
          <span className="mt-2 font-hand text-[18px] text-ink-soft">no memories yet</span>
        )}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-[13px]">
        <div>
          <b>Experience</b>
          <br />
          {exp.length
            ? exp.map((x) => `${DOMAIN[x.d].name} quests −${experienceDiscount(s.ruleset, x.n)}`).join(' · ')
            : `none yet — ${s.ruleset.experienceStep} of a colour = 1 year off`}
        </div>
        <div>
          <b>Tokens</b>
          <br />
          {powers.length ? powers.map((x) => `${x.card.name} — ${x.state}`).join(' · ') : 'none yet'}
        </div>
      </div>
      <div
        className="mt-3.5 flex items-center gap-3 rounded-xl px-3 py-2.5"
        style={{ border: `2.5px dashed ${INK}` }}
      >
        <span className="flex-1 font-hand text-[18px]">if you walked through the Doorway now</span>
        <span className="font-display text-[30px]" data-testid="score-total">
          {sc.total}
        </span>
      </div>
    </section>
  );
}

export function MoveLogDrawer({ t, open = false }: { t: TableController; open?: boolean }) {
  const s = t.state;
  return (
    <details
      className="rounded-2xl text-ink"
      style={{ background: 'var(--paper-mat)', border: `3px solid ${INK}` }}
      open={open}
    >
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-4 font-display text-[18px]">
        Move log
        <span className="font-hand text-[16px] text-ink-soft">{s.turn} turns so far</span>
      </summary>
      <div className="px-4 pb-3">
        <label className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold">
          Bot speed
          <select
            value={t.client.setup.botSpeed}
            onChange={(e) => {
              t.client.setBotSpeed(e.target.value as BotSpeed);
              saveSettings({ botSpeed: e.target.value as BotSpeed });
            }}
            className="min-h-[36px] rounded-lg bg-paper-card px-1.5 text-ink"
            style={{ border: `2px solid ${INK}` }}
            data-testid="bot-speed"
          >
            {(Object.keys(BOT_SPEEDS) as BotSpeed[]).map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <ol
          className="m-0 flex max-h-[300px] list-none flex-col gap-1.5 overflow-y-auto p-0 text-[13px]"
          data-testid="move-log"
          aria-live="polite"
        >
          {fullLog(s)
            .slice(-40)
            .reverse()
            .map((line, i) => (
              <li key={i} className={i === 0 ? 'font-bold' : 'text-ink-soft'}>
                {line}
              </li>
            ))}
        </ol>
      </div>
    </details>
  );
}

export function ErrorNote({ t }: { t: TableController }) {
  if (!t.err) return null;
  return (
    <p
      role="alert"
      className="m-0 rounded-xl px-3 py-2 text-sm font-bold text-ink"
      style={{ background: 'var(--sticky)', border: '2.5px solid var(--stamp-red)' }}
    >
      {t.err}
    </p>
  );
}

export function WindowNudge({ t }: { t: TableController }) {
  if (!(t.waitingWindow.length > 0 && t.humanToMove)) return null;
  const p = t.waitingWindow[0];
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-ink"
      style={{ background: 'var(--sticky)', border: `2.5px solid ${INK}` }}
    >
      <span className="flex-1 font-hand text-[19px]">
        {t.waitingWindow.map((x) => x.name).join(', ')} reached the Doorway and can choose a stretch any time.
      </span>
      <TrayButton kind="ghost" onClick={() => t.setWindowFor(p.id)}>
        Choose {p.name}&apos;s stretch
      </TrayButton>
    </div>
  );
}

/** Rosette / Keep a diary swap, Board style: tap the gap between two chips (with the Passion & Full life effect). */
export function BoardSwap({ t }: { t: TableController }) {
  const s = t.state;
  if (!t.pendingMine || !s.pending) return null;
  const pid = s.pending.playerId;
  const p = P(s, pid);
  const src = s.pending.queue[0];
  const base = scoreCards(s.ruleset, s.cards, p.tower);
  const opts = p.tower.slice(0, -1).map((_, i) => {
    const tw = p.tower.slice();
    [tw[i], tw[i + 1]] = [tw[i + 1], tw[i]];
    const sc = scoreCards(s.ruleset, s.cards, tw);
    return { i, passion: sc.passion, fullLife: sc.fullLife };
  });
  return (
    <section
      aria-label="Swap"
      className="rounded-[20px] p-5 text-ink"
      style={{ background: 'var(--paper)', border: `3px solid ${INK}`, boxShadow: '0 5px 0 var(--drop)' }}
      data-testid="swap-prompt"
    >
      <h2 className="m-0 font-display text-[24px] font-normal">
        {src.source === 'diary'
          ? 'Keep a diary: swap two neighbouring discs?'
          : `Rosette ${src.space}: swap two neighbouring discs?`}
      </h2>
      <p className="mt-1 mb-3 font-hand text-[19px] text-ink-soft">
        {p.name}, tap the gap you want to swap — or keep the tower as it is.
        {s.pending.queue.length > 1 ? ` ${s.pending.queue.length - 1} more swap after this one.` : ''}
      </p>
      <div className="flex flex-col">
        {p.tower
          .map((id, i) => ({ id, i }))
          .reverse()
          .map(({ id, i }) => {
            const c = s.cards[id];
            const o = opts[i - 1];
            return (
              <div key={`${id}-${i}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-right text-[12px] font-black text-ink-soft">{i + 1}</span>
                  <Chip domain={c.color} w={128} h={26} label={<ChipLabel domain={c.color} />} />
                  <span className="truncate text-[13.5px] font-bold">{c.name}</span>
                </div>
                {o && (
                  <button
                    type="button"
                    onClick={() => t.submit(pid, { type: 'swap', index: o.i })}
                    className="my-1 ml-7 flex min-h-[36px] w-[calc(100%-28px)] cursor-pointer items-center gap-3 rounded-xl bg-transparent px-3 text-left text-[13px] font-bold text-ink"
                    style={{ border: `2px dashed ${INK}` }}
                    data-testid={`swap-${o.i}`}
                  >
                    <span>
                      ⇅ swap {o.i + 1} and {o.i + 2}
                    </span>
                    <span className="ml-auto font-hand text-[16px] font-normal">
                      Passion {base.passion} → {o.passion} · Full life {base.fullLife} → {o.fullLife}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
      </div>
      <div className="mt-3">
        <TrayButton onClick={() => t.submit(pid, { type: 'skip_swap' })} testId="skip-swap" rot="-1deg">
          Keep it as it is
        </TrayButton>
      </div>
    </section>
  );
}

/** The whole Board table (desktop). */
export function BoardTable({ t }: { t: TableController }) {
  const s = t.state;
  const others = s.players.filter((p) => p.id !== t.viewer);
  const me = t.viewer ? P(s, t.viewer) : null;
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-8 text-on-felt md:px-7" data-testid="board-table">
      <BoardHeader t={t} />
      <div className="flex flex-wrap items-start gap-6">
        <main className="flex min-w-0 flex-[999_1_760px] flex-col gap-[18px]">
          <RulesPanel t={t} />
          <TipNote t={t} />
          <ErrorNote t={t} />
          <WindowNudge t={t} />
          <BoardSheet
            state={t.shown}
            current={t.cp}
            ghost={t.ghost}
            bubble={bubbleFor(t)}
            flash={t.anim.passed}
          />
          {t.pendingMine ? <BoardSwap t={t} /> : <CardGroups t={t} />}
          <ActionTray t={t} />
        </main>
        <aside aria-label="Players" className="flex max-w-[380px] min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <TurnOrder t={t} />
          {others.map((p) => (
            <PlayerMat key={p.id} t={t} p={p} />
          ))}
          {me && <YourLife t={t} p={me} />}
          <MoveLogDrawer t={t} />
        </aside>
      </div>
    </div>
  );
}

export { StrokeIcon, ICONS };
