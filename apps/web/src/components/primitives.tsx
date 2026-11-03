import type { CSSProperties, ReactNode } from 'react';
import type { Domain } from '@doorway/engine';
import { DOMAIN, ICONS, UI_ICONS } from '@/lib/domains';
import { pawnStyle } from '@/lib/ui-rules';

export function Icon({
  d,
  size = 16,
  stroke = 'var(--ink)',
  width = 2.2,
  label,
}: {
  d: string;
  size?: number;
  stroke?: string;
  width?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
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

export const DomainIcon = ({ domain, size = 16 }: { domain: Domain; size?: number }) => (
  <Icon d={ICONS[domain]} size={size} width={2.4} />
);
export const UiIcon = ({
  name,
  size = 16,
  stroke,
}: {
  name: keyof typeof UI_ICONS;
  size?: number;
  stroke?: string;
}) => <Icon d={UI_ICONS[name]} size={size} stroke={stroke} />;

export type DiscState = 'normal' | 'kept' | 'left' | 'new';

/** A disc pill: domain colour + icon + two-letter code (R33: never colour alone). */
export function Disc({
  domain,
  state = 'normal',
  w = 64,
  h = 24,
  showCode = true,
  className = '',
}: {
  domain: Domain;
  state?: DiscState;
  w?: number;
  h?: number;
  showCode?: boolean;
  className?: string;
}) {
  const info = DOMAIN[domain];
  return (
    <span
      className={`${state === 'new' ? 'dw-drop' : ''} ${className}`}
      title={info.name}
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        background: info.css,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.18)',
        flex: 'none',
        opacity: state === 'left' ? 0.28 : 1,
      }}
    >
      <DomainIcon domain={domain} size={h >= 30 ? 16 : 14} />
      {showCode && <span className="font-mono text-[11px] font-bold text-ink">{info.code}</span>}
      <span className="sr-only">{info.name}</span>
    </span>
  );
}

/** Mini disc: a circle with the icon only. */
export function MiniDisc({ domain, size = 22, title }: { domain: Domain; size?: number; title?: string }) {
  const info = DOMAIN[domain];
  return (
    <span
      title={title ?? info.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: info.css,
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
      }}
    >
      <DomainIcon domain={domain} size={Math.round(size * 0.6)} />
      <span className="sr-only">{info.code}</span>
    </span>
  );
}

/** R34: ivory pawn with the player's initial; dashed ring for bots; pulse for the current pawn. */
export function Pawn({
  initial,
  isBot = false,
  current = false,
  ghost = false,
  size = 24,
  title,
}: {
  initial: string;
  isBot?: boolean;
  current?: boolean;
  ghost?: boolean;
  size?: number;
  title?: string;
}) {
  const st = pawnStyle({ isBot, current, ghost });
  return (
    <span
      className={st.pulse ? 'dw-pulse' : ''}
      title={title}
      data-pawn={initial}
      data-bot={isBot ? 'true' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: st.background,
        color: st.color,
        border: st.border,
        outline: st.outline,
        outlineOffset: 2,
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        font: `700 ${size >= 30 ? 13 : 11}px var(--font-mono)`,
        flex: 'none',
      }}
    >
      {initial}
    </span>
  );
}

export function Chip({
  children,
  bg = 'var(--door)',
  fg = 'var(--ink)',
  className = '',
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block self-start rounded-full px-2 py-1 font-mono text-[11px] font-bold ${className}`}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'pill' | 'alert';
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  expanded?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  testId?: string;
};

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  pressed,
  className = '',
  style,
  ariaLabel,
  expanded,
  type = 'button',
  title,
  testId,
}: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed min-h-[44px]';
  const v =
    variant === 'primary'
      ? 'rounded-xl bg-door text-ink font-bold px-[22px] min-h-[48px] text-base disabled:opacity-45'
      : variant === 'ghost'
        ? 'rounded-xl border border-line bg-transparent text-text px-4 disabled:opacity-45'
        : variant === 'pill'
          ? 'rounded-full border border-line bg-surface text-text px-4'
          : variant === 'alert'
            ? 'rounded-full border border-alert bg-surface text-text px-4'
            : 'rounded-xl border-2 bg-surface-2 text-text font-bold px-[18px] min-h-[48px] disabled:opacity-45';
  const border = variant === 'secondary' ? { borderColor: pressed ? 'var(--door)' : 'var(--line)' } : {};
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      title={title}
      data-testid={testId}
      className={`${base} ${v} ${className}`}
      style={{ ...border, ...style }}
    >
      {children}
    </button>
  );
}

export function Panel({
  children,
  className = '',
  border = 'var(--line)',
  label,
  as = 'section',
}: {
  children: ReactNode;
  className?: string;
  border?: string;
  label?: string;
  as?: 'section' | 'div' | 'aside';
}) {
  const Tag = as;
  return (
    <Tag
      aria-label={label}
      className={`rounded-2xl bg-surface p-4 ${className}`}
      style={{ border: `1px solid ${border}` }}
    >
      {children}
    </Tag>
  );
}

export function ThinkingDots() {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      <span className="dw-dot h-1.5 w-1.5 rounded-full bg-door" />
      <span className="dw-dot2 h-1.5 w-1.5 rounded-full bg-door" />
      <span className="dw-dot3 h-1.5 w-1.5 rounded-full bg-door" />
    </span>
  );
}
