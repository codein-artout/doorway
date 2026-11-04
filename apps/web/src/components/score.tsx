import type { GameState, PlayerState } from '@doorway/engine';
import type { WindowScore } from '@doorway/engine';
import { DOMAIN } from '@/lib/domains';
import { Disc, type DiscState } from './primitives';

/** The four score boxes + total (table, Doorway and results share it). */
export function ScoreTiles({
  sc,
  size = 'md',
  why,
}: {
  sc: Pick<WindowScore, 'cards' | 'fullLife' | 'passion' | 'reflection' | 'total'>;
  size?: 'md' | 'lg';
  why?: Partial<Record<'cards' | 'fullLife' | 'passion' | 'reflection', string>>;
}) {
  const items: [keyof typeof labels, number][] = [
    ['cards', sc.cards],
    ['fullLife', sc.fullLife],
    ['passion', sc.passion],
    ['reflection', sc.reflection],
  ];
  if (size === 'lg')
    return (
      <div className="grid grid-cols-2 gap-2">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-ground px-3 py-2.5" data-testid={`score-${k}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted">{labels[k]}</span>
              <b className="font-mono text-xl">{v}</b>
            </div>
            {why?.[k] && <div className="mt-0.5 text-xs text-text">{why[k]}</div>}
          </div>
        ))}
      </div>
    );
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-ground px-1 py-2" data-testid={`score-${k}`}>
            <div className="font-mono text-lg font-bold">{v}</div>
            <div className="text-[11px] text-muted">{labels[k]}</div>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="text-[13px] text-muted">Total</span>
        <span className="font-display text-[28px] font-extrabold" data-testid="score-total">
          {sc.total}
        </span>
      </div>
    </div>
  );
}
const labels = { cards: 'Cards', fullLife: 'Full life', passion: 'Passion', reflection: 'Reflection' };

/** A tower list, newest on top (Your life panel, swap prompt, Doorway). */
export function TowerList({
  state,
  p,
  newest,
  states,
  onGap,
  gapLabel,
  compact,
}: {
  state: GameState;
  p: PlayerState;
  newest?: string | null;
  states?: DiscState[];
  onGap?: (i: number) => void;
  gapLabel?: (i: number) => string;
  compact?: boolean;
}) {
  const rows = p.tower.map((id, i) => ({ id, i })).reverse();
  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ id, i }, k) => {
        const c = state.cards[id];
        return (
          <div key={`${id}-${i}`}>
            <div className={`flex items-center gap-2.5 ${id === newest ? 'dw-drop' : ''}`}>
              <span className="w-4 text-right font-mono text-[11px] font-medium text-muted">{i + 1}</span>
              <Disc domain={c.color} state={states?.[i] ?? 'normal'} w={compact ? 52 : 64} />
              <span className="min-w-0 flex-1 truncate text-[13px]" title={c.name}>
                {c.name}
              </span>
              <span className="font-mono text-xs font-bold">{c.points} pt</span>
            </div>
            {onGap && k < rows.length - 1 && (
              <button
                type="button"
                onClick={() => onGap(i - 1)}
                className="my-0.5 ml-[26px] min-h-[24px] w-[calc(100%-26px)] cursor-pointer rounded-md border border-dashed border-door bg-transparent text-xs text-door"
                aria-label={gapLabel?.(i - 1)}
              >
                ⇅ swap {i} and {i + 1}
              </button>
            )}
          </div>
        );
      })}
      <div className="mt-1 ml-[26px] h-2 w-[76px] rounded-[3px] bg-plate" aria-hidden />
      {p.tower.length === 0 && <p className="m-0 text-[13px] text-muted">No memories yet.</p>}
      <span className="sr-only">{`Tower base to top: ${p.tower.map((id) => DOMAIN[state.cards[id].color].name).join(', ')}`}</span>
    </div>
  );
}
