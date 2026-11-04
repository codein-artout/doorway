'use client';
import { useEffect, useMemo, useState } from 'react';
import { CARDS } from '@doorway/content';
import { apply, currentPlayer, replay as engineReplay, type GameState } from '@doorway/engine';
import { AnalystResults } from '@/components/analyst/analyst-results';
import { LineChart, PlayersLedger, TrackRuler } from '@/components/analyst/analyst-table';
import { Panel } from '@/components/analyst/panel';
import { BoardResults } from '@/components/board/board-results';
import { BoardSheet } from '@/components/board/board-sheet';
import { ChipStack } from '@/components/board/board-table';
import { INK } from '@/components/board/pieces';
import { logRows, positionChart, queueText, scoreChart, turnPoints } from '@/lib/analyst-model';
import { demoBase } from '@/lib/demo';
import { useView } from '@/lib/use-view';
import { Market } from '@/components/market';
import { SiteNav } from '@/components/site-nav';
import { TowerList } from '@/components/score';
import { importFile, download, exportReplayJson, exportStateJson } from '@/lib/import-export';
import { findGame, loadCurrent, loadSaved, type StoredGame } from '@/lib/storage';
import { fullLog, logLine } from '@/lib/table-model';

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
      let all: GameState[];
      if (g.state !== undefined && g.id === 'demo') {
        // the demo starts from a stacked market, not from its seed: rebuild from the demo's base position
        all = [demoBase()];
        for (const pm of g.replay.moves) all.push(apply(all[all.length - 1], pm.move, pm.playerId).state);
      } else
        all = engineReplay(
          g.replay,
          { ruleset: g.setup.ruleset, cards: CARDS },
          { keepStates: true },
        ).states!;
      const r = { states: all };
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

  const [view] = useView();
  const s = states?.[move] ?? null;
  const upTo = useMemo(
    () =>
      states
        ? { states: states.slice(0, move + 1), thinkMs: states.slice(0, move + 1).map(() => null) }
        : null,
    [states, move],
  );
  const points = useMemo(() => (upTo ? turnPoints(upTo) : []), [upTo]);
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
      {s && view === 'analyst' && upTo && (
        <div className="px-4 text-ink md:px-7" data-testid="replay-analyst">
          {s.phase === 'over' ? (
            <AnalystResults
              state={s}
              timeline={upTo}
              viewer={null}
              replayHref={`/replay?id=${game?.id ?? ''}`}
              storedId={game?.id}
            />
          ) : (
            <>
              <TrackRuler
                state={s}
                current={currentPlayer(s)}
                ghost={null}
                queueNow={queueText(s)}
                queueAfter={null}
              />
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <PlayersLedger state={s} viewer={null} />
                <Panel label="Towers" title="Towers, top first" className="lg:col-span-4">
                  <div className="grid grid-cols-2 gap-3">
                    {s.players.map((p) => (
                      <div key={p.id}>
                        <div className="text-[12.5px] font-semibold">
                          {p.name} <span className="font-mono text-muted">· {p.position}</span>
                        </div>
                        <TowerList state={s} p={p} compact />
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel label="Event log" title="Log" className="lg:col-span-4">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {logRows(s, points).map((l) => (
                        <tr
                          key={l.t}
                          className="border-b border-rule"
                          style={{ background: l.newest ? 'var(--highlight-soft)' : 'transparent' }}
                        >
                          <td className="px-[3px] py-1 font-mono text-muted">{l.t}</td>
                          <td className="px-[3px] py-1">{l.who}</td>
                          <td className="px-[3px] py-1">{l.move}</td>
                          <td className="px-[3px] py-1 text-right font-mono">{l.path}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
                <LineChart
                  label="Position by turn"
                  title="Position by turn"
                  note="to this move"
                  {...positionChart(s, points)}
                  gridSteps={4}
                  testId="chart-position"
                />
                <LineChart
                  label="Score if you walked through now"
                  title="Score if you walked through now"
                  note="whole tower kept"
                  {...scoreChart(s, points)}
                  gridSteps={4}
                  testId="chart-score"
                />
              </div>
            </>
          )}
        </div>
      )}
      {s && view === 'board' && (
        <div className="px-4 pt-4 md:px-7" data-testid="replay-board">
          {s.phase === 'over' ? (
            <BoardResults state={s} replayHref={`/replay?id=${game?.id ?? ''}`} />
          ) : (
            <div className="flex flex-col gap-4">
              <BoardSheet
                state={s}
                current={currentPlayer(s)}
                ghost={null}
                bubble={lastLines.length ? { text: lastLines.join(' '), thinking: false } : null}
              />
              <div className="flex flex-wrap gap-3">
                {s.players.map((p) => (
                  <section
                    key={p.id}
                    aria-label={`${p.name}'s tower`}
                    className="flex min-w-[150px] flex-1 flex-col items-center gap-2 rounded-2xl p-3 text-ink"
                    style={{ background: 'var(--paper-mat)', border: `3px solid ${INK}` }}
                  >
                    <h2 className="m-0 font-display text-[18px] font-normal">
                      {p.name} <span className="font-hand text-[16px] text-ink-soft">space {p.position}</span>
                    </h2>
                    <ChipStack state={s} p={p} />
                  </section>
                ))}
              </div>
              <section
                aria-label="Market at this move"
                className="min-w-0 rounded-2xl border border-line-soft bg-sunk px-[18px] pt-4 pb-[18px]"
              >
                <h2 className="m-0 font-display text-xl font-bold">Quests</h2>
                <Market
                  state={s}
                  viewer={currentPlayer(s)}
                  myTurn={false}
                  rushMode={false}
                  selected={null}
                  discard={null}
                  onPick={() => {}}
                />
              </section>
            </div>
          )}
        </div>
      )}
      {s && (
        <>
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
