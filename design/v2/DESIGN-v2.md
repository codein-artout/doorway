# DESIGN v2: Board mode and Analyst mode

Doorway has two ways of looking at the same game. Both views read one engine state, and switching never changes or reloads the game.

- **Board mode** feels like a board game on a table: an illustrated paper board on dark felt, ink outlines, little pawn figures, and cards that look like cards.
- **Analyst mode** is the same moment drawn as a scoresheet: every option with its numbers, the bots' reasoning, and charts of the game so far.

This document replaces `design/DESIGN.md` for the game screens and the designer tools. Anything it doesn't mention (copy rules, accessibility rules, R-rulings) still comes from `design/DESIGN.md` and `spec/RULINGS.md`.

## Primary references (`design/v2/screens/`)

| File | Screen | Mockup is interactive |
|---|---|---|
| `Board-Table.dc.html` | **Board table** (primary) | yes: pick a card, preview, rush with discard, confirm, undo, bots play |
| `Board-Doorway.dc.html` | **Board Doorway moment** (primary) | yes: slide, tap a disc, compare, hint, walk through |
| `Board-Pieces.dc.html` | **Pieces sheet**: cards, card back, discs, pawns, tiles, tokens, track patterns | no |
| `Board-Results.dc.html` | Board end of game | no |
| `Board-Phone.dc.html` | Board table at 390 px (primary for mobile) | no |
| `Analyst-Table.dc.html` | **Analyst table** (primary) | yes: decision table, preview, confirm, bots play, charts update |
| `Analyst-Doorway.dc.html` | Analyst window scorer | yes |
| `Analyst-Results.dc.html` | Analyst game report | no |

These files use the same mockup format as v1: inline styles are the spec, and `{{…}}`, `<sc-for>` and `<sc-if>` are template syntax. The script block of each file contains:

- the exact icon paths (`ICONS`);
- the pawn SVG;
- the board geometry;
- the scoring helpers for previews.

The live canvas is "Doorway — Playtest App", page **v2 — Board & Analyst modes**.

## 1. The view switch

- A segmented control, **Board | Analyst**, sits in the header of every game screen and every designer screen.
- The switch shows the same moment in the other view:
  - table ↔ table;
  - Doorway ↔ window scorer;
  - results ↔ game report.
- The choice persists:
  - in the URL as `?view=board` or `?view=analyst`;
  - in localStorage for the next visit;
  - per viewer (in a hot-seat game, all seats share one browser, so one choice applies).
- The keyboard shortcut is **V**.
- Defaults:
  - a new viewer starts in Board mode;
  - `/designer` always uses Analyst styling and has no Board version.
- Implementation:
  - the two token sets live under `[data-view="board"]` and `[data-view="analyst"]`;
  - components that differ have Board and Analyst variants;
  - game logic stays shared, and no component holds game rules.

## 2. Shared across both modes

**Domain colours.** These replace the v1 colours everywhere. The colour-blind palette from v1 (Okabe–Ito) stays available as an alternate.

| Domain | Code | Icon | Colour |
|---|---|---|---|
| Love | Lv | heart | `#EBA6B0` |
| Work | Wk | hammer | `#E6B84F` |
| Play | Pl | kite | `#8DB884` |
| Family | Fm | house | `#D9733F` |
| Wonder | Wd | star | `#A097D6` |

Domain colour only ever appears on cards, discs, chips and small doodles, never on chrome. Every disc also shows its icon and code.

**Pawn identities** are neutral fills, never domain colours:

| Seat | Fill |
|---|---|
| Seat 1 (Priya in the mockups) | `#F6EFE0` |
| Arun | `#7F97A8` |
| Meera | `#C9B28E` |
| Kavi | `#5F5868`, with cream eyes and initial |

Bots wear an antenna with a lamplight ball. In charts, players are told apart by line style as well as colour (Analyst §4).

**Demo state.** All mockups share one position, and it is reachable under the rules: at turn 22, Priya is on 11, Arun 12, Meera 13 and Kavi 15, and Priya is to move. Its full 21-turn history is `HIST0` in `Analyst-Table.dc.html`. Use it as the fixture for component stories and e2e tests.

