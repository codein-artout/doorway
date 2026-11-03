# DECISIONS — Doorway overnight build

Every judgement call made while building, with date, decision, why and alternatives.
"Proposed ruling" entries are gaps or contradictions found in `spec/` (read-only); each has an ID
(`P1`, `P2`, …) that the tests cite.

## Environment and process

### D-ENV-1 — Node, pnpm, tooling (2026-11-03)
- **Found:** Node v22.23.4, pnpm 10.28.0, 4 vCPU, 15 GB RAM. Playwright 1.63.0 with Chromium pre-installed at `/opt/pw-browsers`.
- **Decision:** pin `@playwright/test` to 1.63.0 so it uses the pre-installed browser; do not download another one.
  TypeScript is pinned to 5.9.3 (npm `latest` is 7.x, the native port; typescript-eslint and Next.js are not yet validated against it).
- **Alternatives:** `playwright install` a new browser (slower, can be blocked by the proxy).

### D-ENV-2 — BUILD_PROMPT.md (2026-11-03)
- **Decision:** the repo held an older draft of the prompt (deployment, Prisma, M18). The prompt actually given to the session is the authority, so it is saved as `BUILD_PROMPT.md`; the older draft is kept as `BUILD_PROMPT.previous-draft.md` for reference only.

### D-ENV-3 — Packages run from TypeScript source (2026-11-03)
- **Decision:** workspace packages export `src/index.ts` directly (no build step). Node CLIs run through `tsx`; Next.js consumes them via `transpilePackages`; Vitest reads them natively.
- **Why:** one source of truth, no stale `dist/`, fastest iteration overnight.
- **Alternatives:** tsup/tsc builds per package (more moving parts).

## Engine

### D-ENG-1 — Ruleset and cards travel inside GameState (2026-11-03)
- **Decision:** `GameState` keeps the build spec §5.2 fields and adds `ruleset`, `cards` (by id), `rulesetHash`, `cardsHash`, `moves` (the replayable action log) and `lastActor`.
- **Why:** `apply(state, move)` (spec §5.1) has no other way to see the rules; embedding keeps the state self-contained, JSON-serializable and replayable anywhere (browser, worker, Node, future server). Clones share the card objects by reference (they are never mutated).
- **Alternatives:** a global registry keyed by `rulesetId` (breaks custom rulesets and workers).

### D-ENG-2 — `apply(state, move, playerId?)` (2026-11-03)
- **Decision:** `apply` takes an optional `playerId`; it defaults to `currentPlayer(state)`. Needed because `choose_window` can be made by any arrived player at any time (R25), not only the current one.
- `applyInPlace` is the same validation and resolution but mutates (used by simulations and search for speed). `apply` = clone + `applyInPlace` + log append.

### D-ENG-3 — Deferred refill and arrival while swaps are pending (2026-11-03)
- **Decision:** R8 orders a quest as move → disc → powers → Keep a diary swap → Milestone swaps → refill → arrival. Swaps are player choices, so the engine stores `pending.after = { refill, endTurn }` and performs the refill, arrival and (solo) drift only when the last swap is resolved or auto-skipped.
- **Why:** literal R8 order; the refilled card is not visible while choosing swaps, exactly as at the table.

### D-ENG-4 — Window moves in `legalMoves` (2026-11-03)
- **Decision:** `legalMoves` lists every contiguous window of length 1..allowance (R24 "the engine accepts any"), so `legalMoves ⟺ apply` holds. UI and bots use `windowMoves(state, id, maximalOnly=true)` / `bestWindow`.
- An empty tower gets `keptRange = [0, -1]` (empty window) automatically on arrival.

### D-ENG-5 — RNG (2026-11-03)
- **Decision:** sfc32 seeded by cyrb128(seed) with 12 warm-up draws; state serialized as four hex words `aaaaaaaa:bbbbbbbb:cccccccc:dddddddd` in `rngState`. Bot streams are seeded from `bot|<gameSeed>|<seat>|<policyId>` (R30).

### D-ENG-6 — Hashes (2026-11-03)
- **Decision:** a pure-JS SHA-256 (no Node or WebCrypto, so it is synchronous everywhere). `rulesetHash = sha256(canonicalJson(ruleset))`, `cardsHash = sha256(canonicalJson(cards[]))`, `stateHash = sha256(canonicalJson(state minus log/cards/ruleset))`. Canonical JSON sorts object keys.

### D-ENG-7 — Override syntax (2026-11-03)
- **Decision:** dotted paths (`doorway.4`, `doorway.4.0`, `passion.5`). Values: `10,7,5,3` or `10/7/5/3` → array; `3:2,4:4,5:7` → object; a plain list on an object key (e.g. `passion=2,4,7`) maps onto the existing thresholds in ascending key order, so the S4 sweep `passion: 2/4/7` means `{3:2, 4:4, 5:7}`.

### D-ENG-8 — Hash memoization (2026-11-03)
- **Decision:** `rulesetHash`/`cardsHash` are memoized per object (WeakMap). Content objects must be treated as immutable once loaded; overrides always deep-clone (`setByPath`), so a changed ruleset is a new object with a new hash.
- **Why:** hashing 60 cards in pure JS on every `init` cost ~0.3 ms/game, which dominated simulations and replays.

### D-ENG-9 — Arrival during a pending swap (2026-11-03)
- **Decision:** a pawn that reached the track end during a quest/rush that also queued swaps stands on space 40 with `arrivalOrder = null` until the swaps resolve (R8: swaps before arrival). The invariant checker allows exactly this state.

## Tests

### D-TEST-1 — Property-test budget (2026-11-03)
- **Decision:** 10,000 random 1–4p default games (fast-check, fixed seed 20261103) plus 1,000 minCost = 0, 1,000 alternative-Doorway and 1,000 solo games. On every step: invariants, and `legalMoves ⟺ apply` on three candidates (two from a "move universe" of in- and out-of-market quests with every power-flag combination, rushes with every discard, out-of-range swaps and windows; one legal move). Every 200th game (40th for variants) checks the whole universe exhaustively. Replays compare players + scores for every game and the full `stateHash` for 10%.
- **Why:** exhaustive checks on every state take ~5 minutes; this keeps `pnpm test` around 30–40 s while still covering every move shape.
