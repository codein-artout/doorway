// The committed bot-study numbers the game report compares against (reports/data/summary.json, read-only),
// trimmed at build time to a few per-player-count averages. Static: no server work at runtime.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { trimStudy } from '@/lib/report-model';

export const dynamic = 'force-static';

export function GET() {
  for (const p of [
    path.join(process.cwd(), '../../reports/data/summary.json'),
    path.join(process.cwd(), 'reports/data/summary.json'),
  ])
    if (existsSync(p)) return Response.json(trimStudy(JSON.parse(readFileSync(p, 'utf8'))));
  return Response.json(null);
}
