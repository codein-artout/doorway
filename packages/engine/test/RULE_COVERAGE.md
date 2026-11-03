# Rule coverage checklist

Every rule below has an ID. `scripts/check-rule-coverage.mjs` (run by `pnpm test`) fails unless every ID
outside the **Deferred** section appears in the title of at least one `it()` / `test()` / `describe()` in a
`*.test.ts` file. Sources: rulebook v0.2 §3–§13 and §15 (`RB-…`), build spec v1.0 §5 (`BS-…`),
RULINGS R1–R46 (`R…`), proposed rulings from DECISIONS.md (`P…`).

Where most tests live: `packages/engine/test/*.test.ts`, `packages/content/test/content.test.ts`,
`packages/bots/test/*.test.ts`, `packages/sim/test/*.test.ts`, `apps/web/test/*.test.ts`.

## Rulebook §3 — Setup

| ID | Rule |
|---|---|
| `RB-3.1` | The life track runs 0..`trackLength`; every pawn starts on space 0. |
| `RB-3.2` | Quest cards are sorted into three decks by age and each deck is shuffled. |
| `RB-3.3` | Market: deal face up 3 Young, 2 Middle, 2 Old in three rows. |
| `RB-3.4` | Discs come from a supply: every card's disc is created when the card is taken (no disc stock to run out). |
| `RB-3.5` | Each player has a pawn and an (empty) tower. |
| `RB-3.6` | Doorway tiles are sorted for the player count, 1st on top. |
| `RB-3.7` | All pawns start on 0 in one stack: first player on top, then clockwise, last player at the bottom. |
| `RB-3.8` | No one starts with any discs or cards. |

## Rulebook §4 — Whose turn is it?

| ID | Rule |
|---|---|
| `RB-4.1` | No rounds: the player furthest back on the track takes the next turn. |
| `RB-4.2` | If several pawns share the rearmost space, the pawn on top goes first. |
| `RB-4.3` | A pawn ending its move on an occupied space goes on top. |
| `RB-4.4` | You may take several turns in a row if you remain furthest back. |
| `RB-4.5` | Players at the Doorway take no turns and are ignored for "furthest back". |

## Rulebook §5 — Quest or Rush

| ID | Rule |
|---|---|
| `RB-5.1` | Each turn is exactly one of Quest or Rush. |
| `RB-5.A1` | Quest: the card's age must be your age or younger. |
| `RB-5.A2` | Quest: you must meet the card's requirement, counting discs already in your tower. |
| `RB-5.A3` | Quest: pay printed years minus experience minus power discounts; never less than 1. |
| `RB-5.A4` | Quest: move forward that many spaces, stopping at 40. |
| `RB-5.A5` | Quest: gain the disc on top of your tower; the card goes to the end of your card row (row matches tower). |
| `RB-5.A6` | Quest: resolve an "immediately" power. |
| `RB-5.A7` | Quest: resolve each Milestone crossed or landed on for the first time. |
| `RB-5.A8` | Quest: refill the empty slot from the same age deck; empty deck leaves the slot empty. |
| `RB-5.B1` | Rush: optionally discard one face-up market card of any age and refill that slot. |
| `RB-5.B2` | Rush: move to the space directly ahead of the nearest pawn in front (strictly ahead, not at the Doorway). |
| `RB-5.B3` | Rush: with no such pawn, move 3 spaces. |
| `RB-5.B4` | Rush: Rush bonuses from powers are added after the target is found. |
| `RB-5.B5` | Rush: resolve any Milestones crossed. |
| `RB-5.B6` | Rush: you gain no disc. |
| `RB-5.B7` | Rush is always legal; with no legal quest you must Rush. |

## Rulebook §6 — Ages

| ID | Rule |
|---|---|
| `RB-6.1` | Your age is set by your own pawn's position. |
| `RB-6.2` | Young (0–13) may take Young cards. |
| `RB-6.3` | Middle (14–27) may take Young or Middle cards. |
| `RB-6.4` | Old (28–39) may take Young, Middle or Old cards. |
| `RB-6.5` | Age is checked at the start of the turn, before moving. |
| `RB-6.6` | The market always shows all three ages; older players may still take Young cards. |

## Rulebook §7 — Experience and powers

