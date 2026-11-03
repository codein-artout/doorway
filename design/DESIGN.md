# DESIGN — Doorway, playtest app

**Look: "Dusk table."** A dark night-ink table. Five bright memory discs. One warm, lit Doorway at the end of the path.

Everything comes from the game's own parts: the track is a strip of shaded years, discs are chips that stack, and the Doorway is the only warm light on screen. It is reserved for the end and for the action that moves you toward it.

There are no gradients, no glassmorphism, no emoji and no stock "card with a colored left border".

## Primary references (design/screens/)

The `.dc.html` files are the canvas sources. Their inline styles are the spec: match spacing, sizes and colors from them. The `{{…}}` holes and `<sc-for>` / `<sc-if>` tags are the mockup's template language. Rebuild them as React components; don't copy the runtime.

| File | Screen | Status |
|---|---|---|
| `Main.dc.html` | **Game table, desktop.** Interactive: select, preview, confirm, undo, bot "thinking", flag. | **Primary** |
| `Doorway.dc.html` | **The Doorway moment.** Interactive: slide the stretch, live score, compare windows, lock in. | **Primary** |
| `TablePhone.dc.html` | **Game table at 390px.** | **Primary for mobile** |
| `Lobby.dc.html` | Lobby: host view and "friend opens the link" view; seats, bots, how to play. | Primary |
| `LobbyPhone.dc.html` | Join flow at 390px. | Primary for mobile |
| `Results.dc.html` | Final scores (kept stretches, component bars), then the survey. | Reference |
| `SimDashboard.dc.html` | Simulation analysis. Numbers are placeholders. | Reference |
| `Sandbox.dc.html` | Designer sandbox: dials, diff, run, compare. | Reference |
| `Feedback.dc.html` | Private feedback dashboard. | Reference |

The live canvas, with the same files, is the Claude Design artifact "Doorway — Playtest App".

---

## 1. Tokens

Define these once, as CSS variables in `globals.css` and in the Tailwind theme. Never hard-code hexes in components.

### Color — ground and text

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#12131F` | page ground; text on light surfaces |
| `--surface` | `#1B1D2E` | panels |
| `--surface-2` | `#24273B` | raised and selected panels, buttons |
| `--surface-sunk` | `#171928` | inset areas (market well, notes) |
| `--card` | `#1F2134` | quest cards |
| `--line` | `#34374F` | borders |
| `--line-soft` | `#2C2F45` | dividers |
| `--text` | `#ECE8DF` | primary text (warm off-white) |
| `--muted` | `#A9A8B8` | secondary text; ≥ 6:1 on `--surface` |
| `--door` | `#F7EBD0` | **the Doorway light**: the primary action, the current turn, the selection, the focus ring |
| `--alert` | `#5FD3E6` | signal cyan: "something feels off", discard marking, placeholder banners. Deliberately **not** a domain hue. |

### Color — age bands (track, row labels)

| Token | Hex | Rule line |
|---|---|---|
| `--young` | `#1F2A44` | `#3B4A72` |
| `--middle` | `#2A2745` | `#4C4478` |
| `--old` | `#352838` | `#5E4559` |

### Color — domains (discs, card badges)

| Domain | Code | Icon | Standard | Colour-blind (Okabe–Ito) |
|---|---|---|---|---|
| Love | Lv | heart | `#F07AA8` | `#CC79A7` |
| Work | Wk | hammer | `#E9B949` | `#F0E442` |
| Play | Pl | kite | `#57C785` | `#009E73` |
| Family | Fm | house | `#F08A3C` | `#E69F00` |
| Wonder | Wd | star | `#A48BFF` | `#56B4E9` |

Icons and codes on discs are always `--ink`. Every domain color clears 4.5:1 against ink.

### Color — score components (charts only, never discs)

| Component | Hex |
|---|---|
| Cards | `#ECE8DF` |
| Full life | `#6CB6D6` |
| Passion | `#E7766E` |
| Reflection | `#8E8FA8` |

Diverging charts (matchup matrix, seat advantage) run from blue `#5B8DEF` through `--surface` to orange `#F0A04B`.

### Type

| Role | Font | Use |
|---|---|---|
| Display | **Bricolage Grotesque** 700/800 | headlines, card names, big numbers, section titles |
| Body | **Atkinson Hyperlegible** 400/700 | everything people read; chosen for legibility on phones |
| Numbers | **JetBrains Mono** 500/700 | years, points, spaces, IDs, room codes |

The scale is 11 / 12 / 13 / 15 (body) / 16 / 17 / 20 / 26 / 32 / 40–44 px. Headlines use letter-spacing −0.015em. Nothing smaller than 10px, and only track numbers are 10px.

### Shape and space

- **Radius:** 5 (track cells) · 10–12 (buttons, cards) · 14–16 (panels) · 18–20 (hero panels) · 999 (pills, pawns, discs).
- **Spacing:** 4-px base; panel padding 16–24; page gutter 28 desktop and 16 phone; gaps of 10–20 between panels.
- **Touch targets:** 44px or more everywhere; primary actions 48–54px.
- **Doorway arch:** `border-radius: 50% 50% 6px 6px` horizontally, giving a lit arch shape at every size.

