'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARDS } from '@doorway/content';
import {
  AGES,
  bestWindowFor,
  currentPlayer,
  scoreCards,
  type GameState,
  type PlayerId,
} from '@doorway/engine';
import { ActionBar, type PowerToggle } from '@/components/actions';
import { DoorwaySelect } from '@/components/doorway';
import { Market } from '@/components/market';
import { NearStrip, OverviewBar, PhoneMarket, QueueChips, useIsPhone } from '@/components/phone';
import { Button, Panel, UiIcon } from '@/components/primitives';
import { Results } from '@/components/results';
import { RulesReference } from '@/components/rules-ref';
import { ScoreTiles, TowerList } from '@/components/score';
import { Track } from '@/components/track';
import { QueueCard, TurnBanner } from '@/components/turn';
import { LocalGameClient, type GameClient } from '@/lib/game-client';
import { download, exportReplayJson, exportStateJson } from '@/lib/import-export';
import {
  loadCurrent,
  findGame,
  loadTipsSeen,
  saveCurrent,
  saveFinished,
  saveSettings,
  saveTipsSeen,
  type StoredGame,
} from '@/lib/storage';
import {
  banner,
  choiceToMove,
  discountSummary,
  fullLog,
  P,
  powersOf,
  preview,
  queue,
  rushLanding,
  tipsFrom,
  TIPS,
  type Choice,
  type TipKind,
} from '@/lib/table-model';
import { BOT_SPEEDS, hintSettings, type BotSpeed } from '@/lib/ui-rules';
import { useAnimatedState, useClient } from '@/lib/use-game';
import { DOMAIN } from '@/lib/domains';