| ID | Rule |
|---|---|
| `RB-7.1` | Every 2 discs of a domain already in your tower make that domain's quests 1 year cheaper. |
| `RB-7.T1` | 0–1 discs → discount 0. |
| `RB-7.T2` | 2–3 discs → −1. |
| `RB-7.T3` | 4–5 discs → −2. |
| `RB-7.T4` | 6–7 discs → −3. |
| `RB-7.T5` | 8+ discs → −4. |
| `RB-7.2` | Count discs before adding the new one. |
| `RB-7.3` | Powers are active from the moment the card is taken and stay active even if the card falls away at the Doorway. |
| `RB-7.P1` | Cross-domain discount (5 cards): Love → Family → Play → Wonder → Work → Love, −1 year. |
| `RB-7.P2` | Rush bonus (Learn to rest): +1 space whenever you Rush. |
| `RB-7.P3` | Reach older (Old friends): once per game, take a quest one age older. |
| `RB-7.P4` | Ignore requirement (Say yes more): once per game, ignore one requirement. |
| `RB-7.P5` | Swap now (Keep a diary): immediately swap two adjacent discs; the new disc may be one of them. |
| `RB-7.P6` | Next quest discount (Quit the good job): next quest −2; a Rush first leaves it waiting. |
| `RB-7.P7` | Doorway bonus (Make peace with it): keep 1 extra disc at the Doorway. |
| `RB-7.4` | All discounts stack; the minimum cost is still 1. |
| `RB-7.5` | Once-per-game powers are tracked as used; you choose when to use them; they are never forced. |
| `RB-7.6` | Reflection: if kept, +1 per disc of its domain in the kept stretch, including its own. |
| `RB-7.7` | Reflection only counts if the Reflection card itself is kept. |

## Rulebook §8 — Milestones

| ID | Rule |
|---|---|
| `RB-8.1` | Spaces 10, 20, 30: the first time you land on or pass one, you may swap two adjacent discs (and cards). |
| `RB-8.2` | One move crossing two Milestones gives two swaps. |
| `RB-8.3` | Swaps are optional. |
| `RB-8.4` | Milestones are per player: each player gets each Milestone once. |

## Rulebook §9 — Reaching the Doorway

| ID | Rule |
|---|---|
| `RB-9.1` | Reaching space 40 arrives you; extra movement is ignored. |
| `RB-9.2` | A quest past 40 is allowed: you gain its disc and arrive. |
| `RB-9.3` | Take the top Doorway tile: it is your allowance. |
| `RB-9.T4` | 4 players: 9 / 8 / 7 / 6. |
| `RB-9.T3` | 3 players: 9 / 8 / 7. |
| `RB-9.T2` | 2 players: 9 / 7. |
| `RB-9.4` | Keep one unbroken stretch up to the allowance (plus Doorway bonus); everything outside is discarded. |
| `RB-9.5` | A tower no taller than the allowance is kept whole. |
| `RB-9.6` | Choose the stretch at once or wait until the end; no more turns after arriving. |
| `RB-9.7` | The game ends when every player has arrived. |

## Rulebook §10 — Scoring and winning

| ID | Rule |
|---|---|
| `RB-10.1` | Card points: printed points of each kept card. |
| `RB-10.2` | Full life: +6 per complete set of all five domains (sets = count of the rarest domain). |
| `RB-10.3` | Passion: your longest run of one domain, touching in the tower. |
| `RB-10.T1` | Passion run 1–2 → 0. |
| `RB-10.T2` | Passion run 3 → 3. |
| `RB-10.T3` | Passion run 4 → 6. |
| `RB-10.T4` | Passion run 5+ → 10. |
| `RB-10.4` | Reflection: each kept Reflection card scores +1 per kept disc of its domain. |
| `RB-10.5` | Highest total wins. |
| `RB-10.6` | Tiebreaker 1: most discs kept. |
| `RB-10.7` | Tiebreaker 2: arrived earlier. |
| `RB-10.8` | Tiebreaker 3: shared victory. |

## Rulebook §11 — Solo challenge

