# RULINGS — Doorway v0.2

This file settles every gap found in `everything-you-bring-rules-v0.2.md`, `everything-you-bring-build-spec-v1.0.md` and `cards.json`.

**Precedence.** Where this file speaks, it wins. Where it is silent, the rulebook wins, then the build spec. Rulings marked **(confirmed)** were approved by CIAO. All others are build defaults: change them by editing this file, never by quietly changing code.

Each ruling has an ID. Every engine test that covers a ruling names its ID, for example `it('R3: Milestone with one disc auto-skips')`.

---

## 0. Canonical ruleset file

`packages/content/rulesets/v0.2-default.json` must be exactly this. It is the build spec §5.7 file plus two keys: `experienceCap` (R1) and `hints.bestWindow` (R35).

```json
{
  "id": "v0.2-default",
  "trackLength": 40,
  "ageBands": { "young": [0, 13], "middle": [14, 27], "old": [28, 39] },
  "milestones": [10, 20, 30],
  "market": { "young": 3, "middle": 2, "old": 2 },
  "experienceStep": 2,
  "experienceCap": 4,
  "minCost": 1,
  "rushNoPawnAhead": 3,
  "rushDiscard": true,
  "doorway": { "2": [9, 7], "3": [9, 8, 7], "4": [9, 8, 7, 6] },
  "fullLifeBonus": 6,
  "passion": { "3": 3, "4": 6, "5": 10 },
  "reflectionPerDisc": 1,
  "solo": { "doorway": 8, "rush": 4 },
  "hints": { "bestWindow": true },
  "cardsFile": "cards.json"
}
```

Every key is tunable (CIAO, confirmed). The simulator's `--sweep` and the sandbox must accept any of them by dotted path: `doorway.4=10,7,5,3` sets the whole 4-player array, and `doorway.4.0=10` sets one element.

---

## 1. The four rulings from review

**R1 — Experience is capped (confirmed).** The discount for a domain is `min(experienceCap, floor(discsOfThatDomain / experienceStep))`, with `experienceCap = 4`. This matches the rulebook table, where 8 or more discs gives −4. Count discs before the new one is added.

**R2 — Passion keys are thresholds (confirmed).** The ruleset key `"5"` means 5 or more. In general, a run of length L scores the value of the largest key ≤ L. A run shorter than the smallest key scores 0. Only the single longest run of one domain in the kept stretch scores.

**R3 — A swap with nothing to swap is skipped automatically (confirmed).** If a Milestone or *Keep a diary* would let you swap two adjacent discs but your tower has fewer than 2 discs, there is no choice. The engine emits `swap_skipped { reason: "nothing_to_swap" }` and continues. The Milestone still counts as used; it is "the first time you reach it", whether or not you could swap.

**R4 — The Doorway allowances stay as written (confirmed).** Do not change the rules. Expose the allowances as parameters (§0). Make "Does arriving first make the Doorway irrelevant?" the headline question of the simulation analysis: discs lost by arrival order, the share of arrivals that lose any disc, and sweeps of alternative tiles.

---

## 2. Turns and movement

**R5 — The current player.** Among players who have not arrived, the lowest position moves. Ties go to the pawn on top of that space's stack. Turns are not rounds. Each Quest or Rush is one turn and increments `turn`. Swaps and window choices are sub-moves and do not increment it.

**R6 — The starting stack.** Seat 1 is the first player and sits on top. The stack bottom to top is seat N … seat 2, seat 1. "Clockwise" in the rulebook means ascending seat number.

**R7 — Milestones.** A move from space `a` to `b` triggers every Milestone `m` with `a < m ≤ b` that this player has not used. This applies to Quests and Rushes alike. Several are queued in ascending order. A move never goes backward.

**R8 — The order of resolution within a Quest** is fixed:
1. Pay and move.
2. Push the disc on top.
3. Mark powers.
4. Apply *Keep a diary*'s swap.
5. Apply Milestone swaps in ascending order.
6. Refill the market slot.
7. If the pawn reached the Doorway, run the arrival steps (take a tile, assign the allowance).

Swaps resolve **before** arrival, so a Quest from 28 to 40 still gives the Milestone-30 swap. This matters because tower order decides the window.

**R9 — The Rush target.** "The nearest pawn in front of you" is the pawn on the lowest space strictly greater than yours, ignoring arrived pawns. Pawns on your own space, above or below you, are not in front. The target is that space + 1, even if it is occupied (you go on top), capped at the track length. If no such pawn exists, the target is your space + `rushNoPawnAhead` (solo: `solo.rush`). The Rush bonus (*Learn to rest*) is added after this, in both cases.