export default function PlayPage() {
  const [stored, setStored] = useState<StoredGame | null | 'none'>(null);
  const [client, setClient] = useState<GameClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    const g = id ? findGame(id) : loadCurrent();
    if (!g) {
      setStored('none');
      return;
    }
    try {
      const c = new LocalGameClient(g.setup, CARDS, g.replay.moves.length ? { from: g.replay } : {});
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
  const snap = useClientSnap(client);
  const anim = useAnimatedState(snap);
  const phone = useIsPhone();
  const state = snap.state;
  const view = anim.state ?? state;
  const humans = useMemo(
    () => new Set(state.players.filter((p) => !p.isBot).map((p) => p.id)),
    [state.players],
  );
  const hints = hintSettings(state.ruleset, client.setup.blind);
  const cp = currentPlayer(state);
  const lastViewer = useRef<PlayerId | null>(null);
  const viewer: PlayerId | null = cp && humans.has(cp) ? cp : (lastViewer.current ?? [...humans][0] ?? null);
  if (viewer) lastViewer.current = viewer;
  const me = viewer ? P(state, viewer) : null;
  const myTurn = !!viewer && cp === viewer && state.phase === 'playing';
  const [choice, setChoice] = useState<Choice>(null);
  const [mode, setMode] = useState<'quest' | 'rush' | null>(null);
  const [armed, setArmed] = useState({ ageReach: false, ignoreReq: false });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [windowFor, setWindowFor] = useState<PlayerId | null>(null);
  const [tip, setTip] = useState<TipKind | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const cardEls = useRef(new Map<string, HTMLButtonElement>());
  const [err, setErr] = useState<string | null>(null);

  // persist after every change
  useEffect(() => {
    const g: StoredGame = {
      id: stored.id,
      savedAt: new Date().toISOString(),
      setup: client.setup,
      replay: client.toReplay(),
    };
    saveCurrent(g);
    if (state.phase === 'over') saveFinished(g);
  }, [snap, client, stored.id, state.phase]);

  // reset selection whenever the position changes
  useEffect(() => {
    setChoice(null);
    setMode(null);
    setArmed({ ageReach: false, ignoreReq: false });
    setErr(null);
  }, [state.moves.length]);

  // first-game tips (spec §8.5; off in blind test, R35)
  useEffect(() => {
    if (!hints.firstGameTips) return;
    const seen = loadTipsSeen();
    const fresh = tipsFrom(snap.events, humans).find((k) => !seen.includes(k));
    if (fresh) {
      setTip(fresh);
      saveTipsSeen([...seen, fresh]);
    }
  }, [snap.events, humans, hints.firstGameTips]);

  // arrived humans who still need to choose a window
  const waitingWindow = state.players.filter(
    (p) => !p.isBot && p.arrivalOrder !== null && p.keptRange === null,
  );
  const humanToMove =
    !!cp && humans.has(cp) && (state.phase === 'playing' || state.phase === 'pending_choice');
  const showDoorwayFor =
    windowFor && waitingWindow.some((p) => p.id === windowFor)
      ? windowFor
      : !humanToMove && waitingWindow[0]
        ? waitingWindow[0].id
        : null;

  const submit = useCallback(
    (pid: PlayerId, m: Parameters<GameClient['submit']>[0]) => {
      try {
        client.submit(m, pid);
        setErr(null);
      } catch (e) {
        setErr((e as Error).message);
      }
    },
    [client],
  );

  const pick = (id: string) => {
    if (!myTurn) return;
    if (mode === 'rush') {
      setChoice({
        kind: 'rush',
        discardCardId: choice?.kind === 'rush' && choice.discardCardId === id ? undefined : id,
      });
      return;
    }
    if (choice?.kind === 'quest' && choice.cardId === id) {
      setChoice(null);
      return;
    }
    setMode('quest');
    setChoice({
      kind: 'quest',
      cardId: id,
      useAgeReach: armed.ageReach || undefined,
      useIgnoreReq: armed.ignoreReq || undefined,
    });
  };
  const fixedChoice = (): Choice => {
    if (!choice || choice.kind !== 'quest' || !viewer) return choice;
    // set the power flags exactly as the engine needs them (R17/R18)
    const ms = snap.state;
    const v = ms.market[ms.cards[choice.cardId].age].includes(choice.cardId);
    if (!v) return null;
    return choice;
  };
  const confirm = () => {
    if (!viewer || !myTurn) return;
    const c = fixedChoice();
    if (!c) return;
    let m = choiceToMove(c)!;
    if (m.type === 'quest') {
      const needed = needs(state, viewer, m.cardId);
      m = {
        type: 'quest',
        cardId: m.cardId,
        ...(needed.ageReach ? { useAgeReach: true } : {}),
        ...(needed.ignoreReq ? { useIgnoreReq: true } : {}),
      };
    }
    submit(viewer, m);
  };

  // keyboard: arrows move between cards, Enter quests, R rushes, U undoes, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'SELECT' || t?.tagName === 'TEXTAREA') return;
      if (showDoorwayFor) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setChoice(null);
        setMode(null);
        setRulesOpen(false);
        setTip(null);
      } else if (k === 'u' && !e.metaKey && !e.ctrlKey) {
        if (snap.canUndo) client.undo();
      } else if (k === 'r' && !e.metaKey && !e.ctrlKey && myTurn) {
        if (mode === 'rush') confirm();
        else {
          setMode('rush');
          setChoice({ kind: 'rush' });
        }
      } else if (k === 'enter' && choice && myTurn && !t?.dataset?.card) {
        confirm();
      } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) && !t?.dataset?.card) {
        const ids = AGES.flatMap((a) => state.market[a]).filter((x): x is string => !!x);
        if (ids.length) {
          setFocusId(ids[0]);
          cardEls.current.get(ids[0])?.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const onCardKey = (e: React.KeyboardEvent, id: string) => {
    const ids = AGES.flatMap((a) => state.market[a]).filter((x): x is string => !!x);
    const i = ids.indexOf(id);
    if (['ArrowRight', 'ArrowDown'].includes(e.key) || ['ArrowLeft', 'ArrowUp'].includes(e.key)) {
      const nx = ids[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ids.length - 1)) % ids.length];
      setFocusId(nx);
      cardEls.current.get(nx)?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (choice?.kind === 'quest' && choice.cardId === id) confirm();
      else pick(id);
    }
  };

  const b = banner(
    state,
    viewer,
    snap.lastActor === cp && !!cp && humans.has(cp) && state.moves.length > 0 && state.lastActor === cp,
    !!snap.thinking,
  );
  const pv = viewer ? preview(state, viewer, choice) : { text: '', next: '', landing: null };
  const rt = viewer && myTurn ? rushLanding(state, viewer) : null;
  const toggles: PowerToggle[] = [];
  if (me && myTurn) {
    const pw = powersOf(state, me);
    const anyNeeds = (key: 'ageReach' | 'ignoreReq') =>
      AGES.some((a) => state.market[a].some((id) => id && needs(state, me.id, id)[key]));
    if (
      pw.some((x) => x.card.power?.type === 'age_reach_once') &&
      !me.oncePowersUsed.ageReach &&
      anyNeeds('ageReach')
    )
      toggles.push({
        key: 'ageReach',
        label: 'Old friends',
        detail: 'once · take a card one age older',
        checked: armed.ageReach,
        onChange: (v) => setArmed({ ...armed, ageReach: v }),
      });
    if (
      pw.some((x) => x.card.power?.type === 'ignore_requirement_once') &&
      !me.oncePowersUsed.ignoreReq &&
      anyNeeds('ignoreReq')
    )
      toggles.push({
        key: 'ignoreReq',
        label: 'Say yes more',
        detail: 'once · ignore a requirement',
        checked: armed.ignoreReq,
        onChange: (v) => setArmed({ ...armed, ignoreReq: v }),
      });
  }
  const ghost =
    myTurn && pv.landing !== null && me ? { space: pv.landing, initial: me.name[0].toUpperCase() } : null;
  const confirmLabel =
    mode === 'rush' && rt !== null
      ? `Rush to ${rt}`
      : choice?.kind === 'quest'
        ? 'Take this quest'
        : 'Choose a move';
  const thinkingId = snap.thinking?.playerId ?? null;
  const q = queue(state);

  const header = (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3.5 md:px-7">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href="/"
          className="font-display text-[21px] font-extrabold tracking-[-0.01em] text-text no-underline"
        >
          Doorway
        </a>
        <span className="font-mono text-xs text-muted">
          LOCAL · {state.players.length} {state.players.length === 1 ? 'player (solo)' : 'players'} · ruleset{' '}
          {state.rulesetId} · seed {state.seed}
          {client.setup.blind ? ' · blind test' : ''}
        </span>
      </div>
      <div className="flex-1" />
      <Button
        variant="pill"
        onClick={() => setRulesOpen(!rulesOpen)}
        expanded={rulesOpen}
        testId="rules-toggle"
      >
        Rules
      </Button>
      <Button
        variant="pill"
        onClick={() => download(`doorway-replay-${state.seed}.json`, exportReplayJson(state, client.setup))}
        testId="export-replay"
      >
        Export replay
      </Button>
      <Button
        variant="pill"
        onClick={() =>
          download(`doorway-state-${state.seed}-m${state.moves.length}.json`, exportStateJson(state))
        }
      >
        Export state
      </Button>
      <a
        href={`/replay?id=${stored.id}&move=${state.moves.length}`}
        className="inline-flex min-h-[44px] items-center rounded-full border border-line px-4 text-text no-underline"
      >
        Replay
      </a>
    </header>
  );

  const tipBox = tip && (
    <div
      role="status"
      className="dw-fade flex flex-wrap items-center gap-3 rounded-2xl border border-door bg-surface-2 px-4 py-3 text-sm"
      data-testid="tip"
    >
      <UiIcon name="help" stroke="var(--door)" size={20} />
      <span className="flex-1">{TIPS[tip]}</span>
      <button
        type="button"
        onClick={() => setTip(null)}
        className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-transparent px-3 text-text"
      >
        Got it
      </button>
    </div>
  );

  // ---- game over
  if (state.phase === 'over')
    return (
      <div className="mx-auto max-w-[1440px] pb-8">
        {header}
        <main className="px-4 pt-6 md:px-7">
          <Results
            state={state}
            actions={
              <>
                <a
                  href="/"
                  className="inline-flex min-h-[48px] items-center rounded-xl bg-door px-5 font-bold text-ink no-underline"
                >
                  Play again
                </a>
                <a
                  href={`/replay?id=${stored.id}`}
                  className="inline-flex min-h-[48px] items-center rounded-xl border border-line bg-surface px-[18px] text-text no-underline"
                >
                  Watch the replay
                </a>
                <Button variant="ghost" onClick={() => client.undo()} disabled={!snap.canUndo}>
                  Undo
                </Button>
              </>
            }
          />
        </main>
      </div>
    );

  // ---- the Doorway moment for a human
  if (showDoorwayFor)
    return (
      <div className="mx-auto max-w-[1440px] pb-8">
        {header}
        <main className="px-4 pt-6 md:px-7">
          <DoorwaySelect
            key={showDoorwayFor}
            state={state}
            playerId={showDoorwayFor}
            hintAllowed={hints.bestWindow}
            onLock={(a, z) => {
              submit(showDoorwayFor, { type: 'choose_window', start: a, end: z });
              setWindowFor(null);
            }}
            othersLine={othersLine(state, showDoorwayFor)}
          />
          {humanToMove && (
            <p className="mt-4">
              <button
                type="button"
                className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-transparent px-4 text-text"
                onClick={() => setWindowFor(null)}
              >
                Decide later — back to the table
              </button>
            </p>
          )}
        </main>
      </div>
    );

  const pendingMine = state.phase === 'pending_choice' && state.pending && humans.has(state.pending.playerId);
  const swapPanel = pendingMine && (
    <SwapPrompt
      state={state}
      pid={state.pending!.playerId}
      onSwap={(i) => submit(state.pending!.playerId, { type: 'swap', index: i })}
      onSkip={() => submit(state.pending!.playerId, { type: 'skip_swap' })}
    />
  );
  const windowNudge = waitingWindow.length > 0 && humanToMove && (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-door bg-sunk px-4 py-3 text-sm">
      <span className="flex-1">
        {waitingWindow.map((p) => p.name).join(', ')} reached the Doorway and can choose a stretch any time.
      </span>
      <Button onClick={() => setWindowFor(waitingWindow[0].id)}>
        Choose {waitingWindow[0].name}&apos;s stretch
      </Button>
    </div>
  );
  const marketPanel = (
    <section
      aria-label="Quest market"
      className="rounded-2xl border border-line-soft bg-sunk px-[18px] pt-4 pb-[18px]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-xl font-bold">Quests</h2>
        <span className="text-[13px] text-muted">
          {mode === 'rush'
            ? 'Rushing: you may discard one card before you move.'
            : 'Take one your age or younger. Costs include your discounts.'}
        </span>
      </div>
      <Market
        state={state}
        viewer={viewer}
        myTurn={myTurn}
        rushMode={mode === 'rush'}
        selected={choice?.kind === 'quest' ? choice.cardId : null}
        discard={choice?.kind === 'rush' ? (choice.discardCardId ?? null) : null}
        onPick={pick}
        armed={armed}
        registerCard={(id, el) => (el ? cardEls.current.set(id, el) : cardEls.current.delete(id))}
        focusId={focusId}
        onCardKey={onCardKey}
      />
    </section>
  );
  const actionBar = (
    <ActionBar
      myTurn={myTurn}
      mode={mode}
      rushTarget={rt}
      onQuest={() => {
        setMode('quest');
        if (choice?.kind === 'rush') setChoice(null);
      }}
      onRush={() => {
        if (mode === 'rush') {
          setMode(null);
          setChoice(null);
        } else {
          setMode('rush');
          setChoice({ kind: 'rush' });
        }
      }}
      toggles={toggles}
      previewText={
        myTurn
          ? pv.text
          : pendingMine
            ? 'Resolve the swap first.'
            : thinkingId
              ? `${P(state, thinkingId).name} is thinking…`
              : pv.text
      }
      previewNext={pv.next}
      canUndo={snap.canUndo}
      onUndo={() => client.undo()}
      confirmLabel={confirmLabel}
      confirmDisabled={!myTurn || !choice}
      onConfirm={confirm}
      sticky={phone}
    />
  );
  const yourLife = me && (
    <section
      className="rounded-2xl border border-line bg-surface p-4"
      aria-label="Your life"
      data-testid="your-life"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 font-display text-xl font-bold">
          {humans.size > 1 ? `${me.name}'s life` : 'Your life'}
        </h2>
        <span className="font-mono text-xs font-medium text-muted">
          space {me.position} · {me.arrivalOrder ? 'through' : ageLabel(state, me.position)}
        </span>
      </div>
      <p className="mt-1 mb-3 text-[13px] text-muted">
        {me.arrivalOrder
          ? `Through the Doorway, keeping ${me.doorwayAllowance}.`
          : `${state.ruleset.trackLength - me.position} years to the Doorway. Newest memory on top.`}
      </p>
      <TowerList
        state={state}
        p={me}
        newest={
          snap.events.some((e) => e.type === 'quest_taken' && e.playerId === me.id)
            ? me.tower[me.tower.length - 1]
            : null
        }
      />
      <div className="mt-3.5 flex flex-col gap-2 text-[13px]">
        <div>
          <span className="text-muted">Experience</span>
          <br />
          {discountSummary(state, me).join(' · ') ||
            `None yet — ${state.ruleset.experienceStep} discs of a domain = 1 year off`}
        </div>
        <div>
          <span className="text-muted">Powers</span>
          <br />
          {powersOf(state, me)
            .map((x) => `${x.card.name} — ${x.state}`)
            .join(' · ') || 'None yet'}
        </div>
      </div>
    </section>
  );
  const walked = me && <IfYouWalked state={state} pid={me.id} />;
  const log = (
    <div className="rounded-[14px] border border-line bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="m-0 font-display text-base font-bold">Move log</h2>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          Bot speed
          <select
            value={client.setup.botSpeed}
            onChange={(e) => {
              client.setBotSpeed(e.target.value as BotSpeed);
              saveSettings({ botSpeed: e.target.value as BotSpeed });
            }}
            className="min-h-8 rounded-lg border border-line bg-ink px-1.5 text-text"
            data-testid="bot-speed"
          >
            {(Object.keys(BOT_SPEEDS) as BotSpeed[]).map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol
        className="m-0 flex max-h-[320px] list-none flex-col gap-1.5 overflow-y-auto p-0 text-[13px]"
        data-testid="move-log"
        aria-live="polite"
      >
        {fullLog(state)
          .slice(-40)
          .reverse()
          .map((t, i) => (
            <li key={i} style={{ color: i === 0 ? 'var(--text)' : 'var(--muted)' }}>
              {t}
            </li>
          ))}
      </ol>
    </div>
  );
  const bannerEl = (
    <TurnBanner {...b} thinking={!!thinkingId} sameAsBefore={b.title.startsWith('You go again')} />
  );
  const rules = rulesOpen && (
    <div className="rounded-2xl bg-surface-2 px-[18px] py-4">
      <RulesReference r={state.ruleset} players={state.players.length} />
    </div>
  );
  const errBox = err && (
    <p role="alert" className="m-0 rounded-xl border border-alert px-3 py-2 text-sm text-alert">
      {err}
    </p>
  );

  if (phone)
    return (
      <div className="pb-4">
        <header className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
          <a href="/" className="font-display text-[17px] font-extrabold text-text no-underline">
            Doorway
          </a>
          <span className="font-mono text-[11px] font-medium text-muted">turn {state.turn + 1}</span>
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Rules"
            onClick={() => setRulesOpen(!rulesOpen)}
            className="h-11 w-11 rounded-xl border border-line bg-surface font-bold text-text"
          >
            ?
          </button>
          <a
            href={`/replay?id=${stored.id}`}
            aria-label="Replay"
            className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-text no-underline"
          >
            ⟲
          </a>
        </header>
        <div className="flex flex-col gap-3 px-4 pt-3">
          {bannerEl}
          {rules}
          {tipBox}
          {errBox}
        </div>
        <section aria-label="Life track" className="px-4 pt-3.5">
          <OverviewBar state={view} current={cp} />
          <NearStrip state={view} viewer={viewer} current={cp} ghost={ghost?.space ?? null} />
        </section>
        <QueueChips entries={q} thinking={thinkingId} />
        {swapPanel ? (
          <div className="px-4 pt-3">{swapPanel}</div>
        ) : (
          <PhoneMarket
            state={state}
            viewer={viewer}
            myTurn={myTurn}
            rushMode={mode === 'rush'}
            selected={choice?.kind === 'quest' ? choice.cardId : null}
            discard={choice?.kind === 'rush' ? (choice.discardCardId ?? null) : null}
            onPick={pick}
            armed={armed}
          />
        )}
        <div className="flex flex-col gap-3 px-4 pt-3">
          {windowNudge}
          {yourLife}
          {walked}
          <section aria-label="Other players" className="rounded-2xl bg-sunk p-3.5">
            <h2 className="m-0 mb-2 text-sm">Other towers</h2>
            {state.players
              .filter((p) => p.id !== viewer)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-[54px] text-[13px] font-bold">{p.name}</span>
                  <span className="flex flex-wrap gap-0.5">
                    {p.tower.map((id, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-full"
                        style={{ background: DOMAIN[state.cards[id].color].css }}
                        title={DOMAIN[state.cards[id].color].name}
                      />
                    ))}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted">sp {p.position}</span>
                </div>
              ))}
          </section>
          {log}
        </div>
        <div className="sticky bottom-0 z-20 mt-3 px-2 pb-2">{actionBar}</div>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1440px] pb-7">
      {header}
      <Track state={view} current={cp} ghost={ghost} flash={anim.passed} />
      <div className="flex flex-wrap items-start gap-5 px-4 pt-3.5 md:px-7">
        <aside
          aria-label="Turn order and players"
          className="flex max-w-[330px] min-w-0 flex-[1_1_280px] flex-col gap-3"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 font-display text-lg font-bold">Who moves next</h2>
            <span className="text-xs text-muted">furthest back first</span>
          </div>
          {q.map((e) => (
            <QueueCard
              key={e.player.id}
              state={state}
              e={e}
              thinking={thinkingId === e.player.id}
              options={snap.thinking?.options}
              choosing={e.current && !e.player.isBot && !myTurn}
            />
          ))}
          {log}
        </aside>
        <main className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          {bannerEl}
          {tipBox}
          {rules}
          {errBox}
          {windowNudge}
          {swapPanel || marketPanel}
          {actionBar}
        </main>
        <aside aria-label="Your life" className="flex max-w-[340px] min-w-0 flex-[1_1_290px] flex-col gap-3">
          {yourLife}
          {walked}
        </aside>
      </div>
    </div>
  );
}