| ID | Rule |
|---|---|
| `RB-11.1` | Solo allowance is 8. |
| `RB-11.2` | Solo market drift: at the end of each turn, discard the leftmost card of each row, slide left, refill. |
| `RB-11.3` | Solo Rush moves 4 spaces (plus Rush bonuses). |
| `RB-11.T1` | Rating: under 25 — A quiet life. |
| `RB-11.T2` | Rating: 25–34 — A good life. |
| `RB-11.T3` | Rating: 35–44 — A full life. |
| `RB-11.T4` | Rating: 45+ — Everything you could bring. |

## Rulebook §12 — Clarifications

| ID | Rule |
|---|---|
| `RB-12.T1` | Furthest back = lowest space among players who haven't arrived. |
| `RB-12.T2` | Ties: top pawn first; stack order only changes when a pawn arrives on that space. |
| `RB-12.T3` | Start of game: all pawns on 0, the top pawn goes first. |
| `RB-12.T4` | Rush with no pawn ahead (e.g. everyone else arrived): move 3. |
| `RB-12.T5` | Rush when the nearest pawn ahead is on 39: move to 40 and arrive. |
| `RB-12.M1` | Taking a card is the only way a row changes, except the Rush discard and solo drift. |
| `RB-12.M2` | An empty deck leaves the slot empty for the rest of the game. |
| `RB-12.M3` | Visible cards you can't take stay in the market. |
| `RB-12.R1` | Requirements count discs in your tower when you take the card, before the new disc. |
| `RB-12.R2` | Discs moved by a Milestone swap still count for requirements. |
| `RB-12.R3` | Old friends stretches age by exactly one step and does not waive requirements. |
| `RB-12.R4` | Old friends and Say yes more may be used on the same quest. |
| `RB-12.C1` | Discounts: add them all, subtract from printed years, then apply the minimum of 1. |
| `RB-12.C2` | Quit the good job applies to the next quest even many turns later; it cannot be saved past it. |
| `RB-12.W1` | The tower is never reordered except by Milestones and Keep a diary. |
| `RB-12.W2` | The card row mirrors the tower; swapping discs swaps their cards. |
| `RB-12.W3` | Requirements, discounts and powers use the whole tower during play; only scoring uses the kept stretch. |
| `RB-12.D1` | The kept stretch must be unbroken (consecutive discs). |
| `RB-12.D2` | Make peace with it adds 1 to the allowance even if the card itself falls away. |
| `RB-12.D3` | A tower shorter than the allowance: keep everything. |
| `RB-12.D4` | Arrival order is the order players reached space 40. |
| `RB-12.S1` | Passion counts consecutive same-domain discs in the kept stretch; only the single longest run scores. |
| `RB-12.S2` | Full life sets need no order or adjacency. |
| `RB-12.S3` | One disc can count for card points, a set, a Passion run and a Reflection bonus at once. |
| `RB-12.P1` | Everything is public: towers, card rows, market, positions (deck order is the only hidden information). |

## Rulebook §13 — Tunable values (each key is honoured)

| ID | Rule |
|---|---|
| `RB-13.1` | `trackLength` is honoured. |
| `RB-13.2` | `ageBands` are honoured. |
| `RB-13.3` | `milestones` are honoured. |
| `RB-13.4` | `market` row sizes are honoured. |
| `RB-13.5` | `experienceStep` is honoured. |
| `RB-13.6` | `minCost` is honoured. |
| `RB-13.7` | `rushNoPawnAhead` is honoured. |
| `RB-13.8` | `rushDiscard` (on/off) is honoured. |
| `RB-13.9` | `doorway.4` (4p tiles) is honoured. |
| `RB-13.10` | `doorway.3` (3p tiles) is honoured. |
| `RB-13.11` | `doorway.2` (2p tiles) is honoured. |
| `RB-13.12` | `fullLifeBonus` is honoured. |
| `RB-13.13` | `passion` table is honoured. |
| `RB-13.14` | `reflectionPerDisc` is honoured. |
| `RB-13.15` | `solo.doorway` is honoured. |
| `RB-13.16` | `solo.rush` is honoured. |
| `RB-13.17` | `experienceCap` (R1) is honoured. |
| `RB-13.18` | `hints.bestWindow` (R35) is honoured by the hint logic. |
| `RB-13.W1` | Things to watch — Doorway irrelevance is measured (discs lost by arrival order). |
| `RB-13.W2` | Things to watch — specialist snowball is measured (experience discount usage, strategy win rates). |
| `RB-13.W3` | Things to watch — first-player advantage is measured (seat win rates). |
| `RB-13.W4` | Things to watch — stale market for Young players is measured (turns with no legal quest). |

