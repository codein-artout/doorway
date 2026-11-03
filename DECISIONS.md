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

## Bots and simulation

### D-BOT-1 — Bot interface and features (2026-11-03)
- **Decision:** every bot implements `BotPolicy { id, label, params, choose(view, rng) }`. `BotView.state` is the public state with decks *sorted by id* (the set of unseen cards is public, the order is not — R15) and the RNG state blanked. Weighted strategies score each legal move as Σ weight × feature (features in `packages/bots/src/features.ts`); weights/params live in `packages/bots/strategies.json`.
- The "projected window" used by features is the top `allowance − expectedFutureDiscs` discs of the tower, where the allowance is projected from the current race position and future discs = years left ÷ `avgYears`.
- Pending swaps use one shared chooser (best projected-window value); windows are always the engine's `bestWindow` (spec §6).

### D-BOT-2 — Lookahead budget (2026-11-03)
- **Decision:** flat determinized Monte Carlo with common random numbers: 16 determinizations × up to 6 candidate moves (top quests by points/year, plain rush, best denying discard), greedy rollouts. Budget is counted in rollouts, not milliseconds, so it is deterministic. Measured: ~7 ms/move in 2p, ~250 ms per 4p game with one lookahead seat (target ≤ 3 s), beats greedy ~80% in 2p (test requires > 60%).
- **Alternatives:** ms-based budgets (non-deterministic across machines), MCTS (more code, little gain at this budget).

### D-BOT-3 — Bot RNG in the browser (2026-11-03)
- **Decision:** in the web client each bot decision seeds its stream from `botSeed(seed, seat, policy) + '|m' + moveIndex`, so undo/redo and reloads reproduce the same bot choices. The simulator keeps one continuous stream per seat. Both satisfy R30 (own stream, deal unaffected).

### D-SIM-1 — Seat mode `field` and explicit seat lists (2026-11-03)
- **Decision:** besides `rotate | fixed | all-permutations`, the CLI accepts `--seats field` (each seat drawn uniformly from `--bots`, seeded per game); the study can pass explicit seat lists (S2 uses all 990 / 7,920 ordered seatings of distinct strategies).

### D-SIM-2 — Paired seeds across sweep values (2026-11-03)
- **Decision:** game *g* uses seed `<seed>|g<g>` for every sweep value, so variants are compared on identical deals (common random numbers). Value labels write lists with `/` (`doorway.4=10/7/5/3`) so they never break CSV cells.

### D-SIM-3 — S4 lookahead budget (2026-11-03)
- **Decision:** in the S4 sweep fields the lookahead seat runs at 4 determinizations × 5 candidates (about 4× cheaper). S4C re-runs `doorway.4` and `experienceCap` with 2,000 games per value where every game has one full-budget lookahead seat (the prompt's "confirm the top findings with 2k games that include lookahead").

### D-SIM-4 — Chunked, resumable study (2026-11-03)
- **Decision:** runs are split into chunks (125–500 games) written atomically to `reports/runs/<run>/chunks/`. `--resume` skips existing chunks; `study.ts --budget-min 22` processes runs until the time budget is spent, so each background job stays under 25 minutes and is restarted until the plan is complete.

### D-SIM-5 — Statistics (2026-11-03)
- Win rates count a k-way shared win as 1/k (R28) with Wilson 95% intervals over player-games. Card "win when picked" is the picker's mean win share relative to fair share (1/n), 95% CI by normal approximation; flagged when the CI clears fair by more than ±10%. Predictors of winning: logistic regression (IRLS) on standardized components plus point-biserial correlations, on up to 60,000 4p player-games.
- Seat advantage pass/fail uses percentage points (±5 pts) per R45; the relative reading is reported alongside.

## Web app

### D-WEB-1 — GameClient boundary (2026-11-03)
- **Decision:** the table talks only to `GameClient` (`getSnapshot / subscribe / submit / undo / setBotSpeed / toReplay`). `LocalGameClient` runs the engine in the page and bots in a Web Worker (`workers/bot.worker.ts`). A networked client (server-authoritative engine, rooms, R32 online undo with `revealAt`) can implement the same interface later. Moves are plain serializable actions; a replay is `{ ruleset, seed, seats, moves }` (format `doorway-replay@1`, ruleset embedded so custom rulesets travel).
- Persistence is localStorage only (current game, finished games, custom rulesets, settings, tips seen), every access wrapped in try/catch.

### D-WEB-2 — Local undo semantics (2026-11-03)
- **Decision (R32, local):** Undo reverts the most recent *human* move and every bot move after it; unlimited. In all-bot games it steps back one move.

### D-WEB-3 — Once-per-game power toggles (2026-11-03)
- **Decision:** *Old friends* / *Say yes more* appear as checkboxes in the action bar only when the player holds the unused power **and** some face-up card would need it (R17/R18). Cards that need a power are clickable only while it is ticked; the move sent to the engine sets the flag exactly when needed.

### D-WEB-4 — Best-window hint (2026-11-03)
- **Decision:** following `Doorway.dc.html`, the hint is a toggle ("Show best stretch") that is available by default and disabled in Blind test ("Hint off (blind test)"). The live score preview always updates (R35).

### D-WEB-5 — Deferred UI from the mockups (2026-11-03)
- The "Something feels off" flag (R37), the privacy footer (R40), the survey (R36), room codes and invite/join are later features (BUILD_PROMPT §7) and are not shown in the local build. The header shows `LOCAL · n players · ruleset · seed` where the mockup shows the room code.

### D-WEB-6 — Faded discs without opacity (2026-11-03)
- **Decision:** "left behind" discs are drawn with a 30% colour-mix of the domain colour over the surface (≈ the 25–32% opacity of DESIGN.md) instead of CSS opacity, so text on them keeps WCAG contrast and axe passes. Heatmap cells pick whichever text colour reaches 4.5:1 and deepen the fill until one does.

### D-WEB-7 — Tailwind token names (2026-11-03)
- `--base` (tower base plate) is exposed to Tailwind as `plate`, because a `base` colour collides with Tailwind's `text-base` font-size utility.
