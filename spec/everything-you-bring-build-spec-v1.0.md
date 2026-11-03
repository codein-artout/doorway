# Everything You Bring — Web Playtest Prototype
### Product Spec v1.0

**Owner:** CIAO · **Status:** Ready to build · **Source of truth:** `everything-you-bring-rules-v0.2.md` + `cards.json`

---

## 1. Why this exists

The game is designed but untested. Before anything is printed, we need to know whether it is fun, balanced, about an hour long and teachable. A web prototype answers those questions faster than paper:

- **Bots can play thousands of games overnight** to find broken strategies and bad numbers.
- **Real people can play remotely**, so we aren't limited to who can come over.
- **Every game is logged**, so decisions are made from data, not memory.
- **Numbers and cards are editable without code**, so one evening can test five variants.

This is a **design tool**, not a product launch. It should be fast, honest and ugly-but-clear. Art, lore and polish come later.

### Goals
1. Play a complete, rules-correct game of 1–4 players in the browser.
2. Run headless bot simulations at scale and report balance metrics.
3. Let remote playtesters join with a link and give structured feedback.
4. Change any tunable value or card without a deploy, and compare variants.

### Non-goals (v1)
- Accounts, payments, matchmaking with strangers, leaderboards.
- Final art, animation polish, sound, lore text.
- Native mobile apps (responsive web is enough).
- 3D renders of the printed parts.

### Definition of "ready to print"
The prototype has done its job when all of these hold for the current ruleset:

| Signal | Target |
|---|---|
| Bot sims, 4p: no single strategy archetype wins more than | 35% of games |
| Bot sims: first-seat win rate within | ±5% of fair share |
| Bot sims: average discs lost at the Doorway (non-first arrivals) | ≥ 2 |
| Human games: median length (4p) | 50–65 min |
| Human games: "would play again" | ≥ 80% |
| Human games: rules questions per game, last 10 games | ≤ 2 |
| At least 3 different archetypes have won human games | yes |

---

## 2. Users

| User | Needs |
|---|---|
| **Designer (CIAO)** | Edit rules config and cards, run simulations, read results, compare variants, review game logs. |
| **Playtester** | Open a link, understand the game in minutes, play, give feedback. No sign-up. |
| **Spectator / observer** | Watch a live game silently (for blind-playtest observation). |
| **Bot** | Play legal moves through the same engine as humans. |

---

## 3. Scope overview

| Area | P0 (first playable) | P1 (playtesting) | P2 (analysis) |
|---|---|---|---|
| Rules engine | Full rules, config, seeded RNG, tests | | |
| Local play | Hot-seat 1–4 players, bots in any seat | | |
| UI | Track, market, towers, Doorway selection, scoring | Tutorial hints, rules drawer, undo | Replay viewer |
| Bots | Random, Greedy | Archetype bots | Lookahead bot |
| Simulation | CLI batch runner + CSV/JSON output | | Web dashboard |
| Online | | Room links, realtime sync, reconnect, spectate | |
| Telemetry | Local event log | Server-side logs, post-game survey | |
| Design tools | Config via JSON file | In-app config editor, card editor, variants | A/B comparisons |

---

## 4. Architecture

```
packages/
  engine/        Pure TypeScript rules engine. No DOM, no network. Deterministic.
  content/       cards.json + rulesets/*.json (default = v0.2)
  bots/          Bot policies that call engine.legalMoves / engine.apply
  sim/           Node CLI: runs N games, writes results
apps/
  web/           React + Vite client (local + online play, tools)
  server/        Realtime room server (authoritative engine host)
```

### Principles
- **One engine everywhere.** The client, server, bots and simulator all run the same `engine` package. The server is authoritative for online games.
- **Pure functions.** `apply(state, move) → { state, events }`. No hidden mutation, which makes undo, replay and simulation trivial.
- **Data-driven.** Every number in the rulebook's Section 13 and every card lives in content files, never in engine code.
- **Seeded randomness.** Every game has a seed. The same seed, ruleset and moves always reproduce the same game.

