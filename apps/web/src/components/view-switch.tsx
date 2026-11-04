'use client';
import { useView } from '@/lib/use-view';
import type { View } from '@/lib/view';

const ICON: Record<View, string> = {
  board: 'M3 7h12a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h12',
  analyst: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
};

/** Board | Analyst segmented control (DESIGN-v2 §1). Binds the V key. */
export function ViewSwitch() {
  const [view, setView] = useView({ keyboard: true });
  const board = view === 'board';
  return (
    <div
      role="group"
      aria-label="View mode (V)"
      data-testid="view-switch"
      className={
        board
          ? 'inline-flex rounded-full border-2 border-felt-line bg-felt-2 p-1'
          : 'inline-flex overflow-hidden rounded-lg border-[1.5px] border-ink'
      }
    >
      {(['board', 'analyst'] as View[]).map((v) => {
        const on = v === view;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => setView(v)}
            data-testid={`view-${v}`}
            className={
              board
                ? `inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-none px-4 font-extrabold ${on ? 'bg-on-felt text-ink' : 'bg-transparent text-on-felt'}`
                : `inline-flex min-h-[36px] cursor-pointer items-center gap-2 border-none px-3.5 font-semibold ${on ? 'bg-ink text-sheet' : 'bg-transparent text-ink'}`
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2.2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              <path d={ICON[v]} />
            </svg>
            {v === 'board' ? 'Board' : 'Analyst'}
          </button>
        );
      })}
    </div>
  );
}
