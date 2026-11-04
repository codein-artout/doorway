import { describe, expect, it } from 'vitest';
import { apply, checkQuest, cost, costBreakdown, legalMoves, IllegalMoveError } from '../src/index';
import { P, cur, hasMove, play, q, rules, rush, scen, skipSwaps } from './helpers';

const two = (p1: number, p2: number, extra: Parameters<typeof scen>[1] = {}) =>
  scen(2, {
    ...extra,
    players: {
      p1: { position: p1, ...(extra.players?.p1 ?? {}) },
      p2: { position: p2, ...(extra.players?.p2 ?? {}) },
    },
    stacks: p1 === p2 ? { [p1]: ['p2', 'p1'] } : { [p1]: ['p1'], [p2]: ['p2'] },
  });

describe('Quest (rulebook §5A)', () => {
  it('RB-5.1: a turn is exactly one Quest or one Rush', () => {
    const s = two(0, 10);
    const ms = legalMoves(s, 'p1');
    expect(ms.every((m) => m.type === 'quest' || m.type === 'rush')).toBe(true);
    const s2 = play(s, ms[0]);
    expect(s2.turn).toBe(1);
  });
  it('RB-5.A1 RB-6.2 R16: a Young player may only take Young cards', () => {
    const s = two(13, 20, { market: { middle: ['PK-M2', 'GD-M3'], old: ['GR-O1', 'PU-O3'] } });
    expect(checkQuest(s, 'p1', 'PK-M2')).toMatchObject({
      ok: false,
      reason: 'too_young',
      message: 'Too young — Middle from space 14.',
    });
    expect(checkQuest(s, 'p1', 'GR-O1')).toMatchObject({ ok: false, reason: 'too_young' });
    expect(legalMoves(s, 'p1').filter((m) => m.type === 'quest').length).toBe(3);
    expect(() => apply(s, q('PK-M2'))).toThrow(IllegalMoveError);
  });
  it('RB-6.3: a Middle player (14–27) may take Young or Middle cards', () => {
    const s = two(14, 30, { market: { middle: ['PK-M2', 'GD-M3'], old: ['GR-O1', 'PU-O3'] } });
    expect(checkQuest(s, 'p1', 'PK-M2').ok).toBe(true);
    expect(checkQuest(s, 'p1', s.market.young[0]!).ok).toBe(true);
    expect(checkQuest(s, 'p1', 'GR-O1').ok).toBe(false);
  });
  it('RB-6.4: an Old player (28–39) may take any age', () => {
    const s = two(28, 35, { market: { middle: ['PK-M2', 'GD-M3'], old: ['GR-O1', 'PU-O3'] } });
    expect(checkQuest(s, 'p1', 'GR-O1').ok).toBe(true);
    expect(checkQuest(s, 'p1', 'PK-M2').ok).toBe(true);
    expect(checkQuest(s, 'p1', s.market.young[0]!).ok).toBe(true);
  });
  it('RB-6.1 RB-6.5: age comes from your own position at the start of the turn', () => {
    // p1 at 12 takes a 4-year Young card and ends at 16 (Middle) — legal because age was Young at turn start
    let s = two(12, 30, { market: { young: ['PK-Y5', 'PK-Y1', 'PK-Y2'], middle: ['PK-M2', 'GD-M3'] } });
    s = play(s, q('PK-Y5'));
    expect(P(s, 'p1').position).toBe(16);
    expect(s.log.some((e) => e.type === 'age_changed' && e.age === 'middle')).toBe(true);
    // next turn p1 is Middle and may take Middle
    expect(hasMove(s, 'p1', q('PK-M2'))).toBe(true);
  });
  it('RB-6.6: the market shows all three ages; an older player may take Young cards', () => {
    const s = two(30, 35);
    expect(s.market.young.filter(Boolean).length).toBe(3);
    expect(s.market.old.filter(Boolean).length).toBe(2);
    expect(hasMove(s, 'p1', q(s.market.young[0]!))).toBe(true);
  });
  it('RB-5.A2 RB-12.R1: requirements count discs already in the tower, before the new disc', () => {
    const s = two(20, 30, { market: { middle: ['PK-M4', 'PK-M3'] }, players: { p1: { tower: ['PK-Y1'] } } });
    expect(checkQuest(s, 'p1', 'PK-M3').ok).toBe(true); // needs 1 Love, has 1
    expect(checkQuest(s, 'p1', 'PK-M4')).toMatchObject({ ok: false, message: 'Needs 2 Love.' });
  });
  it('RB-5.A3 RB-12.C1 R21: cost = printed − experience − powers, then the floor of 1', () => {
    const s = two(20, 30, {
      market: { middle: ['GD-M2', 'PU-M2'] },
      players: { p1: { tower: ['GD-Y1', 'GD-Y2', 'PU-M1'], pendingNextQuestDiscount: 2 } },
    });
    // GD-M2: 5 − 1 (2 Work) − 1 (PU-M1 Work discount) − 2 (next quest) = 1
    expect(costBreakdown(s, 'p1', 'GD-M2')).toEqual({
      printed: 5,
      experience: 1,
      power: 1,
      nextQuest: 2,
      cost: 1,
    });
    // A 2-year card with −4 total is floored at 1
    const t = two(20, 30, {
      market: { young: ['GD-Y3', 'PK-Y1', 'PK-Y2'] },
      players: { p1: { tower: ['GD-Y1', 'GD-Y2', 'PU-M1'], pendingNextQuestDiscount: 2 } },
    });
    expect(cost(t, 'p1', 'GD-Y3')).toBe(1); // 3 − 1 − 1 − 2 = −1 → 1
  });
  it('RB-5.A4: you move forward exactly the cost', () => {
    const s = play(two(3, 30, { market: { young: ['PK-Y5', 'PK-Y1', 'PK-Y2'] } }), q('PK-Y5'));
    expect(P(s, 'p1').position).toBe(7);
  });
  it('RB-5.A5 RB-12.W2: the disc goes on top; the card row is the tower', () => {
    let s = two(0, 30, { market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] } });
    s = play(s, q('PK-Y1'));
    s = play(s, q('GD-Y1'));
    expect(P(s, 'p1').tower).toEqual(['PK-Y1', 'GD-Y1']);
  });
  it('RB-5.A8 R13 RB-12.M2: the slot refills from the same age deck; an empty deck leaves it empty', () => {
    let s = two(0, 30, { market: { young: ['PK-Y1', 'GD-Y1', 'GR-Y1'] }, decks: { young: ['OR-Y1'] } });
    s = play(s, q('GD-Y1'));
    expect(s.market.young).toEqual(['PK-Y1', 'OR-Y1', 'GR-Y1']);
    expect(s.log.some((e) => e.type === 'market_refilled' && e.slot === 1 && e.cardId === 'OR-Y1')).toBe(
      true,
    );
    s.decks.young = [];
    s = play(s, q('PK-Y1'));
    expect(s.market.young).toEqual([null, 'OR-Y1', 'GR-Y1']);
    s = play(s, q('GR-Y1'));
    expect(s.market.young[0]).toBeNull();
  });
  it('RB-12.M1: only taking (or a Rush discard / solo drift) changes a row', () => {
    let s = two(0, 30);
    const before = JSON.stringify(s.market);
    s = play(s, rush());
    expect(JSON.stringify(s.market)).toBe(before);
  });
  it('RB-12.M3: cards you cannot take stay in the market', () => {
    const s = two(0, 30, { market: { middle: ['PK-M2', 'GD-M3'] } });
    const s2 = play(s, q(s.market.young[0]!));
    expect(s2.market.middle).toEqual(['PK-M2', 'GD-M3']);
  });
  it('BS-5.4.2: quest validation, cost, move, disc, refill; pendingNextQuestDiscount cleared after use', () => {
    let s = two(20, 30, {
      market: { middle: ['PK-M2', 'GD-M3'] },
      players: { p1: { pendingNextQuestDiscount: 2 } },
    });
    s = play(s, q('PK-M2'));
    expect(P(s, 'p1').position).toBe(22);
    expect(P(s, 'p1').pendingNextQuestDiscount).toBe(0);
  });
});

