// The table talks to a game only through GameClient. Tonight there is a local implementation (engine in the
// browser, bots in a Web Worker). A networked client (server-authoritative engine, R32 online undo) can
// implement the same interface later without touching the UI.

import { bestWindowMove, policyIdFor, type Skill } from '@doorway/bots';
import { chooseBotMove } from './bot-move';
import {
  apply,
  currentPlayer,
  init,
  legalMoves,
  replay as engineReplay,
  toReplay,
  type Card,
  type GameEvent,
  type GameState,
  type Move,
  type PlayerId,
  type Replay,
  type Ruleset,
} from '@doorway/engine';
import { BOT_SPEEDS, type BotSpeed } from './ui-rules';

export type SeatConfig = { name: string; kind: 'human' | 'bot'; strategy?: string; skill?: Skill };

export type GameSetup = {
  seats: SeatConfig[];
  ruleset: Ruleset;
  seed: string;
  botSpeed: BotSpeed;
  blind: boolean;
};

export type ClientSnapshot = {
  state: GameState;
  /** events produced by the most recent change (for animation and tips) */
  events: GameEvent[];
  /** a bot that is computing its move right now */
  thinking: { playerId: PlayerId; options: number } | null;
  canUndo: boolean;
  /** how many moves have been applied */
  moveIndex: number;
  /** the actor who made the most recent move */
  lastActor: PlayerId | null;
};

export interface GameClient {
  readonly setup: GameSetup;
  getSnapshot(): ClientSnapshot;
  subscribe(listener: () => void): () => void;
  /** Submit a move for a human seat. Throws IllegalMoveError if the engine refuses it. */
  submit(move: Move, playerId: PlayerId): void;
  undo(): void;
  setBotSpeed(speed: BotSpeed): void;
  toReplay(): Replay & { setup: Omit<GameSetup, 'ruleset'> };
  /** every state so far (oldest first) with the think time of the move that produced it */
  timeline(): { states: GameState[]; thinkMs: (number | null)[] };
  dispose(): void;
}

export const policyOf = (seat: SeatConfig) => policyIdFor(seat.strategy ?? 'greedy', seat.skill ?? 'normal');

export function seatsToPlayers(seats: SeatConfig[]) {
  return seats.map((s, i) => ({
    id: `p${i + 1}`,
    name: s.name,
    isBot: s.kind === 'bot',
    ...(s.kind === 'bot' ? { botPolicy: policyOf(s) } : {}),
  }));
}

export { chooseBotMove };

type Compute = (state: GameState, playerId: PlayerId) => Promise<Move>;

