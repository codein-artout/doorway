'use client';
// Analyst mode table (design/v2/screens/Analyst-Table.dc.html, DESIGN-v2 §4). Renders the shared table
// controller plus pure numbers from lib/analyst-model; holds no rules.

import { useEffect, useMemo, useRef } from 'react';
import { AGES, scoreCards, type GameState, type Move } from '@doorway/engine';
import { DOMAIN, DOMAIN_ORDER } from '@/lib/domains';
import {
  CHART,
  decisionRows,
  ledger,
  lastBotWhy,
  logRows,
  positionChart,
  previewLine,
  projection,
  queueText,
  scoreChart,
  turnPoints,
  type ChartLine,
  type DecisionRow,
  type TurnPoint,
  type Why,
} from '@/lib/analyst-model';
import { P, TIPS } from '@/lib/table-model';
import type { TableController } from '@/lib/use-table';
import { BOT_SPEEDS, type BotSpeed } from '@/lib/ui-rules';
import { saveSettings } from '@/lib/storage';
import { previewMove } from '@doorway/engine';
import { RulesReference } from '../rules-ref';
import { AnalystButton, AnalystHeader, LineSwatch, Panel } from './panel';

/** Timeline points for the charts, log and "Why" (recomputed when the game changes). */
export function useTimeline(t: TableController) {
  const { snap, client } = t;
  return useMemo(() => {
    void snap;
    const tl = client.timeline();
    return { tl, points: turnPoints(tl) };
  }, [snap, client]);
}

export function gameLine(t: TableController) {
  const s = t.state;
  const cp = t.cp ? P(s, t.cp).name : 'nobody';
  return `turn ${s.turn + 1} · seed ${s.seed} · ${s.rulesetId} · ${s.players.length} player${s.players.length > 1 ? 's' : ''} · ${s.phase === 'over' ? 'game over' : `${cp} to move`}`;
}

// ------------------------------------------------------------------ track ruler

