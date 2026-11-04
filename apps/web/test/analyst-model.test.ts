import { describe, expect, it } from 'vitest';
import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { type GameState, type Move, type PlayerId } from '@doorway/engine';
import { demoBase, demoState, DEMO_SEATS, DEMO_THINK_MS } from '../src/lib/demo';
import { LocalGameClient } from '../src/lib/game-client';
import { seatFromPlayer } from '../src/lib/import-export';
import {
  decisionRows,
  lastBotWhy,
  ledger,
  logRows,
  positionChart,
  previewLine,
  projection,
  scoreChart,
  turnPoints,
} from '../src/lib/analyst-model';

const noCompute = {
  // bots never answer in these tests
  compute: (): Promise<Move> => new Promise<Move>(() => {}),
  dispose: () => {},
};

function demoClient() {
  const st = demoState();
  return new LocalGameClient(
    {
      seats: DEMO_SEATS.map(seatFromPlayer),
      ruleset: DEFAULT_RULESET,
      seed: st.seed,
      botSpeed: 'instant',
      blind: false,
    },
    CARDS,
    { start: st, base: demoBase(), baseThinkMs: DEMO_THINK_MS, compute: noCompute },
  );
}

describe('Analyst decision table (DESIGN-v2 §4) on the demo position', () => {
  const s = demoState();
  const rows = decisionRows(s, 'p1', true);
  const row = (k: string) => rows.find((r) => r.key === k)!;

  it('has one row per face-up card plus Rush', () => {
    expect(rows.map((r) => r.key)).toEqual([
      'PK-Y3',
      'OR-Y5',
      'PU-Y3',
      'PU-M2',
      'GR-M2',
      'PK-O2',
      'OR-O3',
      'rush',
    ]);
  });

  it('PK-Y3: cost 2 after Love −1, lands 13 on top of Arun, Δ now +5, best for Greedy and Tempo', () => {
    const r = row('PK-Y3');
    expect([r.years, r.disc, r.cost, r.pts, r.ppy, r.lands]).toEqual([3, 1, 2, 2, '1.00', 13]);
    expect(r.next).toBe('Arun 12 · you stack on top');
    expect(r.delta).toBe(5);
    expect(r.bots).toBe('G#1 T#1');
    expect(r.discTitle).toContain('experience −1');
  });

  it('marks too-young and requirement rows illegal with the reason', () => {
    expect(row('PU-M2')).toMatchObject({ legal: false, age: 'from 14', next: 'too young' });
    expect(row('OR-O3')).toMatchObject({ legal: false, req: '✗ 2 Family' });
    expect(row('PK-O2').req).toBe('✓ 2 Love');
  });

  it('the Rush row lands past the nearest pawn ahead', () => {
    expect(row('rush')).toMatchObject({ legal: true, lands: 13, cost: 2, delta: 0 });
  });

  it('nothing is legal when it is not your turn', () => {
    expect(decisionRows(s, 'p3', false).every((r) => !r.legal && r.delta === null)).toBe(true);
  });

  it('the preview line reads like the mockup', () => {
    expect(previewLine(s, 'p1', true, { type: 'quest', cardId: 'PK-Y3' })).toBe(
      'PK-Y3 · cost 2 (3 − Love 1) · 11→13 · next: Arun 12 · you stack on top · Δ now +5',
    );
    expect(previewLine(s, 'p1', true, null)).toBe('Your move. 3 cards open to you, or rush to 13.');
    expect(previewLine(s, 'p3', false, null)).toBe('Priya is furthest back (11) and is choosing.');
  });
});

describe('Analyst ledger, timeline and charts', () => {
  it('ledger: scores now, discounts and the spread', () => {
    const l = ledger(demoState(), 'p1');
    expect(l.rows.map((r) => [r.name, r.role, r.pos, r.score])).toEqual([
      ['Priya', 'you', 11, 7],
      ['Arun', 'bot · Tempo', 12, 8],
      ['Meera', 'friend', 13, 4],
      ['Kavi', 'bot · Specialist', 15, 9],
    ]);
    expect(l.discLines[1]).toBe('Arun: Play −2, Family −1');
    expect(l.spread).toBe(4);
  });

  it('the demo timeline includes the 21 turns before the demo position, with their think times', () => {
    const c = demoClient();
    const pts = turnPoints(c.timeline());
    expect(pts).toHaveLength(22);
    expect(pts[21]).toMatchObject({ actor: 'p4', from: 11, to: 15, thinkMs: 41 });
    const s = c.getSnapshot().state;
    const log = logRows(s, pts);
    expect(log).toHaveLength(8);
    expect(log[0]).toMatchObject({
      t: 21,
      who: 'Kavi',
      move: 'Travel alone',
      path: '11→15',
      think: '41ms',
      newest: true,
    });
    expect(log[6]).toMatchObject({ who: 'Priya', move: 'Fall in love', think: '21.7s' });
    c.dispose();
  });

  it('projection: pace = mean years per quest; projected memories; loss at the door', () => {
    const c = demoClient();
    const pj = projection(c.getSnapshot().state, 'p1', turnPoints(c.timeline()));
    expect(pj.pace).toBeCloseTo(11 / 4);
    expect(pj.projected).toBe(4 + Math.round(29 / 2.75));
    expect([pj.tiles, pj.loseLo, pj.loseHi]).toEqual(['9–6', pj.projected - 9, pj.projected - 6]);
    c.dispose();
  });

  it('charts end on the current positions and walk-through scores', () => {
    const c = demoClient();
    const s = c.getSnapshot().state;
    const pts = turnPoints(c.timeline());
    const pos = positionChart(s, pts);
    expect(pos.lines.map((l) => l.last)).toEqual([11, 12, 13, 15]);
    expect(pos.yMax).toBe(20);
    expect(pos.lines[0].d.startsWith('M40 180')).toBe(true);
    const sc = scoreChart(s, pts);
    expect(sc.lines.map((l) => l.last)).toEqual([7, 8, 4, 9]);
    expect(sc.yMax % 4).toBe(0);
    c.dispose();
  });

  it('"Why Kavi did that" comes from the bot policy explain(), with the played move marked', () => {
    const c = demoClient();
    const why = lastBotWhy(turnPoints(c.timeline()))!;
    expect(why.bot).toBe('Kavi');
    expect(why.header).toMatch(/^turn 21 · specialist · \d+ options · 41 ms$/);
    const chosen = why.bars.filter((b) => b.chosen);
    expect(chosen).toHaveLength(1);
    expect(chosen[0].name).toBe('Travel alone');
    expect(why.bars.length).toBeLessThanOrEqual(4);
    c.dispose();
  });

  it('think times follow moves through submit and undo', () => {
    const c = demoClient();
    c.submit({ type: 'quest', cardId: 'PK-Y3' }, 'p1' as PlayerId);
    const tl = c.timeline();
    expect(tl.states).toHaveLength(tl.thinkMs.length);
    expect(tl.thinkMs[tl.thinkMs.length - 1]).toBeGreaterThanOrEqual(0);
    c.undo();
    const tl2 = c.timeline();
    expect(tl2.states).toHaveLength(tl2.thinkMs.length);
    expect((tl2.states[tl2.states.length - 1] as GameState).moves.length).toBe(demoState().moves.length);
    c.dispose();
  });
});
