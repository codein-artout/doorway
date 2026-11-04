'use client';
// The table controller: everything both views (Board, Analyst) need to play — selection, previews, power
// toggles, undo, keyboard, tips and Doorway routing. Views only render it; switching views never resets it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AGES,
  ageIndex,
  ageOf,
  currentPlayer,
  serialize,
  type GameState,
  type Move,
  type PlayerId,
} from '@doorway/engine';
import type { ClientSnapshot, GameClient } from './game-client';
import { loadTipsSeen, saveCurrent, saveFinished, saveTipsSeen, type StoredGame } from './storage';
import {
  banner,
  choiceToMove,
  P,
  powersOf,
  preview,
  queue,
  rushLanding,
  tipsFrom,
  type Choice,
  type TipKind,
} from './table-model';
import { hintSettings } from './ui-rules';
import { useAnimatedState, useClient } from './use-game';

export type PowerToggle = {
  key: 'ageReach' | 'ignoreReq';
  label: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
};

/** Which once-per-game powers a card would need for this player (R17/R18). */
export function needs(state: GameState, pid: PlayerId, cardId: string) {
  const p = P(state, pid);
  const c = state.cards[cardId];
  const myAge = ageOf(state.ruleset, p.position);
  const ageReach = myAge !== null && ageIndex(c.age) === ageIndex(myAge) + 1;
  let have = 0;
  if (c.requires) for (const id of p.tower) if (state.cards[id].color === c.requires.color) have++;
  const ignoreReq = !!c.requires && have < c.requires.count;
  return { ageReach, ignoreReq };
}

export type TableController = ReturnType<typeof useTable>;

export function useTable(client: GameClient, stored: StoredGame, opts: { keyboard?: boolean } = {}) {
  const snap: ClientSnapshot = useClient(client) ?? client.getSnapshot();
  const anim = useAnimatedState(snap);
  const state = snap.state;
  const shown = anim.state ?? state; // what the board draws (pawns mid-hop)
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
  const cardEls = useRef(new Map<string, HTMLElement>());
  const [err, setErr] = useState<string | null>(null);

  // persist after every change
  useEffect(() => {
    const g: StoredGame = {
      id: stored.id,
      savedAt: new Date().toISOString(),
      setup: client.setup,
      replay: client.toReplay(),
      ...(stored.state !== undefined ? { state: serialize(state) } : {}),
    };
    saveCurrent(g);
    if (state.phase === 'over') saveFinished(g);
  }, [snap, client, stored.id, stored.state, state]);

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
  const pendingMine =
    state.phase === 'pending_choice' && !!state.pending && humans.has(state.pending.playerId);

  const submit = useCallback(
    (pid: PlayerId, m: Move) => {
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
    setChoice({ kind: 'quest', cardId: id });
  };
  const chooseQuest = () => {
    setMode('quest');
    if (choice?.kind === 'rush') setChoice(null);
  };
  const chooseRush = () => {
    if (mode === 'rush') {
      setMode(null);
      setChoice(null);
    } else {
      setMode('rush');
      setChoice({ kind: 'rush' });
    }
  };
  const setDiscard = (id: string | null) => {
    if (!myTurn) return;
    setMode('rush');
    setChoice({ kind: 'rush', ...(id ? { discardCardId: id } : {}) });
  };

  /** The engine move for the current choice, with power flags set exactly as needed (R17/R18). */
  const moveFor = (c: Choice): Move | null => {
    if (!c || !viewer) return null;
    let m = choiceToMove(c)!;
    if (m.type === 'quest') {
      if (!state.market[state.cards[m.cardId].age].includes(m.cardId)) return null;
      const nd = needs(state, viewer, m.cardId);
      m = {
        type: 'quest',
        cardId: m.cardId,
        ...(nd.ageReach ? { useAgeReach: true } : {}),
        ...(nd.ignoreReq ? { useIgnoreReq: true } : {}),
      };
    }
    return m;
  };
  const selectedMove = moveFor(choice);
  const confirm = () => {
    if (!viewer || !myTurn || !selectedMove) return;
    submit(viewer, selectedMove);
  };
  const undo = () => {
    if (snap.canUndo) client.undo();
  };

  // keyboard: arrows move between cards, Enter quests, R rushes, U undoes, Esc closes (V is the view switch)
  const ids = AGES.flatMap((a) => state.market[a]).filter((x): x is string => !!x);
  useEffect(() => {
    if (opts.keyboard === false) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'SELECT' || t?.tagName === 'TEXTAREA') return;
      if (showDoorwayFor) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setChoice(null);
        setMode(null);
        setRulesOpen(false);
        setTip(null);
      } else if (k === 'u') undo();
      else if (k === 'r' && myTurn) {
        if (mode === 'rush') confirm();
        else {
          setMode('rush');
          setChoice({ kind: 'rush' });
        }
      } else if (k === 'enter' && choice && myTurn && !t?.dataset?.card) confirm();
      else if (
        ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) &&
        !t?.dataset?.card &&
        ids.length
      ) {
        setFocusId(ids[0]);
        cardEls.current.get(ids[0])?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const onCardKey = (e: React.KeyboardEvent, id: string) => {
    const i = ids.indexOf(id);
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
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
  const registerCard = (id: string, el: HTMLElement | null) =>
    el ? cardEls.current.set(id, el) : cardEls.current.delete(id);

  const again =
    snap.lastActor === cp && !!cp && humans.has(cp) && state.moves.length > 0 && state.lastActor === cp;
  const thinkingId = snap.thinking?.playerId ?? null;
  const ban = banner(state, viewer, again, !!thinkingId);
  const pv = viewer ? preview(state, viewer, choice) : { text: '', next: '', landing: null as number | null };
  const rushTarget = viewer && myTurn ? rushLanding(state, viewer) : null;
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
  /** a card that needs a once-per-game power is only selectable while that power is ticked */
  const powerOk = (cardId: string) => {
    if (!viewer) return false;
    const nd = needs(state, viewer, cardId);
    return (!nd.ageReach || armed.ageReach) && (!nd.ignoreReq || armed.ignoreReq);
  };
  const ghost =
    myTurn && pv.landing !== null && me ? { space: pv.landing, initial: me.name[0].toUpperCase() } : null;
  const confirmLabel =
    mode === 'rush' && rushTarget !== null
      ? `Rush to ${rushTarget}`
      : choice?.kind === 'quest'
        ? 'Take this quest'
        : 'Choose a move';

  return {
    client,
    stored,
    snap,
    anim,
    state,
    shown,
    humans,
    hints,
    cp,
    viewer,
    me,
    myTurn,
    again,
    choice,
    setChoice,
    mode,
    setMode,
    armed,
    rulesOpen,
    setRulesOpen,
    windowFor,
    setWindowFor,
    tip,
    setTip,
    err,
    waitingWindow,
    humanToMove,
    showDoorwayFor,
    pendingMine,
    submit,
    pick,
    chooseQuest,
    chooseRush,
    setDiscard,
    selectedMove,
    moveFor,
    confirm,
    undo,
    onCardKey,
    registerCard,
    focusId,
    banner: ban,
    preview: pv,
    rushTarget,
    toggles,
    powerOk,
    ghost,
    confirmLabel,
    thinkingId,
    queue: queue(state),
  };
}