function useClientSnap(client: GameClient) {
  const s = useClient(client);
  return s ?? client.getSnapshot();
}

function ageLabel(state: GameState, pos: number) {
  for (const a of AGES)
    if (pos >= state.ruleset.ageBands[a][0] && pos <= state.ruleset.ageBands[a][1])
      return a[0].toUpperCase() + a.slice(1);
  return '';
}

function needs(state: GameState, pid: PlayerId, cardId: string) {
  // ask the engine which once-per-game powers this card would use
  const p = P(state, pid);
  const c = state.cards[cardId];
  const ageOrder = ['young', 'middle', 'old'];
  const myAge = ageLabel(state, p.position).toLowerCase();
  const ageReach = ageOrder.indexOf(c.age) === ageOrder.indexOf(myAge) + 1;
  let have = 0;
  if (c.requires) for (const id of p.tower) if (state.cards[id].color === c.requires.color) have++;
  const ignoreReq = !!c.requires && have < c.requires.count;
  return { ageReach, ignoreReq };
}

function othersLine(state: GameState, pid: PlayerId) {
  const through = state.players
    .filter((p) => p.id !== pid && p.arrivalOrder !== null)
    .map(
      (p) =>
        `${p.name} (${p.arrivalOrder}${['st', 'nd', 'rd', 'th'][Math.min(3, p.arrivalOrder! - 1)]}${p.keptRange ? `, kept ${p.keptRange[1] - p.keptRange[0] + 1} of ${p.tower.length}` : ''})`,
    );
  const path = state.players.filter((p) => p.arrivalOrder === null).map((p) => `${p.name} at ${p.position}`);
  return `${through.length ? `Already through: ${through.join(', ')}. ` : ''}${path.length ? `Still on the path: ${path.join(', ')}.` : 'Everyone else is through.'}`;
}

