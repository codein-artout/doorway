# STATUS — Doorway overnight build

**Current milestone:** M7 — simulator CLI

## Finished milestones
| # | What | Commit |
|---|---|---|
| M1 | Workspace scaffold, content package, validation and hash tests | edeea29 |
| M2 | Engine core | b819275 |
| M3 | Rule coverage checklist + checker, §16 worked example, 10k property tests, perf | fd00952 |
| M4 | Bot interface, random, greedy, noisy wrapper, determinism tests | fd00952 |
| M5 | Eight weighted strategies from strategies.json, beat-random tests | fd00952 |
| M6 | Lookahead (determinized Monte Carlo, 16 determinizations × ≤6 candidates), beats greedy ~80% in 2p | fd00952 |

## In progress
- M7: simulator CLI (workers, shards, resume, sweeps, outputs).

## Next
- M8 start the study in background shards; M9 report; M10+ web.

## Blockers and workarounds
- `pnpm test` runs the rule-coverage checker first; 13 IDs (web/sim rulings: R32, R34, R35, R38, R39, R41, R45, R46, RB-13.18, RB-13.W1–W4) get their tests in M7–M11, so `pnpm test` reports them until then. `vitest run` alone is green.

## How to run
```bash
pnpm install
pnpm test        # unit + property tests (and the rule-coverage check)
pnpm lint && pnpm typecheck
```

## Time log (UTC)
- 2026-11-03 21:23 — session start; read spec, rulings, design.
- 2026-11-03 21:40 — M1 scaffold + content package passing.
- 2026-11-03 21:51 — M2 engine core pushed.
- 2026-11-03 22:01 — M3–M6 pushed (179 tests green).
