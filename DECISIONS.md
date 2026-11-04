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

### D-SIM-6 — "Strategy archetype" in the 35% signal (2026-11-03)
- **Decision:** the spec's "no single strategy archetype wins more than 35% (4p)" is judged on the nine heuristic archetype bots. `lookahead` is a search baseline (spec §6: "stronger opponent; finds degenerate lines"), not an archetype, so it is reported on its own row as a stricter reading (36.1% in S2 4p → fail on that reading). `random` is excluded as a fuzzing bot.
- **Why:** an archetype is a play style a human might adopt; a search bot measures how much skill the rules reward.

### D-SIM-7 — Tweak selection (2026-11-03)
- **Decision:** tweaks are chosen by fixed rules over the S4 rows (and S4C when present): 4p tiles that widen the first-vs-last loss gap without raising lookahead's S4C win rate; 3p/2p tiles that narrow the strategy spread by ≥ 2 pts; a Full life bonus that raises sets' share of points without widening the spread; dropping the experience cap when "no cap" is indistinguishable from the default. Each suggestion prints the exact rows it relies on.

### D-ENV-4 — PR base branch (2026-11-03)
- **Decision:** the prompt says "PR into `main`", but the repository's only base branch is `master`, so the PR targets `master`.

## v2

### V2-1 — Branch and base (2026-11-04)
- The repository has no `main`; its default branch is `master`, which already contains v1 and the v2 design kit. The session branch was fast-forwarded to `origin/master` before any v2 work, and the v2 PR targets `master`.

### V2-2 — `replays/` excluded from Prettier (2026-11-04)
- CIAO's sample export in `replays/` is data, not source, and failed `prettier --check`, which turned `pnpm verify` red before any v2 change. It is added to `.prettierignore` instead of being reformatted.

### V2-3 — Regression baseline lives in `scripts/regression/` (2026-11-04)
- `reports/runs/` is gitignored (and `reports/` must not change), so a fresh clone has no `v2-before`. The N1 output is fingerprinted (SHA-256 of the uncompressed `games.csv`, `players.csv`, `picks.csv`) in `scripts/regression/v2-baseline.json`; `pnpm regress` compares a new run against the fingerprint and, when present, byte-for-byte against `reports/runs/v2-before`.

### V2-4 — Token naming (2026-11-04)
- DESIGN-v2 uses `--ink` for the outline/text colour, but v1 used `--ink` for the page ground. v1's ground token is renamed `--ground` (and `bg-ink`/`text-ink` → `bg-ground`/`text-ground`); v1's other semantic tokens (`--surface`, `--text`, `--muted`, `--door`, …) are re-mapped per view, so every v1 page renders in both token sets without a rewrite.

### V2-5 — `--door` keeps its v1 meaning (2026-11-04)
- v1's `--door` is the primary/selection/focus colour; in Board it maps to lamplight, in Analyst to ink. DESIGN-v2's Board `--door` (`#3A3340`, the door leaf and card back) is exposed as `--door-leaf` to avoid the clash.

### V2-6 — Hook signatures (2026-11-04)
- `windowScores` takes the content it scores with as a first argument — `windowScores({ ruleset, cards }, tower, allowance)` — because the engine has no global content (D-ENG-1); a `GameState` works as that argument. `previewMove(state, move, playerId?)` skips any swaps the move grants (swaps never move pawns) and also returns `arrives`, `again` and `swaps`. `gameHistory(state)` replays the state's own seed and moves and returns one point per quest/rush turn, taken after that turn's swaps.
- `explain(view, chosen?)`: weighted bots return every candidate with weight × feature contributions (same arithmetic as `choose`); greedy returns points/year; `random` returns `null`; `lookahead` returns the mean rollout value per candidate, computed on a private RNG seeded by the position (`explain|seed|player|moveIndex`), so the bot's own stream is untouched. The noisy wrapper forwards to its base. Tests run whole games with and without `explain` and require identical moves and RNG states.

### V2-7 — Demo fixture (2026-11-04)
- `apps/web/src/lib/demo.ts` plays `HIST0` (Analyst-Table mockup) through the real engine from a scenario whose decks hold the cards in the order they are taken. Milestone swaps on the way are skipped. The result is the shared turn-22 position (Priya 11, Arun 12, Meera 13, Kavi 15, Priya to move), verified by a test.

### V2-8 — Analyst table details (2026-11-04)
- **Timeline and think time.** `GameClient.timeline()` returns every state with the think time of the move that made it (bots: compute time, not the display delay; people: time from the turn starting to the submit). Think times are UI-only and not persisted; after a reload they show "—". The demo's 21 earlier turns are rebuilt from `demoBase()` and carry the mockup's THINK0 values.
- **Charts** use one point per quest/rush turn (`turnPoints`), taken after that turn's swaps. The x-axis spans max(turns, 24) so early games do not stretch; the position chart's y-axis is 0–20 and grows in steps of 10.
- **Bots column** ranks legal cards by the Greedy and Tempo policies' own `explain()` order (G#/T#). L# (Lookahead) is a stretch item and is skipped.
- **"Why <bot> did that"** shows the four best candidates of the last bot quest/rush plus the played one if it was not in the top four. Positive contributions stack left to right; contributions that count against a move are drawn hatched after them, so a bar's length is the sum of absolute contributions. Features are grouped (pts per year, focus domain, experience, tempo, scoring & other) for colour; the tooltip names each feature.
- **Phone (Analyst).** Below 768 px the decision table drops Age, Needs, Yrs, Disc., Pts/yr, Next up and Bots; the ruler scrolls inside its panel and starts at the current pawn. The page itself never scrolls sideways.
- **Once-per-game powers.** A card that needs Old friends / Say yes more is selectable in the table; Confirm stays disabled (and the preview says so) until its power is ticked, matching the Board tray.

