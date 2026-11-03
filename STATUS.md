# STATUS — Doorway overnight build

**Current milestone:** M2 — engine core (code written during M1; tests next)

## Finished milestones
| # | What | Commit |
|---|---|---|
| M1 | Workspace scaffold, content package, validation and hash tests | (this commit) |

## In progress
- M2: engine core (setup, RNG, turn order, quest, rush, market, swaps, arrival, scoring, events, serialize/replay).

## Next
- M3 rule coverage + worked example + property tests + perf.

## Blockers and workarounds
- none yet.

## How to run
```bash
pnpm install
pnpm test        # unit + property tests (and the rule-coverage check)
pnpm lint && pnpm typecheck
```

## Time log (UTC)
- 2026-11-03 21:23 — session start; read spec, rulings, design.
- 2026-11-03 21:40 — M1 scaffold + content package passing.