/** "If you walked through now": best window under the expected tile (score preview always live, R35). */
function IfYouWalked({ state, pid }: { state: GameState; pid: PlayerId }) {
  const p = P(state, pid);
  const n = state.players.length;
  const order = p.arrivalOrder ?? state.arrivals.length + 1;
  const tile =
    p.doorwayAllowance ??
    (n === 1 ? state.ruleset.solo.doorway : (state.ruleset.doorway[String(n)]?.[order - 1] ?? 0)) +
      p.tower.filter((id) => state.cards[id].power?.type === 'doorway_bonus').length;
  const w = bestWindowFor(state.ruleset, state.cards, p.tower, tile);
  const sc = p.keptRange
    ? scoreCards(state.ruleset, state.cards, p.tower.slice(p.keptRange[0], p.keptRange[1] + 1))
    : w.score;
  const text =
    p.tower.length <= tile
      ? `Your ${p.tower.length} discs fit inside the next tile (${tile}). The cut comes later.`
      : `Your ${p.tower.length} discs are taller than the next tile (${tile}); the best stretch is discs ${w.start + 1}–${w.end + 1}.`;
  return (
    <Panel border="var(--door)" label="If you walked through now">
      <h2 className="m-0 mb-1 font-display text-base font-bold">
        {p.keptRange ? 'Through the Doorway' : 'If you walked through now'}
      </h2>
      <p className="m-0 mb-2.5 text-[13px] text-muted">
        {p.keptRange ? `Kept discs ${p.keptRange[0] + 1}–${p.keptRange[1] + 1}.` : text}
      </p>
      <ScoreTiles sc={sc} />
    </Panel>
  );
}