**R10 — The Rush discard.** It is optional, and allowed only if `rushDiscard` is true. You may discard any face-up market card of any age, including cards you could not take. Refill that slot from that age's deck; if the deck is empty, the slot stays empty. The discard happens before you move.

**R11 — Rush is always legal.** A Rush always moves you at least one space forward. If you have no legal Quest, Rush is your only move. Because of this, every game ends (property test).

**R12 — Arrival.** Reaching `trackLength` arrives you. Extra movement is ignored. Players arrive one at a time, because only one pawn moves per turn. Your tile is `doorway[playerCount][arrivalOrder − 1]` plus the sum of your `doorway_bonus` powers. Build spec §5.4 writes `[arrivalOrder]` with a 1-based `arrivalOrder`; the 0-based array index is `arrivalOrder − 1`. Arrived pawns are removed from turn order and from Rush targeting.

---

## 3. Market and decks

**R13 — Slots are positional.** Each age row is an ordered array of length `market[age]`. A refill goes into the slot that was emptied. An empty deck leaves the slot `null` for the rest of the game.

**R14 — Initial deal.** Shuffle each age deck with the seeded RNG, then deal Young, Middle, Old in that order. This makes a seed reproduce the same market.

**R15 — Hidden information.** Deck order is the only hidden information.
- Bots must never read deck order.
- The lookahead bot determinizes: it shuffles the unseen cards of each age per rollout.
- The UI shows deck counts only.

---

## 4. Ages, requirements and powers

**R16 — Age is checked at the start of the turn**, from your own position: Young 0–13, Middle 14–27, Old 28–39. You may take cards of your age or younger.

**R17 — *Old friends* (age reach).** Once per game, it lets you take a card exactly one age older: Young may take Middle, Middle may take Old. An Old player cannot use it, and it is not consumed. `legalMoves` offers `useAgeReach: true` only on a card that needs it. It is not offered for a card you could already take, so the power is never wasted by accident. It does not waive requirements.

**R18 — *Say yes more* (ignore requirement).** Once per game, it ignores one quest's requirement, but not its age gate. It is offered only on a card whose requirement you do not meet. It may combine with *Old friends* on the same quest.

**R19 — Powers start after the quest that grants them.** The granting card's own cost never benefits from its power. Cross-domain discounts and the Rush bonus are permanent. Powers stay active even if the card later falls away at the Doorway (rulebook).

**R20 — *Quit the good job*.** It applies −2 to your next Quest of any domain, even many turns later. Rushes don't consume it. It is consumed by that Quest even if the minimum cost (1) makes part of it wasted.

**R21 — Discount order.** `cost = max(minCost, years − experience − crossDomainDiscounts − pendingNextQuestDiscount)`. Add the discounts, subtract, then apply the floor.

**R22 — *Keep a diary* is optional.** Its "immediately" means "now or never": the swap is offered as a pending choice that can be skipped. The new disc may be one of the two swapped. This follows the rulebook's "powers are never forced".

**R23 — Swaps** exchange `tower[i]` and `tower[i+1]` for any valid `i`. The card row is the tower; a single array of card ids stores both. Requirements count discs regardless of order.

---

## 5. Doorway and scoring

**R24 — The window.** The engine accepts any contiguous window of length 1 to the allowance.
- Every score component is non-decreasing as a window grows, so a shorter window never scores more. The UI and bots therefore offer only maximal windows: length `min(allowance, towerHeight)`.
- If the tower is no taller than the allowance, the engine keeps everything automatically and emits `window_chosen` without a choice.
- An empty tower scores 0.

**R25 — Timing.** A player may choose a window any time after arriving. Bots choose immediately and optimally. The game is over when everyone has arrived and every window is chosen. The online UI prompts at once but lets a player wait.

**R26 — Full life** counts how many times all five domains appear in the kept stretch: `min(count per domain) × fullLifeBonus`.

**R27 — Reflection.** Each kept Reflection card scores `reflectionPerDisc ×` the kept discs of its domain, counting its own disc. Two Reflection cards each score separately.

**R28 — Tiebreakers.** Highest total wins. Ties go to most discs kept, then earlier arrival; if still tied, the victory is shared. For win-rate statistics, a k-way shared win counts 1/k to each player.

---

## 6. Solo

**R29 — Solo uses the normal rules with three changes.** A game with exactly one seat is a solo game. This replaces build spec §5.6's `solo: true` flag; the ruleset's `solo` object holds the solo values.
- The allowance is `solo.doorway` (8) plus bonuses.
- Rush moves `solo.rush` (4) plus bonuses. There is never a pawn ahead.
- At the end of every turn, including Rushes, the market drifts: in each age row, discard the leftmost non-empty card, slide the rest left, and refill the empty slots on the right from the deck.