describe('Rush (rulebook §5B, R9–R11)', () => {
  it('RB-5.B1 R10: optional discard of any face-up card (any age), refilled before moving', () => {
    let s = two(0, 10, { market: { old: ['GR-O1', 'PU-O3'] }, decks: { old: ['PK-O1'] } });
    expect(hasMove(s, 'p1', rush('PU-O3'))).toBe(true);
    s = play(s, rush('PU-O3'));
    expect(s.market.old).toEqual(['GR-O1', 'PK-O1']);
    expect(s.discard).toEqual(['PU-O3']);
    const ev = s.log.slice(-6).map((e) => e.type);
    expect(ev.indexOf('card_discarded')).toBeLessThan(ev.indexOf('rushed'));
    expect(() => apply(two(0, 10), rush('NOPE'))).toThrow(IllegalMoveError);
  });
  it('RB-5.B2 R9: rush lands directly ahead of the nearest pawn strictly in front (on top if occupied)', () => {
    let s = scen(3, {
      players: { p1: { position: 2 }, p2: { position: 5 }, p3: { position: 9 } },
      stacks: { 2: ['p1'], 5: ['p2'], 9: ['p3'] },
    });
    s = play(s, rush());
    expect(P(s, 'p1').position).toBe(6);
    // a pawn on your own space is not "in front"
    let t = scen(3, {
      players: { p1: { position: 4 }, p2: { position: 4 }, p3: { position: 8 } },
      stacks: { 4: ['p2', 'p1'], 8: ['p3'] },
    });
    t = play(t, rush());
    expect(P(t, 'p1').position).toBe(9);
    // the target space may be occupied: you go on top
    const u = scen(3, {
      players: { p1: { position: 2 }, p2: { position: 5 }, p3: { position: 6 } },
      stacks: { 2: ['p1'], 5: ['p2'], 6: ['p3'] },
    });
    const u2 = play(u, rush());
    expect(u2.stacks[6]).toEqual(['p3', 'p1']);
  });
  it('RB-5.B3 RB-12.T4: with no pawn ahead, rush 3 spaces', () => {
    const s = play(two(10, 4), rush(), 'p2');
    // p2 at 4 is behind; p1 at 10 is ahead → 11. Now test the leader:
    expect(P(s, 'p2').position).toBe(11);
    const lead = scen(2, {
      players: { p1: { position: 10 }, p2: { position: 10 } },
      stacks: { 10: ['p2', 'p1'] },
    });
    const t = play(lead, rush());
    expect(P(t, 'p1').position).toBe(13);
  });
  it('RB-5.B4 RB-7.P2: the Rush bonus (Learn to rest) is added after the target', () => {
    const s = scen(2, {
      players: { p1: { position: 2, tower: ['GR-M2'] }, p2: { position: 5 } },
      stacks: { 2: ['p1'], 5: ['p2'] },
    });
    expect(P(play(s, rush()), 'p1').position).toBe(7); // 5+1, +1 bonus
    const lead = scen(2, {
      players: { p1: { position: 6, tower: ['GR-M2'] }, p2: { position: 6 } },
      stacks: { 6: ['p2', 'p1'] },
    });
    expect(P(play(lead, rush()), 'p1').position).toBe(10); // +3 +1
  });
  it('RB-5.B5: a rush resolves Milestones it crosses', () => {
    let s = scen(2, {
      players: { p1: { position: 8, tower: ['PK-Y1', 'GD-Y1'] }, p2: { position: 12 } },
      stacks: { 8: ['p1'], 12: ['p2'] },
    });
    s = play(s, rush());
    expect(P(s, 'p1').position).toBe(13);
    expect(s.phase).toBe('pending_choice');
    expect(P(s, 'p1').milestonesUsed).toEqual([10]);
  });
  it('RB-5.B6: a rush gains no disc', () => {
    const s = play(two(0, 10), rush());
    expect(P(s, 'p1').tower).toEqual([]);
  });
  it('RB-5.B7 R11: rush is always legal and always moves forward; with no quest you must rush', () => {
    // p1 Young with an all-Middle/Old market and an empty Young row
    const s = two(0, 10, { market: { young: [null, null, null] }, decks: {} });
    s.decks.young.push(...s.market.young.filter(Boolean).map(String));
    const ms = legalMoves(s, 'p1');
    expect(ms.filter((m) => m.type === 'quest')).toEqual([]);
    expect(ms.some((m) => m.type === 'rush')).toBe(true);
    const s2 = play(s, rush());
    expect(P(s2, 'p1').position).toBeGreaterThan(0);
  });
  it('RB-12.T5: rush when the nearest pawn ahead is on 39 → move to 40 and arrive', () => {
    let s = scen(2, {
      players: { p1: { position: 35 }, p2: { position: 39 } },
      stacks: { 35: ['p1'], 39: ['p2'] },
    });
    s = skipSwaps(play(s, rush()));
    expect(P(s, 'p1').position).toBe(40);
    expect(P(s, 'p1').arrivalOrder).toBe(1);
  });
  it('R9: arrived pawns are ignored as rush targets; target capped at the track length', () => {
    let s = scen(3, {
      players: {
        p1: { position: 30 },
        p2: { position: 40, arrivalOrder: 1, doorwayAllowance: 9, keptRange: [0, -1] },
        p3: { position: 33 },
      },
      stacks: { 30: ['p1'], 40: ['p2'], 33: ['p3'] },
    });
    s.arrivals = ['p2'];
    s = play(s, rush());
    expect(P(s, 'p1').position).toBe(34);
  });
  it('BS-5.4.3: rush = discard + refill, target, rush bonus, Milestones', () => {
    let s = scen(2, {
      market: { young: ['PK-Y1', 'PK-Y2', 'PK-Y3'] },
      decks: { young: ['GD-Y1'] },
      players: { p1: { position: 18, tower: ['GR-M2', 'PK-Y4'] }, p2: { position: 20 } },
      stacks: { 18: ['p1'], 20: ['p2'] },
    });
    s = play(s, rush('PK-Y2'));
    expect(s.market.young).toEqual(['PK-Y1', 'GD-Y1', 'PK-Y3']);
    expect(P(s, 'p1').position).toBe(22);
    expect(s.phase).toBe('pending_choice');
  });
});

