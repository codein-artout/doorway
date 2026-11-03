# STATUS — Doorway overnight build

**Current milestone:** M8/M9 — the full study is running in background slices; report when it completes. M15 docs in progress.

## Finished milestones
| # | What | Commit |
|---|---|---|
| M1 | Workspace scaffold, content package, validation and hash tests | edeea29 |
| M2 | Engine core | b819275 |
| M3 | Rule coverage checklist + checker, §16 worked example, 10k property tests, perf | fd00952 |
| M4 | Bot interface, random, greedy, noisy wrapper, determinism tests | fd00952 |
| M5 | Eight weighted strategies from strategies.json, beat-random tests | fd00952 |
| M6 | Lookahead (determinized MC, 16 determinizations), beats greedy ~80% in 2p | fd00952 |
| M7 | Simulator CLI: workers, shards, resume, sweeps, outputs | 708e66d |
| M8 | Study S1–S5 started in background slices (22 min each) | (running) |
| M9 | Aggregate + report pipeline (built on partial data; final run pending) | f8fffeb |
| M10 | Web shell, tokens, fonts, core components, /design-check | 300416c |
| M11 | New game screen, local table, bots in Web Worker, previews, undo, log, rules, keyboard, tips | 2f64a0b |
| M12 | Swaps, Doorway selection, results, replay viewer, export/import | 7649a61 |
| M13 | Phone layouts, accessibility pass, Playwright e2e (12 tests green) | 127b382 |
| M14 | /designer Analysis + Sandbox + card browser/editor (stretch done) | 7649a61 |

## In progress
- Study slices (`npx tsx packages/sim/src/study.ts --budget-min 22 --workers 3`), relaunched until `--list` shows 143/143 complete.

## Next
- `pnpm sim:aggregate && pnpm sim:report`, review ANALYSIS.md tweaks, commit reports.
- M15: fresh-clone verification, PR.

## Blockers and workarounds
- None. Playwright uses the pre-installed Chromium 1.63 (pinned `@playwright/test@1.63.0`), no download needed.

## How to run
```bash
pnpm install
pnpm test          # rule coverage + unit + property tests
pnpm e2e           # Playwright (builds and starts the app on :3200)
pnpm --filter @doorway/web dev   # http://localhost:3000
pnpm sim --players 4 --games 1000 --bots greedy,tempo,specialist,generalist
pnpm sim:study     # full study (hours); pnpm sim:aggregate; pnpm sim:report
pnpm verify
```

## Time log (UTC)
- 2026-11-03 21:23 — session start; read spec, rulings, design.
- 21:40 — M1 scaffold + content package passing.
- 21:51 — M2 engine core pushed.
- 22:01 — M3–M6 pushed (179 tests green).
- 22:06 — M7 pushed; study slice 1 started.
- 22:13 — M9 report pipeline pushed.
- 22:20–22:45 — M10–M14 web app pushed; e2e green.
