import { describe, expect, it } from 'vitest';
import {
  apply,
  bestWindow,
  costBreakdown,
  currentPlayer,
  gameHistory,
  init,
  isOver,
  legalMoves,
  previewMove,
  Rng,
  scoreCards,
  scoreIfWalkedNow,
  turnOrder,
  windowScores,
  type GameState,
} from '../src/index';
import { CARDS, DEFAULT_RULESET, P, play, q, rush, scen, seats, skipSwaps } from './helpers';

function randomGame(seed: string, n = 4): GameState {
  let s = init(DEFAULT_RULESET, CARDS, seats(n), seed);
  const rng = Rng.fromSeed('d|' + seed);
  while (!isOver(s)) {
    const pid = currentPlayer(s)!;
    s = apply(s, rng.pick(legalMoves(s, pid)), pid).state;
  }
  return s;
}

describe('v2 analysis hooks (additive)', () => {
  it('costBreakdown splits printed − experience − power − next-quest, floored', () => {
    const s = scen(2, {
      market: { middle: ['GD-M2', 'PU-M2'] },
      players: {
        p1: { position: 20, tower: ['GD-Y1', 'GD-Y2', 'PU-M1'], pendingNextQuestDiscount: 2 },
        p2: { position: 30 },
      },
      stacks: { 20: ['p1'], 30: ['p2'] },
    });
    expect(costBreakdown(s, 'p1', 'GD-M2')).toEqual({
      printed: 5,
      experience: 1,
      power: 1,
      nextQuest: 2,
      cost: 1,
    });
  });

  it('previewMove: landing, the pawn under you, who goes next, the queue after, Δ now — and the state is untouched', () => {
    const s = scen(3, {
      market: { young: ['PK-Y3', 'PK-Y1', 'GD-Y1'] },
      players: {
        p1: { position: 11, tower: ['PK-Y5', 'PK-Y4'] },
        p2: { position: 12 },
        p3: { position: 13 },
      },
      stacks: { 11: ['p1'], 12: ['p2'], 13: ['p3'] },
    });
    const before = JSON.stringify(s);
    const pv = previewMove(s, q('PK-Y3'));
    expect(JSON.stringify(s)).toBe(before);
    // 3 − Love 1 = 2 years → 13, on top of p3; p2 (12) is next
    expect(pv).toMatchObject({
      landing: 13,
      onTopOf: 'p3',
      nextPlayer: 'p2',
      queueAfter: ['p2', 'p1', 'p3'],
      arrives: false,
      again: false,
    });
    // Δ now: Love run of 3 (+3 Passion) + 2 card points
    expect(pv.scoreDeltaNow).toBe(
      scoreIfWalkedNow(s, ['PK-Y5', 'PK-Y4', 'PK-Y3']).total - scoreIfWalkedNow(s, ['PK-Y5', 'PK-Y4']).total,
    );
    expect(pv.scoreDeltaNow).toBe(5);
    // the real move agrees
    const t = play(s, q('PK-Y3'));
    expect(P(t, 'p1').position).toBe(pv.landing);
    expect(currentPlayer(t)).toBe(pv.nextPlayer);
    expect(turnOrder(t)).toEqual(pv.queueAfter);
    // a rush: Δ 0, lands just past the nearest pawn ahead
    expect(previewMove(s, rush())).toMatchObject({ landing: 13, onTopOf: 'p3', scoreDeltaNow: 0 });
  });

  it('previewMove agrees with apply on every legal quest/rush over random games (swaps skipped)', () => {
    for (let g = 0; g < 30; g++) {
      let s = init(DEFAULT_RULESET, CARDS, seats(2 + (g % 3)), 'pv' + g);
      const rng = Rng.fromSeed('pv' + g);
      while (!isOver(s)) {
        const pid = currentPlayer(s)!;
        const ms = legalMoves(s, pid);
        if (s.phase === 'playing')
          for (const m of ms.filter((x) => x.type !== 'choose_window').slice(0, 4)) {
            const pv = previewMove(s, m, pid);
            let t = apply(s, m, pid).state;
            t = skipSwaps(t);
            expect(P(t, pid).position).toBe(pv.landing);
            expect(turnOrder(t)).toEqual(pv.queueAfter);
          }
        s = apply(s, rng.pick(ms), pid).state;
      }
    }
  });

  it('windowScores lists every maximal window with its parts; the best matches bestWindow', () => {
    for (let g = 0; g < 20; g++) {
      const s = randomGame('ws' + g);
      for (const p of s.players) {
        const rows = windowScores(s, p.tower, p.doorwayAllowance!);
        const len = Math.min(p.doorwayAllowance!, p.tower.length);
        expect(rows.length).toBe(Math.max(1, p.tower.length - len + 1));
        for (const r of rows) {
          expect(r.end - r.start + 1).toBe(len);
          expect(r.total).toBe(r.cards + r.fullLife + r.passion + r.reflection);
          expect(r.total).toBe(scoreCards(s.ruleset, s.cards, p.tower.slice(r.start, r.end + 1)).total);
        }
        const b = bestWindow(s, p.id);
        const best = rows.find((r) => r.best)!;
        expect([best.start, best.total]).toEqual([b.start, b.score.total]);
        expect(Math.max(...rows.map((r) => r.vsBest))).toBe(0);
      }
    }
    expect(windowScores(DEFAULTS(), [], 9)).toHaveLength(1);
  });

  it('gameHistory: one point per turn with positions and score-if-walked-now, ending at the final state', () => {
    const s = randomGame('hist', 3);
    const h = gameHistory(s);
    expect(h[0].turn).toBe(0);
    expect(Object.values(h[0].positions)).toEqual([0, 0, 0]);
    expect(h[h.length - 1].turn).toBe(s.turn);
    expect(h.length).toBe(s.turn + 1);
    for (const p of s.players) {
      expect(h[h.length - 1].positions[p.id]).toBe(p.position);
      expect(h[h.length - 1].scoreNow[p.id]).toBe(scoreIfWalkedNow(s, p.tower).total);
    }
    // positions never go backward
    for (let i = 1; i < h.length; i++)
      for (const p of s.players)
        expect(h[i].positions[p.id]).toBeGreaterThanOrEqual(h[i - 1].positions[p.id]);
  });
});

function DEFAULTS() {
  return { ruleset: DEFAULT_RULESET, cards: Object.fromEntries(CARDS.map((c) => [c.id, c])) };
}
