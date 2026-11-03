import { Button } from './primitives';

export type PowerToggle = {
  key: 'ageReach' | 'ignoreReq';
  label: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
};

/** Action bar: Quest / Rush toggles, power toggles (only when they matter), live preview, Undo, confirm. */
export function ActionBar({
  myTurn,
  mode,
  rushTarget,
  onQuest,
  onRush,
  toggles,
  previewText,
  previewNext,
  canUndo,
  onUndo,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  sticky,
}: {
  myTurn: boolean;
  mode: 'quest' | 'rush' | null;
  rushTarget: number | null;
  onQuest: () => void;
  onRush: () => void;
  toggles: PowerToggle[];
  previewText: string;
  previewNext: string;
  canUndo: boolean;
  onUndo: () => void;
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
  sticky?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-2xl border border-line bg-surface p-4 ${sticky ? 'sticky bottom-0 z-20' : ''}`}
      data-testid="action-bar"
    >
      <div role="group" aria-label="Choose your action" className="flex gap-2">
        <Button onClick={onQuest} pressed={mode === 'quest'} disabled={!myTurn} testId="mode-quest">
          Quest
        </Button>
        <Button onClick={onRush} pressed={mode === 'rush'} disabled={!myTurn} testId="mode-rush">
          Rush{rushTarget !== null ? ` → ${rushTarget}` : ''}
        </Button>
      </div>
      {toggles.map((t) => (
        <label key={t.key} className="inline-flex min-h-[44px] items-center gap-2 text-[13px] text-text">
          <input
            type="checkbox"
            checked={t.checked}
            disabled={t.disabled || !myTurn}
            onChange={(e) => t.onChange(e.target.checked)}
            className="h-[18px] w-[18px]"
          />
          <span>
            <b>{t.label}</b> <span className="text-muted">· {t.detail}</span>
          </span>
        </label>
      ))}
      <div role="status" className="min-w-0 flex-[1_1_280px] text-sm" data-testid="preview">
        <div className="font-bold">{previewText}</div>
        <div className="text-door">{previewNext}</div>
      </div>
      <Button variant="ghost" onClick={onUndo} disabled={!canUndo} testId="undo" title="Undo (U)">
        Undo
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled} testId="confirm">
        {confirmLabel}
      </Button>
    </div>
  );
}