---

## 2. Components

| Component | Anatomy | States |
|---|---|---|
| **Disc** | A pill 56–64 × 22–34px in its domain color, with an inset bottom shadow so it reads as a chip. Holds the icon and the code; the card name sits beside it. Minis are 16–22px circles with the icon only. | normal · kept · left behind (25–32% opacity) · new (drop-in animation) |
| **Pawn** | A 24–34px ivory circle with the initial in mono. | current (Doorway-light pulse) · bot (2px dashed muted ring) · ghost landing (dashed Doorway-light outline, no fill) |
| **Track cell** | Age-band fill, space number at the bottom, pawns stacked above with the **top pawn drawn on top**. | milestone (Doorway-light ring around the number) · ghost |
| **Doorway** | A lit arch at the end of the track with a slow glow. Tiles beside it: `1st 9 · 2nd 8 · 3rd 7 · 4th 6`. A taken tile becomes an outline. | — |
| **Quest card** | Domain badge, domain name and code, ID, name (display font), cost (`3 → 2 yrs` with the old value struck through), points, requirement chip, power or Reflection text, and a status line at the bottom. | legal (status in Doorway light: "Lands on 13") · selected (2px Doorway-light border) · illegal (50% opacity plus a reason: "Too young — Middle from space 14", "Needs 2 Love") · discard target (2px dashed `--alert` cyan border) |
| **Market row** | Age label tile (band fill, range, "open to you" / "opens at 14") and up to 3 cards. Empty slots show the deck count. | — |
| **Turn banner** | Eyebrow, H1 ("Your turn, Priya." / "You go again, Priya." / "Arun is thinking…"), the reason line, and a "Why is it my turn?" disclosure. | yours (Doorway-light border) · others' (line border) |
| **Turn queue** | One card per player, sorted by who moves next: `Now / Next / 3rd / 4th`. Shows position, age, disc count, mini tower (base → top), experience. | current · bot thinking (three-dot pulse plus "weighing N legal moves") · friend choosing |
| **Action bar** | Quest / Rush toggles, power checkbox(es), live preview text ("…You move 11 → 13. You're still furthest back — you move again."), Undo, and the primary confirm button (Doorway-light fill). | — |
| **Score tiles** | Four boxes: Cards, Full life, Passion, Reflection, plus the total. The same four appear on the table, the Doorway and the results. | — |
| **Window bracket** | A 3px Doorway-light bracket down the left of the kept discs, with caps at both ends. The best-window hint is a dashed muted bracket. | — |
| **Flag button** | "Something feels off": a cyan alert-outlined pill with a flag icon, always in the header. It opens an inline note and saves with the game state. | — |
| **Placeholder banner** | A dashed alert-cyan box: "Every number on this page is placeholder data." Used on the designer mockups only; delete it once real data is wired. | — |

Icons are inline stroke SVG at 24-unit paths, 2–2.4 stroke, round caps. The paths are in `Main.dc.html` (`ICONS`).

---