/** Swap prompt (spec §8.3): click a gap to swap, with the Passion and Full life effect of each swap. */
function SwapPrompt({
  state,
  pid,
  onSwap,
  onSkip,
}: {
  state: GameState;
  pid: PlayerId;
  onSwap: (i: number) => void;
  onSkip: () => void;
}) {
  const p = P(state, pid);
  const src = state.pending!.queue[0];
  const base = scoreCards(state.ruleset, state.cards, p.tower);
  const options = p.tower.slice(0, -1).map((_, i) => {
    const t = p.tower.slice();
    [t[i], t[i + 1]] = [t[i + 1], t[i]];
    const s = scoreCards(state.ruleset, state.cards, t);
    return { i, passion: s.passion, run: s.passionRun, fullLife: s.fullLife, total: s.total };
  });
  const [hover, setHover] = useState<number | null>(null);
  const h = hover !== null ? options[hover] : null;
  return (
    <section
      aria-label="Swap"
      className="rounded-2xl border border-door bg-surface p-5"
      data-testid="swap-prompt"
    >
      <h2 className="m-0 font-display text-xl font-bold">
        {src.source === 'diary'
          ? 'Keep a diary: you may swap two adjacent discs.'
          : `Milestone ${src.space} reached: you may swap two adjacent discs.`}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Click the gap between two discs to swap them, or skip.{' '}
        {state.pending!.queue.length > 1
          ? `${state.pending!.queue.length - 1} more swap${state.pending!.queue.length > 2 ? 's' : ''} after this one.`
          : ''}
      </p>
      <div className="flex flex-wrap gap-6">
        <div className="min-w-[260px] flex-1">
          <TowerList
            state={state}
            p={p}
            onGap={(i) => onSwap(i)}
            gapLabel={(i) =>
              `Swap discs ${i + 1} and ${i + 2}: Passion ${base.passion} → ${options[i].passion}, Full life ${base.fullLife} → ${options[i].fullLife}`
            }
          />
        </div>
        <div className="min-w-[240px] flex-1">
          <h3 className="m-0 mb-2 text-sm">Effect on your whole tower</h3>
          <div className="flex flex-col gap-1">
            {options
              .slice()
              .reverse()
              .map((o) => (
                <button
                  key={o.i}
                  type="button"
                  onMouseEnter={() => setHover(o.i)}
                  onFocus={() => setHover(o.i)}
                  onClick={() => onSwap(o.i)}
                  className="grid min-h-[36px] cursor-pointer items-center gap-2 rounded-[10px] border border-line-soft bg-transparent px-2 text-left text-[13px] text-text"
                  style={{ gridTemplateColumns: '100px 1fr 1fr' }}
                  data-testid={`swap-${o.i}`}
                >
                  <span className="font-mono text-xs">
                    discs {o.i + 1} ⇅ {o.i + 2}
                  </span>
                  <span style={{ color: o.passion !== base.passion ? 'var(--door)' : 'var(--muted)' }}>
                    Passion {base.passion} → {o.passion}
                  </span>
                  <span style={{ color: o.fullLife !== base.fullLife ? 'var(--door)' : 'var(--muted)' }}>
                    Full life {base.fullLife} → {o.fullLife}
                  </span>
                </button>
              ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {h
              ? `With that swap your longest run is ${h.run}.`
              : `Longest run now: ${base.passionRun}. Full life sets: ${base.fullLifeSets}.`}
          </p>
          <Button onClick={onSkip} testId="skip-swap">
            Skip the swap
          </Button>
        </div>
      </div>
    </section>
  );
}
