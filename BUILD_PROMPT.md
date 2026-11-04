# Overnight build: Doorway — playtest app

You are building, unattended and overnight, the digital playtest app for **Doorway**, a board game designed by CIAO. Nobody is watching. Work through everything below, in order, until it all passes.

**Tonight's scope is local only:** the rules engine, the bots, the simulation study and its analysis, a playable table on this machine, and the local designer tools. Online rooms, sharing with friends, the database, feedback collection and deployment come later (§7). Don't build them tonight, but keep the architecture ready for them.

## 0. How to work tonight (read first, re-read after every context compaction)

1. **Never stop to ask.**
   - Do not use AskUserQuestion. Do not end a turn with a question.
   - When something is unclear, take the most reasonable reading, record it in `DECISIONS.md` (date, decision, why, alternatives), and keep going.
   - If an action is blocked, find another route, record it, move to the next milestone, and come back later.
2. **Keep `STATUS.md` current** at the repo root. Update it at the start and end of every milestone and whenever you change direction. It holds:
   - the current milestone;
   - finished milestones, each with its commit hash;
   - what is in progress;
   - what is next;
   - blockers and workarounds;
   - how to run everything;
   - a short time log in UTC.

   After any context compaction, first read `STATUS.md`, `DECISIONS.md`, `spec/RULINGS.md` and this prompt (saved at `BUILD_PROMPT.md`; if it is missing from the repo, save this prompt there in M1), then continue.
3. **Commit and push after every milestone**, and at least every 45 minutes, to the branch this session works on. Commit messages start with `M<n>:`. Never force-push. Never rewrite history. At the end, open a pull request into `main` (see M15).
4. **Deadline.** CIAO's cloud credits expire on **2026-11-05 at 08:00 UTC** (13:30 IST).
   - Everything must be committed and pushed by **07:00 UTC**. Check the clock (`date -u`) at every milestone.
   - If you are behind, keep the milestone order and cut the lowest-priority items marked *(stretch)* first. Never skip tests for the parts you do ship.
5. **Long commands.**
   - Foreground commands must finish within 10 minutes. Anything longer runs in the background, and no background job should need more than about 25 minutes: split simulations into resumable shards (`--shard i/n`, `--resume`).
   - While the study runs, carry on with UI milestones. Check on it periodically and restart failed shards.
6. **Don't deploy, don't sign up for anything, don't add secrets.** There is no database and no server state tonight.
7. **Only stop when "Done means" (§9) is fully true**, or the deadline in rule 4 forces a stop. If the deadline forces it, `STATUS.md` must say exactly what is left.

## 1. Sources of truth (non-negotiable)

Read all of these before writing code:

| File | What it is |
|---|---|
| `spec/everything-you-bring-rules-v0.2.md` | the rulebook |
| `spec/everything-you-bring-build-spec-v1.0.md` | CIAO's product spec: engine API, data model, bots, sim metrics, screens, "ready to print" signals |
| `spec/cards.json` | the 60 cards, the **single source of truth** |
| `spec/RULINGS.md` | settles every rules gap and contains the **canonical ruleset JSON** (§0) |
| `design/DESIGN.md` | tokens, components, layout, motion, copy voice |
| `design/screens/*.dc.html` | the mockups (see DESIGN.md for which are primary) |

**Name.** The game, app and repo are called **Doorway** (RULINGS R46). The spec files still say "Everything You Bring"; treat that as the old working title. Package names use the `@doorway/` scope.

**Precedence.**
- On game rules: `RULINGS.md` > rulebook > build spec.
- On tooling and stack: **this prompt** > build spec §4. For example, Next.js replaces "React + Vite", and there is no room server tonight.
- On look and copy: `design/` is binding.

**`spec/` and `design/` are read-only.** If you find a contradiction or a new gap, don't edit them. Add a "Proposed ruling" entry to `DECISIONS.md`, implement your proposed default, and cite its ID in the tests.

