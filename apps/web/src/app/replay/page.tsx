'use client';
import { useEffect, useMemo, useState } from 'react';
import { CARDS } from '@doorway/content';
import { currentPlayer, replay as engineReplay, type GameState } from '@doorway/engine';
import { Market } from '@/components/market';
import { Results } from '@/components/results';
import { SiteNav } from '@/components/site-nav';
import { Track } from '@/components/track';
import { QueueCard } from '@/components/turn';
import { TowerList } from '@/components/score';
import { importFile, download, exportReplayJson, exportStateJson } from '@/lib/import-export';
import { findGame, loadCurrent, loadSaved, type StoredGame } from '@/lib/storage';
import { fullLog, logLine, queue } from '@/lib/table-model';

export default function ReplayPage() {
  const [game, setGame] = useState<StoredGame | null>(null);
  const [list, setList] = useState<StoredGame[]>([]);
  const [states, setStates] = useState<GameState[] | null>(null);
  const [move, setMove] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('id');
    const cur = loadCurrent();
    setList([
      ...(cur && cur.replay.moves.length ? [cur] : []),
      ...loadSaved().filter((g) => g.id !== cur?.id),
    ]);
    const g = id ? findGame(id) : null;
    if (g) open(g, q.get('move'));
  }, []);

  function open(g: StoredGame, moveParam?: string | null) {
    try {
      const r = engineReplay(g.replay, { ruleset: g.setup.ruleset, cards: CARDS }, { keepStates: true });
      setGame(g);
      setStates(r.states!);
      const m =
        moveParam !== null && moveParam !== undefined && moveParam !== ''
          ? Math.max(0, Math.min(r.states!.length - 1, Number(moveParam)))
          : r.states!.length - 1;
      setMove(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // deep link: ?move=N
  useEffect(() => {
    if (!game) return;
    const u = new URL(window.location.href);
    u.searchParams.set('id', game.id);
    u.searchParams.set('move', String(move));
    window.history.replaceState(null, '', u.toString());
  }, [game, move]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!states) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') setMove((m) => Math.min(states.length - 1, m + 1));
      if (e.key === 'ArrowLeft') setMove((m) => Math.max(0, m - 1));
      if (e.key === 'Home') setMove(0);
      if (e.key === 'End') setMove(states.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [states]);

  const s = states?.[move] ?? null;
  const last = useMemo(() => (s && move > 0 ? s.moves[move - 1] : null), [s, move]);
  const lastLines = useMemo(() => {
    if (!states || move === 0) return [];
    const before = states[move - 1].log.length;
    return states[move].log
      .slice(before)
      .map((e) => logLine(states[move], e))
      .filter(Boolean) as string[];
  }, [states, move]);

  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <SiteNav />
      <main className="px-4 pt-6 md:px-7">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <h1 className="m-0 font-display text-[34px] font-extrabold">Replay</h1>
            <p className="m-0 text-muted">
              Every game rebuilds from its seed and its move list. Step through it, or share a link to a
              single move.
            </p>
          </div>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-line px-4 text-sm">
            Open a replay file (.json)
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = await importFile(f);
                if (!r.ok) setError(r.error);
                else open({ id: r.id, savedAt: new Date().toISOString(), setup: r.setup, replay: r.replay });
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-alert px-3 py-2 text-alert">
            {error}
          </p>
        )}
        {!game && (
          <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
            <h2 className="m-0 mb-2 font-display text-xl">Games on this device</h2>
            {list.length === 0 && (
              <p className="m-0 text-muted">No games yet. Finished and in-progress games appear here.</p>
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-left text-text"
                    onClick={() => open(g)}
                  >
                    {g.setup.seats.map((x) => x.name).join(' · ')} — {g.replay.moves.length} moves · seed{' '}
                    {g.setup.seed} · {new Date(g.savedAt).toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {s && states && game && (
          <>
            <section
              aria-label="Replay controls"
              className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <button
                type="button"
                onClick={() => setMove(0)}
                disabled={move === 0}
                className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-3 text-text disabled:opacity-45"
                aria-label="First move"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={() => setMove(Math.max(0, move - 1))}
                disabled={move === 0}
                className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text disabled:opacity-45"
                data-testid="replay-back"
              >
                ← Back
              </button>
              <input
                type="range"
                min={0}
                max={states.length - 1}
                value={move}
                onChange={(e) => setMove(Number(e.target.value))}
                aria-label="Move"
                className="min-w-[160px] flex-1"
              />
              <button
                type="button"
                onClick={() => setMove(Math.min(states.length - 1, move + 1))}
                disabled={move === states.length - 1}
                className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text disabled:opacity-45"
                data-testid="replay-forward"
              >
                Forward →
              </button>
              <button
                type="button"
                onClick={() => setMove(states.length - 1)}
                disabled={move === states.length - 1}
                className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-3 text-text disabled:opacity-45"
                aria-label="Last move"
              >
                ⏭
              </button>
              <span className="font-mono text-sm" data-testid="replay-pos">
                move {move} / {states.length - 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  download(
                    `doorway-replay-${game.setup.seed}.json`,
                    exportReplayJson(states[states.length - 1], game.setup),
                  )
                }
                className="min-h-[44px] cursor-pointer rounded-full border border-line bg-surface px-4 text-text"
              >
                Export replay
              </button>
              <button
                type="button"
                onClick={() => download(`doorway-state-${game.setup.seed}-m${move}.json`, exportStateJson(s))}
                className="min-h-[44px] cursor-pointer rounded-full border border-line bg-surface px-4 text-text"
              >
                Export this state
              </button>
            </section>
            <p className="mt-3 mb-0 text-sm" aria-live="polite">
              {last ? (
                <>
                  <b>Move {move}:</b> {lastLines.join(' ') || `${last.playerId} ${last.move.type}`}
                </>
              ) : (
                'The start of the game: everyone on space 0.'
              )}
            </p>
          </>
        )}
      </main>
      {s && (
        <>
          <Track state={s} current={currentPlayer(s)} />
          {s.phase === 'over' ? (
            <div className="px-4 pt-4 md:px-7">
              <Results state={s} />
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-5 px-4 pt-3.5 md:px-7">
              <aside
                className="flex max-w-[330px] min-w-0 flex-[1_1_280px] flex-col gap-3"
                aria-label="Players"
              >
                {queue(s).map((e) => (
                  <QueueCard key={e.player.id} state={s} e={e} thinking={false} />
                ))}
              </aside>
              <section
                aria-label="Market at this move"
                className="min-w-0 flex-[999_1_600px] rounded-2xl border border-line-soft bg-sunk px-[18px] pt-4 pb-[18px]"
              >
                <h2 className="m-0 font-display text-xl font-bold">Quests</h2>
                <Market
                  state={s}
                  viewer={currentPlayer(s)}
                  myTurn={false}
                  rushMode={false}
                  selected={last?.move.type === 'quest' ? null : null}
                  discard={null}
                  onPick={() => {}}
                />
              </section>
              <aside
                className="flex max-w-[340px] min-w-0 flex-[1_1_290px] flex-col gap-3"
                aria-label="Towers"
              >
                {s.players.map((p) => (
                  <section key={p.id} className="rounded-2xl border border-line bg-surface p-4">
                    <h2 className="m-0 mb-2 font-display text-base">
                      {p.name} · space {p.position}
                    </h2>
                    <TowerList state={s} p={p} compact />
                  </section>
                ))}
              </aside>
            </div>
          )}
          <section className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 md:mx-7">
            <h2 className="m-0 mb-2 font-display text-base">Log to this move</h2>
            <ol className="m-0 flex max-h-[260px] list-none flex-col gap-1 overflow-y-auto p-0 text-[13px] text-muted">
              {fullLog(s)
                .slice()
                .reverse()
                .map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
