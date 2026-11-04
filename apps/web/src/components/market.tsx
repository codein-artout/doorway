import { ageIndex, ageOf, type Age, type GameState, type PlayerId } from '@doorway/engine';
import { AGE_BG, AGE_NAME, DOMAIN } from '@/lib/domains';
import { cardView, powerText, type CardView } from '@/lib/table-model';
import { DomainIcon } from './primitives';

export type CardMode = 'legal' | 'selected' | 'illegal' | 'discard' | 'waiting';

/** Quest card (DESIGN.md §2): badge, domain + code, id, name, cost (struck → effective), points, requirement, power, status. */
export function QuestCard({
  v,
  selected,
  discarding,
  clickable,
  onPick,
  cardRef,
  tabIndex,
  onKeyDown,
}: {
  v: CardView;
  selected: boolean;
  discarding: boolean;
  clickable: boolean;
  onPick?: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const c = v.card;
  const d = DOMAIN[c.color];
  const text = powerText(c);
  const border = selected ? 'var(--door)' : discarding ? 'var(--alert)' : 'var(--line-soft)';
  const toneColor = v.tone === 'door' ? 'var(--door)' : v.tone === 'alert' ? 'var(--alert)' : 'var(--muted)';
  return (
    <button
      type="button"
      ref={cardRef}
      onClick={clickable ? onPick : undefined}
      aria-disabled={!clickable}
      aria-pressed={selected || discarding}
      aria-describedby={undefined}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      data-card={c.id}
      data-takeable={v.takeable ? 'true' : 'false'}
      title={v.reason ?? undefined}
      className="box-border flex min-h-[176px] flex-col gap-[7px] rounded-xl bg-card p-3 text-left text-text"
      style={{
        border: `2px ${discarding ? 'dashed' : 'solid'} ${border}`,
        opacity: clickable || selected ? 1 : 0.5,
        cursor: clickable ? 'pointer' : 'not-allowed',
      }}
    >
      <span className="flex w-full items-center gap-2">
        <span
          className="grid h-7 w-7 flex-none place-items-center rounded-full"
          style={{ background: d.css }}
        >
          <DomainIcon domain={c.color} size={16} />
        </span>
        <span className="text-xs text-muted">
          {d.name} · {d.code}
        </span>
        <span className="ml-auto font-mono text-[11px] font-medium text-muted">{c.id}</span>
      </span>
      <span className="font-display text-base leading-tight font-bold">{c.name}</span>
      <span className="flex gap-3.5 font-mono text-[13px]">
        <span>
          {v.discounted && (
            <>
              <s className="text-muted">{v.printed}</s> →{' '}
            </>
          )}
          <b className="text-base">{v.cost}</b> yrs
        </span>
        <span>
          <b className="text-base">{c.points}</b> pts
        </span>
      </span>
      {c.requires && (
        <span className="self-start rounded-md bg-ink px-2 py-[3px] text-xs">
          Needs {c.requires.count} {DOMAIN[c.requires.color].name}
        </span>
      )}
      {text && <span className="text-[13px] leading-snug text-text">{text}</span>}
      <span className="mt-auto text-xs font-bold" style={{ color: toneColor }}>
        {v.status}
      </span>
    </button>
  );
}

export function AgeLabel({
  age,
  state,
  viewerPos,
}: {
  age: Age;
  state: GameState;
  viewerPos: number | null;
}) {
  const [s, e] = state.ruleset.ageBands[age];
  const open =
    viewerPos === null ? true : ageIndex(age) <= ageIndex(ageOf(state.ruleset, viewerPos) ?? 'old');
  return (
    <div
      className="flex flex-col justify-center gap-0.5 rounded-[10px] px-2.5 py-2"
      style={{ background: AGE_BG[age] }}
    >
      <span className="font-display text-base font-bold">{AGE_NAME[age]}</span>
      <span className="font-mono text-[11px] font-medium text-muted">
        {s}–{e}
      </span>
      <span className="text-xs" style={{ color: open ? 'var(--door)' : 'var(--muted)' }}>
        {open ? 'open to you' : `opens at ${s}`}
      </span>
    </div>
  );
}

export function DeckSlot({ age, count }: { age: Age; count: number }) {
  return (
    <div className="flex min-h-[176px] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-[13px] text-muted">
      <span className="font-mono text-[22px] font-bold text-text">{count}</span>
      <span>left in the {AGE_NAME[age]} deck</span>
    </div>
  );
}

export type MarketProps = {
  state: GameState;
  viewer: PlayerId | null;
  myTurn: boolean;
  rushMode: boolean;
  selected: string | null;
  discard: string | null;
  onPick: (id: string) => void;
  ages?: Age[];
  registerCard?: (id: string, el: HTMLButtonElement | null) => void;
  focusId?: string | null;
  onCardKey?: (e: React.KeyboardEvent, id: string) => void;
  armed?: { ageReach: boolean; ignoreReq: boolean };
};

/** Market rows: label tile + up to 3 cards; empty slots show the deck count (R13, R15: counts only). */
export function Market({
  state,
  viewer,
  myTurn,
  rushMode,
  selected,
  discard,
  onPick,
  ages = ['young', 'middle', 'old'],
  registerCard,
  focusId,
  onCardKey,
  armed,
}: MarketProps) {
  const vp = viewer ? state.players.find((p) => p.id === viewer)!.position : null;
  const maxSlots = Math.max(...ages.map((a) => state.ruleset.market[a]), 1);
  return (
    <>
      {ages.map((age) => {
        const row = state.market[age];
        const cards = row.filter((x): x is string => !!x);
        return (
          <div
            key={age}
            className="mt-3 grid gap-2.5"
            style={{ gridTemplateColumns: `92px repeat(${maxSlots}, minmax(0, 1fr))` }}
            data-row={age}
          >
            <AgeLabel age={age} state={state} viewerPos={vp} />
            {cards.map((id) => {
              const v = cardView(state, viewer, id, { myTurn, rushMode, discarding: discard === id });
              const powerOk =
                (!v.needsAgeReach || !!armed?.ageReach) && (!v.needsIgnoreReq || !!armed?.ignoreReq);
              if (myTurn && !rushMode && v.takeable && !powerOk)
                v.status = `Needs ${v.needsAgeReach ? 'Old friends' : 'Say yes more'} — tick it below`;
              const clickable = myTurn && (rushMode ? state.ruleset.rushDiscard : v.takeable && powerOk);
              return (
                <QuestCard
                  key={id}
                  v={v}
                  selected={selected === id}
                  discarding={discard === id}
                  clickable={clickable}
                  onPick={() => onPick(id)}
                  cardRef={(el) => registerCard?.(id, el)}
                  tabIndex={focusId === undefined ? undefined : focusId === id ? 0 : -1}
                  onKeyDown={onCardKey ? (e) => onCardKey(e, id) : undefined}
                />
              );
            })}
            {cards.length < row.length || state.decks[age].length > 0 ? (
              cards.length < maxSlots ? (
                <DeckSlot age={age} count={state.decks[age].length} />
              ) : null
            ) : null}
          </div>
        );
      })}
    </>
  );
}