The mockups' `{{…}}`, `<sc-for>` and `<sc-if>` are a mockup template language. Rebuild the screens as React components, matching their spacing, sizes, tokens and copy. Do not ship the mockup runtime.

## 2. Stack and layout

- **pnpm workspace**, TypeScript `strict` everywhere, Node 22 (expected to be pre-installed; check with `node -v` and record what you find). ESLint and Prettier.
- **`packages/engine`.** A pure, framework-free rules engine.
  - No DOM, no network, no Node-only APIs, zero or near-zero runtime dependencies.
  - Deterministic: a seeded RNG (RULINGS R30), JSON-serializable state, a replayable action log.
  - Driven entirely by the ruleset JSON and `cards.json`. No game number may be hard-coded in engine logic.
- **`packages/content`.**
  - Loads `spec/cards.json` directly. Don't fork a copy; if a copy is unavoidable, a test asserts that its SHA-256 equals `spec/cards.json`'s.
  - `rulesets/v0.2-default.json` must equal RULINGS §0 exactly (test it).
  - zod schemas and a validator implementing RULINGS R43.
- **`packages/bots`.** Every bot behind one interface, with strategy weights in config.
- **`packages/sim`.** A headless Node CLI using `worker_threads`, plus the report generator.
- **`apps/web`.** Next.js (App Router) + Tailwind. Tokens come from DESIGN.md as CSS variables and Tailwind theme values. Fonts load via `next/font/google`.
- **No database tonight.** Games run in the browser on the shared engine. Local state (settings, saved games, custom rulesets) lives in localStorage and in exported JSON files. Keep game logic out of React components so a server can host the same engine later.
- **Tests.** Vitest (with fast-check for property tests) and Playwright with `@axe-core/playwright`. Install Playwright's Chromium in the session (`pnpm exec playwright install --with-deps chromium`). If the download is blocked, record it and keep going; don't remove the e2e suite.
- **Root scripts** (must exist and work):
  - `pnpm test` — all unit and property tests;
  - `pnpm e2e` — Playwright;
  - `pnpm sim` — the simulator CLI;
  - `pnpm sim:study` — reruns the full study, then aggregates;
  - `pnpm sim:aggregate` — folds `reports/runs/` into `reports/data/`;
  - `pnpm sim:report` — regenerates the reports from `reports/data`, without re-simulating;
  - `pnpm build`, `pnpm lint`, `pnpm typecheck`;
  - `pnpm verify` — runs lint, typecheck, test, a quick sim and build in sequence.

## 3. Engine (goal: rules-correct and deterministic)

**API.** Implement build spec §5.1 to §5.6 exactly, plus:
- `serialize(state)` / `deserialize(json)`;
- `replay({ rulesetId, rulesetHash, cardsHash, seed, seats, moves })`, which also verifies the hashes (R31);
- `stateHash(state)`;
- `legalMoves` that includes the pending swap and window choices (spec §5.3).

**Ruleset.**
- Every key in RULINGS §0 is honoured, including `experienceCap` (R1), Passion thresholds (R2), auto-skipped swaps (R3), the resolution order (R8), Rush targeting (R9) and solo drift (R29).
- Any ruleset key can be overridden by dotted path, for example `doorway.4.0=10` or `passion.5=12`.

**Rule coverage is a checklist, not a vibe.**
- Create `packages/engine/test/RULE_COVERAGE.md` listing every bullet and table row in rulebook §3–§13 (including that each §13 tunable key is honoured), the §15 count claims (25/20/15 by age, 12 per domain, 11 powers, 5 Reflection, no Young requirements), every engine-relevant item in build spec §5, and every ruling R1–R46. Give each one an ID, for example `RB-4.2` or `R9`.
- Every ID needs at least one test whose name contains it, except IDs in a **Deferred** section of the file: rulings that only concern later features (online undo in R32, R36, R37, the `revealAt` part of R39, R40, R44). Those carry no test tonight.
- A script (run inside `pnpm test`) fails if any ID has no test.