### Recommended stack
- **Language:** TypeScript end to end, pnpm workspace.
- **Client:** React + Vite. SVG for the board. Zustand or plain reducer for client state.
- **Realtime:** a small WebSocket room server (Node, or a hosted rooms service such as PartyKit/Cloudflare Durable Objects). Evaluate boardgame.io as an alternative to hand-rolling turn sync, but check its current maintenance status first; its built-in turn order is round-based, so the "furthest back goes next" rule will need a custom turn-order function either way.
- **Storage:** Postgres (e.g. Supabase) or SQLite for game logs, surveys, rulesets.
- **Testing:** Vitest for the engine, with property-based tests (fast-check) for invariants.
- **Hosting:** any static host for the client plus one small server.

---

## 5. Rules engine

### 5.1 Public API

```ts
init(ruleset: Ruleset, cards: Card[], players: PlayerSetup[], seed: string): GameState
currentPlayer(state): PlayerId | null          // null when game over
legalMoves(state, playerId): Move[]
apply(state, move): { state: GameState; events: GameEvent[] }   // throws on illegal move
isOver(state): boolean
score(state): ScoreBreakdown[]
cost(state, playerId, cardId, options?): number   // for UI previews
```

### 5.2 Data model

```ts
type Domain = 'pink' | 'gold' | 'green' | 'orange' | 'purple';
type Age = 'young' | 'middle' | 'old';

type Card = {
  id: string; name: string; color: Domain; age: Age;
  years: number; points: number;
  requires: { color: Domain; count: number } | null;
  power: Power | null;
  reflection: Domain | null;
};

type Power =
  | { type: 'discount'; color: Domain; amount: number }
  | { type: 'rush_bonus'; amount: number }
  | { type: 'age_reach_once' }
  | { type: 'ignore_requirement_once' }
  | { type: 'swap_now' }
  | { type: 'next_quest_discount'; amount: number }
  | { type: 'doorway_bonus'; amount: number };

type PlayerState = {
  id: PlayerId; name: string; isBot: boolean; botPolicy?: string;
  position: number;              // 0..trackLength
  tower: string[];               // card ids, bottom → top
  milestonesUsed: number[];      // e.g. [10, 20]
  oncePowersUsed: { ageReach: boolean; ignoreReq: boolean };
  pendingNextQuestDiscount: number;
  arrivalOrder: number | null;   // 1-based
  doorwayAllowance: number | null;
  keptRange: [number, number] | null;  // inclusive tower indices
};

type GameState = {
  rulesetId: string; seed: string; rngState: string;
  phase: 'playing' | 'pending_choice' | 'doorway_selection' | 'over';
  pending: PendingChoice | null; // swaps the active player must resolve
  players: PlayerState[];
  stacks: Record<number, PlayerId[]>;  // space → pawn order, bottom → top
  market: Record<Age, (string | null)[]>;
  decks: Record<Age, string[]>;
  discard: string[];
  arrivals: PlayerId[];
  turn: number;
  log: GameEvent[];
};
```

### 5.3 Moves

```ts
type Move =
  | { type: 'quest'; cardId: string; useAgeReach?: boolean; useIgnoreReq?: boolean }
  | { type: 'rush'; discardCardId?: string }
  | { type: 'swap'; index: number }      // swap tower[index] and tower[index+1]
  | { type: 'skip_swap' }
  | { type: 'choose_window'; start: number; end: number };
```

Swaps (from Milestones or Keep a diary) are modeled as a **pending choice** the same player resolves before the turn ends. Multiple pending swaps resolve one at a time. `choose_window` is available to a player any time after arrival; the game is over only when all arrived players have chosen.

### 5.4 Turn resolution (must match rulebook exactly)
1. **Current player:** among non-arrived players, lowest `position`; ties broken by the topmost pawn in `stacks[position]`.
2. **Quest:** validate age (`ageOf(position)` at turn start, +1 step if `useAgeReach`), requirement (unless `useIgnoreReq`), card is face up. Cost = `max(minCost, years − experience − powerDiscounts − pendingNextQuestDiscount)`. Clear `pendingNextQuestDiscount` after use. Move, push card onto tower, apply `swap_now` / mark powers, queue Milestone swaps, refill slot from same-age deck.
3. **Rush:** optional discard + refill; target = 1 + position of nearest non-arrived pawn strictly ahead, else `position + rushNoPawnAhead`; add rush bonus; queue Milestones.
4. **Movement cap:** `position = min(position, trackLength)`. On reaching `trackLength`, set `arrivalOrder`, assign allowance from `doorway[playerCount][arrivalOrder]` + doorway bonus.
5. **Stacking:** a pawn that ends a move on an occupied space goes on top.
6. **Game over:** all players arrived and all windows chosen.