## Rulebook §15 — Card list claims

| ID | Rule |
|---|---|
| `RB-15.1` | 60 cards: 25 Young, 20 Middle, 15 Old. |
| `RB-15.2` | 12 cards per domain. |
| `RB-15.3` | 11 cards with powers. |
| `RB-15.4` | 5 Reflection cards (one per domain, Old). |
| `RB-15.5` | Young cards never have requirements. |
| `RB-15.6` | Years/points ranges per age match the §15 table. |

## Rulebook §16 — Worked example

| ID | Rule |
|---|---|
| `RB-16` | The worked example plays out exactly as written. |

## Build spec §5 — Rules engine

| ID | Rule |
|---|---|
| `BS-5.1` | Public API: `init`, `currentPlayer`, `legalMoves`, `apply` (throws on illegal), `isOver`, `score`, `cost`. |
| `BS-5.2` | Data model: Card, Power, PlayerState and GameState carry the spec's fields. |
| `BS-5.3` | Moves: quest / rush / swap / skip_swap / choose_window; swaps are pending choices resolved one at a time; `choose_window` any time after arrival; game over only when all have chosen. |
| `BS-5.4.1` | Current player: lowest position among non-arrived, ties → topmost pawn. |
| `BS-5.4.2` | Quest validation and resolution; `pendingNextQuestDiscount` cleared after use. |
| `BS-5.4.3` | Rush: discard + refill, target, rush bonus, Milestones. |
| `BS-5.4.4` | Movement cap and arrival (`arrivalOrder`, allowance + bonus). |
| `BS-5.4.5` | Stacking: landing on an occupied space goes on top. |
| `BS-5.4.6` | Game over: all arrived and all windows chosen. |
| `BS-5.5` | Score = cardPoints + fullLifeBonus × min(count) + passion(longestRun) + Σ reflection, over the kept range. |
| `BS-5.6` | Solo mode values (superseded by R29: solo = exactly one seat). |
| `BS-5.7` | Ruleset file shape (plus `experienceCap` and `hints.bestWindow`). |
| `BS-5.8.1` | Every rule has a test (this checklist and its checker). |
| `BS-5.8.2` | The rulebook §16 worked example is a passing scripted test. |
| `BS-5.8.3` | Property tests over 10,000 random games: ends, no illegal state, card conservation, tower = row, deterministic replay. |
| `BS-5.8.4` | `legalMoves` never returns a move `apply` rejects; `apply` rejects every move not in `legalMoves`. |
| `BS-5.8.5` | 1,000 greedy bot-vs-bot 4p games in under 10 s. |
| `BS-EVENTS` | Events from the spec appendix are emitted (game_started, quest_taken, rushed, market_refilled, milestone_reached, swap_made/skipped, age_changed, arrived, window_chosen, game_over). |

## RULINGS