The earlier v1 demo (11 / 14 / 17 / 20) **cannot happen**:

- The pawn in front got there by moving from the back.
- So every other pawn was at least where that pawn started.
- Pawns never move backward.
- Therefore the spread between first and last is at most one move: about 4 spaces with Young cards, up to 6 later in the game.

Analyst mode shows this spread as a note.

## 3. Board mode

### Tokens

| Token | Value | Use |
|---|---|---|
| `--felt` | `#2C3836` + dot texture `radial-gradient(rgba(242,232,213,.035) 1px, transparent 1.5px) 6px 6px` | page background (the table) |
| `--felt-2` | `#233030` | sunken felt panels, the view switch |
| `--felt-line` | `#46534F` | outlines on felt |
| `--on-felt` | `#F2E8D5` | text on felt |
| `--on-felt-muted` | `#C9D2CC` | secondary text on felt |
| `--paper` | `#F1E7D2` | the board sheet |
| `--paper-card` | `#FBF6EA` | cards, tokens, bubbles (`#FFFDF6`) |
| `--paper-mat` | `#E9DFCB` | other players' mats |
| `--ink` | `#2B2530` | all outlines and text on paper |
| `--ink-soft` | `#5B5262` | secondary text on paper |
| `--lamplight` | `#F7D47A` | whose turn it is, selection halo, points coins, Doorway light, primary-button text |
| `--door` | `#3A3340` | door leaf, card back |
| `--drop` | `#1F2826` | the hard drop shadow under things on the table |
| `--sticky` | `#F6EBC0` | "too young" notes |
| `--stamp-red` | `#B2453A` | the Discard stamp only |
| Stage fills | Young `#F6EEDB` + dots · Middle `#F1E5CF` + 45° stripes · Old `#ECDDCB` + crosshatch | track rows (patterns as in `Board-Pieces`) |

**Type.** Three fonts:

- **Caprasimo** for names, numbers on cards and headings;
- **Gochi Hand** for the narrator: speech bubbles, hints, notes;
- **Nunito** 500–900 for everything people have to read.

Nothing is smaller than 11 px.

**Line and shape:**

- Ink outlines are 2.5–4 px with round joins.
- Corner radii: 12 for cards, 16–24 for panels, 999 for chips.
- One hard shadow, `0 5px 0 var(--drop)`, sits under objects on the table. There are no soft shadows except the board's own drop.
- Cards sit at small, fixed, deterministic rotations: −1.8° to +1.8° by slot, never random per render. A selected card straightens and lifts 14 px with a 5 px lamplight halo.

### Board geometry (`Board-Table`)

- The board sheet is 980 × 600 with a 4 px ink border and radius 26. It scales down proportionally below 1040 px and switches to the phone layout below 760 px.
- Three stage rows of cells 62 × 78. Their left edge is x = 54, and their tops are at y = 92, 278 and 464.
  - Young, spaces 0–13, runs left to right.
  - Middle, 14–27, runs right to left (`row-reverse`).
  - Old, 28–39, runs left to right and ends at the Doorway arch (x = 798, 128 × 170).
- The bends are SVG Bezier bands, an ink stroke of 48 under a paper stroke of 41, each with a chevron.
- Each stage name is set in Caprasimo 30 at the start of its row, with the space range in Gochi Hand.
- The Doorway tiles are small rotated plaques under the arch.
- The doodles (sun, cloud with a face, kite, paper plane, house, heart, cup, tree, bench, moon, sparkles) are decoration in one SVG layer. They are ink line plus a muted fill and must never sit under cells.
- Rosettes on 10, 20 and 30 are a double ring with the number, on a lamplight-tinted cell.

### Components

