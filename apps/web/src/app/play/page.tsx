'use client';
import { useEffect, useState } from 'react';
import { CARDS } from '@doorway/content';
import { BoardHeader, BoardTable } from '@/components/board/board-table';
import { BoardDoorway } from '@/components/board/board-doorway';
import { BoardPhone } from '@/components/board/board-phone';
import { BoardResults } from '@/components/board/board-results';
import { othersLine } from '@/lib/table-model';
import { useIsPhone } from '@/components/phone';
import { LocalGameClient, type GameClient } from '@/lib/game-client';
import { findGame, loadCurrent, saveCurrent, type StoredGame } from '@/lib/storage';
import { demoBase, demoState, DEMO_SEATS, DEMO_THINK_MS } from '@/lib/demo';
import { AnalystShell, AnalystTable, gameLine, useTimeline } from '@/components/analyst/analyst-table';
import { AnalystHeader } from '@/components/analyst/panel';
import { AnalystDoorway } from '@/components/analyst/analyst-doorway';
import { AnalystResults } from '@/components/analyst/analyst-results';
import { allowanceLine } from '@/lib/window-model';
import { DEFAULT_RULESET } from '@doorway/content';
import { deserialize, serialize, toReplay } from '@doorway/engine';
import { seatFromPlayer } from '@/lib/import-export';
import type { BotSpeed } from '@/lib/ui-rules';
import { useTable } from '@/lib/use-table';
import { useView } from '@/lib/use-view';

export default function PlayPage() {
  const [stored, setStored] = useState<StoredGame | null | 'none'>(null);
  const [client, setClient] = useState<GameClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('demo') !== null) startDemo();
    const id = q.get('id');
    const g = id ? findGame(id) : loadCurrent();
    if (!g) {
      setStored('none');
      return;
    }
    try {
      const c = new LocalGameClient(
        g.setup,
        CARDS,
        g.state
          ? {
              start: deserialize(g.state),
              ...(g.id === 'demo' ? { base: demoBase(), baseThinkMs: DEMO_THINK_MS } : {}),
            }
          : g.replay.moves.length
            ? { from: g.replay }
            : {},
      );
      setStored(g);
      setClient(c);
      return () => c.dispose();
    } catch (e) {
      setError((e as Error).message);
      setStored('none');
    }
  }, []);

  if (stored === 'none')
    return (
      <main className="mx-auto max-w-[700px] p-8">
        <h1 className="font-display text-3xl font-extrabold">No game on this table.</h1>
        {error && (
          <p role="alert" className="text-alert">
            {error}
          </p>
        )}
        <a href="/">Start a new game</a>
      </main>
    );
  if (!client || !stored) return <main className="p-8 text-muted">Setting the table…</main>;
  return <Table client={client} stored={stored} />;
}

function Table({ client, stored }: { client: GameClient; stored: StoredGame }) {
  const t = useTable(client, stored);
  const [view] = useView();
  const phone = useIsPhone();
  const s = t.state;
  const { tl } = useTimeline(t);
  const analyst = view === 'analyst';
  const header = analyst ? (
    <AnalystHeader
      state={s}
      setup={t.client.setup}
      line={
        s.phase === 'over'
          ? `game report · seed ${s.seed} · ${s.rulesetId} · ${s.players.length} players · ${s.turn} turns`
          : t.showDoorwayFor
            ? allowanceLine(s, t.showDoorwayFor)
            : gameLine(t)
      }
      storedId={stored.id}
    />
  ) : (
    <BoardHeader t={t} compact={phone} />
  );
  if (s.phase === 'over')
    return analyst ? (
      <AnalystShell>
        {header}
        <AnalystResults
          state={s}
          timeline={tl}
          viewer={t.viewer}
          replayHref={`/replay?id=${stored.id}`}
          storedId={stored.id}
          onUndo={t.undo}
          canUndo={t.snap.canUndo}
        />
      </AnalystShell>
    ) : (
      <div className="mx-auto max-w-[1440px] px-4 pb-8 md:px-7">
        {header}
        <BoardResults
          state={s}
          replayHref={`/replay?id=${stored.id}`}
          onUndo={t.undo}
          canUndo={t.snap.canUndo}
        />
      </div>
    );
  if (t.showDoorwayFor) {
    const pid = t.showDoorwayFor;
    const lock = (a: number, z: number) => {
      t.submit(pid, { type: 'choose_window', start: a, end: z });
      t.setWindowFor(null);
    };
    const later = t.humanToMove && (
      <p className="mt-4">
        <button
          type="button"
          className={
            analyst
              ? 'min-h-[38px] cursor-pointer rounded-lg border-[1.5px] border-ink bg-transparent px-3.5 font-semibold text-ink'
              : 'min-h-[44px] cursor-pointer rounded-xl border-2 border-felt-line bg-transparent px-4 font-bold text-on-felt'
          }
          onClick={() => t.setWindowFor(null)}
        >
          Decide later — back to the table
        </button>
      </p>
    );
    return analyst ? (
      <AnalystShell>
        {header}
        <AnalystDoorway
          key={pid}
          state={s}
          playerId={pid}
          hintAllowed={t.hints.bestWindow}
          onLock={lock}
          othersLine={othersLine(s, pid)}
          start={t.doorStart(pid)}
          onStart={(v) => t.setDoorStart(pid, v)}
        />
        {later}
      </AnalystShell>
    ) : (
      <div className="mx-auto max-w-[1440px] px-4 pb-8 md:px-7">
        {header}
        <BoardDoorway
          key={pid}
          state={s}
          playerId={pid}
          hintAllowed={t.hints.bestWindow}
          onLock={lock}
          othersLine={othersLine(s, pid)}
          start={t.doorStart(pid)}
          onStart={(v) => t.setDoorStart(pid, v)}
        />
        {later}
      </div>
    );
  }
  if (analyst) return <AnalystTable t={t} />;
  return phone ? <BoardPhone t={t} /> : <BoardTable t={t} />;
}

/** /play?demo=1 — the shared v2 demo position (turn 22, Priya to move). */
function startDemo() {
  const st = demoState();
  const speed = new URLSearchParams(window.location.search).get('speed');
  const setup = {
    seats: DEMO_SEATS.map(seatFromPlayer),
    ruleset: DEFAULT_RULESET,
    seed: st.seed,
    botSpeed: (speed === 'instant' || speed === 'slow' ? speed : 'normal') as BotSpeed,
    blind: false,
  };
  saveCurrent({
    id: 'demo',
    savedAt: new Date().toISOString(),
    setup,
    replay: toReplay(st, true),
    state: serialize(st),
  });
  const u = new URL(window.location.href);
  u.searchParams.delete('demo');
  u.searchParams.delete('speed');
  u.searchParams.set('id', 'demo');
  window.history.replaceState(null, '', u.toString());
}