### 5.5 Scoring
Exactly per rulebook Section 10, computed only over `tower[keptRange]`:
`cardPoints + fullLifeBonus × min(count per domain) + passionTable(longestRun) + Σ reflection(+1 × kept discs of its domain)`.
Tiebreakers: most discs kept, then earlier arrival, then shared.

### 5.6 Solo mode
Ruleset flag `solo: true` applies: allowance 8, rush 4, and the end-of-turn market drift (discard leftmost of each row, slide, refill).

### 5.7 Ruleset file

```json
{
  "id": "v0.2-default",
  "trackLength": 40,
  "ageBands": { "young": [0, 13], "middle": [14, 27], "old": [28, 39] },
  "milestones": [10, 20, 30],
  "market": { "young": 3, "middle": 2, "old": 2 },
  "experienceStep": 2,
  "minCost": 1,
  "rushNoPawnAhead": 3,
  "rushDiscard": true,
  "doorway": { "2": [9, 7], "3": [9, 8, 7], "4": [9, 8, 7, 6] },
  "fullLifeBonus": 6,
  "passion": { "3": 3, "4": 6, "5": 10 },
  "reflectionPerDisc": 1,
  "solo": { "doorway": 8, "rush": 4 },
  "cardsFile": "cards.json"
}
```

### 5.8 Engine acceptance criteria
- Every rule and clarification in rulebook Sections 4–12 has at least one unit test (aim: one test per bullet).
- The worked example in rulebook Section 16 is a scripted test that passes.
- Property tests over 10,000 random games: game always ends; no illegal state; every card is in exactly one place (deck, market, tower, discard); tower and card order always match; scores are deterministic for a given seed and move list.
- `legalMoves` never returns a move that `apply` rejects, and `apply` rejects every move not in `legalMoves`.
- 1,000 bot-vs-bot 4p games run in under 10 seconds on a laptop.

---

## 6. Bots

| Policy | Behavior | Purpose |
|---|---|---|
| `random` | Uniform over legal moves; window chosen to maximize score | Fuzzing, smoke tests |
| `greedy` | Maximizes points per year this turn; rushes only if no quest | Baseline |
| `specialist` | Picks 1–2 target domains early, prefers them, aims for Passion + Reflection | Archetype test |
| `generalist` | Prefers missing domains, aims for Full life sets | Archetype test |
| `early_leaver` | Takes high-value cards, rushes when a quest's value/year is below a threshold | Archetype test |
| `late_bloomer` | Never rushes, maximizes tower quality in the last ~third of life | Archetype test |
| `lookahead` (P2) | Shallow search / Monte Carlo rollouts with the greedy policy | Stronger opponent; finds degenerate lines |

- Every bot chooses its Doorway window optimally (try every legal window, pick max score).
- Bot thresholds are parameters, so the simulator can sweep them.
- Bots must be deterministic for a given seed.

---

## 7. Simulation harness

### CLI

```
pnpm sim --ruleset v0.2-default --players 4 \
  --bots specialist,generalist,early_leaver,late_bloomer \
  --games 10000 --rotate-seats --out results/2026-11-04-v02
```

### Outputs
- `games.jsonl`: one line per game (seed, seats, final scores, arrival order, length in turns, rushes, discs lost).
- `summary.json` and a printed table with:

| Metric | Why it matters |
|---|---|
| Win rate by policy and by seat | Balance and first-player advantage |
| Mean and spread of final scores | Is the game close? |
| Turns per game and per player | Proxy for length |
| Tower height at arrival; discs lost at the Doorway | Is the Doorway decision real? |
| Rushes per player | Is Rush used, overused, ignored? |
| Card pick rate and win-rate-when-taken | Over- and under-powered cards |
| Power usage rate | Do once-per-game powers get used? |
| Score source breakdown (cards / Full life / Passion / Reflection) | Which scoring paths matter |
| Turns with no legal quest | Stale market detection |