| Component | Notes |
|---|---|
| **Pawn** | The 28 × 40 SVG figure: head, eyes, body and initial. Several pawns on a space overlap by 12 px with the **top pawn drawn last**. The current pawn stands on a lamplight ellipse and bobs. Bots have the antenna. The landing preview is a dashed outline figure. |
| **Speech bubble** | Comes from the current pawn's space, in Gochi Hand 19 px. Examples: "My turn — I'm furthest back!", "Me again — still furthest back!", or a bot's "Hmm, let me think" with three pulsing dots. |
| **Quest card** | 128 × 196, with a domain band (icon, domain name), the name in Caprasimo, a requirement pill, power text, and a footer with an hourglass and years (old value struck through when discounted) plus a points coin. Cards you can't take carry a sticky note ("too young — opens at space 14", "needs 2 Family first"). In Rush mode, the card you're discarding gets a red Discard stamp. |
| **Card groups** | Young, Middle and Old groups lie side by side. Each label is in Caprasimo with a Gochi note: "open to you · 4 in the deck". |
| **Action tray** | A paper strip with Quest and Rush buttons (rotated ±1°, 4 px hard shadow), a token checkbox, the preview sentence in Gochi Hand 21 ("…land on 13 — on top of Meera; Arun goes next."), Undo, and **Take it** (ink fill, lamplight text). |
| **Turn order** | Pawn figures in queue order with arrows, under the heading "Furthest back goes next". |
| **Player mat** | Name, badge, space, age, number of memories, cheaper domains, and a physical chip stack (base bar, chips 46 × 12 that overlap by 2). |
| **Your life** | The large mat: chips 92 × 22 with names, experience, tokens, and a dashed "if you walked through the Doorway now" box. |
| **Doorway moment** | Your tower as chips (128 × 28) next to a large open-door illustration. A lamplight rail with ink caps marks the kept stretch. Discs outside it fade and slide out. Score parts are ticket stubs, the total is a rotated stamp, and "Every stretch you could take" is a row of bars. |
| **Results** | Four player cards with a rank rosette. Each card shows the kept chips inside an arch outline, with the chips left behind faded above and below, the four parts, a large total, and one Gochi line of story. |

### Motion (respects reduced motion)

| What | How it moves |
|---|---|
| Pawn | Hops space by space: 70 ms per space, 6 px arc, at most 900 ms. Lands on top of any stack; the stack re-flows in 150 ms. |
| Rush | One glide of 300 ms. |
| Card take | The card lifts, flies to your mat (350 ms) and becomes a chip that drops onto your stack (420 ms, settle overshoot). The empty slot refills by sliding the new card in from the deck side. |
| Speech bubble | Pops: scale 0.9 → 1, 160 ms. Bot thinking dots pulse at 1.2 s. |
| Doorway | The arch light breathes over 3 s. On "Walk through", the left-behind chips slide 28 px and tilt 4° (500 ms, staggered), and the stamp thuds (scale 1.15 → 1, 200 ms). |

### Copy

- The narrator is warm and plain, and may be a little wistful.
- Pawns may use one exclamation mark in their own speech bubble; system text never does.
- Use the game's words: memories, stretch, the road, the Doorway.

## 4. Analyst mode

### Tokens

| Token | Value |
|---|---|
| `--sheet` | `#F4F0E6` with a 24 px grid of `#E9E3D5` lines |
| `--panel` | `#FBF9F4` |
| `--panel-border` | `#CFC6B3`, 1.5 px, radius 10 |
| `--rule` | `#E2DACA` (row lines) · `#23202A` 1.5 px under table headers and the page header |
| `--ink` | `#23202A` |
| `--muted` | `#6B6475` (≥ 4.9:1 on panel) |
| `--highlight` | `#F6E27A`: selected row, current player, the newest log entry (at 33–55% alpha for soft) |
| `--good` / `--bad` | `#2F7D4F` / `#B4443A`. Always paired with a sign or symbol (`+5`, `✓`, `✗`), never colour alone. |
| Player lines | Priya `#23202A` 2.5 solid · Arun `#4F7290` dashed `6 4` · Meera `#9A7A4A` dotted `2 3` · Kavi `#6E5A86` dash-dot `9 3 2 3` |

**Type:**

- IBM Plex Sans for text;
- **IBM Plex Mono for every number**;
- Caprasimo for the Doorway wordmark only.

Section titles are 13 px, bold, uppercase and tracked 0.06em.

### Components and metric definitions

