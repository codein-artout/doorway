// Board-mode pieces (design/v2/screens/Board-Pieces.dc.html): pawn figures, chips, quest cards.
import type { CSSProperties, ReactNode } from 'react';
import type { Card, Domain } from '@doorway/engine';
import { DOMAIN, ICONS } from '@/lib/domains';
import type { CardView } from '@/lib/table-model';

export const INK = 'var(--ink)';
/** fixed, deterministic card rotations by slot (DESIGN-v2 §3) */
export const ROT = ['-1.6deg', '1.2deg', '-0.6deg', '1.8deg', '-1.1deg', '0.7deg', '-1.8deg'];
export const HOURGLASS = 'M6 3h12M6 21h12M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9s10 3 10 9';

/** Pawn identities by seat (DESIGN-v2 §2): neutral fills, Kavi's seat gets cream eyes. */
export function pawnColors(seat: number) {
  const i = ((seat - 1) % 4) + 1;
  return { fill: `var(--pawn-${i})`, eye: i === 4 ? 'var(--on-felt)' : INK };
}

export function StrokeIcon({
  d,
  size = 16,
  stroke = INK,
  width = 2.4,
}: {
  d: string;
  size?: number;
  stroke?: string;
  width?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        fill: 'none',
        stroke,
        strokeWidth: width,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        flex: 'none',
      }}
    >
      <path d={d} />
    </svg>
  );
}

/** The 28 × 40 pawn figure: head, eyes, body, initial; bots wear an antenna with a lamplight ball. */
export function PawnFigure({
  initial,
  seat,
  isBot,
  current = false,
  ghost = false,
  w = 26,
  h = 38,
  outline = INK,
  smile = false,
  spot = true,
  title,
}: {
  initial: string;
  seat: number;
  isBot: boolean;
  current?: boolean;
  ghost?: boolean;
  w?: number;
  h?: number;
  outline?: string;
  smile?: boolean;
  spot?: boolean;
  title?: string;
}) {
  if (ghost)
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 28 40"
        role="img"
        aria-label={title ?? 'You would land here'}
        style={{ fill: 'none', stroke: INK, strokeWidth: 2, strokeDasharray: '3 3' }}
        data-ghost="true"
      >
        <circle cx="14" cy="15" r="7" />
        <path d="M4 38Q4 23 14 23Q24 23 24 38Z" />
      </svg>
    );
  const { fill, eye } = pawnColors(seat);
  return (
    <span
      className={`flex flex-col items-center ${current ? 'dw-bob' : ''}`}
      title={title}
      data-pawn={initial}
      data-bot={isBot ? 'true' : undefined}
    >
      <svg width={w} height={h} viewBox="0 0 28 40" aria-hidden="true" style={{ overflow: 'visible' }}>
        {isBot && (
          <>
            <path d="M14 8V2" style={{ stroke: outline, strokeWidth: 2, strokeLinecap: 'round' }} />
            <circle
              cx="14"
              cy="2"
              r="2.6"
              style={{ fill: 'var(--lamplight)', stroke: outline, strokeWidth: 1.5 }}
            />
          </>
        )}
        <circle cx="14" cy="15" r="7.5" style={{ fill, stroke: outline, strokeWidth: 2.2 }} />
        <circle cx="11.4" cy="14.5" r="1.3" style={{ fill: eye }} />
        <circle cx="16.6" cy="14.5" r="1.3" style={{ fill: eye }} />
        {smile && (
          <path
            d="M11.5 18q2.5 1.6 5 0"
            style={{ fill: 'none', stroke: eye, strokeWidth: 1, strokeLinecap: 'round' }}
          />
        )}
        <path
          d="M3.5 38.5Q3.5 22.5 14 22.5Q24.5 22.5 24.5 38.5Z"
          style={{ fill, stroke: outline, strokeWidth: 2.2, strokeLinejoin: 'round' }}
        />
        <text x="14" y="34" textAnchor="middle" style={{ font: '900 9px var(--f-body)', fill: eye }}>
          {initial}
        </text>
      </svg>
      {spot && (
        <span
          style={{
            width: w,
            height: 6,
            marginTop: -3,
            borderRadius: '50%',
            background: current ? 'var(--lamplight)' : 'rgba(43,37,48,.18)',
          }}
        />
      )}
    </span>
  );
}

