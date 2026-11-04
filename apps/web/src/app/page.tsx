'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STRATEGIES, STRATEGY_IDS, type Skill } from '@doorway/bots';
import { DEFAULT_RULESET } from '@doorway/content';
import type { Ruleset } from '@doorway/engine';
import { Pawn } from '@/components/primitives';
import { SiteNav } from '@/components/site-nav';
import { importFile } from '@/lib/import-export';
import {
  loadCurrent,
  loadRulesets,
  loadSaved,
  loadSettings,
  saveCurrent,
  saveSettings,
  type StoredGame,
} from '@/lib/storage';
import type { SeatConfig } from '@/lib/game-client';
import { applyPalette, BOT_SPEEDS, type BotSpeed, type Palette } from '@/lib/ui-rules';

const NAMES = ['Priya', 'Arun', 'Meera', 'Kavi'];
const SKILLS: { v: Skill; label: string }[] = [
  { v: 'casual', label: 'Casual (makes mistakes)' },
  { v: 'normal', label: 'Normal' },
  { v: 'sharp', label: 'Sharp' },
];

const selectCls = 'min-h-[44px] rounded-[10px] border border-line bg-ground px-2.5 text-text';

export default function NewGame() {
  const router = useRouter();
  const [seats, setSeats] = useState<SeatConfig[]>([
    { name: 'Priya', kind: 'human' },
    { name: 'Arun', kind: 'bot', strategy: 'tempo', skill: 'normal' },
  ]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([DEFAULT_RULESET]);
  const [rulesetId, setRulesetId] = useState(DEFAULT_RULESET.id);
  const [seed, setSeed] = useState('');
  const [speed, setSpeed] = useState<BotSpeed>('normal');
  const [blind, setBlind] = useState(false);
  const [palette, setPalette] = useState<Palette>('standard');
  const [resume, setResume] = useState<StoredGame | null>(null);
  const [saved, setSaved] = useState<StoredGame[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSettings();
    setSpeed(s.botSpeed);
    setPalette(s.palette);
    setRulesets([DEFAULT_RULESET, ...loadRulesets().map((x) => x.ruleset)]);
    const cur = loadCurrent();
    setResume(cur);
    setSaved(loadSaved());
    const want = new URLSearchParams(window.location.search).get('ruleset');
    if (want) setRulesetId(want);
  }, []);

  const update = (i: number, patch: Partial<SeatConfig>) =>
    setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const start = () => {
    const ruleset = rulesets.find((r) => r.id === rulesetId) ?? DEFAULT_RULESET;
    const setup = {
      seats,
      ruleset,
      seed: seed.trim() || `game-${Date.now().toString(36)}`,
      botSpeed: speed,
      blind,
    };
    const id = `g${Date.now().toString(36)}`;
    saveSettings({ botSpeed: speed });
    saveCurrent({
      id,
      savedAt: new Date().toISOString(),
      setup,
      replay: {
        format: 'doorway-replay@1',
        rulesetId: ruleset.id,
        rulesetHash: '',
        cardsHash: '',
        seed: setup.seed,
        seats: [],
        moves: [],
      },
    });
    router.push(`/play?id=${id}&new=1`);
  };
  const names = new Set(seats.map((s) => s.name.trim()));
  const cantStart = seats.length < 1 || seats.some((s) => !s.name.trim()) || names.size !== seats.length;

  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <SiteNav />
      <div className="flex flex-wrap items-start gap-6 px-4 pt-6 md:px-7">
        <div className="flex min-w-0 flex-[1_1_620px] flex-col gap-4">
          <header>
            <h1 className="m-0 font-display text-[34px] font-extrabold tracking-[-0.01em] md:text-[40px]">
              New game
            </h1>
            <p className="m-0 text-muted">
              One to four seats at this table. Any seat can be you, a friend on this device, or a bot.
            </p>
          </header>
          {resume && resume.replay.moves.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-door bg-surface px-5 py-4">
              <span className="flex-1">
                A game is in progress: {resume.setup.seats.map((s) => s.name).join(', ')} ·{' '}
                {resume.replay.moves.length} moves.
              </span>
              <a
                href={`/play?id=${resume.id}`}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-door px-5 font-bold text-ground no-underline"
              >
                Resume
              </a>
            </div>
          )}
          <section aria-label="Seats" className="rounded-[20px] border border-line bg-surface px-6 py-[22px]">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="m-0 font-display text-xl font-bold">Seats</h2>
              <span className="text-[13px] text-muted">Seat 1 starts on top of the stack at space 0</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {seats.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-[14px] border px-3.5 py-3"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: s.kind === 'human' ? 'var(--door)' : 'var(--line)',
                  }}
                  data-testid={`seat-${i + 1}`}
                >
                  <span className="w-[46px] font-mono text-xs font-bold text-muted">Seat {i + 1}</span>
                  <Pawn
                    initial={(s.name.trim()[0] ?? '?').toUpperCase()}
                    isBot={s.kind === 'bot'}
                    size={34}
                  />
                  <label className="flex min-w-0 flex-[1_1_140px] flex-col gap-0.5 text-xs text-muted">
                    Name
                    <input
                      value={s.name}
                      maxLength={20}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className={`${selectCls} font-bold`}
                      aria-label={`Seat ${i + 1} name`}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs text-muted">
                    Who
                    <select
                      value={s.kind}
                      onChange={(e) =>
                        update(i, {
                          kind: e.target.value as 'human' | 'bot',
                          strategy: s.strategy ?? 'tempo',
                          skill: s.skill ?? 'normal',
                        })
                      }
                      className={selectCls}
                      aria-label={`Seat ${i + 1} player type`}
                    >
                      <option value="human">Human</option>
                      <option value="bot">Bot</option>
                    </select>
                  </label>
                  {s.kind === 'bot' && (
                    <>
                      <label className="flex flex-col gap-0.5 text-xs text-muted">
                        Strategy
                        <select
                          value={s.strategy}
                          onChange={(e) => update(i, { strategy: e.target.value })}
                          className={selectCls}
                          aria-label={`Seat ${i + 1} bot strategy`}
                        >
                          {STRATEGY_IDS.map((id) => (
                            <option key={id} value={id}>
                              {STRATEGIES[id].label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-0.5 text-xs text-muted">
                        Skill
                        <select
                          value={s.skill}
                          onChange={(e) => update(i, { skill: e.target.value as Skill })}
                          className={selectCls}
                          aria-label={`Seat ${i + 1} bot skill`}
                        >
                          {SKILLS.map((k) => (
                            <option key={k.v} value={k.v}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {seats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSeats(seats.filter((_, j) => j !== i))}
                      className="min-h-[44px] cursor-pointer rounded-[10px] border border-line bg-transparent px-3 text-text"
                    >
                      Open seat
                    </button>
                  )}
                </div>
              ))}
              {seats.length < 4 && (
                <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-line px-3.5 py-3">
                  <span className="w-[46px] font-mono text-xs font-bold text-muted">
                    Seat {seats.length + 1}
                  </span>
                  <span className="flex-1 text-sm text-muted">Open</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSeats([
                        ...seats,
                        {
                          name: NAMES.find((n) => !names.has(n)) ?? `Seat ${seats.length + 1}`,
                          kind: 'bot',
                          strategy: 'specialist',
                          skill: 'normal',
                        },
                      ])
                    }
                    className="min-h-[44px] cursor-pointer rounded-xl border border-door bg-transparent px-4 font-bold text-door"
                    data-testid="add-bot"
                  >
                    Fill with a bot
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSeats([
                        ...seats,
                        {
                          name: NAMES.find((n) => !names.has(n)) ?? `Seat ${seats.length + 1}`,
                          kind: 'human',
                        },
                      ])
                    }
                    className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-transparent px-4 text-text"
                  >
                    Add a human
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Ruleset
                <select
                  value={rulesetId}
                  onChange={(e) => setRulesetId(e.target.value)}
                  className={selectCls}
                  data-testid="ruleset"
                >
                  {rulesets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Seed (optional)
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="random"
                  className={`${selectCls} w-[150px] font-mono`}
                  data-testid="seed"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Bot speed
                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value as BotSpeed)}
                  className={selectCls}
                  data-testid="speed"
                >
                  {(Object.keys(BOT_SPEEDS) as BotSpeed[]).map((k) => (
                    <option key={k} value={k}>
                      {k === 'slow' ? 'Slow (2s)' : k === 'normal' ? 'Normal (1s)' : 'Instant'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={blind}
                  onChange={(e) => setBlind(e.target.checked)}
                  className="h-[18px] w-[18px]"
                />{' '}
                Blind test (hide best-stretch hint and tips)
              </label>
              <label className="inline-flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={palette === 'colorblind'}
                  onChange={(e) => {
                    const p: Palette = e.target.checked ? 'colorblind' : 'standard';
                    setPalette(p);
                    applyPalette(p);
                    saveSettings({ palette: p });
                  }}
                  className="h-[18px] w-[18px]"
                />{' '}
                Colour-blind palette
              </label>
              <div className="flex-1" />
              <button
                type="button"
                disabled={cantStart}
                onClick={start}
                className="min-h-[52px] cursor-pointer rounded-[14px] border-none bg-door px-7 text-[17px] font-bold text-ground disabled:opacity-45"
                data-testid="start"
              >
                {seats.length === 1 ? 'Start the solo challenge' : `Start a ${seats.length}-player game`}
              </button>
            </div>
            {cantStart && (
              <p className="mt-2 mb-0 text-[13px] text-muted">Every seat needs a different name.</p>
            )}
          </section>
          <section
            aria-label="Load a game"
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm"
          >
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-line px-4">
              Import a replay or saved state (.json)
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = await importFile(f);
                  if (!r.ok) setMsg(r.error);
                  else router.push(`/play?id=${r.id}`);
                }}
              />
            </label>
            {saved.length > 0 && <span className="text-muted">Finished games:</span>}
            {saved.slice(0, 5).map((g) => (
              <a key={g.id} href={`/replay?id=${g.id}`} className="text-door">
                {g.setup.seats.map((s) => s.name).join(' · ')} ({new Date(g.savedAt).toLocaleDateString()})
              </a>
            ))}
            {msg && (
              <p role="alert" className="m-0 w-full text-alert">
                {msg}
              </p>
            )}
          </section>
        </div>
        <aside
          aria-label="How to play"
          className="min-w-0 max-w-[520px] flex-[1_1_400px] rounded-[20px] border border-line-soft bg-sunk p-6"
        >
          <h2 className="m-0 mb-1 font-display text-2xl font-bold">How to play, in five breaths</h2>
          <p className="m-0 mb-[18px] text-[13px] text-muted">You&apos;ll pick up the rest as you go.</p>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            <li className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
              <span aria-hidden className="grid h-10 grid-cols-3 gap-0.5 overflow-hidden rounded-lg">
                <span className="bg-young" />
                <span className="bg-middle" />
                <span className="bg-old" />
              </span>
              <span>
                <b>One life, 40 years.</b> Your pawn walks a path from Young to Old. At the end is the
                Doorway.
              </span>
            </li>
            <li className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
              <span aria-hidden className="flex flex-col items-center gap-0.5">
                <span className="h-3 w-11 rounded-md bg-love" />
                <span className="h-3 w-11 rounded-md bg-work" />
                <span className="h-3 w-11 rounded-md bg-play" />
              </span>
              <span>
                <b>Quest.</b> Spend years on a card, move that far, and stack its memory disc on top of your
                tower.
              </span>
            </li>
            <li className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
              <span aria-hidden className="flex items-end justify-center gap-1.5">
                <span
                  className="h-[18px] w-[18px] rounded-full bg-text"
                  style={{ boxShadow: '0 0 0 3px var(--door)' }}
                />
                <span className="h-[18px] w-[18px] rounded-full bg-grey" />
              </span>
              <span>
                <b>Furthest back goes next.</b> No rounds. Cheap quests can earn you several turns in a row.
              </span>
            </li>
            <li className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
              <span aria-hidden className="text-center font-display text-[22px] font-extrabold text-door">
                →|
              </span>
              <span>
                <b>Or rush.</b> Jump just past the nearest pawn ahead. No memory, but you&apos;re closer to
                the Doorway.
              </span>
            </li>
            <li className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
              <span
                aria-hidden
                className="mx-auto h-12 w-10 bg-door"
                style={{ borderRadius: '20px 20px 4px 4px' }}
              />
              <span>
                <b>Keep one stretch.</b> Arrive early and you carry more (9 · 8 · 7 · 6). Points come only
                from the unbroken stretch you keep.
              </span>
            </li>
          </ol>
          <div className="mt-[22px] flex flex-wrap gap-2.5">
            <a
              href="/rules"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-door px-5 font-bold text-door no-underline"
            >
              Full rules
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