| Component | Contents and definitions |
|---|---|
| **Track ruler** | 41 columns; age bands as three greys; rosettes in highlight; the Doorway shown as a dark "D". Pawn markers are mono chips: the current one is inverted, bots have a dashed border, and ↑ marks the top of a stack. The ghost marker is "P?". Above the ruler: **queue now** and **queue after the selected move**. |
| **Decision table** | One row per face-up card, plus a Rush row. The first cell is a real `<button>`. Columns:<br>• **Age**: ok / from N.<br>• **Needs**: ✓ or ✗ with the requirement.<br>• **Yrs**: printed years.<br>• **Disc.**: total discount, with a tooltip splitting experience, power and next-quest.<br>• **Cost**: what you pay.<br>• **Pts**, and **Pts/yr** = pts ÷ cost.<br>• **Lands**: the space you land on.<br>• **Next up**: who moves next, with "you stack on top" or "you again".<br>• **Δ now**: score of tower + card, minus score of tower, both as if you walked through now with the whole tower kept.<br>• **Bots**: rank among legal cards for Greedy (G#) and Tempo (T#); the mockup shows G# and T#, and a Lookahead (L#) rank can be added.<br>Illegal rows are muted, with the reason given. Selecting a row previews it on the ruler. A discard selector appears for Rush. |
| **Preview line** | Mono text, for example `PK-Y3 · cost 2 (3 − Love 1) · 11→13 · next: Arun 12 · you stack on top · Δ now +5`, followed by Undo and **Take PK-Y3**. |
| **Players ledger** | Position; domain counts (dots plus codes); score now; discount lines per player. Plus the **Spread note**: "Spread N spaces. The leader always moved last from the back…". |
| **Your tower** | A table, top first, plus:<br>• **Pace**: mean years per quest for this player so far.<br>• **Projected**: discs + round((40 − position) ÷ pace) memories at space 40.<br>• **At the door**: "lose about (projected − 9) to (projected − 6)", with 4-player tiles. |
| **Why <bot> did that** | The last bot decision's top four candidates. Each is a stacked bar of feature contributions (points per year, focus domain, experience, tempo, and any other feature the strategy weights), with its total. The chosen one is highlighted. Header: turn · strategy · options · ms. Needs the engine hook in `BUILD_PROMPT-v2.md` §N3. |
| **Log** | The last eight events: turn, who, the card or "rush", from→to, and think time (ms for bots, s for people). The newest is highlighted. |
| **Charts** | **Position by turn**: a step chart, y = 0–20, growing as the game goes on. **Score if you walked through now**: lines, y auto-scaled to a multiple of 4. Inline SVG with a legend showing line styles, and an `aria-label` that summarises the final values. |
| **Window scorer** | A tower × window matrix: rows are discs (top first); columns are every maximal window, filled when the disc is inside it; the selected column is highlighted. A score table per window (cards, life, passion, reflection, total, versus best). Detail for the selected window (domain counts, why it scores sets / passion / reflection, what's left behind). **"If you had arrived at another time"**: the best window and score for each allowance from 10 down to 6, with the same tower. |
| **Game report** | • KPIs: winner, length, discs lost, back-to-back turns, rushes.<br>• Final table: arrived, tower, allowed, kept, lost, the four parts, total, a split bar, and the chosen window versus the best.<br>• Turn economy: turns, back-to-back, rushes, years per quest, years saved by experience, swaps used, median think time.<br>• **Played most like**, where agreement = share of this player's decisions where that strategy, given the same state, would have chosen the same move; the top three are shown.<br>• **Turning points**, which are events where:<br>  – Δ now ≥ 5 or ≤ −5;<br>  – a swap creates a run of 3 or more;<br>  – a rush discard removes a card the next player could take;<br>  – an arrival keeps everything;<br>  – an arrival loses 3 or more discs.<br>  Each turning point links to the replay at that move.<br>• **This game versus the bot study**, read from `reports/data/summary.json`. |
| **Designer tools** (`/designer`) | Same content as v1 (Analysis, Sandbox). Restyled with Analyst tokens, with the Board / Analyst switch hidden. The Analysis page replaces placeholders with the committed study numbers. |

**Motion:** row highlight 120 ms and chart lines drawn in 200 ms. Nothing else moves.

**Copy:** terse, numbers first, no narrator. Use the plain domain names.
