#!/usr/bin/env tsx
// pnpm sim:report — regenerate reports/ANALYSIS.md and reports/analysis.html from reports/data (no re-simulation).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderHtml } from './html';
import { renderMarkdown } from './markdown';

export function report(dataDir = path.join('reports', 'data'), outDir = 'reports') {
  const f = path.join(dataDir, 'summary.json');
  if (!existsSync(f)) throw new Error(`${f} not found — run pnpm sim:aggregate (or pnpm sim:study) first.`);
  const s = JSON.parse(readFileSync(f, 'utf8'));
  const md = renderMarkdown(s);
  const html = renderHtml(s);
  writeFileSync(path.join(outDir, 'ANALYSIS.md'), md);
  writeFileSync(path.join(outDir, 'analysis.html'), html);
  return { md, html };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('report', 'index.ts'));
if (isMain) {
  const { md, html } = report();
  console.log(
    `Wrote reports/ANALYSIS.md (${(md.length / 1024).toFixed(0)} KB) and reports/analysis.html (${(html.length / 1024).toFixed(0)} KB).`,
  );
}
