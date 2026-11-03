'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS, DEFAULT_RULESET } from '@doorway/content';
import { type Ruleset } from '@doorway/engine';
import { DesignerNav } from '@/components/designer-nav';
import { download } from '@/lib/import-export';
import { BOT_MIXES, DIALS, dialValue, diff, emptyAgg, mergeAgg, metrics, rulesetProblems, runBatch, setDial, type BotMix, type SimAgg } from '@/lib/sandbox';
import { loadRulesets, saveRuleset } from '@/lib/storage';

const sel = 'min-h-[44px] rounded-[10px] border border-line bg-ink px-2 text-text';

export default function Sandbox() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([DEFAULT_RULESET]);
  const [baseId, setBaseId] = useState(DEFAULT_RULESET.id);
  const base = rulesets.find((r) => r.id === baseId) ?? DEFAULT_RULESET;
  const [variant, setVariant] = useState<Ruleset>(DEFAULT_RULESET);
  const [name, setName] = useState('v0.2-variant-a');
  const [players, setPlayers] = useState(4);
  const [games, setGames] = useState(1000);
  const [mix, setMix] = useState<BotMix>('field');
  const [seed, setSeed] = useState('doorway-2026');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ base: SimAgg; variant: SimAgg; games: number } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const workers = useRef<Worker[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const all = [DEFAULT_RULESET, ...loadRulesets().map((x) => x.ruleset)];
    setRulesets(all);
    const set = p.get('set');
    if (set) {
      // ?set=key=value (from the analysis tweaks)
      const [k, v] = set.split('=');
      try {
        let r = DEFAULT_RULESET;
        const vals = v.split(/[,/]/).map(Number);
        if (vals.length > 1 && k.startsWith('doorway.')) vals.forEach((x, i) => (r = setDial(r, `${k}.${i}`, x)));
        else if (vals.length > 1 && k === 'passion') ['3', '4', '5'].forEach((t, i) => (r = setDial(r, `passion.${t}`, vals[i])));
        else r = setDial(r, k, vals[0]);
        setVariant(r);
      } catch {
        /* ignore bad links */
      }
    }
    return () => workers.current.forEach((w) => w.terminate());
  }, []);

  const changes = useMemo(() => diff(base, variant), [base, variant]);
  const problems = rulesetProblems(variant);
  const groups = [...new Set(DIALS.map((d) => d.group))];

  async function run() {
    setRunning(true);
    setProgress(0);
    setResult(null);
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const chunk = Math.max(50, Math.ceil(games / (n * 4)));
    const tasks: { which: 'base' | 'variant'; from: number; to: number }[] = [];
    for (const which of ['base', 'variant'] as const) for (let f = 0; f < games; f += chunk) tasks.push({ which, from: f, to: Math.min(games, f + chunk) });
    const agg = { base: emptyAgg(), variant: emptyAgg() };
    let done = 0;
    const exec = (t: (typeof tasks)[number], w: Worker | null) =>
      new Promise<void>((resolve) => {
        const msg = { id: Math.random(), ruleset: t.which === 'base' ? base : variant, players, mix, seed, from: t.from, to: t.to };
        const finish = (a: SimAgg) => {
          agg[t.which] = mergeAgg(agg[t.which], a);
          done++;
          setProgress(done / tasks.length);
          resolve();
        };
        if (!w) {
          setTimeout(() => finish(runBatch({ ...msg, cards: CARDS })), 0);
          return;
        }
        w.onmessage = (e) => finish(e.data.agg ?? emptyAgg());
        w.postMessage(msg);
      });
    try {
      if (workers.current.length !== n) workers.current = Array.from({ length: n }, () => new Worker(new URL('../../../workers/sim.worker.ts', import.meta.url), { type: 'module' }));
    } catch {
      workers.current = [];
    }
    const queue = tasks.slice();
    const lanes = (workers.current.length ? workers.current : [null]).map(async (w) => {
      while (queue.length) await exec(queue.shift()!, w);
    });
    await Promise.all(lanes);
    setResult({ ...agg, games });
    setRunning(false);
  }

  const mb = result ? metrics(result.base) : null;
  const mv = result ? metrics(result.variant) : null;

  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <DesignerNav />
      <header className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 pt-[22px] pb-2.5 md:px-7">
        <div className="flex-[1_1_520px]">
          <h1 className="m-0 font-display text-[36px] font-extrabold tracking-[-0.015em]">Sandbox</h1>
          <p className="mt-1 mb-0 text-muted">Turn a dial, run the bots, compare with the baseline. Nothing reaches real games until you save it as a new ruleset.</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Baseline
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} className={sel}>
            {rulesets.map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          New ruleset name
          <input value={name} onChange={(e) => setName(e.target.value.replace(/[^\w.+-]/g, '-'))} className={`${sel} px-3 font-mono`} data-testid="ruleset-name" />
        </label>
      </header>
      <div className="flex flex-wrap items-start gap-[18px] px-4 py-2 md:px-7">
        <section aria-label="Ruleset dials" className="grid min-w-0 flex-[1_1_620px] grid-cols-1 gap-3.5 md:grid-cols-2">
          {groups.map((g) => (
            <fieldset key={g} className="m-0 min-w-0 rounded-2xl border border-line bg-surface px-[18px] py-4">
              <legend className="px-1.5 font-display text-[17px] font-bold">{g}</legend>
              <div className="flex flex-col gap-2.5">
                {DIALS.filter((d) => d.group === g).map((d) => {
                  const v = dialValue(variant, d.key);
                  const b = dialValue(base, d.key);
                  const changed = v !== b;
                  return (
                    <div key={d.key} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-bold">{d.key}</div>
                        <div className="text-xs text-muted">{d.note}</div>
                      </div>
                      <div className="inline-flex items-center overflow-hidden rounded-[10px] border" style={{ borderColor: changed ? 'var(--door)' : 'var(--line)' }}>
                        <button type="button" aria-label={`Decrease ${d.key}`} disabled={v <= d.min} onClick={() => setVariant(setDial(variant, d.key, v - 1))} className="h-10 w-10 cursor-pointer border-none bg-surface-2 text-lg text-text disabled:opacity-40" data-testid={`dec-${d.key}`}>
                          −
                        </button>
                        <span className="min-w-[44px] text-center font-mono text-base font-bold" style={{ color: changed ? 'var(--door)' : 'var(--text)' }} data-testid={`val-${d.key}`}>
                          {v}
                        </span>
                        <button type="button" aria-label={`Increase ${d.key}`} disabled={v >= d.max} onClick={() => setVariant(setDial(variant, d.key, v + 1))} className="h-10 w-10 cursor-pointer border-none bg-surface-2 text-lg text-text disabled:opacity-40" data-testid={`inc-${d.key}`}>
                          +
                        </button>
                      </div>
                      <span className="w-16 font-mono text-[11px] font-medium text-muted">{changed ? `was ${b}` : 'default'}</span>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-sunk px-[18px] py-3.5 text-[13px] md:col-span-2">
            <span className="text-muted">
              Cards live in <code className="font-mono text-text">spec/cards.json</code> — browse and check all 60 in the card editor.
            </span>
            <a href="/designer/cards" className="font-bold">
              Open card editor →
            </a>
          </div>
        </section>
        <aside aria-label="Run and compare" className="flex max-w-[560px] min-w-0 flex-[1_1_440px] flex-col gap-3.5">
          <section className="rounded-2xl bg-surface p-[18px]" style={{ border: `1px solid ${changes.length ? 'var(--door)' : 'var(--line)'}` }}>
            <h2 className="m-0 mb-2 font-display text-lg font-bold">Changes from baseline</h2>
            {!changes.length && <p className="m-0 text-[13px] text-muted">None yet. Use the − / + dials.</p>}
            <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-[13px] font-medium" data-testid="diff">
              {changes.map((d) => (
                <li key={d.key}>
                  {d.key}: <span className="text-muted line-through">{d.from}</span> → <b className="text-door">{d.to}</b>
                </li>
              ))}
            </ul>
            {problems.length > 0 && (
              <p role="alert" className="mt-2 mb-0 text-[13px] text-alert">
                {problems.join(' ')}
              </p>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-surface p-[18px]">
            <h2 className="m-0 mb-3 font-display text-lg font-bold">Run the bots</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Players
                <select value={players} onChange={(e) => setPlayers(Number(e.target.value))} className={sel}>
                  {[4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? '1 (solo)' : n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Games per side
                <select value={games} onChange={(e) => setGames(Number(e.target.value))} className={sel} data-testid="games">
                  <option value={100}>100 (smoke)</option>
                  <option value={1000}>1,000 (quick)</option>
                  <option value={10000}>10,000</option>
                  <option value={50000}>50,000</option>
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
                Bot mix
                <select value={mix} onChange={(e) => setMix(e.target.value as BotMix)} className={sel}>
                  {(Object.keys(BOT_MIXES) as BotMix[]).map((k) => (
                    <option key={k} value={k}>
                      {BOT_MIXES[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Seed
                <input value={seed} onChange={(e) => setSeed(e.target.value)} className={`${sel} font-mono`} />
              </label>
              <div className="flex items-end">
                <button type="button" onClick={run} disabled={running || problems.length > 0} className="min-h-[44px] w-full cursor-pointer rounded-xl border-none bg-door font-bold text-ink disabled:opacity-45" data-testid="run">
                  {running ? `Running… ${Math.round(progress * 100)}%` : 'Run baseline and variant'}
                </button>
              </div>
            </div>
            {running && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded bg-ink">
                  <div className="dw-tween h-full bg-door" style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="mt-1.5 mb-0 text-xs text-muted">Running baseline and variant on the same seeds in Web Workers…</p>
              </div>
            )}
          </section>
          {result && mb && mv && (
            <section aria-label="Comparison" className="rounded-2xl border border-door bg-surface p-[18px]" data-testid="comparison">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="m-0 font-display text-lg font-bold">Variant vs baseline</h2>
                <span className="text-xs text-muted">
                  {result.games.toLocaleString()} games each · {players}p · same seeds
                </span>
              </div>
              <div className="mt-2.5 grid gap-x-2.5 gap-y-1.5 text-[13px]" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 70px 70px' }}>
                <span className="text-xs text-muted">Metric</span>
                <span className="text-right text-xs text-muted">Base</span>
                <span className="text-right text-xs text-muted">Variant</span>
                <span className="text-right text-xs text-muted">Change</span>
                {mb.map((m, i) => {
                  const d = mv[i].v - m.v;
                  return [
                    <span key={`n${i}`}>{i === 3 ? mv[i].name : m.name}</span>,
                    <span key={`b${i}`} className="text-right font-mono">
                      {m.fmt(m.v)}
                    </span>,
                    <span key={`v${i}`} className="text-right font-mono">
                      {m.fmt(mv[i].v)}
                    </span>,
                    <span key={`d${i}`} className="text-right font-mono font-bold" style={{ color: Math.abs(d) < 1e-9 ? 'var(--muted)' : 'var(--door)' }}>
                      {d >= 0 ? '+' : '−'}
                      {m.fmt(Math.abs(d))}
                    </span>,
                  ];
                })}
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={problems.length > 0 || !name.trim() || name === DEFAULT_RULESET.id}
              onClick={() => {
                const r = { ...variant, id: name.trim() };
                saveRuleset(r, changes.map((c) => `${c.key}: ${c.from} → ${c.to}`).join('; '));
                download(`${r.id}.json`, JSON.stringify(r, null, 2));
                setRulesets([DEFAULT_RULESET, ...loadRulesets().map((x) => x.ruleset)]);
                setSaved(r.id);
              }}
              className="min-h-[44px] cursor-pointer rounded-xl border-none bg-door px-4 font-bold text-ink disabled:opacity-45"
              data-testid="save-ruleset"
            >
              Save as new ruleset
            </button>
            {saved && (
              <a href={`/?ruleset=${encodeURIComponent(saved)}`} className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-text no-underline">
                Play it at a table
              </a>
            )}
            <a href="/designer" className="inline-flex min-h-[44px] items-center px-2">
              Full report →
            </a>
          </div>
          {saved && (
            <p role="status" className="m-0 text-[13px] text-muted">
              Saved “{saved}” on this device and downloaded its JSON. It is now on the New game screen.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
