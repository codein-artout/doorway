import { describe, expect, it } from 'vitest';
import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { applyOverrides, currentPlayer, legalMoves, type GameState } from '@doorway/engine';
import { LocalGameClient, type GameSetup } from '../src/lib/game-client';
import {
  APP_NAME,
  BOT_SPEEDS,
  DEFAULT_BOT_SPEED,
  hintSettings,
  marketTabs,
  pawnStyle,
} from '../src/lib/ui-rules';
import { PALETTES, DOMAIN } from '../src/lib/domains';
import { banner, logLine, preview, tipsFrom } from '../src/lib/table-model';
import { importJson, exportReplayJson } from '../src/lib/import-export';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const setup = (o: Partial<GameSetup> = {}): GameSetup => ({
  seats: [
    { name: 'Priya', kind: 'human' },
    { name: 'Arun', kind: 'bot', strategy: 'greedy', skill: 'sharp' },
  ],
  ruleset: DEFAULT_RULESET,
  seed: 'web-test',
  botSpeed: 'instant',
  blind: false,
  ...o,
});
const inline = () => ({
  compute: async (s: GameState, p: string) => (await import('../src/lib/bot-move')).chooseBotMove(s, p),
  dispose: () => {},
});

describe('Local game client', () => {
  it('R32: local games have unlimited undo (reverting the human move and the bot replies after it)', async () => {
    const c = new LocalGameClient(setup(), CARDS, { compute: inline() });
    const s0 = c.getSnapshot().state;
    expect(c.getSnapshot().canUndo).toBe(false);
    let moves = 0;
    for (let i = 0; i < 6; i++) {
      const s = c.getSnapshot().state;
      const cp = currentPlayer(s);
      if (cp === 'p1') {
        c.submit(legalMoves(s, 'p1')[0], 'p1');
        moves++;
      }
      await wait(5);
    }
    expect(moves).toBeGreaterThan(1);
    for (let i = 0; i < moves; i++) c.undo();
    expect(c.getSnapshot().state.moves.length).toBe(0);
    expect(c.getSnapshot().state.market).toEqual(s0.market);
    c.dispose();
  });
  it('R39: bot speed — Slow 2 s, Normal 1 s (default), Instant', () => {
    expect(BOT_SPEEDS).toEqual({ slow: 2000, normal: 1000, instant: 0 });
    expect(DEFAULT_BOT_SPEED).toBe('normal');
  });
  it('bots reply on their own and choose windows at once; a whole hot-seat game can be finished', async () => {
    const c = new LocalGameClient(
      setup({
        seats: [
          { name: 'Priya', kind: 'human' },
          { name: 'Arun', kind: 'bot', strategy: 'tempo', skill: 'normal' },
        ],
      }),
      CARDS,
      { compute: inline() },
    );
    for (let i = 0; i < 400 && c.getSnapshot().state.phase !== 'over'; i++) {
      const s = c.getSnapshot().state;
      const me = s.players[0];
      const ms = legalMoves(s, 'p1');
      if (ms.length) {
        const w = ms.find((m) => m.type === 'choose_window');
        c.submit(w ?? ms.find((m) => m.type === 'quest') ?? ms[0], 'p1');
      }
      void me;
      await wait(2);
    }
    expect(c.getSnapshot().state.phase).toBe('over');
    const r = JSON.parse(exportReplayJson(c.getSnapshot().state, c.setup));
    expect(r.format).toBe('doorway-replay@1');
    c.dispose();
  });
});

describe('UI rulings', () => {
  it('R34: pawns are ivory with an initial, bots get a dashed ring, the current pawn pulses — never a domain colour', () => {
    const h = pawnStyle({ isBot: false, current: true });
    expect(h.background).toBe('var(--text)');
    expect(h.pulse).toBe(true);
    expect(pawnStyle({ isBot: true, current: false }).outline).toContain('dashed');
    for (const d of Object.values(DOMAIN)) expect(h.background).not.toBe(d.css);
  });
  it('R35 RB-13.18: hint mode on by default; Blind test turns off the best-window hint and tips, but not the live score', () => {
    expect(hintSettings(DEFAULT_RULESET, false)).toEqual({
      bestWindow: true,
      firstGameTips: true,
      liveScore: true,
    });
    expect(hintSettings(DEFAULT_RULESET, true)).toEqual({
      bestWindow: false,
      firstGameTips: false,
      liveScore: true,
    });
    expect(
      hintSettings(applyOverrides(DEFAULT_RULESET, { 'hints.bestWindow': false }), false).bestWindow,
    ).toBe(false);
  });
  it('R38: the phone market defaults to the player’s own age; unreached tabs say where they open', () => {
    const t = marketTabs(DEFAULT_RULESET, 11);
    expect(t.defaultTab).toBe('young');
    expect(t.tabs.map((x) => x.label)).toEqual(['Young', 'Middle · at 14', 'Old · at 28']);
    expect(marketTabs(DEFAULT_RULESET, 20).defaultTab).toBe('middle');
  });
  it('R41: the colour-blind palette is an alternate token set (Okabe–Ito); icons and codes do not change', () => {
    expect(PALETTES.colorblind).toEqual({
      pink: '#CC79A7',
      gold: '#F0E442',
      green: '#009E73',
      orange: '#E69F00',
      purple: '#56B4E9',
    });
    const css = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/globals.css'),
      'utf8',
    );
    expect(css).toMatch(/\[data-palette='colorblind'\][\s\S]*--love: #cc79a7/i);
    expect(Object.values(DOMAIN).map((d) => d.code)).toEqual(['Lv', 'Wk', 'Pl', 'Fm', 'Wd']);
  });
  it('R46: the product is called Doorway in user-facing strings', () => {
    expect(APP_NAME).toBe('Doorway');
    const layout = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/layout.tsx'),
      'utf8',
    );
    expect(layout).toContain("default: 'Doorway'");
    expect(layout).not.toMatch(/Everything You Bring/);
  });
});

describe('Table copy', () => {
  const c = new LocalGameClient(setup({ botSpeed: 'slow' }), CARDS, {
    compute: { compute: () => new Promise(() => {}), dispose: () => {} },
  });
  const s = c.getSnapshot().state;
  it('banner and preview speak plainly ("You move a → b", "you move again")', () => {
    expect(banner(s, 'p1', false, false).title).toBe('Your turn, Priya.');
    const id = s.market.young[0]!;
    const pv = preview(s, 'p1', { kind: 'quest', cardId: id });
    expect(pv.text).toMatch(/You move 0 → \d+\./);
    expect(pv.next).toMatch(/moves next|move again|Doorway/);
    expect(logLine(s, { type: 'rushed', playerId: 'p1', from: 2, to: 5 })).toBe('Priya rushed 2 → 5.');
  });
  it('first-game tips fire for humans only', () => {
    expect(
      tipsFrom(
        [
          { type: 'rushed', playerId: 'p1', from: 0, to: 3 },
          { type: 'rushed', playerId: 'p2', from: 0, to: 3 },
        ],
        new Set(['p1']),
      ),
    ).toEqual(['rush']);
  });
  it('import refuses a replay whose hashes do not match (R31)', () => {
    const r = importJson(
      JSON.stringify({
        format: 'doorway-replay@1',
        rulesetId: 'v0.2-default',
        rulesetHash: 'x',
        cardsHash: 'y',
        seed: 's',
        seats: [],
        moves: [],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/different ruleset/);
  });
});
