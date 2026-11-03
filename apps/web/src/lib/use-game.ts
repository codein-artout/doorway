'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameState, PlayerId } from '@doorway/engine';
import type { ClientSnapshot, GameClient } from './game-client';

export function useClient(client: GameClient | null): ClientSnapshot | null {
  return useSyncExternalStore(
    (l) => (client ? client.subscribe(l) : () => {}),
    () => (client ? client.getSnapshot() : null),
    () => null,
  );
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Display a pawn at an interim space (DESIGN.md §4: hop 60 ms/space, ≤ 900 ms; a Rush glides once in 300 ms). */
function withPawnAt(s: GameState, pid: PlayerId, pos: number): GameState {
  const stacks: GameState['stacks'] = {};
  for (const [k, v] of Object.entries(s.stacks)) {
    const arr = v.filter((x) => x !== pid);
    if (arr.length) stacks[Number(k)] = arr;
  }
  (stacks[pos] ??= []).push(pid);
  return { ...s, stacks, players: s.players.map((p) => (p.id === pid ? { ...p, position: pos } : p)) };
}

export function useAnimatedState(snap: ClientSnapshot | null): {
  state: GameState | null;
  moving: PlayerId | null;
  passed: number[];
} {
  const [disp, setDisp] = useState<{ state: GameState | null; moving: PlayerId | null; passed: number[] }>({
    state: snap?.state ?? null,
    moving: null,
    passed: [],
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!snap) return;
    const ev = snap.events.find((e) => e.type === 'quest_taken' || e.type === 'rushed') as
      { type: string; playerId: PlayerId; from: number; to: number } | undefined;
    if (!ev || prefersReducedMotion() || ev.to <= ev.from) {
      setDisp({ state: snap.state, moving: null, passed: [] });
      return;
    }
    const s = snap.state;
    const ms = s.ruleset.milestones.filter((m) => m > ev.from && m <= ev.to);
    if (ev.type === 'rushed') {
      setDisp({ state: withPawnAt(s, ev.playerId, ev.from), moving: ev.playerId, passed: [] });
      timers.current.push(setTimeout(() => setDisp({ state: s, moving: null, passed: ms }), 300));
      timers.current.push(setTimeout(() => setDisp({ state: s, moving: null, passed: [] }), 800));
      return;
    }
    const dist = ev.to - ev.from;
    const step = Math.min(60, 900 / dist);
    setDisp({ state: withPawnAt(s, ev.playerId, ev.from), moving: ev.playerId, passed: [] });
    for (let i = 1; i <= dist; i++) {
      const pos = ev.from + i;
      timers.current.push(
        setTimeout(
          () =>
            setDisp({
              state: i === dist ? s : withPawnAt(s, ev.playerId, pos),
              moving: i === dist ? null : ev.playerId,
              passed: ms.filter((m) => m <= pos),
            }),
          step * i,
        ),
      );
    }
    timers.current.push(setTimeout(() => setDisp({ state: s, moving: null, passed: [] }), step * dist + 600));
    return () => timers.current.forEach(clearTimeout);
  }, [snap]);
  return disp.state ? disp : { state: snap?.state ?? null, moving: null, passed: [] };
}