/** A memory chip (the disc as a flat poker chip seen from the side). */
export function Chip({
  domain,
  w = 46,
  h = 12,
  label,
  className = '',
  style,
}: {
  domain: Domain;
  w?: number;
  h?: number;
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      title={DOMAIN[domain].name}
      style={{
        width: w,
        height: h,
        flex: 'none',
        borderRadius: 999,
        border: `${h >= 20 ? 2.5 : 2}px solid ${INK}`,
        background: DOMAIN[domain].css,
        boxShadow: `inset 0 -${h >= 20 ? 4 : 3}px 0 rgba(43,37,48,.18)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        color: 'var(--on-domain)',
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export function ChipLabel({ domain, iconSize = 13 }: { domain: Domain; iconSize?: number }) {
  return (
    <>
      <StrokeIcon d={ICONS[domain]} size={iconSize} width={2.6} />
      <span className="text-[11px] font-black">{DOMAIN[domain].code}</span>
    </>
  );
}

/** A paper quest card, 128 × 196 (DESIGN-v2 §3). */
export function BoardCard({
  v,
  rot,
  selected,
  discarding,
  clickable,
  blockText,
  rushMode,
  onPick,
  cardRef,
  tabIndex,
  onKeyDown,
  small = false,
}: {
  v: CardView;
  rot: string;
  selected: boolean;
  discarding: boolean;
  clickable: boolean;
  blockText: string | null;
  rushMode: boolean;
  onPick?: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  small?: boolean;
}) {
  const c: Card = v.card;
  const d = DOMAIN[c.color];
  const text = c.reflection
    ? `Reflection: +1 per ${DOMAIN[c.reflection].name} disc you keep.`
    : c.power?.text
      ? `Power: ${c.power.text.charAt(0).toLowerCase()}${c.power.text.slice(1)}`
      : null;
  const W = small ? 112 : 128;
  const H = small ? 176 : 196;
  return (
    <button
      type="button"
      ref={cardRef}
      onClick={clickable ? onPick : undefined}
      aria-disabled={!clickable}
      aria-pressed={selected || discarding}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      data-card={c.id}
      data-takeable={v.takeable ? 'true' : 'false'}
      className="relative flex flex-col overflow-visible p-0 text-left text-ink"
      style={{
        width: W,
        height: H,
        flex: 'none',
        borderRadius: 12,
        border: `${selected ? 3.5 : 2.5}px solid ${INK}`,
        background: 'var(--paper-card)',
        cursor: clickable ? 'pointer' : 'default',
        transform: selected ? 'translateY(-14px) rotate(0deg)' : `rotate(${rot})`,
        boxShadow: selected ? '0 0 0 5px var(--lamplight), 0 12px 0 var(--drop)' : '0 5px 0 var(--drop)',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }}
    >
      <span
        className="flex items-center gap-1.5 rounded-t-[9px] px-2 py-[7px]"
        style={{ background: d.css, borderBottom: `2.5px solid ${INK}`, color: 'var(--on-domain)' }}
      >
        <span
          className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full"
          style={{ background: 'var(--paper-card)', border: `2px solid ${INK}` }}
        >
          <StrokeIcon d={ICONS[c.color]} size={15} />
        </span>
        <span className="text-[12px] font-black tracking-[0.04em] uppercase">{d.name}</span>
        <span className="ml-auto text-[11px] font-extrabold">{d.code}</span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <span className="px-[9px] pt-2 font-display text-[15px] leading-[1.12]">{c.name}</span>
        {c.requires && (
          <span
            className="mx-[9px] mt-1.5 self-start rounded-full px-[7px] py-[2px] text-[11px] font-extrabold"
            style={{ border: `1.5px solid ${INK}` }}
          >
            needs {c.requires.count} {DOMAIN[c.requires.color].name}
          </span>
        )}
        {text && !small && (
          <span className="mx-[9px] mt-1.5 text-[11.5px] leading-[1.25] text-ink-soft">{text}</span>
        )}
      </span>
      <span
        className="flex flex-none items-center justify-between px-[9px] py-2"
        style={{ borderTop: '2px dashed #CDBFA6' }}
      >
        <span className="inline-flex items-center gap-1" title="years">
          <StrokeIcon d={HOURGLASS} size={16} width={2.2} />
          {v.discounted && <s className="text-[12px] font-extrabold text-ink-soft">{v.printed}</s>}
          <b className="font-display text-[19px] font-normal">{v.cost}</b>
          <span className="sr-only">years</span>
        </span>
        <span
          title="points"
          className="grid h-[30px] w-[30px] place-items-center rounded-full font-display text-[15px]"
          style={{ border: `2.5px solid ${INK}`, background: 'var(--lamplight)' }}
        >
          {c.points}
          <span className="sr-only"> points</span>
        </span>
      </span>
      {blockText && !rushMode && (
        <span
          className="absolute right-2.5 left-2.5 p-2 text-center font-hand text-[17px] leading-[1.1]"
          style={{
            top: 74,
            background: 'var(--sticky)',
            border: `2px solid ${INK}`,
            transform: 'rotate(-4deg)',
          }}
        >
          {blockText}
        </span>
      )}
      {discarding && (
        <span
          className="absolute right-2 left-2 p-1.5 text-center font-display text-[16px] uppercase"
          style={{
            top: 80,
            border: '3px solid var(--stamp-red)',
            color: 'var(--stamp-red)',
            background: 'var(--paper-card)',
            transform: 'rotate(-8deg)',
          }}
        >
          Discard
        </span>
      )}
      <span className="sr-only">. {v.status}</span>
    </button>
  );
}

/** The Board button style: rotated paper button with a hard ink shadow. */
export function TrayButton({
  children,
  onClick,
  pressed,
  disabled,
  rot = '0deg',
  testId,
  kind = 'paper',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  rot?: string;
  testId?: string;
  kind?: 'paper' | 'ink' | 'ghost';
  ariaLabel?: string;
}) {
  const style: CSSProperties =
    kind === 'ink'
      ? {
          minHeight: 54,
          padding: '0 24px',
          borderRadius: 14,
          border: `3px solid ${INK}`,
          background: INK,
          color: 'var(--lamplight)',
          fontFamily: 'var(--f-display)',
          fontSize: 20,
        }
      : kind === 'ghost'
        ? {
            minHeight: 48,
            padding: '0 16px',
            borderRadius: 12,
            border: `2.5px solid ${INK}`,
            background: 'transparent',
            color: INK,
            fontWeight: 800,
          }
        : {
            minHeight: 52,
            padding: '0 20px',
            borderRadius: 14,
            border: `3px solid ${INK}`,
            background: pressed ? 'var(--lamplight)' : 'var(--paper-card)',
            color: INK,
            fontFamily: 'var(--f-display)',
            fontSize: 19,
            transform: `rotate(${rot})`,
            boxShadow: `0 4px 0 ${INK}`,
          };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      aria-label={ariaLabel}
      className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      style={style}
    >
      {children}
    </button>
  );
}