- `--sweep key=a,b,c` runs the same batch across values of any ruleset key (e.g. `experienceStep=2,3`) and prints a side-by-side comparison.

### Acceptance
- Re-running with the same arguments produces identical output.
- A sweep of 3 values × 10,000 games finishes in under 2 minutes.

---

## 8. Web app

### 8.1 Screens
1. **Home:** New local game · Create online room · Join with code · Solo challenge · Designer tools.
2. **Lobby:** seats 1–4, each Human or Bot (pick policy), ruleset picker, seed (optional), Start.
3. **Game table** (main screen, below).
4. **Doorway selection:** chosen per player after arrival.
5. **Results:** scores with full breakdown, arrival order, each player's kept stretch highlighted; buttons for Play again, Survey, View replay.
6. **Designer tools:** ruleset editor, card editor, simulation runs, game log browser.

### 8.2 Game table layout

- **Life track** (top or left): spaces 0–40, age bands shaded, Milestones marked, pawns stacked visibly with top pawn clear. The current player's pawn pulses.
- **Market** (center): three labeled rows (Young 3, Middle 2, Old 2). Each card shows name, domain color + icon, age, years, points, requirement, power or Reflection.
  - Cards the current player can't take are dimmed, with a reason on hover ("Too young", "Needs 2 Love").
  - Legal cards show **effective cost** (e.g. "4 → 3 years") so discounts are visible.