**Required tests.**
- **Rulebook §16 worked example** as a scripted test. Build the exact market and decks with a scenario helper, then play the moves and assert positions, stack order, turn order (including "Meera on top goes before Arun"), the Rush discard, the "later" Priya cost (5 − 1 = 4, crossing Milestone 20), and Arun's Doorway scoring.
- **Property tests over 10,000 random games** (build spec §5.8):
  - the game always ends;
  - no illegal state;
  - every card is in exactly one place;
  - the tower matches the card row;
  - deterministic replay;
  - `legalMoves` ⟺ `apply` acceptance.

  Also run them with `minCost = 0` (R42), with alternative Doorway arrays, and in solo.
- **Performance:** 1,000 bot-vs-bot 4p games (greedy bots) in under 10 s on this VM.

## 4. Bots (goal A)

**One interface:**

```ts
interface BotPolicy {
  id: string;
  label: string;
  params: Record<string, number>;
  choose(view: BotView, rng: Rng): Move;
}
```

- `BotView` exposes everything public. It **never** exposes deck order (R15).
- Every bot picks its Doorway window optimally (spec §6).
- Bots use their own RNG stream (R30) and are deterministic for a given seed.

**Strategies.** Most bots are a **weighted feature scorer**. Features include:
- points per year;
- the chance of an extra turn (does this move keep me furthest back?);
- experience gained;
- progress toward full sets;
- Passion run extension, including planned swaps;
- Reflection potential;
- how well the move fits my projected Doorway window;
- Rush value: the tempo gained and the card denied by the discard;
- age-gate unlocks;
- denying other players.

Weights and thresholds live in `packages/bots/strategies.json`. Adding a strategy should be about 10 lines of config, plus code only for genuinely new features.

