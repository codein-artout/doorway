'use client';
import { useState } from 'react';
import type { GameState, PlayerState } from '@doorway/engine';
import { STRATEGIES } from '@doorway/bots';
import { ageName, discountSummary, type QueueEntry } from '@/lib/table-model';
import { DOMAIN } from '@/lib/domains';
import { initialOf } from '@/lib/ui-rules';
import { MiniDisc, Pawn, ThinkingDots } from './primitives';

export function badgeFor(p: PlayerState): string {
  if (!p.isBot) return 'Human';
  const [id, eps] = (p.botPolicy ?? 'greedy').split('@eps');
  const lbl = STRATEGIES[id]?.label ?? id;
  const skill = eps === undefined ? 'Sharp' : Number(eps) >= 0.2 ? 'Casual' : 'Normal';
  return `Bot · ${lbl}${skill !== 'Normal' ? ` · ${skill}` : ''}`;
}

/** Turn banner with eyebrow, H1, reason and the "Why is it my turn?" disclosure. */
export function TurnBanner({
  eyebrow,
  title,
  why,
  whyWho,
  whyOrder,
  mine,
  thinking,
  sameAsBefore,
}: {
  eyebrow: string;
  title: string;
  why: string;
  whyWho: string;
  whyOrder: string;
  mine: boolean;
  thinking?: boolean;
  sameAsBefore?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-5 py-[18px]"
      style={{ border: `1px solid ${mine ? 'var(--door)' : 'var(--line)'}` }}
      data-testid="turn-banner"
    >
      <div className="min-w-0 flex-[1_1_360px]" key={sameAsBefore ? 'same' : title}>
        <div
          className={`${sameAsBefore ? '' : 'dw-fade'} font-mono text-xs font-bold tracking-[0.06em] text-muted uppercase`}
        >
          {eyebrow}
        </div>
        <h1
          className={`${sameAsBefore ? '' : 'dw-fade'} mt-0.5 mb-1 font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em] md:text-[32px]`}
          aria-live="polite"
        >
          {title}
          {thinking && (
            <span className="ml-3 inline-flex align-middle">
              <ThinkingDots />
            </span>
          )}
        </h1>
        <p className="m-0 text-text">{why}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="min-h-[44px] cursor-pointer rounded-full border border-line bg-surface-2 px-4 text-text"
      >
        Why is it {whyWho} turn?
      </button>
      {open && (
        <div className="flex flex-[1_1_100%] flex-col gap-1 rounded-xl bg-ground px-3.5 py-3 text-sm">
          <span>
            There are no rounds. Whoever is furthest back on the track moves next — even several times in a
            row.
          </span>
          <span>
            If pawns share a space, the one on top goes first. A pawn that lands on an occupied space goes on
            top.
          </span>
          <span className="text-muted">Right now: {whyOrder || 'everyone is through.'}</span>
        </div>
      )}
    </div>
  );
}

/** One card of the "Who moves next" queue. */
export function QueueCard({
  state,
  e,
  thinking,
  options,
  choosing,
}: {
  state: GameState;
  e: QueueEntry;
  thinking: boolean;
  options?: number;
  choosing?: boolean;
}) {
  const p = e.player;
  const disc = discountSummary(state, p).map((x) => x.replace(/ \(\d+ discs\)/, ''));
  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] px-3.5 py-3"
      style={{
        background: e.current ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${e.current ? 'var(--door)' : 'var(--line)'}`,
      }}
      data-testid={`queue-${p.id}`}
    >
      <div className="flex items-center gap-2.5">
        <Pawn initial={initialOf(p.name)} isBot={p.isBot} current={e.current} size={30} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {p.name} <span className="text-xs font-normal text-muted">· {badgeFor(p)}</span>
          </div>
          <div className="text-xs text-muted">
            {p.arrivalOrder
              ? `Through the Doorway · keeps ${p.doorwayAllowance}`
              : `Space ${p.position} · ${ageName(state, p.position)}`}{' '}
            · {p.tower.length} discs
          </div>
        </div>
        <span
          className="rounded-full px-2 py-1 font-mono text-[11px] font-bold"
          style={{
            background: e.current ? 'var(--door)' : 'var(--surface-2)',
            color: e.current ? 'var(--ground)' : 'var(--text)',
          }}
        >
          {e.slot}
        </span>
      </div>
      {thinking && (
        <div role="status" className="flex items-center gap-2 text-[13px] text-door">
          <ThinkingDots />
          Thinking — weighing {options ?? 0} moves
        </div>
      )}
      {choosing && (
        <div role="status" className="text-[13px] text-door">
          Choosing a move…
        </div>
      )}
      <div
        className="flex flex-wrap items-center gap-[3px]"
        aria-label={`${p.name}'s tower, base to top: ${p.tower.map((id) => DOMAIN[state.cards[id].color].name).join(', ') || 'empty'}`}
      >
        <span className="mr-1 text-[11px] text-muted">base</span>
        {p.tower.map((id, i) => (
          <MiniDisc
            key={i}
            domain={state.cards[id].color}
            title={`${DOMAIN[state.cards[id].color].name}: ${state.cards[id].name}`}
          />
        ))}
        <span className="ml-1 text-[11px] text-muted">top</span>
      </div>
      <div className="text-xs text-muted">
        {disc.length ? `Experience: ${disc.join(' · ')}` : 'No experience discounts yet'}
      </div>
    </div>
  );
}
