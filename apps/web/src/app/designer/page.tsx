import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Analysis } from './analysis';

export const metadata = { title: 'Designer · Analysis' };

function loadSummary() {
  // the committed study results (reports/data/summary.json at the repo root)
  for (const p of [path.join(process.cwd(), '../../reports/data/summary.json'), path.join(process.cwd(), 'reports/data/summary.json')])
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return null;
}

export default function Page() {
  return <Analysis summary={loadSummary()} />;
}