| id | Behaviour |
|---|---|
| `random` | Uniform over legal moves |
| `greedy` | Best immediate points per year spent (the spec's definition of "best immediate points"); rushes only if there is no quest |
| `specialist` | 1–2 target domains chosen early; discounts, Passion and Reflection (spec) |
| `generalist` | Prefers missing domains; aims for full sets (spec) |
| `early_leaver` | High-value cards, rushes when value per year is below a threshold, arrives early (spec) |
| `late_bloomer` | Never rushes unless forced (spec §6), takes the extra turns while furthest back, and **saves its best discs for the top of the tower** so its final stretch suits a small Doorway (CIAO). The two definitions are compatible: "maximizes tower quality in the last ~third of life". |
| `tempo` | Maximizes extra turns from cheap quests under the furthest-back rule |
| `rusher` | Leans on Rush and uses the Rush discard to deny |
| `set_collector` | Plans full sets *inside its projected kept window* |
| `passion_specialist` | One-domain runs, using Milestone and *Keep a diary* swaps to join them |
| `lookahead` | A strong baseline: determinized Monte Carlo tree search, or a 2–3 ply search, with the unseen deck order sampled per rollout or per determinization. The budget is per move (`iterations` or `msPerMove`, default about 25 ms); tune it so a 4p game with one lookahead seat takes about 3 s or less. Record the setting. It must beat `greedy` in more than 60% of 2p games (test it). |

- **Noisy variants:** a wrapper `<id>@eps<ε>` (for example `tempo@eps0.1`) plays uniformly random with probability ε, to imitate human mistakes.
- **Skill levels in the UI:** Casual = ε 0.25, Normal = ε 0.08, Sharp = ε 0.
- **Tests:** determinism; every non-random strategy beats `random` in more than 90% of 2p games (spec §13); no bot ever submits an illegal move (over 1,000 games each).

## 5. Simulation and analysis (goal A)

**CLI** (spec §7, extended):

```
pnpm sim --players 4 --bots tempo,specialist,lookahead,greedy --games 10000 \
  --seats rotate --seed doorway-2026 --ruleset v0.2-default \
  --sweep 'doorway.4=9,8,7,6;10,7,5,3' --workers 4 --shard 1/8 --resume --out reports/runs/<name>
```

- `--seats` takes `rotate`, `fixed` or `all-permutations`.
- `--sweep` values are separated by `;` and must be quoted. Keys use dotted paths: `doorway.4` is the whole array, `doorway.4.0` one element.
- Raw runs go to `reports/runs/` (gitignored). `pnpm sim:aggregate` folds them into `reports/data/`. `pnpm sim:study` runs the whole study, then aggregates.
- Same arguments give identical output.
- Speed target (spec §7): a sweep of 3 values × 10,000 games with heuristic bots finishes in under 2 minutes.
- Each run writes `games` rows (spec §7 fields, plus per-player score components, arrival order, tower height, discs lost, rushes, extra turns, years saved by experience, powers used) and per-card pick records.

**Run the full study yourself and commit the results.** "Main configuration" means each row below; each needs at least 10,000 games.

| ID | Study |
|---|---|
| S1 | **2p round robin.** All 121 ordered pairs of the 11 strategies (mirrors included) × 1,000 games = 121k games. This feeds the matchup matrix and 2p seat advantage. |
| S2 | **3p and 4p, every strategy against every other in all seat orders.** All combinations of distinct strategies × all seat permutations, with enough games per seating for at least 10,000 games per player count: 3p is 990 seatings × 11 or more games, 4p is 7,920 seatings × 2 or more. |
| S3 | **Noisy field.** Every strategy at ε 0.1 against a uniform field, 4p, 10k games. |
| S4 | **Sweeps.** 10k 4p "field" games per value (seats drawn uniformly from the 10 non-random strategies; lookahead may be swapped for a cheaper bot if needed, recorded). Confirm the top findings with 2k games that include lookahead. |
| S5 | **Solo.** 2k games per strategy; rating distribution. |

Sweep values for S4:
- `doorway.4`: 9/8/7/6 (base), 10/7/5/3, 8/7/6/5, 9/7/5/3, 10/8/6/4;
- `doorway.3` (3p games): 9/8/7 (base), 10/7/5, 9/7/5, 8/7/6;
- `doorway.2` (2p games): 9/7 (base), 10/6, 9/6, 8/7;
- `experienceCap`: 2, 3, 4 (base), 99 (no cap);
- `fullLifeBonus`: 4, 6 (base), 8, 10;
- `passion`: 2/4/7, 3/6/10 (base), 4/8/14.

**Data.**
- `reports/data/`: CSV is required; Parquet too if a pure-JS writer works (otherwise record why).
- Include `games.csv(.gz)`, `players.csv(.gz)`, `cards.csv`, `matchups.csv`, `sweeps.csv`, `summary.json`.
- Keep every committed file under 50 MB and `reports/` under 300 MB. Downsample raw rows if needed (record how). Commit full move logs for a 1,000-game sample only.

**`pnpm sim:report`** regenerates `reports/ANALYSIS.md` and `reports/analysis.html` from the data. It is TypeScript only (no Python needed). The HTML is self-contained, with inline SVG charts in DESIGN.md's dark tokens and no network.

**ANALYSIS.md** opens with plain-language answers, then the detail. It covers at least:
1. **Headline: does arriving first make the Doorway irrelevant?** Tower height at arrival vs. allowance and discs lost, by arrival order and player count; the share of arrivals that lose any disc; the spec target (non-first arrivals lose ≥ 2 on average).
2. Win rate by strategy with **Wilson 95% CIs** (shared wins count 1/k); the 2p matchup matrix; whether any strategy dominates (spec target: none above 35% in 4p).
3. Seat and turn-order advantage by player count, against the spec's "within ±5% of fair share" target (reported both ways, per R45).
4. Score distributions; each component's contribution (cards, sets, Passion, Reflection); which components best predict winning (logistic regression on standardized components, or point-biserial correlation, with method stated).
5. Game length in turns; turns per player; **extra turns from the furthest-back rule** (back-to-back turns); how often each player moves.
6. Quest vs. Rush usage and payoff (win rate by rush count; tempo gained).
7. Card pick rate (when visible and takeable) and win rate when picked, with CIs. Flag over- and under-powered cards (CI excludes fair share by a stated margin).
8. Experience discount usage and years saved, and how fast engines accelerate (years per quest over the game).
9. Power usage, including once-per-game powers; turns with no legal quest (stale market).
10. Sensitivity sweeps: how each dial shifts balance and Doorway relevance.
11. **Suggested rule tweaks.** 3–6 of them, each citing the sweep row that backs it. Suggestions only; don't change the default ruleset.
12. The spec's "ready to print" table, with each bot-measurable signal marked pass / fail.

## 6. Playable table (goal B)

Match `Main.dc.html`, `Doorway.dc.html`, `Results.dc.html` and `TablePhone.dc.html`.

- **New game screen:** pick 1–4 seats, each Human or Bot (strategy and skill), the ruleset, an optional seed, bot speed, and Blind test. Base it on the **Seats** panel and settings row of `Lobby.dc.html`, without the invite link or join flow. Include the short "How to play, in five breaths" panel from the same mockup.

- **Hot-seat and solo** for 1–4 seats. Any seat can be human or a bot with selectable strategy and skill.
- **Bot speed:** Slow (2 s), Normal (1 s), Instant (R39). Bots compute in a Web Worker so the UI stays responsive. The bot "thinking" state is shown on its queue card and in the banner.
- **Track:** age bands, Milestones, stacked pawns with the top pawn on top, a pulse on the current pawn, a ghost pawn on preview, and the Doorway with its tiles.
- **Turn banner** with "Why is it my turn?"; the turn queue; legal-move highlighting with reasons for illegal cards; effective cost (`4 → 3 yrs`).
- **Move preview** showing the landing space and who moves next ("you move again").
- **Rush** with the optional discard; power toggles (*Old friends*, *Say yes more*) only when they would matter (R17, R18).
- **Swap prompt** for Milestones and *Keep a diary*, with a Passion and Full life preview.
- **Doorway selection:** bracket, live score, compare windows, best-window hint unless blind mode is on (R35), lock in.
- **Results:** breakdown with each kept stretch highlighted.
- **Move log, rules reference panel, unlimited undo** (R32, local games), and a live score preview.
- **Full replay** from the action log (step forward and back, `?move=N` deep links).
- **Export / import** of the replay JSON and of full state.
- **Keyboard play:** arrows, Enter, R, U, Esc.
- **Motion** as specified in DESIGN.md §4, respecting reduced-motion.
- **First-game hint mode** (spec §8.5): contextual tips on the first Quest, Rush, age change, Milestone and arrival. On by default; off in Blind test (R35).
- Works down to **360 px** wide (spec §8.6) with the phone layout; the mockup is drawn at 390 px.

## 7. Designer tools (local) and what comes later

**Designer tools** at `/designer`. No password tonight, since nothing is deployed.
- **Analysis:** renders the committed `reports/data/summary.json`. Match `SimDashboard.dc.html`, with real numbers and no placeholder banner.
- **Sandbox:** ruleset dials, a diff against the baseline, and sims run **in the browser with Web Workers** (same engine and bots), comparing variant vs. baseline on the same seeds. "Save as new ruleset" stores it in localStorage, offers a JSON download, and makes it selectable on the New game screen. Match `Sandbox.dc.html`.
- *(stretch)* Card editor with validation (spec §11.2), CSV and JSON import/export.

**Later — do not build tonight.** CIAO will test the local build first. Keep these possible without rewrites:
- online rooms, nickname join and reconnect (`Lobby.dc.html`, `LobbyPhone.dc.html`), with a server-authoritative engine;
- the tutorial, the post-game survey (R36), "Something feels off" (R37), telemetry and the private feedback dashboard (`Feedback.dc.html`);
- Postgres and deployment (Vercel + Neon).

In practice that means:
- the engine and bots run unchanged in Node and in the browser;
- every move is a serializable action, and a replay is `{ ruleset, seed, seats, moves }`;
- the table UI talks to the game through a small `GameClient` interface (local implementation tonight), so a networked client can be added later.

Record this design in `DECISIONS.md`.

## 8. Milestones (in order; commit and push after each)

| # | Milestone |
|---|---|
| M1 | Workspace scaffold, CI-style `pnpm verify`, `STATUS.md`, `DECISIONS.md`, `content` package with validation and hash tests |
| M2 | Engine core: setup, RNG, turn order, quest, rush, market, swaps, arrival, scoring, events, serialize/replay |
| M3 | Engine tests: `RULE_COVERAGE.md` and its checker, every rule ID covered, the §16 worked example, property tests, perf |
| M4 | Bot interface, `random`, `greedy`, noisy wrapper, determinism tests |
| M5 | The eight heuristic strategies from config; beat-random tests |
| M6 | `lookahead` bot with a tuned budget |
| M7 | Simulator CLI: workers, shards, resume, sweeps, outputs |
| M8 | **Start the full study (S1–S5) in background shards now.** Continue with M10+ while it runs; monitor and restart shards |
| M9 | `sim:report`: ANALYSIS.md, analysis.html, data exports. Build it early on a quick run; run it for real when the study finishes (usually after M10–M13), and commit |
| M10 | Web shell: Tailwind tokens, fonts, core components (Disc, Pawn, TrackCell, Doorway, QuestCard, TurnBanner, TurnQueue, ActionBar, ScoreTiles); a `/design-check` page showing them in every state |
| M11 | New game screen and local table (hot-seat, solo, bots, previews, undo, log, rules, keyboard) |
| M12 | Swaps, Doorway selection, results, replay viewer, export/import |
| M13 | Phone layouts plus an accessibility pass; Playwright e2e: a full 2p game vs. a bot at Instant speed, a 360 px smoke test, and axe on every page with zero serious or critical violations |
| M14 | `/designer` Analysis and Sandbox pages; card editor *(stretch)* |
| M15 | Docs and wrap-up (below), then the clean-clone verification and the PR |

**M15 docs.**
- `README.md`:
  - what this is;
  - a Mermaid architecture diagram (content → engine → bots → sim / web app);
  - how to run locally;
  - **how to change rules** (edit the ruleset JSON or `cards.json` → tests → sim → report);
  - **how to add a bot strategy** (a config entry plus an optional feature);
  - how to read the reports;
  - a short "Later" section listing the §7 items not built yet.

**Then:**
1. Clone the pushed branch into a fresh directory and run the commands in §9.
2. Open a PR into `main` titled "Doorway playtest app — overnight build". Its body summarizes the analysis headline results, what's done, any *(stretch)* items skipped, and links to `ANALYSIS.md`.

## 9. Done means

All of the following are true, checked from a **fresh clone** of the pushed branch:

- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm sim --players 4 --games 1000 --bots greedy,tempo,specialist,generalist`, `pnpm sim:report` and `pnpm build` all pass. `pnpm e2e` passes too, or any environment-only blocker is documented in STATUS.md with the suite still present.
- [ ] Every ID in `RULE_COVERAGE.md` has a passing test; the §16 worked example passes; the property tests pass at 10,000 games; the perf target is met.
- [ ] All 11 strategies plus noisy variants are reachable through one interface, configured in `strategies.json`.
- [ ] The full study (S1–S5) has run with at least 10k games per main configuration. `reports/data/*`, `reports/ANALYSIS.md` and `reports/analysis.html` are committed with real numbers, and the Doorway headline is answered first.
- [ ] The New game screen, table, Doorway, results, replay and `/designer` Analysis and Sandbox work and match `design/`.
- [ ] `README.md`, `STATUS.md` (final state) and `DECISIONS.md` are complete.
- [ ] Everything is pushed and the PR is open.