export function TrackRuler({
  state,
  current,
  ghost,
  queueNow,
  queueAfter,
}: {
  state: GameState;
  current: string | null;
  ghost: { space: number; label: string } | null;
  queueNow: string;
  queueAfter: string | null;
}) {
  const r = state.ruleset;
  const L = r.trackLength;
  const cells = Array.from({ length: L + 1 }, (_, i) => i);
  const bandOf = (i: number) =>
    i === L
      ? 'var(--ink)'
      : r.milestones.includes(i)
        ? 'var(--highlight)'
        : i >= r.ageBands.old[0]
          ? 'var(--old)'
          : i >= r.ageBands.middle[0]
            ? 'var(--middle)'
            : 'var(--young)';
  const [y0, y1] = r.ageBands.young;
  const [m0, m1] = r.ageBands.middle;
  const [o0, o1] = r.ageBands.old;
  const scroller = useRef<HTMLDivElement>(null);
  const focus = current ? P(state, current).position : 0;
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth)
      el.scrollLeft = (el.scrollWidth * focus) / (L + 1) - el.clientWidth / 3;
  }, [focus, L]);
  return (
    <Panel
      label="Track"
      className="mt-4"
      title="Track"
      aside={
        <>
          <span className="font-mono text-[12.5px]" data-testid="queue-now">
            queue now: {queueNow || '—'}
          </span>
          <span
            className={`font-mono text-[12.5px] ${queueAfter ? 'text-ink' : 'text-muted'}`}
            data-testid="queue-after"
          >
            {queueAfter ? `after: ${queueAfter}` : 'select a move to see the queue after it'}
          </span>
        </>
      }
    >
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Track ruler (scrolls sideways)"
        ref={scroller}
      >
        <div className="min-w-[1000px]">
          <div
            className="grid h-[62px] items-end gap-px"
            style={{ gridTemplateColumns: `repeat(${L + 1}, minmax(0, 1fr))` }}
          >
            {cells.map((i) => {
              const st = state.stacks[i] ?? [];
              return (
                <div key={i} className="flex flex-col-reverse items-center gap-0.5">
                  {st.map((id, k) => {
                    const p = P(state, id);
                    const top = k === st.length - 1 && st.length > 1;
                    const cur = id === current;
                    return (
                      <span
                        key={id}
                        title={`${p.name} on ${i}${top ? ', on top' : ''}${p.isBot ? ' (bot)' : ''}`}
                        className={`rounded px-1 py-px font-mono text-[10.5px] font-semibold ${cur ? 'bg-ink text-sheet' : 'bg-panel text-ink'}`}
                        style={{ border: `1.5px ${p.isBot ? 'dashed' : 'solid'} var(--ink)` }}
                        data-testid={`ruler-${id}`}
                      >
                        {p.name[0].toUpperCase()}
                        {top ? '↑' : ''}
                      </span>
                    );
                  })}
                  {ghost && ghost.space === i && (
                    <span
                      className="rounded bg-highlight px-1 py-px font-mono text-[10.5px] font-semibold text-ink"
                      style={{ border: '1.5px dashed var(--ink)' }}
                      data-testid="ruler-ghost"
                    >
                      {ghost.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="mt-1 grid gap-px"
            style={{ gridTemplateColumns: `repeat(${L + 1}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {cells.map((i) => (
              <div
                key={i}
                className={`grid h-[18px] place-items-center border-l border-panel-border font-mono ${i % 10 === 0 ? 'text-[10.5px] font-semibold' : 'text-[10px]'} ${i === L ? 'text-sheet' : 'text-ink'}`}
                style={{ background: bandOf(i) }}
              >
                {i === L ? 'D' : i % 5 === 0 || r.milestones.includes(i) ? i : ''}
              </div>
            ))}
          </div>
          <div
            className="mt-1 grid gap-px text-[11.5px] text-muted"
            style={{ gridTemplateColumns: `${y1 - y0 + 1}fr ${m1 - m0 + 1}fr ${o1 - o0 + 1}fr 1fr` }}
          >
            <span>
              Young {y0}–{y1} · Young cards
            </span>
            <span>
              Middle {m0}–{m1} · + Middle cards
            </span>
            <span>
              Old {o0}–{o1} · + Old cards
            </span>
            <span className="text-right">{L}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ decision table

function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block flex-none rounded-full border-[1.5px] border-ink"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function DecisionTable({ t, rows }: { t: TableController; rows: DecisionRow[] }) {
  const s = t.state;
  const sel = t.choice?.kind === 'quest' ? t.choice.cardId : t.choice?.kind === 'rush' ? 'rush' : null;
  const selRow = rows.find((r) => r.key === sel) ?? null;
  const move: Move | null = t.selectedMove;
  const blockedByPower = !!(selRow?.cardId && selRow.needsPower && !t.powerOk(selRow.cardId));
  const line = t.viewer ? previewLine(s, t.viewer, t.myTurn, move) : '';
  const onRow = (r: DecisionRow) => {
    if (!r.legal) return;
    if (r.key === 'rush') {
      t.chooseRush();
      return;
    }
    if (sel === r.key) {
      t.setChoice(null);
      t.setMode(null);
    } else {
      t.setMode('quest');
      t.setChoice({ kind: 'quest', cardId: r.key });
    }
  };
  const label =
    t.mode === 'rush' && t.rushTarget !== null
      ? `Rush to ${t.rushTarget}`
      : selRow?.cardId
        ? `Take ${selRow.cardId}`
        : 'Choose a move';
  const marketIds = AGES.flatMap((a) => s.market[a]).filter((x): x is string => !!x);
  return (
    <Panel
      label="Decision table"
      className="lg:col-span-8"
      title="Every move you can make"
      aside={
        <span className="text-[12.5px] text-muted">
          click a row to preview · Δ = points if you walked through right after
        </span>
      }
    >
      <h1 className="sr-only" data-testid="turn-banner">
        {t.banner.title}
      </h1>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Decision table (scrolls sideways)"
      >
        <table className="w-full text-[13px] md:min-w-[860px]" data-testid="decision-table">
          <thead>
            <tr className="border-b-[1.5px] border-ink text-left text-[11.5px] text-muted">
              <th className="px-1.5 py-1.5 font-semibold">Move</th>
              <th className="hidden md:table-cell px-1 py-1.5 font-semibold">Age</th>
              <th className="hidden md:table-cell px-1 py-1.5 font-semibold">Needs</th>
              <th className="hidden md:table-cell px-1 py-1.5 text-right font-semibold">Yrs</th>
              <th className="hidden md:table-cell px-1 py-1.5 text-right font-semibold">Disc.</th>
              <th className="px-1 py-1.5 text-right font-semibold">Cost</th>
              <th className="px-1 py-1.5 text-right font-semibold">Pts</th>
              <th className="hidden md:table-cell px-1 py-1.5 text-right font-semibold">Pts/yr</th>
              <th className="px-1 py-1.5 text-right font-semibold">Lands</th>
              <th className="hidden md:table-cell px-1 py-1.5 font-semibold">Next up</th>
              <th className="px-1 py-1.5 text-right font-semibold">Δ now</th>
              <th className="hidden md:table-cell px-1.5 py-1.5 font-semibold">Bots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = sel === r.key;
              return (
                <tr
                  key={r.key}
                  className={`border-b border-rule transition-colors duration-[120ms] ${r.legal ? 'text-ink' : 'text-muted'} ${on ? '[&_td]:!text-ink [&_td_span]:!text-ink' : ''}`}
                  style={{ background: on ? 'var(--highlight)' : 'transparent' }}
                  data-testid={`row-${r.key}`}
                >
                  <td className="px-1 py-[3px]">
                    <button
                      type="button"
                      onClick={() => onRow(r)}
                      aria-pressed={on}
                      disabled={!r.legal}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-2 border-none bg-transparent px-1 text-left text-inherit disabled:cursor-not-allowed"
                      data-testid={`pick-${r.key}`}
                      {...(r.cardId ? { 'data-card': r.cardId } : {})}
                    >
                      <Dot color={r.color ? DOMAIN[r.color].css : 'var(--panel)'} />
                      <span>
                        <b className="font-semibold">{r.name}</b>{' '}
                        {r.cardId && <span className="font-mono text-[11px] text-muted">{r.cardId}</span>}
                      </span>
                    </button>
                  </td>
                  <td
                    className="hidden px-1 py-[7px] font-mono text-[12px] md:table-cell"
                    style={{ color: r.ageOk ? 'var(--good)' : 'var(--bad)' }}
                  >
                    {r.age}
                  </td>
                  <td
                    className="hidden px-1 py-[7px] font-mono text-[12px] md:table-cell"
                    style={{
                      color: r.reqOk === null ? 'var(--muted)' : r.reqOk ? 'var(--good)' : 'var(--bad)',
                    }}
                  >
                    {r.req}
                  </td>
                  <td className="hidden px-1 py-[7px] text-right font-mono md:table-cell">{r.years ?? ''}</td>
                  <td className="hidden px-1 py-[7px] text-right font-mono text-good md:table-cell">
                    {r.disc ? (
                      <span title={r.discTitle} className="cursor-help underline decoration-dotted">
                        −{r.disc}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-1 py-[7px] text-right font-mono font-semibold">{r.cost ?? '—'}</td>
                  <td className="px-1 py-[7px] text-right font-mono">{r.pts}</td>
                  <td className="hidden px-1 py-[7px] text-right font-mono md:table-cell">{r.ppy}</td>
                  <td className="px-1 py-[7px] text-right font-mono">{r.lands ?? '—'}</td>
                  <td className="hidden px-1 py-[7px] text-[12.5px] md:table-cell">{r.next}</td>
                  <td
                    className="px-1 py-[7px] text-right font-mono font-semibold"
                    style={{ color: r.delta && r.delta > 0 ? 'var(--good)' : 'var(--ink)' }}
                  >
                    {r.delta === null ? '' : r.delta >= 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="hidden px-1.5 py-[7px] font-mono text-[11.5px] md:table-cell">{r.bots}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-lg bg-sheet px-3 py-2.5">
        {t.mode === 'rush' && s.ruleset.rushDiscard && t.myTurn && (
          <label className="inline-flex items-center gap-2 text-[13px]">
            Discard first
            <select
              value={t.choice?.kind === 'rush' ? (t.choice.discardCardId ?? '') : ''}
              onChange={(e) => t.setDiscard(e.target.value || null)}
              className="min-h-[34px] rounded-md border-[1.5px] border-ink bg-panel px-1.5"
              data-testid="discard-select"
            >
              <option value="">nothing</option>
              {marketIds.map((id) => (
                <option key={id} value={id}>
                  {id} {s.cards[id].name}
                </option>
              ))}
            </select>
          </label>
        )}
        {t.toggles.map((g) => (
          <label key={g.key} className="inline-flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={g.checked}
              disabled={g.disabled}
              onChange={(e) => g.onChange(e.target.checked)}
              data-testid={`power-${g.key}`}
            />
            {g.label} <span className="text-muted">({g.detail})</span>
          </label>
        ))}
        <p role="status" className="m-0 flex-[1_1_360px] font-mono text-[12.5px]" data-testid="preview">
          {line}
          {blockedByPower ? ` · tick ${selRow!.needsPower} to use it` : ''}
        </p>
        <AnalystButton onClick={t.undo} disabled={!t.snap.canUndo} testId="undo">
          Undo
        </AnalystButton>
        <AnalystButton
          primary
          onClick={t.confirm}
          disabled={!t.myTurn || !t.selectedMove || blockedByPower}
          testId="confirm"
        >
          {label}
        </AnalystButton>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ side panels

export function PlayersLedger({ state: s, viewer }: { state: GameState; viewer: string | null }) {
  const { rows, discLines, spread } = ledger(s, viewer);
  return (
    <Panel label="Players" className="lg:col-span-4" title="Players">
      <table className="w-full text-[12.5px]" data-testid="ledger">
        <thead>
          <tr className="border-b-[1.5px] border-ink text-right text-[11px] text-muted">
            <th className="px-1 py-[5px] text-left font-semibold">Player</th>
            <th className="px-[3px] py-[5px] font-semibold">Pos</th>
            {DOMAIN_ORDER.map((d) => (
              <th key={d} className="px-[3px] py-[5px] font-semibold" title={DOMAIN[d].name}>
                <span className="inline-flex items-center gap-1">
                  <Dot color={DOMAIN[d].css} size={9} />
                  {DOMAIN[d].code}
                </span>
              </th>
            ))}
            <th className="px-1 py-[5px] font-semibold">Now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-rule text-right font-mono"
              style={{ background: r.current ? 'var(--highlight-soft)' : 'transparent' }}
              data-testid={`queue-${r.id}`}
            >
              <td className="px-1 py-1.5 text-left font-body">
                <b className="font-semibold">{r.name}</b>
                <br />
                <span className="text-[11px] text-muted">{r.role}</span>
              </td>
              <td className="px-[3px] py-1.5">{r.pos}</td>
              {r.counts.map((c, i) => (
                <td key={i} className="px-[3px] py-1.5">
                  {c}
                </td>
              ))}
              <td className="px-1 py-1.5 font-semibold">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2.5 mb-0 flex flex-col gap-1 pl-4 text-[12.5px]">
        {discLines.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <div
        className="mt-3 rounded-lg px-3 py-2.5 text-[12.5px]"
        style={{ background: 'var(--highlight-soft)', border: '1.5px dashed var(--ink)' }}
        data-testid="spread-note"
      >
        <b className="font-semibold">Spread {spread} spaces.</b> The leader always moved last from the back,
        so pawns stay within one move of each other. Rush jumps are short for the same reason.
      </div>
    </Panel>
  );
}

export function YourTower({ t, points }: { t: TableController; points: TurnPoint[] }) {
  const s = t.state;
  if (!t.viewer) return null;
  const me = P(s, t.viewer);
  const pj = projection(s, me.id, points);
  return (
    <Panel label="Your tower and projection" className="lg:col-span-4" title="Your tower, top first">
      <div className="max-h-[260px] overflow-y-auto">
        <table className="w-full text-[12.5px]" data-testid="your-life">
          <tbody>
            {me.tower
              .map((id, i) => ({ id, i }))
              .reverse()
              .map(({ id, i }) => {
                const c = s.cards[id];
                return (
                  <tr key={`${id}-${i}`} className="border-b border-rule">
                    <td className="w-[22px] px-1 py-[5px] font-mono text-muted">{i + 1}</td>
                    <td className="w-[46px] px-1 py-[5px]">
                      <span
                        className="inline-block h-3 w-10 rounded-full border-[1.5px] border-ink"
                        style={{ background: DOMAIN[c.color].css }}
                        title={DOMAIN[c.color].name}
                      />
                    </td>
                    <td className="px-1 py-[5px]">{c.name}</td>
                    <td className="px-1 py-[5px] text-right font-mono">{c.points}</td>
                  </tr>
                );
              })}
            {me.tower.length === 0 && (
              <tr>
                <td className="py-2 text-muted">No discs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 mb-0 text-[12.5px]">
        Score now{' '}
        <span className="font-mono font-semibold" data-testid="score-total">
          {scoreCards(s.ruleset, s.cards, me.tower).total}
        </span>{' '}
        <span className="text-muted">(whole tower kept)</span>
      </p>
      <dl className="mt-3 mb-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-muted">Pace</dt>
        <dd className="m-0 font-mono">{pj.pace.toFixed(2)} yrs per quest</dd>
        <dt className="text-muted">Projected</dt>
        <dd className="m-0 font-mono">
          ≈ {pj.projected} memories at space {s.ruleset.trackLength}
        </dd>
        <dt className="text-muted">At the door</dt>
        <dd className="m-0 font-mono">
          tile {pj.tiles} → lose about {pj.loseLo}–{pj.loseHi}
        </dd>
      </dl>
    </Panel>
  );
}

export function WhyPanel({ why }: { why: Why | null }) {
  return (
    <Panel
      label="Last bot decision"
      className="lg:col-span-4"
      title={why ? `Why ${why.bot} did that` : 'Why the bot did that'}
      aside={why && <span className="font-mono text-[11.5px] text-muted">{why.header}</span>}
      testId="why"
    >
      {!why && <p className="m-0 text-[12.5px] text-muted">No bot has moved yet.</p>}
      {why && (
        <>
          <div className="flex flex-col gap-2">
            {why.bars.map((b, i) => (
              <div
                key={i}
                className="rounded-md px-2 py-1.5"
                style={{
                  background: b.chosen ? 'var(--highlight-soft)' : 'transparent',
                  border: `1px solid ${b.chosen ? 'var(--ink)' : 'var(--rule)'}`,
                }}
                data-testid={b.chosen ? 'why-chosen' : undefined}
              >
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span>
                    <b className="font-semibold">{b.name}</b> <span className="text-muted">{b.tag}</span>
                  </span>
                  <span className="font-mono font-semibold">{b.total}</span>
                </div>
                <div
                  className="mt-[5px] flex h-2 overflow-hidden rounded-sm bg-sheet"
                  role="img"
                  aria-label={b.parts
                    .map((p) => `${p.feature} ${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}`)
                    .join(', ')}
                >
                  {b.parts.map((p, k) => (
                    <span
                      key={k}
                      title={`${p.label}: ${p.feature} ${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}`}
                      style={{
                        width: `${p.w}%`,
                        background: p.negative
                          ? `repeating-linear-gradient(135deg, ${p.color} 0 2px, transparent 2px 4px)`
                          : p.color,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            {why.groups.map((g) => (
              <span key={g.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-[9px] w-[9px]" style={{ background: g.color }} />
                {g.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-[9px] w-[9px]"
                style={{
                  background: 'repeating-linear-gradient(135deg, var(--ink) 0 2px, transparent 2px 4px)',
                }}
              />
              counts against
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

export function LogPanel({ t, points }: { t: TableController; points: TurnPoint[] }) {
  const rows = logRows(t.state, points);
  return (
    <Panel
      label="Event log"
      className="lg:col-span-4"
      title="Log"
      aside={
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          bots
          <select
            value={t.client.setup.botSpeed}
            onChange={(e) => {
              t.client.setBotSpeed(e.target.value as BotSpeed);
              saveSettings({ botSpeed: e.target.value as BotSpeed });
            }}
            className="min-h-[30px] rounded-md border-[1.5px] border-ink bg-panel px-1 text-ink"
            data-testid="bot-speed"
          >
            {(Object.keys(BOT_SPEEDS) as BotSpeed[]).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <table className="w-full text-[12px]" data-testid="event-log">
        <thead>
          <tr className="border-b-[1.5px] border-ink text-left text-[11px] text-muted">
            <th className="px-[3px] py-1 font-semibold">T</th>
            <th className="px-[3px] py-1 font-semibold">Who</th>
            <th className="px-[3px] py-1 font-semibold">Move</th>
            <th className="px-[3px] py-1 text-right font-semibold">Path</th>
            <th className="px-[3px] py-1 text-right font-semibold">Think</th>
          </tr>
        </thead>
        <tbody aria-live="polite">
          {rows.map((l) => (
            <tr
              key={l.t}
              className="border-b border-rule"
              style={{ background: l.newest ? 'var(--highlight-soft)' : 'transparent' }}
            >
              <td className="px-[3px] py-1 font-mono text-muted">{l.t}</td>
              <td className="px-[3px] py-1">{l.who}</td>
              <td className="px-[3px] py-1">{l.move}</td>
              <td className="px-[3px] py-1 text-right font-mono">{l.path}</td>
              <td className="px-[3px] py-1 text-right font-mono text-muted">{l.think}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-muted">
                No moves yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}

// ------------------------------------------------------------------ charts

export function LineChart({
  label,
  title,
  note,
  lines,
  yMax,
  end,
  gridSteps,
  testId,
}: {
  label: string;
  title: string;
  note: string;
  lines: ChartLine[];
  yMax: number;
  end: number;
  gridSteps: number;
  testId: string;
}) {
  const ys = Array.from(
    { length: gridSteps + 1 },
    (_, i) => CHART.y1 + ((CHART.y0 - CHART.y1) * i) / gridSteps,
  );
  const aria = `${title}. ${lines.map((l) => `${l.name} ${l.last}`).join(', ')}`;
  return (
    <Panel
      label={label}
      className="lg:col-span-6"
      title={title}
      aside={<span className="text-[12px] text-muted">{note}</span>}
      testId={testId}
    >
      <svg
        width="100%"
        viewBox="0 0 640 210"
        role="img"
        aria-label={aria}
        className="mt-2 block"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={ys.map((y) => `M${CHART.x0} ${y}H${CHART.x1}`).join('')}
          style={{ stroke: 'var(--rule)', strokeWidth: 1 }}
        />
        <g style={{ font: '400 10px var(--f-mono)', fill: 'var(--muted)' }}>
          <text x="34" y={CHART.y1 + 4} textAnchor="end">
            {yMax}
          </text>
          <text x="34" y={(CHART.y0 + CHART.y1) / 2 + 4} textAnchor="end">
            {Math.round(yMax / 2)}
          </text>
          <text x="34" y={CHART.y0 + 4} textAnchor="end">
            0
          </text>
          <text x={CHART.x0} y="200">
            t0
          </text>
          <text x={CHART.x1} y="200" textAnchor="end">
            t{end}
          </text>
        </g>
        {lines.map((l) => (
          <path
            key={l.id}
            d={l.d}
            style={{
              fill: 'none',
              stroke: l.c,
              strokeWidth: l.w,
              strokeDasharray: l.dash,
              strokeLinejoin: 'round',
            }}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {lines.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1.5">
            <LineSwatch c={l.c} w={l.w} dash={l.dash} />
            {l.name} <span className="font-mono">· {l.last}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ swaps, nudges, tips

export function AnalystSwap({ t }: { t: TableController }) {
  const s = t.state;
  if (!t.pendingMine || !s.pending) return null;
  const pid = s.pending.playerId;
  const p = P(s, pid);
  const src = s.pending.queue[0];
  const base = scoreCards(s.ruleset, s.cards, p.tower);
  return (
    <Panel
      label="Swap"
      className="lg:col-span-12"
      title={
        src.source === 'diary'
          ? 'Keep a diary · swap two neighbours'
          : `Rosette ${src.space} · swap two neighbours`
      }
      aside={
        <span className="font-mono text-[12px] text-muted">
          {p.name} · passion {base.passion} · full life {base.fullLife} · total {base.total}
          {s.pending.queue.length > 1 ? ` · ${s.pending.queue.length - 1} more after this` : ''}
        </span>
      }
      testId="swap-prompt"
    >
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Swaps (scrolls sideways)">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr className="border-b-[1.5px] border-ink text-left text-[11px] text-muted">
              <th className="px-1 py-1 font-semibold">Swap</th>
              <th className="px-1 py-1 font-semibold">Discs</th>
              <th className="px-1 py-1 text-right font-semibold">Passion</th>
              <th className="px-1 py-1 text-right font-semibold">Full life</th>
              <th className="px-1 py-1 text-right font-semibold">Total (whole tower)</th>
            </tr>
          </thead>
          <tbody>
            {p.tower.slice(0, -1).map((_, i) => {
              const tw = p.tower.slice();
              [tw[i], tw[i + 1]] = [tw[i + 1], tw[i]];
              const sc = scoreCards(s.ruleset, s.cards, tw);
              const d = sc.total - base.total;
              return (
                <tr key={i} className="border-b border-rule">
                  <td className="px-1 py-[3px]">
                    <button
                      type="button"
                      onClick={() => t.submit(pid, { type: 'swap', index: i })}
                      className="min-h-[32px] cursor-pointer rounded-md border-[1.5px] border-ink bg-transparent px-2 font-mono text-[12px] text-ink"
                      data-testid={`swap-${i}`}
                    >
                      {i + 1} ⇅ {i + 2}
                    </button>
                  </td>
                  <td className="px-1 py-[3px]">
                    {s.cards[p.tower[i]].id} · {s.cards[p.tower[i + 1]].id}
                  </td>
                  <td className="px-1 py-[3px] text-right font-mono">
                    {base.passion}→{sc.passion}
                  </td>
                  <td className="px-1 py-[3px] text-right font-mono">
                    {base.fullLife}→{sc.fullLife}
                  </td>
                  <td
                    className="px-1 py-[3px] text-right font-mono font-semibold"
                    style={{ color: d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'var(--ink)' }}
                  >
                    {d > 0 ? `+${d}` : d}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <AnalystButton onClick={() => t.submit(pid, { type: 'skip_swap' })} testId="skip-swap">
          Keep the tower as it is
        </AnalystButton>
      </div>
    </Panel>
  );
}

export function AnalystNotes({ t }: { t: TableController }) {
  const notes = [];
  if (t.err)
    notes.push(
      <p
        key="err"
        role="alert"
        className="m-0 rounded-lg border-[1.5px] border-bad bg-panel px-3 py-2 text-[13px]"
      >
        ✗ {t.err}
      </p>,
    );
  if (t.tip)
    notes.push(
      <div
        key="tip"
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-lg border-[1.5px] border-dashed border-ink bg-panel px-3 py-2 text-[13px]"
        data-testid="tip"
      >
        <span className="flex-1">{TIPS[t.tip]}</span>
        <AnalystButton onClick={() => t.setTip(null)}>Got it</AnalystButton>
      </div>,
    );
  if (t.waitingWindow.length > 0 && t.humanToMove) {
    const p = t.waitingWindow[0];
    notes.push(
      <div
        key="win"
        className="flex flex-wrap items-center gap-3 rounded-lg border-[1.5px] border-ink bg-panel px-3 py-2 text-[13px]"
      >
        <span className="flex-1">
          {t.waitingWindow.map((x) => x.name).join(', ')} at the Doorway · window not chosen yet
        </span>
        <AnalystButton onClick={() => t.setWindowFor(p.id)}>Choose {p.name}&apos;s window</AnalystButton>
      </div>,
    );
  }
  if (t.rulesOpen)
    notes.push(
      <div
        key="rules"
        className="rounded-[10px] border-[1.5px] border-panel-border bg-panel px-4 py-3 text-[14px]"
      >
        <RulesReference r={t.state.ruleset} players={t.state.players.length} />
      </div>,
    );
  if (!notes.length) return null;
  return <div className="mt-4 flex flex-col gap-2">{notes}</div>;
}

// ------------------------------------------------------------------ the page

export function AnalystShell({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div
      className="mx-auto box-border max-w-[1440px] px-4 pb-8 text-[14px] leading-[1.45] text-ink md:px-7"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function AnalystTable({ t }: { t: TableController }) {
  const s = t.state;
  const { points } = useTimeline(t);
  const rows = useMemo(() => (t.viewer ? decisionRows(s, t.viewer, t.myTurn) : []), [s, t.viewer, t.myTurn]);
  const why = useMemo(() => lastBotWhy(points), [points]);
  const pos = useMemo(() => positionChart(s, points), [s, points]);
  const sc = useMemo(() => scoreChart(s, points), [s, points]);
  let after: string | null = null;
  let ghost: { space: number; label: string } | null = null;
  if (t.myTurn && t.viewer && t.selectedMove) {
    try {
      const pv = previewMove(s, t.selectedMove, t.viewer);
      const moved = {
        ...s,
        players: s.players.map((p) => (p.id === t.viewer ? { ...p, position: pv.landing } : p)),
      };
      after = queueText(moved, pv.queueAfter);
      ghost = { space: pv.landing, label: `${P(s, t.viewer).name[0].toUpperCase()}?` };
    } catch {
      after = null;
    }
  }
  return (
    <AnalystShell testId="analyst-table">
      <AnalystHeader
        state={s}
        setup={t.client.setup}
        line={gameLine(t)}
        storedId={t.stored.id}
        rulesOpen={t.rulesOpen}
        onRules={() => t.setRulesOpen(!t.rulesOpen)}
      />
      <AnalystNotes t={t} />
      <TrackRuler state={t.shown} current={t.cp} ghost={ghost} queueNow={queueText(s)} queueAfter={after} />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AnalystSwap t={t} />
        <DecisionTable t={t} rows={rows} />
        <PlayersLedger state={s} viewer={t.viewer} />
        <YourTower t={t} points={points} />
        <WhyPanel why={why} />
        <LogPanel t={t} points={points} />
        <LineChart
          label="Position by turn"
          title="Position by turn"
          note="flat runs are other people's turns · steps are yours"
          lines={pos.lines}
          yMax={pos.yMax}
          end={pos.end}
          gridSteps={4}
          testId="chart-position"
        />
        <LineChart
          label="Score if you walked through now"
          title="Score if you walked through now"
          note="whole tower kept · ignores the Doorway cut"
          lines={sc.lines}
          yMax={sc.yMax}
          end={sc.end}
          gridSteps={4}
          testId="chart-score"
        />
      </div>
    </AnalystShell>
  );
}