- **Player areas:** each player's tower drawn as a vertical stack of colored discs with icons, plus their card row. Show position, age, arrival status, discount summary per domain, unused once-per-game powers.
- **Action bar:** Quest (select a card) · Rush (shows where you'd land; optional "discard a card" picker) · power toggles (Old friends, Say yes more) when relevant.
- **Move preview:** hovering a card or Rush shows a ghost pawn at the landing space and who would go next.
- **Event log:** short readable lines ("Priya took *Fall in love* (4 years) and moved to 4").
- **Rules drawer:** the quick reference, always one click away.

### 8.3 Swaps (Milestones, Keep a diary)
- Prompt: "Milestone reached: you may swap two adjacent discs." Click the gap between two discs to swap; Skip button.
- Show a preview of Passion and Full life effects of the swap.

### 8.4 Doorway selection
- The player's tower with a draggable bracket sized to their allowance.
- Live score preview as the bracket moves, with the breakdown (cards / Full life / Passion / Reflection).
- "Best window" hint button (toggleable in ruleset for blind tests).
- Confirm locks the choice.

### 8.5 Teaching aids (P1)
- First-game hint mode: contextual tips on first Quest, first Rush, first age change, first Milestone, first arrival.
- "Why is it their turn?" tooltip on the turn indicator.
- Undo (local games only; online only before the next player acts, and logged).

### 8.6 Accessibility
- Domains always shown with **color + icon + letter**, never color alone.
- Colorblind-safe palette option.
- Full keyboard play: arrows to move between cards, Enter to quest, R to rush.
- Readable at 360px wide; the track becomes a horizontal scroller on phones.

### 8.7 UI acceptance
- A new player can finish a 2p game against a bot with no outside explanation (validated in 3 blind tests).
- Every legal move is reachable by mouse and keyboard; illegal moves are never offered.
- No game state is shown that the physical game would hide (there is none: everything is public).

---

## 9. Online play (P1)

- **Rooms:** create → 6-character code and share link. No accounts; players pick a display name.
- **Authority:** the server runs the engine, validates every move, broadcasts new state and events.
- **Reconnect:** closing the tab and reopening the link restores your seat (token in local storage).
- **Bots online:** the server runs bot seats.
- **Spectators:** join read-only; optional "observer notes" panel for blind-test facilitators, timestamped and saved with the game log.
- **Timeouts:** none by default (playtesters talk); optional idle nudge after 2 minutes.
- **Scale:** a few concurrent rooms; no need to design for more.

Acceptance: two browsers on different networks complete a full 4p game with one bot, including a disconnect and rejoin mid-game, with identical final scores on all clients.

---

## 10. Telemetry and feedback (P1)

### Game log
Every game stores: ruleset id + hash, cards hash, seed, seat setup, full move list with timestamps, events, final scores. Replays rebuild from seed + moves.

### Derived human-game metrics
Real minutes per game and per turn, time per decision (longest pauses), rushes, discs lost, which archetype each human played (classified from their picks).

### Post-game survey (one screen, under 60 seconds)
1. How much did you enjoy it? (1–5)
2. Would you play again? (Yes / Maybe / No)
3. Length felt: too short / right / too long
4. Was anything confusing? (free text)
5. Your most memorable moment? (free text)
6. Did you feel you had real choices? (1–5)

### Privacy
Display names only; no emails or analytics trackers. Logs can be deleted per game.

---

## 11. Designer tools

### 11.1 Ruleset editor (P1)
- Form for every key in the ruleset file, with defaults shown.
- Save as a new named ruleset (rulesets are immutable once used in a game; edits create a new version).
- Diff view between two rulesets.

### 11.2 Card editor (P1)
- Table view of all cards: edit any field, add/remove cards, duplicate.
- Validation on save: unique ids, 5 domains present, Young cards have no requirements, power types valid, counts per age summary.
- Import/export `cards.json` and CSV.
- Card set is versioned with the ruleset.

### 11.3 Simulation runs (P2)
- Launch a sim batch from the browser (runs on the server or in a Web Worker).
- Results dashboard: the metrics from Section 7 as tables and simple charts; compare two runs side by side.

### 11.4 Game browser and replay (P2)
- List of all games with filters (ruleset, human/bot, date, player count).
- Replay viewer: step forward/back through moves with the board shown.
- Export logs as JSON.

---

## 12. Milestones and order of work

| Phase | Deliverable | Done when |
|---|---|---|
| **P0a Engine** | `engine`, `content`, unit + property tests | All engine acceptance criteria in 5.8 pass |
| **P0b Sim** | `bots` (random, greedy) + `sim` CLI | First 10k-game report produced |
| **P0c Local UI** | Hot-seat table, Doorway selection, results | CIAO plays a full 4p hot-seat game with bots |
| **P1a Archetype bots** | Four archetype policies, sweeps | First balance pass on the ruleset |
| **P1b Online** | Rooms, sync, reconnect, spectate | Remote acceptance test in Section 9 passes |
| **P1c Feedback** | Game logs, survey, hint mode, undo | First 5 remote playtests logged |
| **P1d Tools** | Ruleset + card editors | A variant is created and played without touching code |
| **P2** | Sim dashboard, replay viewer, lookahead bot | "Ready to print" signals measurable in-app |

Run the first simulation batch **before** building most of the UI: if specialists win 70% of bot games, the rules need fixing before anyone plays.

---

## 13. Testing plan

- **Engine:** unit tests per rule; scripted scenario tests (rulebook example, edge cases); property tests with random bots.
- **Bots:** determinism test (same seed → same game); each archetype beats `random` more than 90% of the time.
- **UI:** Playwright smoke test of a full 2p game vs bot; visual check at 360px and 1440px.
- **Online:** two-client test with disconnect/rejoin.
- **Rules parity:** any rule change updates the rulebook, `cards.json`/ruleset and tests in the same change.

---

## 14. Risks and open questions

| Item | Notes |
|---|---|
| Bot strength misleads balance | Archetype bots play "on rails". Confirm major findings with the lookahead bot and with human games before changing rules. |
| Digital hides physical feel | The tower, the Doorway lift and table talk matter. Keep paper/printed playtests alongside the web ones. |
| Game length in digital ≠ table length | Track real table time separately; digital games run faster. |
| Swap and window UX on mobile | Prototype these interactions early; they are the most fiddly. |
| Open: should the "best window" hint exist? | Helpful for learning, but it removes a decision. Default on in hint mode, off otherwise. |
| Open: async play (turns over days)? | Not in v1. Revisit if remote playtesters can't find shared time. |
| Open: name and lore | Placeholder text throughout; the engine doesn't care. |

---

## 15. Appendix: event types

```
game_started { seed, rulesetId, seats }
quest_taken { playerId, cardId, cost, from, to, usedPowers[] }
rushed { playerId, from, to, discardedCardId? }
market_refilled { age, slot, cardId | null }
milestone_reached { playerId, space }
swap_made { playerId, index } | swap_skipped { playerId }
age_changed { playerId, age }
arrived { playerId, order, allowance }
window_chosen { playerId, start, end }
game_over { scores[] }
```