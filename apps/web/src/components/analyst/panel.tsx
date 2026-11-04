// Analyst primitives (DESIGN-v2 §4): panels, section titles, mono numbers, the header.

import type { ReactNode } from 'react';
import { download, exportReplayJson, exportStateJson } from '@/lib/import-export';
import type { GameSetup } from '@/lib/game-client';
import type { GameState } from '@doorway/engine';
import { ViewSwitch } from '../view-switch';

export function Panel({
  label,
  title,
  aside,
  children,
  className = '',
  testId,
}: {
  label: string;
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`min-w-0 rounded-[10px] border-[1.5px] border-panel-border bg-panel px-4 py-3.5 ${className}`}
      data-testid={testId}
    >
      {(title || aside) && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
          {title && <SectionTitle>{title}</SectionTitle>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionTitle({ children, as = 'h2' }: { children: ReactNode; as?: 'h2' | 'h3' }) {
  const C = as;
  return <C className="m-0 text-[13px] font-bold tracking-[0.06em] uppercase">{children}</C>;
}

export const Mono = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`font-mono ${className}`}>{children}</span>
);

export function AnalystButton({
  children,
  onClick,
  disabled,
  primary,
  testId,
  className = '',
  expanded,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  testId?: string;
  className?: string;
  expanded?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-pressed={pressed}
      data-testid={testId}
      className={`min-h-[38px] cursor-pointer rounded-lg border-[1.5px] border-ink px-3.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? 'bg-ink text-sheet' : 'bg-transparent text-ink'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Page header: wordmark, mono game line, view switch, Rules and export. */
export function AnalystHeader({
  state,
  setup,
  line,
  storedId,
  rulesOpen,
  onRules,
}: {
  state: GameState;
  setup: GameSetup;
  line: string;
  storedId?: string;
  rulesOpen?: boolean;
  onRules?: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 border-b-2 border-ink pt-3.5 pb-3">
      <a href="/" className="font-wordmark text-[26px] leading-none text-ink no-underline">
        Doorway
      </a>
      <span className="font-mono text-[12.5px] text-muted">{line}</span>
      <div className="flex-1" />
      <ViewSwitch />
      {onRules && (
        <AnalystButton onClick={onRules} testId="rules-toggle" expanded={!!rulesOpen}>
          Rules
        </AnalystButton>
      )}
      <details className="relative">
        <summary className="flex min-h-[36px] cursor-pointer list-none items-center rounded-lg border-[1.5px] border-ink bg-panel px-3 font-semibold">
          Game ▾
        </summary>
        <div className="absolute right-0 z-30 mt-1.5 flex w-[200px] flex-col rounded-lg border-[1.5px] border-ink bg-panel p-1.5">
          <button
            type="button"
            className="min-h-[36px] cursor-pointer rounded-md border-none bg-transparent px-2.5 text-left font-semibold text-ink hover:bg-sheet"
            onClick={() => download(`doorway-replay-${state.seed}.json`, exportReplayJson(state, setup))}
            data-testid="export-replay"
          >
            Export replay
          </button>
          <button
            type="button"
            className="min-h-[36px] cursor-pointer rounded-md border-none bg-transparent px-2.5 text-left font-semibold text-ink hover:bg-sheet"
            onClick={() =>
              download(`doorway-state-${state.seed}-m${state.moves.length}.json`, exportStateJson(state))
            }
          >
            Export state
          </button>
          {storedId && (
            <a
              href={`/replay?id=${storedId}&move=${state.moves.length}`}
              className="flex min-h-[36px] items-center rounded-md px-2.5 font-semibold text-ink no-underline hover:bg-sheet"
            >
              Replay this game
            </a>
          )}
          <a
            href="/"
            className="flex min-h-[36px] items-center rounded-md px-2.5 font-semibold text-ink no-underline hover:bg-sheet"
          >
            New game
          </a>
        </div>
      </details>
    </header>
  );
}

/** A small line-style swatch for chart legends. */
export function LineSwatch({ c, w, dash }: { c: string; w: number; dash: string }) {
  return (
    <svg width="22" height="8" aria-hidden="true">
      <path d="M0 4H22" style={{ stroke: c, strokeWidth: w, strokeDasharray: dash }} />
    </svg>
  );
}
