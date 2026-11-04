import type { Age, GameState, PlayerId, Ruleset } from '@doorway/engine';
import { AGES } from '@doorway/engine';
import { AGE_BG, AGE_NAME, AGE_RULE } from '@/lib/domains';
import { initialOf } from '@/lib/ui-rules';
import { Pawn, UiIcon } from './primitives';

export type TrackPawn = { id: PlayerId; name: string; isBot: boolean };

export function ageAt(r: Ruleset, i: number): Age {
  for (const a of AGES) if (i >= r.ageBands[a][0] && i <= r.ageBands[a][1]) return a;
  return 'old';
}

/** One space of the life track: age-band fill, pawns stacked with the top pawn drawn on top, Milestone ring. */
export function TrackCell({
  n,
  age,
  milestone,
  pawns,
  current,
  ghost,
  ghostInitial,
  height = 116,
  flash = false,
}: {
  n: number;
  age: Age;
  milestone: boolean;
  pawns: TrackPawn[];
  current?: PlayerId | null;
  ghost?: boolean;
  ghostInitial?: string;
  height?: number;
  flash?: boolean;
}) {
  // pawns: bottom → top; draw the top pawn first (highest on screen)
  const shown = pawns.slice().reverse();
  return (
    <div
      data-space={n}
      className="flex flex-col items-center justify-end rounded-[5px] px-0 pt-1 pb-[5px]"
      style={{ height, background: AGE_BG[age] }}
    >
      <div className="mb-1.5 flex flex-col items-center gap-0.5">
        {ghost && <Pawn initial={ghostInitial ?? '?'} ghost title="You would land here" />}
        {shown.map((p) => (
          <Pawn
            key={p.id}
            initial={initialOf(p.name)}
            isBot={p.isBot}
            current={p.id === current}
            title={`${p.name}${p.isBot ? ' (bot)' : ''} — space ${n}`}
          />
        ))}
      </div>
      {milestone ? (
        <span
          title="Milestone: swap two adjacent discs"
          className={`${flash ? 'dw-flash' : ''} grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-door font-mono text-[10px] font-bold text-door`}
        >
          {n}
        </span>
      ) : (
        <span className="grid h-[22px] place-items-center font-mono text-[10px] font-medium text-muted">
          {n}
        </span>
      )}
    </div>
  );
}

export function DoorwayArch({
  width = 100,
  height = 116,
  children,
  swell = false,
}: {
  width?: number;
  height?: number;
  children?: React.ReactNode;
  swell?: boolean;
}) {
  return (
    <div
      className={`${swell ? 'dw-swell' : 'dw-glow'} flex flex-col items-center justify-end gap-1.5 bg-door pb-3 text-on-door`}
      style={{
        width,
        height,
        borderRadius: `${width / 2}px ${width / 2}px 6px 6px`,
        boxSizing: 'border-box',
        flex: 'none',
      }}
    >
      {children ?? (
        <>
          <UiIcon name="door" size={26} stroke="var(--on-door)" />
          <span className="font-display text-[15px] font-extrabold">Doorway</span>
        </>
      )}
    </div>
  );
}

export function DoorwayTiles({
  ruleset,
  players,
  taken,
}: {
  ruleset: Ruleset;
  players: number;
  taken: number;
}) {
  const tiles = players === 1 ? [ruleset.solo.doorway] : (ruleset.doorway[String(players)] ?? []);
  const places = ['1st', '2nd', '3rd', '4th'];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-bold text-text">
        Doorway tiles · {players === 1 ? 'solo' : `${players} players`}
      </span>
      {tiles.map((k, i) => {
        const gone = i < taken;
        return (
          <span
            key={i}
            className="inline-flex items-baseline gap-1.5 rounded-lg border border-door px-2.5 py-1.5"
            style={{
              background: gone ? 'transparent' : 'var(--door)',
              color: gone ? 'var(--muted)' : 'var(--on-door)',
            }}
            title={gone ? 'Taken' : 'Waiting at the Doorway'}
          >
            <span className="text-xs">{players === 1 ? 'keep' : places[i]}</span>
            <b className="font-mono text-[15px]">{k}</b>
            <span className="text-xs">discs</span>
          </span>
        );
      })}
    </div>
  );
}

/** The life track: 0..L−1 with age bands, Milestones, stacked pawns, ghost landing, and the lit Doorway. */
export function Track({
  state,
  current,
  ghost,
  compactHeight,
  flash = [],
}: {
  flash?: number[];
  state: GameState;
  current: PlayerId | null;
  ghost?: { space: number; initial: string } | null;
  compactHeight?: number;
}) {
  const r = state.ruleset;
  const L = r.trackLength;
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const arrived = (state.stacks[L] ?? []).map((id) => byId[id]);
  return (
    <section aria-label="Life track" className="px-4 pt-[18px] pb-1.5 md:px-7">
      <div className="flex items-stretch gap-2.5">
        <div
          className="min-w-0 flex-1 overflow-x-auto"
          tabIndex={0}
          aria-label="Track spaces (scrolls sideways)"
        >
          <div style={{ minWidth: 900 }}>
            <div
              className="mb-1.5 grid gap-0.5 text-xs text-muted"
              style={{ gridTemplateColumns: `repeat(${L}, minmax(0, 1fr))` }}
            >
              {AGES.map((a) => {
                const [s, e] = r.ageBands[a];
                return (
                  <div
                    key={a}
                    className="flex justify-between pb-[3px]"
                    style={{ gridColumn: `span ${e - s + 1}`, borderBottom: `2px solid ${AGE_RULE[a]}` }}
                  >
                    <span className="font-bold text-text">{AGE_NAME[a]}</span>
                    <span>
                      {s}–{e}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${L}, minmax(0, 1fr))` }}>
              {Array.from({ length: L }, (_, i) => (
                <TrackCell
                  key={i}
                  n={i}
                  age={ageAt(r, i)}
                  milestone={r.milestones.includes(i)}
                  pawns={(state.stacks[i] ?? []).map((id) => byId[id])}
                  current={current}
                  ghost={ghost?.space === i}
                  ghostInitial={ghost?.initial}
                  height={compactHeight}
                  flash={flash.includes(i)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex w-[118px] flex-none flex-col items-center justify-end gap-1">
          <div className="flex min-h-6 flex-wrap justify-center gap-1">
            {arrived.map((p) => (
              <Pawn
                key={p.id}
                initial={initialOf(p.name)}
                isBot={p.isBot}
                title={`${p.name} arrived ${p.arrivalOrder}${['st', 'nd', 'rd', 'th'][Math.min(3, (p.arrivalOrder ?? 1) - 1)]}`}
              />
            ))}
            {ghost?.space === L && <Pawn initial={ghost.initial} ghost title="You would reach the Doorway" />}
          </div>
          <span className="text-xs text-muted">space {L}</span>
          <DoorwayArch height={compactHeight ?? 116} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-door" />
          Milestone: swap two adjacent discs, once each
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full bg-text"
            style={{ outline: '2px dashed var(--muted)', outlineOffset: 2 }}
          />
          Bot pawn
        </span>
        <div className="flex-1" />
        <DoorwayTiles ruleset={r} players={state.players.length} taken={state.arrivals.length} />
      </div>
    </section>
  );
}
