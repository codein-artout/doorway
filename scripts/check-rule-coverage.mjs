#!/usr/bin/env node
// Fails if any rule ID in packages/engine/test/RULE_COVERAGE.md (outside the "Deferred" section)
// has no test whose name contains it. Test names are read from it()/test()/describe() titles in
// every *.test.ts under packages/ and apps/.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const covFile = path.join(root, 'packages/engine/test/RULE_COVERAGE.md');
if (!existsSync(covFile)) {
  console.error('rule coverage: RULE_COVERAGE.md not found');
  process.exit(1);
}
const md = readFileSync(covFile, 'utf8');

// IDs are the first backticked token of a table row: | `RB-4.2` | ... |
const required = [];
const deferred = [];
let inDeferred = false;
for (const line of md.split('\n')) {
  const h = /^#{1,6}\s+(.*)$/.exec(line);
  if (h) inDeferred = /deferred/i.test(h[1]);
  const m = /^\|\s*`([A-Z][A-Z0-9.-]*)`\s*\|/.exec(line);
  if (m) (inDeferred ? deferred : required).push(m[1]);
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const files = [
  ...walk(path.join(root, 'packages'), []),
  ...(existsSync(path.join(root, 'apps')) ? walk(path.join(root, 'apps'), []) : []),
];
const titles = [];
const titleRe =
  /\b(?:it|test|describe)(?:\.each\([^)]*\))?(?:\.(?:skip|only|concurrent))?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(titleRe)) titles.push(m[2]);
}
const idRe = (id) =>
  new RegExp(`(^|[^A-Za-z0-9.-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9-]|\\.(?![0-9]))`);
const missing = required.filter((id) => !titles.some((t) => idRe(id).test(t)));
const dupes = required.filter((id, i) => required.indexOf(id) !== i);
if (dupes.length) {
  console.error(`rule coverage: duplicate IDs: ${dupes.join(', ')}`);
  process.exit(1);
}
if (missing.length) {
  console.error(
    `rule coverage: ${missing.length} of ${required.length} IDs have no test:\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(`rule coverage: all ${required.length} IDs have tests (${deferred.length} deferred).`);
