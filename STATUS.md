# STATUS — Doorway overnight build

**Current milestone:** done — all milestones M1–M15 complete; PR open into `master` (the repo has no `main`): https://github.com/codein-artout/doorway/pull/1

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
| M8 | Study S1–S5 complete: 143 runs, 437,730 games (4 background slices of ≤ 24 min) | b3aab56 |
| M9 | Aggregate + report on the full study (reports/data, ANALYSIS.md, analysis.html) | b3aab56 |
| M10 | Web shell, tokens, fonts, core components, /design-check | 300416c |
| M11 | New game screen, local table, bots in Web Worker, previews, undo, log, rules, keyboard, tips | 2f64a0b |
| M12 | Swaps, Doorway selection, results, replay viewer, export/import | 7649a61 |
| M13 | Phone layouts, accessibility pass, Playwright e2e (12 tests green) | 127b382 |
| M14 | /designer Analysis + Sandbox + card browser/editor (stretch done) | 7649a61 |
| M15 | README, DECISIONS, fresh-clone verification, PR | (final commit) |

## In progress
- Nothing.

## Verification (fresh clone of the pushed branch, 2026-11-04 ~00:00 UTC)
- `pnpm install`, `pnpm lint`, `pnpm typecheck`: pass.
- `pnpm test`: 201 tests in 16 files pass; rule coverage: all 201 IDs have tests (6 deferred); property tests at 10,000 games (+3,000 variant games); §16 worked example passes.
- Perf: 1,000 greedy 4p games in 1.2 s (target < 10 s). Sweep speed: 3 values × 10,000 4p heuristic games in 42 s (target < 2 min). Lookahead: ~250 ms per 4p game with one lookahead seat (target ≤ 3 s).
- `pnpm sim --players 4 --games 1000 --bots greedy,tempo,specialist,generalist`: 2.5 s. `pnpm sim:report`: reproduces the committed ANALYSIS.md byte for byte.
- `pnpm build`: pass. `pnpm e2e`: 12 Playwright tests pass (full 2p game vs bot at Instant, keyboard, 360 px, axe on every page, sandbox save).

## Headline results
- The Doorway matters for everyone: 4p first arrivals still lose 3.1 discs (tower 11.8 vs tile 9.1); non-first arrivals lose 5.7 on average across 2–4p (target ≥ 2).
- No archetype dominates (best 4p: Late bloomer 30.3%); the lookahead search bot reaches 36.1% (over 35% on the stricter reading).
- Seat advantage is negligible (worst 0.6 pts).
- Reflection cards are the strongest cards (1.3–1.5× fair win share when taken).

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
- 23:37 — study complete (437,730 games); aggregate + report.
- 23:55 — fresh-clone verification; PR opened.
