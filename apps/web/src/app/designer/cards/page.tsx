'use client';
import { useMemo, useState } from 'react';
import { CARDS, summarizeCards, validateCards } from '@doorway/content';
import type { Card } from '@doorway/engine';
import { DesignerNav } from '@/components/designer-nav';
import { download } from '@/lib/import-export';
import { DOMAIN } from '@/lib/domains';
import { powerText } from '@/lib/table-model';

const COLS = ['id', 'name', 'color', 'age', 'years', 'points', 'requires', 'power', 'reflection'] as const;

function toCsv(cards: Card[]) {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [
    COLS.join(','),
    ...cards.map((c) =>
      [
        c.id,
        c.name,
        c.color,
        c.age,
        c.years,
        c.points,
        c.requires ? `${c.requires.count} ${c.requires.color}` : '',
        c.power ? JSON.stringify(c.power) : '',
        c.reflection ?? '',
      ]
        .map((x) => q(String(x)))
        .join(','),
    ),
  ].join('\n');
}

/** Card browser with validation (spec §11.2). Editing lives in spec/cards.json; this checks and exports a working copy. */
export default function Cards() {
  const [cards, setCards] = useState<Card[]>(CARDS);
  const [filter, setFilter] = useState('');
  const v = useMemo(() => validateCards(cards), [cards]);
  const sum = summarizeCards(cards);
  const shown = cards.filter(
    (c) => !filter || `${c.id} ${c.name} ${c.color} ${c.age}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const edit = (i: number, patch: Partial<Card>) =>
    setCards(cards.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="mx-auto max-w-[1440px] pb-8">
      <DesignerNav />
      <header className="px-4 pt-[22px] md:px-7">
        <h1 className="m-0 font-display text-[36px] font-extrabold">Cards</h1>
        <p className="mt-1 text-muted">
          The 60 cards from <code className="font-mono">spec/cards.json</code>. Edit years and points here to
          try ideas, check the set, and export JSON or CSV. The game reads only{' '}
          <code className="font-mono">spec/cards.json</code>.
        </p>
      </header>
      <section
        className="mx-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-4 text-sm md:mx-7"
        style={{ borderColor: v.ok ? 'var(--line)' : 'var(--alert)' }}
        data-testid="card-validation"
      >
        <span>
          {cards.length} cards · Young {sum.young} · Middle {sum.middle} · Old {sum.old} · {sum.powers} powers
          · {sum.reflections} Reflection
        </span>
        <span className={v.ok ? 'text-door' : 'text-alert'}>
          {v.ok ? 'Valid: unique ids, all five domains, no Young requirements.' : v.errors.join(' ')}
        </span>
        <div className="flex-1" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter"
          aria-label="Filter cards"
          className="min-h-[44px] rounded-[10px] border border-line bg-ink px-3 text-text"
        />
        <button
          type="button"
          onClick={() => download('cards.json', JSON.stringify({ version: '0.2', cards }, null, 2))}
          className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => download('cards.csv', toCsv(cards))}
          className="min-h-[44px] cursor-pointer rounded-xl border border-line bg-surface-2 px-4 text-text"
        >
          Export CSV
        </button>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-line px-4">
          Import JSON
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const d = JSON.parse(await f.text());
                setCards(Array.isArray(d) ? d : d.cards);
              } catch {
                /* invalid file: validation panel will show */
              }
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setCards(CARDS)}
          className="min-h-[44px] cursor-pointer rounded-xl border-none bg-transparent px-2 text-muted underline"
        >
          Reset
        </button>
      </section>
      <div className="mx-4 mt-4 overflow-x-auto rounded-2xl border border-line bg-surface md:mx-7">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              {['ID', 'Name', 'Domain', 'Age', 'Years', 'Points', 'Requirement', 'Power / Reflection'].map(
                (h) => (
                  <th key={h} className="border-b border-line-soft px-3 py-2 font-normal">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const i = cards.indexOf(c);
              return (
                <tr key={c.id}>
                  <td className="border-b border-[var(--row-line)] px-3 py-1.5 font-mono">{c.id}</td>
                  <td className="border-b border-[var(--row-line)] px-3">{c.name}</td>
                  <td className="border-b border-[var(--row-line)] px-3">
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ background: DOMAIN[c.color].css }}
                    />
                    {DOMAIN[c.color].name}
                  </td>
                  <td className="border-b border-[var(--row-line)] px-3">{c.age}</td>
                  <td className="border-b border-[var(--row-line)] px-3">
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={c.years}
                      onChange={(e) => edit(i, { years: Number(e.target.value) })}
                      aria-label={`${c.id} years`}
                      className="w-14 rounded-md border border-line bg-ink px-1 text-text"
                    />
                  </td>
                  <td className="border-b border-[var(--row-line)] px-3">
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={c.points}
                      onChange={(e) => edit(i, { points: Number(e.target.value) })}
                      aria-label={`${c.id} points`}
                      className="w-14 rounded-md border border-line bg-ink px-1 text-text"
                    />
                  </td>
                  <td className="border-b border-[var(--row-line)] px-3">
                    {c.requires ? `${c.requires.count} ${DOMAIN[c.requires.color].name}` : '—'}
                  </td>
                  <td className="border-b border-[var(--row-line)] px-3 text-muted">{powerText(c) ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
