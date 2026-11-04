// Self-contained HTML report: inline CSS + inline SVG charts in DESIGN.md's dark tokens. No network.

import { answers } from './markdown';
import { buildModel, COLORS as C, fx, label, ordinal, pct, TARGETS, type Summary } from './model';

const esc = (x: unknown) =>
  String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function mixRgb(a: number[], b: number[], t: number) {
  return a.map((x, i) => Math.round(x + (b[i] - x) * t));
}
function lum(c: number[]) {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Diverging colour: blue (below) → surface → orange (above). */
export function diverging(v: number, mid: number, span: number) {
  let t = Math.min(1, Math.abs(v - mid) / span);
  const to = v >= mid ? [240, 160, 75] : [91, 141, 239];
  // nudge mid-strength cells until one text colour clears 4.5:1
  const ok = (c: number[]) =>
    Math.max(contrast(lum(c), lum([18, 19, 31])), contrast(lum(c), lum([236, 232, 223]))) >= 4.5;
  while (t < 1 && !ok(mixRgb([27, 29, 46], to, t))) t = Math.min(1, t + 0.05);
  const rgb = mixRgb([27, 29, 46], v >= mid ? [240, 160, 75] : [91, 141, 239], t);
  const L = lum(rgb);
  // pick whichever text colour reads better on this cell (WCAG contrast)
  const fg = contrast(L, lum([18, 19, 31])) >= contrast(L, lum([236, 232, 223])) ? C.ink : C.text;
  return { bg: `rgb(${rgb.join(',')})`, fg };
}

export function winChart(
  rows: { label: string; win: number; lo: number; hi: number }[],
  fair: number,
  ceiling: number | null,
) {
  const max = Math.max(0.4, ...rows.map((r) => r.hi)) * 1.05;
  const W = 640,
    rowH = 26,
    left = 150,
    right = 64,
    H = rows.length * rowH + 28;
  const x = (v: number) => left + (v / max) * (W - left - right);
  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].filter((t) => t <= max);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Win rate by strategy with 95% intervals">
  ${ticks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H - 20}" stroke="${C.lineSoft}"/><text x="${x(t)}" y="${H - 6}" fill="${C.muted}" font-size="11" text-anchor="middle" font-family="monospace">${pct(t, 0)}</text>`).join('')}
  <line x1="${x(fair)}" x2="${x(fair)}" y1="0" y2="${H - 20}" stroke="${C.grey}" stroke-dasharray="4 3"/>
  ${ceiling ? `<line x1="${x(ceiling)}" x2="${x(ceiling)}" y1="0" y2="${H - 20}" stroke="${C.passion}" stroke-width="2"/>` : ''}
  ${rows
    .map((r, i) => {
      const y = i * rowH + 14;
      const over = ceiling !== null && r.win > ceiling;
      return `<text x="${left - 10}" y="${y + 4}" fill="${C.text}" font-size="13" text-anchor="end">${esc(r.label)}</text>
    <line x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${y}" y2="${y}" stroke="${C.muted}" stroke-width="2"/>
    <circle cx="${x(r.win)}" cy="${y}" r="6" fill="${over ? C.passion : C.door}"/>
    <text x="${W - 4}" y="${y + 4}" fill="${C.text}" font-size="12" text-anchor="end" font-family="monospace" font-weight="700">${pct(r.win)}</text>`;
    })
    .join('')}
</svg>`;
}

function doorwayBars(d: { players: number; rows: any[] }) {
  const maxT = Math.max(...d.rows.map((r) => r.tower)) * 1.1;
  return d.rows
    .map(
      (
        r,
      ) => `<div class="drow"><div class="dlab"><b>${ordinal(r.order)} · keeps ${fx(r.allowance, 1)}</b><span>tower ${fx(r.tower, 1)} · loses <b class="mono">${fx(r.lost, 2)}</b> · ${pct(r.shareLostAny, 0)} lose any</span></div>
      <div class="track"><span style="width:${(r.tower / maxT) * 100}%;background:${C.grey}"></span><span style="width:${(Math.min(r.allowance, r.tower) / maxT) * 100}%;background:${C.door}"></span></div></div>`,
    )
    .join('');
}

export function seatBars(x: { players: number; rows: any[] }) {
  const W = 300,
    H = 90,
    mid = 45,
    scale = 4; // px per pt
  const bw = W / x.rows.length;
  return `<svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Seat advantage, ${x.players} players">
  <rect x="0" y="${mid - TARGETS.seatPP * scale}" width="${W}" height="${TARGETS.seatPP * 2 * scale}" fill="${C.sunk}"/>
  <line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="${C.line}"/>
  ${x.rows
    .map((r, i) => {
      const h = Math.min(mid - 2, Math.abs(r.diffPP) * scale);
      const y = r.diffPP >= 0 ? mid - h : mid;
      return `<rect x="${i * bw + bw * 0.25}" y="${y}" width="${bw * 0.5}" height="${Math.max(1, h)}" rx="2" fill="${r.diffPP >= 0 ? C.orange : C.blue}"/>
      <text x="${i * bw + bw / 2}" y="${H + 14}" fill="${C.muted}" font-size="11" text-anchor="middle" font-family="monospace">seat ${r.seat} ${r.diffPP >= 0 ? '+' : ''}${fx(r.diffPP, 1)}</text>`;
    })
    .join('')}
</svg>`;
}

export function histogram(h: { lo: number; width: number; counts: number[] } | null, color: string) {
  if (!h) return '';
  const W = 640,
    H = 140;
  const max = Math.max(...h.counts);
  const bw = W / h.counts.length;
  return `<svg viewBox="0 0 ${W} ${H + 18}" width="100%" role="img" aria-label="Score distribution">
  ${h.counts
    .map((c, i) => {
      const bh = (c / max) * H;
      return `<rect x="${i * bw + 1}" y="${H - bh}" width="${bw - 2}" height="${bh}" fill="${color}" rx="2"/>${i % 2 === 0 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" fill="${C.muted}" font-size="10" text-anchor="middle" font-family="monospace">${h.lo + i * h.width}</text>` : ''}`;
    })
    .join('')}
</svg>`;
}

function sweepCard(w: any, s: Summary) {
  const max = Math.max(0.4, ...w.values.map((v: any) => v.topWin));
  return `<div class="sweep"><div class="mono b">${esc(w.key)}</div>
  <div class="bars">${w.values
    .map(
      (v: any) =>
        `<div class="bar"><span class="mono small">${fx(v.nonFirstLost, 1)}</span><span class="col" style="height:${(v.topWin / max) * 80}px;background:${v.base ? C.door : C.grey};${v.base ? `outline:2px solid ${C.door};outline-offset:2px` : ''}" title="${esc(label(s, v.topPolicy))} ${pct(v.topWin)}"></span></div>`,
    )
    .join('')}</div>
  <div class="bars labels">${w.values.map((v: any) => `<span class="mono small">${esc(v.label)}</span>`).join('')}</div></div>`;
}

export function renderHtml(s: Summary): string {
  const m = buildModel(s);
  const ans = answers(m);
  const sec = (title: string, body: string, extra = '') =>
    `<section class="panel ${extra}"><h2>${title}</h2>${body}</section>`;
  const tbl = (head: string[], rows: (string | number)[][]) =>
    `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const matrix = m.matrix.length
    ? `<div class="scroll"><div class="mx" style="grid-template-columns:120px repeat(${m.matrix.length}, minmax(34px,1fr))"><span></span>${m.matrix.map((r) => `<span class="mono muted c">${r.short}</span>`).join('')}${m.matrix
        .map(
          (r) =>
            `<span class="rl">${esc(r.label)}</span>${r.cells
              .map((c: any) => {
                if (c.v === null) return '<span class="cell">—</span>';
                const col = diverging(c.v, 0.5, 0.35);
                return `<span class="cell mono" style="background:${col.bg};color:${col.fg}" title="${esc(r.label)} vs ${esc(label(s, c.vs))}: ${pct(c.v)}">${Math.round(c.v * 100)}</span>`;
              })
              .join('')}`,
        )
        .join('')}</div></div>`
    : '';
  const comps = m.components
    .map(
      (c) =>
        `<div class="comp"><span>${c.name}</span><span class="track sm"><span style="width:${(c.share ?? 0) * 100}%;background:${c.color}"></span></span><span class="mono small">${pct(c.share, 0)} · β ${fx(c.beta, 2)} · r ${fx(c.r, 2)}</span></div>`,
    )
    .join('');
  const body = `
<nav><span class="brand">Doorway · Designer</span><span class="muted">Simulation analysis · ruleset ${esc(s.ruleset.id)}</span></nav>
<header><h1>What the bots found</h1><p class="muted">${m.totals.games.toLocaleString()} games · ${Object.keys(s.strategies).length} strategies + noisy variants · 1–4 players · every seat order · generated ${esc(String(s.generatedAt).slice(0, 16).replace('T', ' '))} UTC</p></header>
<section class="heads">${ans
    .slice(0, 4)
    .map(
      (a) =>
        `<div class="head ${a.chip === 'HEADLINE' ? 'hl' : ''}"><span class="muted small">${esc(a.q)}</span><span class="ans">${esc(a.a.split('. ')[0])}.</span><span class="small">${esc(a.a.split('. ').slice(1).join('. '))}</span><span class="chip" style="background:${a.chip === 'HEADLINE' ? C.alert : C.door}">${a.chip}</span></div>`,
    )
    .join('')}</section>
<div class="row">
${sec('Does arriving first make the Doorway irrelevant?', `<p class="muted small">Average tower at arrival (grey) vs. tile size (light), by arrival order. Every bot chooses its stretch optimally.</p>${m.doorway.map((d) => `<h3>${d.players} players · non-first lose ${fx(d.nonFirstLost)} · ${pct(d.shareLostAny, 0)} lose any</h3>${doorwayBars(d)}`).join('')}`, 'door')}
${sec('Win rate by strategy · 4 players', `<p class="muted small">Dot = win rate, line = Wilson 95% CI. Dashed = fair share (25%). Red = the 35% "ready to print" ceiling.</p>${winChart(m.strat4, 0.25, TARGETS.maxStrategyWin4p)}`)}
</div>
<div class="row">
${sec('Head to head · 2 players', `<p class="muted small">Row strategy's win share against the column strategy, both seat orders. Orange = row wins more, blue = row loses more.</p>${matrix}`)}
${sec('Seat advantage', `<p class="muted small">Win rate minus fair share by starting seat (seat 1 = top of the stack). Shaded band = ±5 pts.</p>${m.seats.map((x) => `<h3>${x.players} players · worst ${fx(x.worstPP, 1)} pts (${pct(x.worstRel)} relative)</h3>${seatBars(x)}`).join('')}`)}
</div>
<div class="row">
${sec('Where points come from · 4p', `<p class="muted small">Share of all points, logistic β per sd (predicting a win) and point-biserial r.</p>${comps}<div class="stats"><div><b>${fx(m.g4?.turnsPerGame.mean, 0)}</b><span class="muted small">turns per game (4p)</span></div><div><b>${fx(m.g4?.extraTurns.mean, 1)}</b><span class="muted small">extra back-to-back turns per player</span></div><div><b>${pct(m.rushShare, 1)}</b><span class="muted small">of moves are Rush</span></div><div><b>${fx(m.g4?.savedExperience.mean, 1)}</b><span class="muted small">years saved by experience per player</span></div></div>`)}
${sec('Score distribution · 4p', histogram(m.g4?.scoreHist ?? null, C.cards) + `<p class="muted small">Mean ${fx(m.g4?.score.mean, 1)}, sd ${fx(m.g4?.score.sd, 1)}.</p>`)}
</div>
<div class="row">
${sec(
  'Cards to look at',
  `<p class="muted small">Pick rate when face up and takeable; win share of players who took it relative to fair (1.00 = fair). Flag when the 95% CI clears fair by ±${pct(s.cards.margin, 0)}.</p>${tbl(
    ['ID', 'Card', 'Picked', 'Win when taken', 'Flag'],
    m.lookAt.map((c: any) => [
      `<span class="mono">${c.id}</span>`,
      `<span class="dot" style="background:${C.domains[c.domain]}"></span>${esc(c.name)}`,
      pct(c.pickRate),
      `${fx(c.relWin)}× [${fx(c.relLo)}, ${fx(c.relHi)}]`,
      c.flag
        ? `<span class="chip" style="background:${c.flag === 'strong' ? C.passion : C.fullLife}">${c.flag.toUpperCase()}</span>`
        : '',
    ]),
  )}`,
)}
${sec('If we turn one dial…', `<p class="muted small">Top strategy's win rate (bar) and discs lost by non-first arrivals (number), per value. Baseline outlined.</p><div class="sweeps">${m.sweeps.map((w) => sweepCard(w, s)).join('')}</div>`)}
</div>
${sec('Suggested rule tweaks', `<p class="muted small">Each cites its sweep. Nothing changes until you accept it in the sandbox.</p><ol>${m.tweaks.map((t) => `<li><b>${esc(t.title)}</b> — <span class="muted">${esc(t.why)}</span><br><span class="small">${esc(t.evidence)}</span></li>`).join('')}</ol>`, 'tweaks')}
${sec(
  '"Ready to print" signals',
  tbl(
    ['Signal', 'Target', 'Measured', 'Verdict'],
    m.readyToPrint.map((r) => [
      esc(r.signal),
      esc(r.target),
      esc(r.value),
      r.verdict === 'pass'
        ? `<span class="chip" style="background:${C.door}">PASS</span>`
        : r.verdict === 'fail'
          ? `<span class="chip" style="background:${C.passion}">FAIL</span>`
          : '<span class="muted">human playtests</span>',
    ]),
  ),
)}
${
  m.solo.length
    ? sec(
        'Solo challenge',
        tbl(
          [
            'Strategy',
            'Mean (sd)',
            'A quiet life',
            'A good life',
            'A full life',
            'Everything you could bring',
          ],
          m.solo.map((x: any) => [
            esc(x.label),
            `${fx(x.score.mean, 1)} (${fx(x.score.sd, 1)})`,
            pct(x.ratings['A quiet life']),
            pct(x.ratings['A good life']),
            pct(x.ratings['A full life']),
            pct(x.ratings['Everything you could bring']),
          ]),
        ),
      )
    : ''
}
<p class="muted small foot">Full tables: <code>reports/ANALYSIS.md</code>. Data: <code>reports/data/</code>. Regenerate with <code>pnpm sim:report</code>.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Doorway — simulation analysis</title>
<style>
:root{--ink:${C.ink};--surface:${C.surface};--surface-2:${C.surface2};--sunk:${C.sunk};--line:${C.line};--line-soft:${C.lineSoft};--text:${C.text};--muted:${C.muted};--door:${C.door};--alert:${C.alert}}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--text);font:15px/1.45 'Atkinson Hyperlegible',system-ui,sans-serif}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}.muted{color:var(--muted)}.small{font-size:12px}.b{font-weight:700}
nav{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding:14px 28px;border-bottom:1px solid var(--line-soft)}.brand{font:800 19px 'Bricolage Grotesque',system-ui,sans-serif}
header{padding:22px 28px 6px}h1{margin:0;font:800 38px 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.015em}h2{margin:0 0 4px;font:700 19px 'Bricolage Grotesque',system-ui,sans-serif}h3{margin:14px 0 6px;font-size:13px}
.heads{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:14px 28px}.head{padding:18px;border-radius:16px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:8px}.head.hl{border-color:var(--alert)}.ans{font:800 22px 'Bricolage Grotesque',system-ui,sans-serif;line-height:1.15}
.chip{align-self:flex-start;font:700 11px 'JetBrains Mono',monospace;padding:4px 8px;border-radius:999px;color:var(--ink)}
.row{display:flex;flex-wrap:wrap;gap:16px;padding:8px 28px}.panel{flex:1 1 520px;min-width:0;padding:20px;border-radius:16px;background:var(--surface);border:1px solid var(--line);margin:0}.panel.door{border-color:var(--door)}.tweaks{margin:16px 28px;background:var(--sunk);border-color:var(--door)}section.panel+section.panel{}
body>section.panel{margin:16px 28px}
.drow{margin:8px 0}.dlab{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px}.track{position:relative;display:block;height:16px;margin-top:4px;border-radius:4px;background:var(--ink);overflow:hidden}.track span{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.track.sm{height:14px}
.comp{display:grid;grid-template-columns:90px minmax(0,1fr) 170px;gap:10px;align-items:center;font-size:13px;margin:8px 0}
.stats{margin-top:16px;padding-top:12px;border-top:1px solid var(--line-soft);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.stats b{display:block;font:800 22px 'Bricolage Grotesque',system-ui,sans-serif}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;color:var(--muted);font-weight:400;border-bottom:1px solid var(--line-soft);padding:6px 8px}td{border-bottom:1px solid #23253A;padding:7px 8px;vertical-align:top}
.dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:-1px}
.mx{display:grid;gap:2px;min-width:560px;font-size:11px}.mx .rl{font-size:12px;text-align:right;padding-right:6px;align-self:center}.mx .c{text-align:center}.cell{height:30px;display:grid;place-items:center;border-radius:3px;background:var(--ink)}
.sweeps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.sweep{padding:12px;border-radius:12px;background:var(--ink)}.bars{display:flex;gap:8px;align-items:flex-end;min-height:96px}.bars.labels{min-height:0;margin-top:6px}.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;justify-content:flex-end}.bar .col{width:100%;border-radius:3px;display:block}.bars.labels span{flex:1;text-align:center}
ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px}a{color:var(--door)}.foot{padding:12px 28px}code{font-family:'JetBrains Mono',monospace}
@media (max-width:760px){header,nav,.heads,.row{padding-left:16px;padding-right:16px}body>section.panel{margin:16px}.comp{grid-template-columns:80px 1fr}.comp .small{grid-column:1/-1}}
</style></head><body>${body}</body></html>`;
}