## 3. Desktop layout — game table at 1440px

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Doorway                ROOM K7QX2P · 4p · v0.2-default         [Rules] [⚑ Something off] │ 64
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Young 0–13 ─────────────│ Middle 14–27 ────────────│ Old 28–39 ──────────│              │
│ ┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐ … 40 cells, pawns stacked, ◯10 ◯20 ◯30 │  ╭────╮      │
│ └┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘└┘                                    │  │DOOR│      │ 116
│ ◯ Milestone: swap   ◌ Bot pawn          Doorway tiles · 4p [1st 9][2nd 8][3rd 7][4th 6]   │
├───────────────────┬────────────────────────────────────────────────┬─────────────────────┤
│ WHO MOVES NEXT    │ ┌ YOUR TURN, PRIYA. ───────────── [Why me?] ┐ │ YOUR LIFE  sp 11    │
│ ┌ P Priya  NOW ─┐ │ │ You're furthest back (11). Arun next (14).  │ │  4 ▬Lv Heart broken │
│ │ ●●●●          │ │ └────────────────────────────────────────────┘ │  3 ▬Wk First job    │
│ └───────────────┘ │ QUESTS                                         │  2 ▬Lv Fall in love │
│ ┌ A Arun   NEXT ┐ │ [Young ] [card ] [card ] [card ]               │  1 ▬Wd Say yes more │
│ │ space 14      │ │ [Middle] [card·dim] [card·dim] [deck 15]       │  ═══ base           │
│ └───────────────┘ │ [Old   ] [card·dim] [card·dim] [deck 13]       │ Experience Love −1  │
│ ┌ M Meera  3rd ─┐ │ ┌ [Quest][Rush → 15] ☐Say yes more            ┐ │ Powers ...          │
│ └───────────────┘ │ │ preview: 3 → 2 yrs, 11 → 13, you go again   │ │ ┌ IF YOU WALKED   ┐ │
│ ┌ K Kavi   4th ─┐ │ │                       [Undo] [Take quest]   │ │ │ 7 · 0 · 0 · 0   │ │
│ └───────────────┘ │ └────────────────────────────────────────────┘ │ │ total 7         │ │
│ MOVE LOG  speed▾  │                                                │ └─────────────────┘ │
├───────────────────┴────────────────────────────────────────────────┴─────────────────────┤
│ We keep your nickname and your game moves. Nothing else.                                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  left 280–330px          centre flex (≥ 600px)                          right 290–340px
```

- Columns wrap (`flex-wrap`), so below about 1180px the right column drops under the centre. Below 760px, use the phone layout.
- The track scrolls horizontally if it is narrower than 900px.
- **Keyboard:** arrow keys move between cards, Enter quests, R rushes, U undoes, and Esc closes panels. Every control is a real `<button>`, `<select>` or `<input>`.

### Phone (390px) — `TablePhone.dc.html`

Top to bottom:
1. A compact header with ? and ⚑ icon buttons (44px).
2. The turn banner.
3. A 0–40 overview bar with pawn dots and the arch at the end.
4. A swipeable strip of the spaces near you.
5. Chips showing who moves next.
6. Age tabs for the market (R38).
7. Your tower.
8. The other players' towers.

A **sticky bottom action bar** holds the preview, Quest, Rush and the confirm button.

The Doorway on a phone uses the same tower list with large tap targets. Tapping a disc starts the stretch there, and the bracket and score tiles stay in view.

---

## 4. Motion

All motion respects `prefers-reduced-motion`; when it is set, motion is replaced by instant state changes. Durations are short, because this is a tool you play for an hour.

| Moment | Motion |
|---|---|
| **Disc stacking** | The new disc drops from 36px above onto the top of the tower in 420ms, `cubic-bezier(.2,.9,.3,1)`, with a 3px settle overshoot. The tower below does not move. |
| **Pawn moving** | The pawn hops space by space along the track: 60ms per space, max 900ms total, a 6px arc per hop. It lands on top of any stack, and the stack re-flows in 150ms. Milestones it passes flash their ring once. |
| **Current turn** | The current pawn pulses with a Doorway-light ring (1.6s loop). The turn banner cross-fades in 200ms when the turn changes. When the same player moves again, the title changes to "You go again" with no fade, so it reads as continuity. |
| **Bot thinking** | Three dots pulse in sequence (1.2s) on the bot's queue card and in the banner. The move then animates like a human's after the bot-speed delay. |
| **The Doorway cut** | On "Walk through":<br>1. The bracket locks: it thickens from 3 to 4px over 120ms.<br>2. Discs outside it slide 18px left and fade to 18% over 500ms, staggered 30ms from the edges outward.<br>3. The kept discs lift 4px.<br>4. The arch glow swells once (600ms).<br>5. The total counts up from the previous preview value (400ms). |
| **Rush** | The pawn makes one long glide (300ms), not hops, so it reads as skipping years. A discarded card flips face-down and slides off the row (250ms) before the refill fades in. |
| **Score preview** | Numbers tween over 200ms when the selection changes. Bars animate width over 200ms. |

---

## 5. Copy voice

The voice is warm and plain: a friend explaining a board game at the table, not an app onboarding you. Sentences are short, in second person and present tense. It may be a little wistful about life and memory, never saccharine.

**Do:**
- Say what will happen: "You move 11 → 13. You're still furthest back — you move again."
- Explain refusals: "Too young — Middle from space 14." / "Needs 2 Love."
- Use the game's own words: quest, rush, memory, disc, tower, stretch, Doorway, arrive, kept, left behind.
- Use domain names (Love, Work, Play, Family, Wonder), with codes only where space is tight.
- Use numbers in mono: years, spaces, points.

**Don't:**
- No "Oops!", "Awesome!", "Let's go!" or exclamation marks in system copy.
- No emoji, anywhere.
- No color-only meaning; no "the pink one".
- Don't say "AI" or "agent". Bots are "Bot · Tempo", "Bot · Specialist".
- Don't call losing discs "death"; the Doorway is about what you carry, not about dying.
- Don't use jargon like "legal move" in player-facing copy. Use "you can take" or "you can't take yet". "Legal" is fine in designer tools.

**Fixed strings:**
- Privacy: "We keep your nickname and your game moves. Nothing else."
- Flag button: "Something feels off".
- Why button: "Why is it my turn?" / "Why is it Arun's turn?"
- The Doorway: "The Doorway is small." / "Walk through with discs 3–11" / "N memories stayed behind."
- Results headline pattern: "{Winner} brought the most through."
- Solo ratings: the rulebook bands, verbatim.

---

## 6. Don'ts (visual)

- No light theme in v1. Dashboards use the same dark tokens.
- Don't use the Doorway light for anything but the current turn, primary actions, selection and focus. If everything glows, nothing does.
- Never give domain colors to UI chrome or pawns.
- No gradients, glass blur or drop shadows beyond the disc inset and the Doorway glow.
- No icons from an icon font. Use the five domain icons plus a minimal set (flag, lock, door, arrows) drawn the same way.
- Never hide game state. Everything in the physical game is public, so show it or put it one tap away.
