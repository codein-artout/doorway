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
import { demoState, DEMO_SEATS } from '@/lib/demo';
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
        g.state ? { start: deserialize(g.state) } : g.replay.moves.length ? { from: g.replay } : {},
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
  if (view === 'analyst') return <BoardTable t={t} />;
  if (s.phase === 'over')
    return (
      <div className="mx-auto max-w-[1440px] px-4 pb-8 md:px-7">
        <BoardHeader t={t} compact={phone} />
        <BoardResults
          state={s}
          replayHref={`/replay?id=${stored.id}`}
          onUndo={t.undo}
          canUndo={t.snap.canUndo}
        />
      </div>
    );
  if (t.showDoorwayFor)
    return (
      <div className="mx-auto max-w-[1440px] px-4 pb-8 md:px-7">
        <BoardHeader t={t} compact={phone} />
        <BoardDoorway
          key={t.showDoorwayFor}
          state={s}
          playerId={t.showDoorwayFor}
          hintAllowed={t.hints.bestWindow}
          onLock={(a, z) => {
            t.submit(t.showDoorwayFor!, { type: 'choose_window', start: a, end: z });
            t.setWindowFor(null);
          }}
          othersLine={othersLine(s, t.showDoorwayFor)}
        />
        {t.humanToMove && (
          <p className="mt-4">
            <button
              type="button"
              className="min-h-[44px] cursor-pointer rounded-xl border-2 border-felt-line bg-transparent px-4 font-bold text-on-felt"
              onClick={() => t.setWindowFor(null)}
            >
              Decide later — back to the table
            </button>
          </p>
        )}
      </div>
    );
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