describe('Powers on quests (R17, R18, R19, R20)', () => {
  it('R17 RB-7.P3 RB-12.R3: Old friends reaches exactly one age older, only where needed, once', () => {
    const s = two(5, 30, {
      market: { young: ['PK-Y1', 'PK-Y2', 'PK-Y3'], middle: ['PK-M2', 'GD-M4'], old: ['GR-O1', 'PU-O3'] },
      players: { p1: { tower: ['OR-M2'] } },
    });
    expect(hasMove(s, 'p1', q('PK-M2', { useAgeReach: true }))).toBe(true);
    expect(hasMove(s, 'p1', q('PK-Y1', { useAgeReach: true }))).toBe(false);
    expect(hasMove(s, 'p1', q('PK-Y1'))).toBe(true);
    expect(checkQuest(s, 'p1', 'GR-O1').ok).toBe(false); // two steps
    expect(checkQuest(s, 'p1', 'GD-M4')).toMatchObject({ ok: false, reason: 'requirement' }); // does not waive requirements
    expect(() => apply(s, q('PK-M2'))).toThrow(/Old friends/);
    expect(() => apply(s, q('PK-Y1', { useAgeReach: true }))).toThrow(/Old friends/);
    const s2 = play(s, q('PK-M2', { useAgeReach: true }));
    expect(P(s2, 'p1').oncePowersUsed.ageReach).toBe(true);
    // second use refused
    const s3 = two(5, 30, {
      market: { middle: ['PU-M2', 'GD-M4'] },
      players: { p1: { tower: ['OR-M2'], oncePowersUsed: { ageReach: true, ignoreReq: false } } },
    });
    expect(checkQuest(s3, 'p1', 'PU-M2').ok).toBe(false);
    // Old players cannot use it (nothing older)
    const old = two(30, 35, { players: { p1: { tower: ['OR-M2'] } } });
    expect(legalMoves(old, 'p1').some((m) => m.type === 'quest' && m.useAgeReach)).toBe(false);
  });
  it('R18 RB-7.P4: Say yes more ignores an unmet requirement (not the age gate), once', () => {
    const s = two(20, 30, {
      market: { middle: ['PK-M4', 'PK-M2'], old: ['GR-O3', 'PU-O3'] },
      players: { p1: { tower: ['PU-Y2'] } },
    });
    expect(hasMove(s, 'p1', q('PK-M4', { useIgnoreReq: true }))).toBe(true);
    expect(hasMove(s, 'p1', q('PK-M2', { useIgnoreReq: true }))).toBe(false);
    expect(checkQuest(s, 'p1', 'GR-O3').ok).toBe(false); // age gate stays
    const s2 = play(s, q('PK-M4', { useIgnoreReq: true }));
    expect(P(s2, 'p1').oncePowersUsed.ignoreReq).toBe(true);
    expect(s2.log.some((e) => e.type === 'quest_taken' && e.usedPowers.includes('ignore_requirement'))).toBe(
      true,
    );
  });
  it('RB-12.R4: Old friends and Say yes more combine on one quest', () => {
    const s = two(5, 30, {
      market: { middle: ['PK-M4', 'PK-M2'] },
      players: { p1: { tower: ['OR-M2', 'PU-Y2'] } },
    });
    const m = q('PK-M4', { useAgeReach: true, useIgnoreReq: true });
    expect(hasMove(s, 'p1', m)).toBe(true);
    const s2 = play(s, m);
    expect(P(s2, 'p1').oncePowersUsed).toEqual({ ageReach: true, ignoreReq: true });
  });
  it('R19: a power starts after the quest that grants it', () => {
    const s = two(20, 30, { market: { middle: ['GD-M1', 'PK-M2'] }, players: { p1: { tower: [] } } });
    // GD-M1 discounts Love; its own cost (Work) is unaffected, and it is not discounted by itself
    const s2 = play(s, q('GD-M1'));
    expect(P(s2, 'p1').position).toBe(23);
    expect(cost(s2, 'p1', 'PK-M2')).toBe(3);
  });
  it('R20 RB-7.P6 RB-12.C2: Quit the good job: −2 on the next quest; a rush first leaves it waiting; consumed when partly wasted', () => {
    let s = two(20, 22, { market: { middle: ['GD-M3', 'PK-M2'], young: ['PK-Y1', 'PK-Y2', 'PK-Y3'] } });
    s = play(s, q('GD-M3')); // 20 → 24
    expect(P(s, 'p1').pendingNextQuestDiscount).toBe(2);
    s = play(s, rush(), 'p2'); // p2 22 → 25
    s = play(s, rush(), 'p1'); // p1 24 → 26: rushes don't consume it
    expect(P(s, 'p1').pendingNextQuestDiscount).toBe(2);
    s = play(s, rush(), 'p2'); // p2 25 → 27
    expect(cur(s)).toBe('p1');
    expect(cost(s, 'p1', 'PK-Y1')).toBe(1); // 2 − 2 → floor 1 (partly wasted)
    s = play(s, q('PK-Y1'));
    expect(P(s, 'p1').pendingNextQuestDiscount).toBe(0);
  });
  it('RB-7.P1: cross-domain discounts run Love → Family → Play → Wonder → Work → Love', () => {
    const chain: [string, string][] = [
      ['PK-M1', 'orange'],
      ['OR-M1', 'green'],
      ['GR-M1', 'purple'],
      ['PU-M1', 'gold'],
      ['GD-M1', 'pink'],
    ];
    for (const [card, target] of chain) {
      const s = two(20, 30, { players: { p1: { tower: [card] } } });
      const c = s.cards[card];
      expect(c.power).toMatchObject({ type: 'discount', color: target, amount: 1 });
    }
    const s = two(20, 30, { market: { middle: ['OR-M2', 'PK-M2'] }, players: { p1: { tower: ['PK-M1'] } } });
    expect(costBreakdown(s, 'p1', 'OR-M2')).toMatchObject({ power: 1, cost: 3 });
    expect(costBreakdown(s, 'p1', 'PK-M2')).toMatchObject({ power: 0, cost: 4 });
  });
  it('RB-7.4: all discounts stack; the minimum is still 1', () => {
    const s = two(20, 30, {
      market: { middle: ['OR-M2', 'PK-M2'] },
      players: { p1: { tower: ['PK-M1', 'OR-Y1', 'OR-Y2', 'OR-Y3', 'OR-Y4'], pendingNextQuestDiscount: 2 } },
    });
    expect(costBreakdown(s, 'p1', 'OR-M2')).toEqual({
      printed: 4,
      experience: 2,
      power: 1,
      nextQuest: 2,
      cost: 1,
    });
  });
  it('RB-7.5: once-per-game powers are never forced: a plain quest never spends them', () => {
    let s = two(20, 30, {
      market: { middle: ['PK-M2', 'GD-M3'] },
      players: { p1: { tower: ['OR-M2', 'PU-Y2'] } },
    });
    s = play(s, q('PK-M2'));
    expect(P(s, 'p1').oncePowersUsed).toEqual({ ageReach: false, ignoreReq: false });
  });
  it('RB-5.A6: an "immediately" power resolves during the quest (Keep a diary offers a swap at once)', () => {
    let s = two(0, 30, {
      market: { young: ['GR-Y2', 'PK-Y1', 'PK-Y2'] },
      players: { p1: { tower: ['GD-Y1'] } },
    });
    s = play(s, q('GR-Y2'));
    expect(s.phase).toBe('pending_choice');
    expect(s.pending!.queue[0]).toMatchObject({ source: 'diary' });
  });
});