### V2-9 — Window scorer and game report (2026-11-04)
- **Shared Doorway selection.** The stretch being considered lives in the table controller (`doorStart`), so the Board Doorway and the Analyst window scorer show the same window when the view is switched. Both open on the top window (as in v1); the Analyst scores table marks the best one. In a blind test (best-window hints off) the "vs best" column and the allowance sensitivity are hidden.
- **Allowance sensitivity** "Means" names the arrival positions whose tile (plus this player's own Doorway bonus) gives that allowance; "—" when none does.
- **Played most like** reruns every study strategy except Random and Lookahead (too slow to rerun in the browser) on each of the player's quest/rush decisions, with the same seeded stream a bot in that seat would use. Moves agree when they are the same quest card, or a rush with the same discard (power flags ignored).
- **Turning points**: Δ now ≥ 5 or ≤ −5 on a quest; a swap that makes a run of 3+ (and raises the run); a rush discard of a card the next player could take; an arrival that keeps everything; an arrival that loses 3+. Each links to `/replay?id=…&move=N` (the state just after it).
- **This game vs the study** reads `reports/data/summary.json` through a static route (`/api/study`, built at `next build`), trimmed to the `main-Np` groups. "Winning score" is not in the summary, so the report compares the mean score per player; back-to-back share is the study's `extraTurnShare`; rush share = rushes ÷ turns per player.
- **Replay viewer** renders in the current view: Board shows the illustrated board, chip towers and the market; Analyst shows the ruler, ledger, towers, log and both charts up to the move, and the game report on the last move. The demo replays from `demoBase()` (it cannot be rebuilt from its seed).

### V2-10 — /designer in Analyst style (2026-11-04)
- The Analysis, Sandbox and Cards pages keep their content and behaviour; panels, section titles, numbers and the header use the Analyst tokens. The header is a Doorway wordmark plus an Analysis / Sandbox / Cards segmented control; the Board / Analyst switch is not shown (the boot script already forces Analyst on /designer).
- The study charts come from `@doorway/sim`'s HTML helpers, which bake in v1's dark palette. Rather than change the sim package (its output is what `reports/` was built with), the designer maps those colours to Analyst ones (`lib/designer-colors.ts`), and the head-to-head grid uses a light diverging scale that nudges mid-tones until the number clears 4.5:1 (unit-tested).
- Verdict and flag chips pair colour with a symbol or word (✓ PASS, ✗ FAIL, STRONG, WEAK) and use light text on good/bad fills.
- No placeholder banners were left in /designer; the one "PLACEHOLDER" demo chip on /design-check is renamed.

### V2-11 — Quality pass (2026-11-04)
- **`?view=` is remembered.** A `?view=` link now also stores the choice (boot script), so a link like `/?view=analyst` keeps Analyst through New game → table. /designer never stores a view.
- **Scrollable regions are focusable.** Panels that scroll sideways (ruler, decision table, window matrix, final table, economy, swaps) and the replay log are `tabIndex=0` regions with labels (axe `scrollable-region-focusable`).
- **Coloured text on highlighted rows turns ink.** Green/red numbers fall under 4.5:1 on the highlight yellow, so selected and "you" rows show them in ink; the sign or ✓/✗ still carries the meaning.
- **Tests added, v1 tests untouched.** `e2e/v2.spec.ts` (+ `helpers-v2.ts`): a full 2p game at Instant in each view (Doorway, results, replay, axe on each), switching views mid-game with a selected move (and the V key, and a reload), the Doorway window surviving a switch, 360 px in both views, axe on every page in both views, /designer forced Analyst. `test/contrast-v2.test.ts` checks 42 text/background pairs from both token sets in `globals.css`. /design-check now also renders the Board pieces and Analyst panels.

### V2-12 — Stretch items (2026-11-04)
All three stretch items were done; none were skipped.
- **L# column.** The decision table's Bots column also shows the Lookahead rank (`G#1 T#1 L#2`). Lookahead's `explain()` scores only its shortlist (about five candidates), so cards outside it show `L#–`. It costs about 60 ms per position and is memoised per move.
- **SVG wobble filter.** The Board sheet's bends and doodles go through a still `feTurbulence` + `feDisplacementMap` filter (scale 2.6) for a hand-drawn edge. It does not animate, so it is kept under reduced motion. Each sheet's filter id is unique (`useId`).
- **Card-to-chip flight.** Taking a quest from the Board tray (desktop or phone) flies a domain-coloured ghost from the card to the top of "Your life", where it squashes into a chip (520 ms, Web Animations). It is presentation only: the move is submitted at once. It is skipped under reduced motion and for keyboard Enter.