/** Compute bot moves in a Web Worker when available, else inline. */
export function workerCompute(): { compute: Compute; dispose: () => void } {
  if (typeof window === 'undefined' || typeof Worker === 'undefined')
    return { compute: async (s, p) => chooseBotMove(s, p), dispose: () => {} };
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('../workers/bot.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (!worker) return { compute: async (s, p) => chooseBotMove(s, p), dispose: () => {} };
  const w = worker;
  let next = 0;
  const pending = new Map<number, (m: Move) => void>();
  const failed = new Map<number, () => void>();
  w.onmessage = (e: MessageEvent<{ id: number; move?: Move; error?: string }>) => {
    const { id, move } = e.data;
    if (move) pending.get(id)?.(move);
    else failed.get(id)?.();
    pending.delete(id);
    failed.delete(id);
  };
  return {
    compute: (state, playerId) =>
      new Promise<Move>((resolve) => {
        const id = ++next;
        pending.set(id, resolve);
        failed.set(id, () => resolve(chooseBotMove(state, playerId)));
        w.postMessage({ id, state, playerId });
      }),
    dispose: () => w.terminate(),
  };
}

export class LocalGameClient implements GameClient {
  readonly setup: GameSetup;
  private cards: Card[];
  private states: GameState[];
  /** which moves (by index into state.moves) were made by a human */
  private humanMoves: boolean[];
  private lastEvents: GameEvent[] = [];
  private thinking: ClientSnapshot['thinking'] = null;
  private listeners = new Set<() => void>();
  private gen = 0;
  private snap: ClientSnapshot;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private computer: { compute: Compute; dispose: () => void };
  private disposed = false;
  /** states before `start` (demo), shown in the timeline but never undone into */
  private prelude: GameState[] = [];
  private preludeThink: (number | null)[] = [];
  /** think time (ms) of the move that produced states[i]; null when unknown */
  private thinkMs: (number | null)[] = [null];
  private turnStarted = Date.now();
  onChange?: (c: LocalGameClient) => void;

  constructor(
    setup: GameSetup,
    cards: Card[],
    opts: {
      from?: Replay;
      start?: GameState;
      /** with `start`: the position `start.moves` were played from, so the timeline can show the moves before `start` */
      base?: GameState;
      /** think times (ms) for the quest/rush moves before `start`, in order (the demo's) */
      baseThinkMs?: (number | null)[];
      compute?: { compute: Compute; dispose: () => void };
    } = {},
  ) {
    this.setup = setup;
    this.cards = cards;
    this.computer = opts.compute ?? workerCompute();
    const players = seatsToPlayers(setup.seats);
    if (opts.start) {
      // start from a given position (the v2 demo); moves before it cannot be undone
      this.states = [opts.start];
      this.humanMoves = [];
      if (opts.base) {
        const pre: GameState[] = [opts.base];
        const think: (number | null)[] = [null];
        let k = 0;
        for (const pm of opts.start.moves.slice(opts.base.moves.length)) {
          pre.push(apply(pre[pre.length - 1], pm.move, pm.playerId).state);
          think.push(
            pm.move.type === 'quest' || pm.move.type === 'rush' ? (opts.baseThinkMs?.[k++] ?? null) : null,
          );
        }
        // the last rebuilt state is `start` itself
        this.prelude = pre.slice(0, -1);
        this.preludeThink = think.slice(0, -1);
        this.thinkMs = [think[think.length - 1]];
      }
    } else if (opts.from) {
      const r = engineReplay(opts.from, { ruleset: setup.ruleset, cards }, { keepStates: true });
      this.states = r.states!;
      this.humanMoves = opts.from.moves.map((m) => !players.find((p) => p.id === m.playerId)?.isBot);
      this.thinkMs = this.states.map(() => null);
    } else {
      this.states = [init(setup.ruleset, cards, players, setup.seed)];
      this.humanMoves = [];
    }
    this.snap = this.makeSnap();
    this.afterChange();
  }

  get state(): GameState {
    return this.states[this.states.length - 1];
  }

  private makeSnap(): ClientSnapshot {
    const s = this.state;
    const last = s.moves[s.moves.length - 1];
    return {
      state: s,
      events: this.lastEvents,
      thinking: this.thinking,
      canUndo:
        this.humanMoves.some(Boolean) ||
        (this.states.length > 1 && this.setup.seats.every((x) => x.kind === 'bot')),
      moveIndex: s.moves.length,
      lastActor: last?.playerId ?? null,
    };
  }

  getSnapshot = () => this.snap;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit() {
    this.snap = this.makeSnap();
    this.listeners.forEach((l) => l());
    this.onChange?.(this);
  }

  private push(move: Move, playerId: PlayerId, human: boolean, ms: number | null = null): GameEvent[] {
    const { state, events } = apply(this.state, move, playerId);
    this.states.push(state);
    this.humanMoves.push(human);
    this.thinkMs.push(ms);
    return events;
  }

  submit(move: Move, playerId: PlayerId): void {
    const p = this.state.players.find((x) => x.id === playerId);
    if (!p || p.isBot) throw new Error('Only human seats submit moves.');
    this.lastEvents = this.push(move, playerId, true, Date.now() - this.turnStarted);
    this.afterChange();
  }

  private isBot(id: PlayerId) {
    return !!this.state.players.find((p) => p.id === id)?.isBot;
  }

  /** After any change: bots pick their windows at once (R25), then the next bot move is scheduled. */
  private afterChange() {
    if (this.disposed) return;
    let more: GameEvent[] = [];
    for (const p of this.state.players)
      if (p.isBot && p.arrivalOrder !== null && p.keptRange === null)
        more = more.concat(this.push(bestWindowMove(this.state, p.id), p.id, false));
    if (more.length) this.lastEvents = this.lastEvents.concat(more);
    this.thinking = null;
    this.turnStarted = Date.now();
    const cp = currentPlayer(this.state);
    if (cp && this.isBot(cp)) this.scheduleBot(cp);
    this.emit();
  }

  private scheduleBot(pid: PlayerId) {
    const gen = ++this.gen;
    const state = this.state;
    this.thinking = { playerId: pid, options: legalMoves(state, pid).length };
    const delay = BOT_SPEEDS[this.setup.botSpeed];
    const started = Date.now();
    this.computer.compute(state, pid).then((move) => {
      if (gen !== this.gen || this.disposed) return;
      const ms = Date.now() - started;
      const wait = Math.max(0, delay - (Date.now() - started));
      this.timer = setTimeout(() => {
        if (gen !== this.gen || this.disposed) return;
        this.lastEvents = this.push(move, pid, false, ms);
        this.afterChange();
      }, wait);
    });
  }

  /** R32 (local): unlimited undo. Reverts the last human move and every bot move after it. */
  undo(): void {
    this.gen++;
    if (this.timer) clearTimeout(this.timer);
    const allBots = this.setup.seats.every((x) => x.kind === 'bot');
    if (allBots) {
      if (this.states.length > 1) {
        this.states.pop();
        this.humanMoves.pop();
        this.thinkMs.pop();
      }
    } else {
      const last = this.humanMoves.lastIndexOf(true);
      if (last < 0) return;
      this.states.length = last + 1;
      this.humanMoves.length = last;
      this.thinkMs.length = last + 1;
    }
    this.lastEvents = [];
    this.thinking = null;
    // do not auto-replay bot moves until the human acts, unless a bot is to move
    this.afterChange();
  }

  setBotSpeed(speed: BotSpeed): void {
    this.setup.botSpeed = speed;
    this.emit();
  }

  toReplay() {
    const r = toReplay(this.state, true);
    const { ruleset: _r, ...setup } = this.setup;
    return { ...r, setup };
  }

  /** Every intermediate state (for the replay viewer). */
  history(): GameState[] {
    return this.states.slice();
  }

  /** Every state from the first known position (including the demo's moves before `start`), with think times. */
  timeline(): { states: GameState[]; thinkMs: (number | null)[] } {
    return {
      states: [...this.prelude, ...this.states],
      thinkMs: [...this.preludeThink, ...this.thinkMs],
    };
  }

  dispose(): void {
    this.disposed = true;
    this.gen++;
    if (this.timer) clearTimeout(this.timer);
    this.computer.dispose();
    this.listeners.clear();
  }
}