describe('Experience (rulebook §7, R1)', () => {
  const towerOf = (n: number) =>
    ['PK-Y1', 'PK-Y2', 'PK-Y3', 'PK-Y4', 'PK-Y5', 'PK-M1', 'PK-M2', 'PK-M3', 'PK-M4'].slice(0, n);
  const disc = (n: number, r = rules()) =>
    costBreakdown(
      scen(
        2,
        {
          market: { old: ['PK-O3', 'GR-O1'] },
          players: { p1: { position: 30, tower: towerOf(n) }, p2: { position: 35 } },
          stacks: { 30: ['p1'], 35: ['p2'] },
        },
        r,
      ),
      'p1',
      'PK-O3',
    ).experience;
  it('RB-7.1: every 2 discs of a domain → −1 year', () => expect(disc(2)).toBe(1));
  it('RB-7.T1: 0–1 discs → 0', () => expect([disc(0), disc(1)]).toEqual([0, 0]));
  it('RB-7.T2: 2–3 discs → −1', () => expect([disc(2), disc(3)]).toEqual([1, 1]));
  it('RB-7.T3: 4–5 discs → −2', () => expect([disc(4), disc(5)]).toEqual([2, 2]));
  it('RB-7.T4: 6–7 discs → −3', () => expect([disc(6), disc(7)]).toEqual([3, 3]));
  it('RB-7.T5 R1: 8+ discs → −4 (capped by experienceCap)', () => {
    expect([disc(8), disc(9)]).toEqual([4, 4]);
    expect(disc(9, rules({ experienceCap: 99 }))).toBe(4); // 9/2 = 4
    expect(disc(9, rules({ experienceCap: 2 }))).toBe(2);
  });
  it('RB-7.2: discs are counted before the new one is added', () => {
    let s = two(0, 30, {
      market: { young: ['PK-Y1', 'PK-Y2', 'PK-Y3'] },
      players: { p1: { tower: ['PK-Y4'] } },
    });
    s = play(s, q('PK-Y3')); // 1 Love before → no discount → 3 years
    expect(P(s, 'p1').position).toBe(3);
  });
});