The game ends when the player arrives and chooses a window. The rating uses the rulebook bands.

---

## 7. Randomness, replays, bots

**R30 — Seeded RNG.** Use one documented PRNG (for example sfc32 or xoshiro128**) whose state serializes into `GameState.rngState`.
- Deck shuffles draw from the game stream.
- Each bot gets its own stream seeded from `hash(gameSeed, seat, policyId)`, so changing a bot never changes the deal.

**R31 — Replays.** A replay is `{ rulesetId, rulesetHash, cardsHash, seed, seats, moves[] }`. Replaying must reproduce identical events and scores. A replay whose hashes don't match the current content refuses to load and says why.

**R32 — Undo.**
- Local games: unlimited undo.
- Online games: a player may undo their own last move until the first event after it is revealed (its `revealAt`). After a human move, the server reveals bot moves no sooner than 1.5 s later, even at Instant speed, so an undo window always exists. An undo discards those bot moves and recomputes them.
- Human moves by another player end the window at once.
- Every undo is logged as an event.

---

## 8. Design-level rulings (found while designing)

**R33 — Domain letter codes** for color-blind play are two letters: Love **Lv**, Work **Wk**, Play **Pl**, Family **Fm**, Wonder **Wd**. Single letters collide (W). A disc always shows its color, its icon and its code, never color alone.

**R34 — Pawns are not colored by domain.** This overrides the rulebook's "one pawn per player color" for the digital version: a player is identified by initial and seat, not by color. Pawns are ivory tokens with the player's initial, so they never compete with the five domain colors. A bot pawn has a dashed outer ring. The current player's pawn pulses.

**R35 — Best-window hint.**
- It is on by default.
- A room's **Blind test** toggle turns it off, along with all first-game hints. The ruleset flag is `hints.bestWindow`.
- When the hint is off, the score preview still updates live; only the "best" outline disappears.
- This is build spec §14's "on in hint mode": hint mode is the default for rooms and local games, and Blind test turns hint mode off.

**R36 — Survey.** One screen, about a minute, seven quick items:
- CIAO's five: fun 1–5, clarity 1–5, would play again (Yes / Maybe / No), most confusing moment (text), and free text;
- plus the build spec's: length felt (too short / right / too long) and real choices 1–5. The spec's "most memorable moment" is the free-text prompt: "Your most memorable moment — or anything else?"

**R37 — "Something feels off"** is always visible during play. It captures:
- the full serialized state;
- the move index;
- whose turn it was;
- the comment.

The dashboard opens the replay at exactly that move.

**R38 — Phone market.** At 390px wide, the market shows one age at a time as tabs. The default tab is the player's own age. Tabs for ages not yet reached say where they open ("Middle · at 14"). The action bar sticks to the bottom.

**R39 — Bot speed.** Slow (2 s), Normal (1 s, the default), Instant. The server computes bot moves at once and stamps their events with `revealAt` times, so clients animate at the chosen speed. Undo (R32) respects the same delay.

**R40 — Privacy line.** Shown in the lobby, at the table footer and in the survey: *"We keep your nickname and your game moves. Nothing else."* There are no third-party analytics.

**R41 — The colour-blind palette** is an alternate token set (Okabe–Ito mapping). Toggling it never changes the icons or codes.

**R42 — Minimum cost in the sandbox** may be set to 0. The engine must still terminate: quests of cost 0 are finite because the market is finite, then Rush applies. Property tests cover `minCost = 0`.

**R43 — Ruleset validation.**
- `doorway[n]` must have exactly n entries for every supported player count.
- Age bands must tile 0 to `trackLength − 1` with no gaps.
- Milestones must lie inside the track.
- `passion` must have at least one key.

An invalid ruleset is refused with a readable error; it never crashes the engine.

**R44 — What is stored.** Only nicknames and game data: seats, moves, states, surveys, flags, timings. No IP addresses, user agents, emails or third-party analytics (no Vercel Analytics). The private dashboard can delete any game's logs (build spec §10).

**R45 — Seat-advantage target.** Build spec §1's "within ±5% of fair share" is reported both ways: in percentage points and relative to fair share. The analysis states which reading it used for pass / fail.

**R46 — The name is Doorway (confirmed).** The game, the app, the repo and every user-facing string use **Doorway**. The spec files keep their original working title, "Everything You Bring", and their file names; read that title as Doorway. The in-game Doorway (space 40) keeps its name. Where the two could be confused in copy, the game is "Doorway" and the end of the track is "the Doorway".