| ID | Rule |
|---|---|
| `R1` | Experience discount = min(experienceCap, floor(discs / experienceStep)), counted before the new disc. |
| `R2` | Passion keys are thresholds: a run scores the value of the largest key ≤ its length; below the smallest key, 0. |
| `R3` | A swap with fewer than 2 discs is skipped automatically (`swap_skipped nothing_to_swap`); the Milestone still counts as used. |
| `R4` | Doorway allowances are parameters; the analysis headline is Doorway relevance. |
| `R5` | Current player = lowest non-arrived position, ties → top pawn; each Quest/Rush increments `turn`; swaps and windows don't. |
| `R6` | Starting stack bottom → top is seat N … seat 1; seat 1 is first. |
| `R7` | A move a → b triggers every unused Milestone m with a < m ≤ b, ascending, for Quests and Rushes. |
| `R8` | Quest resolution order: pay+move, disc, powers, Keep a diary swap, Milestone swaps, refill, arrival (swaps before arrival). |
| `R9` | Rush target: lowest space strictly greater than yours among non-arrived pawns, +1 (on top if occupied), capped; else + rushNoPawnAhead (solo: solo.rush); Rush bonus after. |
| `R10` | Rush discard: optional, only if rushDiscard; any face-up card; refill the slot; before moving. |
| `R11` | Rush is always legal and always moves at least one space, so every game ends. |
| `R12` | Arrival: allowance = doorway[count][order − 1] + doorway bonuses; arrived pawns leave turn order and Rush targeting. |
| `R13` | Market slots are positional; refills go to the emptied slot; an empty deck leaves `null`. |
| `R14` | Initial deal: shuffle each age deck with the seeded RNG, then deal Young, Middle, Old. |
| `R15` | Deck order is the only hidden information; bots never read it; the UI shows deck counts only. |
| `R16` | Age is checked at the start of the turn from your own position. |
| `R17` | Old friends: once per game, exactly one age older; offered only on cards that need it; not for Old players. |
| `R18` | Say yes more: once per game, ignores a requirement but not the age gate; offered only when the requirement is unmet; combines with Old friends. |
| `R19` | Powers start after the quest that grants them; cross-domain and Rush bonus are permanent and survive the Doorway. |
| `R20` | Quit the good job: −2 on the next Quest of any domain; Rushes don't consume it; consumed even if partly wasted. |
| `R21` | cost = max(minCost, years − experience − crossDomain − pendingNextQuestDiscount). |
| `R22` | Keep a diary's swap is optional (a pending choice that can be skipped); the new disc may be one of the two. |
| `R23` | Swaps exchange tower[i] and tower[i+1]; the card row is the tower. |
| `R24` | Any contiguous window of length 1..allowance is accepted; UI and bots offer maximal windows; short towers keep all automatically; empty tower scores 0. |
| `R25` | Windows may be chosen any time after arriving; bots choose at once and optimally; the game is over when all have arrived and chosen. |
| `R26` | Full life = min(count per domain) × fullLifeBonus. |
| `R27` | Each kept Reflection card scores reflectionPerDisc × kept discs of its domain (own disc included); two cards score separately. |
| `R28` | Ties: most kept, then earlier arrival, then shared; a k-way shared win counts 1/k. |
| `R29` | Solo = exactly one seat: allowance solo.doorway, Rush solo.rush (+bonus), end-of-turn drift (leftmost non-empty discarded, slide left, refill right). |
| `R30` | Seeded RNG with serializable state; decks use the game stream; each bot has its own stream from hash(seed, seat, policy). |
| `R31` | Replays `{rulesetId, rulesetHash, cardsHash, seed, seats, moves}` reproduce events and scores; hash mismatch refuses with a reason. |
| `R32` | Local games: unlimited undo. |
| `R33` | Domain codes Lv, Wk, Pl, Fm, Wd; a disc shows color, icon and code. |
| `R34` | Pawns are ivory with the player's initial, never domain-colored; bot pawns have a dashed ring; the current pawn pulses. |
| `R35` | Best-window hint on by default; Blind test turns it and first-game hints off; the score preview still updates. |
| `R38` | Phone market shows one age at a time as tabs; default = player's own age; unreached ages say where they open. |
| `R39` | Bot speed: Slow 2 s, Normal 1 s (default), Instant. |
| `R41` | The colour-blind palette is an alternate token set (Okabe–Ito); icons and codes don't change. |
| `R42` | minCost may be 0 and the engine still terminates (property tests). |
| `R43` | Ruleset validation: doorway[n] has n entries, age bands tile the track, Milestones inside, passion non-empty; invalid rulesets are refused readably. |
| `R45` | Seat advantage is reported both in percentage points and relative to fair share. |
| `R46` | The game, app and user-facing strings say Doorway. |

## Deferred

Later features (online play, survey, telemetry). No tests tonight.

| ID | Rule |
|---|---|
| `R32-ONLINE` | Online undo window until `revealAt`; human moves end it; undo logged as an event. |
| `R36` | Post-game survey (seven items). |
| `R37` | "Something feels off" captures state, move index, turn and comment. |
| `R39-REVEALAT` | Server stamps bot events with `revealAt`. |
| `R40` | Privacy line in lobby, table footer and survey. |
| `R44` | What is stored server-side (nicknames and game data only). |
