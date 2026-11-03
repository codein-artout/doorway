# EVERYTHING YOU BRING
### Rulebook — v0.2 (working title, complete prototype rules)

> Every life ends at the same Doorway. Some arrive early, some arrive late. The Doorway is small, and it only lets you carry one stretch of your life through.

- **Players:** 2–4 (plus a solo challenge)
- **Time:** about 60 minutes
- **Weight:** Splendor / Patchwork range
- **Core mechanisms:** time track (furthest back goes next), open drafting with personal age gates, ordered stacking, light engine (experience discounts + powers), set collection, final window selection

Lore and card flavor text come later. All numbers are playtest values; the full list of tunable values is in **Section 13**. The card list in **Section 15** is generated from `cards.json`, which is the single source of truth for both this rulebook and the web prototype.

### What changed from v0.1
- Market is now **7 cards: 3 Young, 2 Middle, 2 Old** (was 2 / 2 / 2).
- Deck split is now **25 Young / 20 Middle / 15 Old** (5 / 4 / 3 per color).
- **Rush** may discard one market card.
- Added **Reflection** cards (Old cards that score per disc of their color).
- Added the complete 60-card list, a solo challenge, and color-blind icons.

---

## Table of Contents
1. The Game in One Paragraph
2. Components
3. Setup
4. Whose Turn Is It?
5. Your Turn: Quest or Rush
6. Ages
7. The Engine: Experience and Powers
8. Milestones
9. Reaching the Doorway
10. Scoring and Winning
11. Solo Challenge
12. Rules Clarifications (complete)
13. Tunable Values
14. Strategies
15. The Complete Card List
16. Worked Example
17. Paper Prototype
18. Quick Reference

---

## 1. The Game in One Paragraph

Each player lives one life along a 40-year path. On your turn you either do a **quest** (spend years to gain a memory) or **rush** (skip ahead). Memories are colored discs stacked in your tower in the order you lived them. Things you've done before get faster. At the end of the path is the **Doorway**: the earlier you arrive, the more of your tower you can carry through, but you keep only **one unbroken stretch**. Points come only from what you keep.

---

## 2. Components

| Component | Qty | Notes |
|---|---|---|
| Life track | 1 | Spaces 0–40. Milestones at 10, 20, 30. Age bands: Young 0–13, Middle 14–27, Old 28–39. Space 40 is the Doorway. |
| Pawns | 4 | One per player color |
| Quest cards | 60 | 25 Young, 20 Middle, 15 Old (12 per domain) |
| Memory discs | 60 | 12 per domain color; each quest card has a matching disc |
| Tower bases | 4 | Discs stack on top |
| Doorway tiles | 4 | Show 9 / 8 / 7 / 6 (backs show the 2- and 3-player values) |
| Reminder tokens | 6 | For once-per-game powers and "next quest" discounts |
| Score pad | 1 | |

### The five domains

Each domain has a color **and an icon**, so the game is playable without relying on color.

| Domain | Color | Icon | Covers |
|---|---|---|---|
| Love | Pink | Heart | Partners, crushes, heartbreak |
| Work | Gold | Hammer | Career, craft, mastery |
| Play | Green | Kite | Hobbies, games, sport, art |
| Family | Orange | House | Parents, siblings, friends, children |
| Wonder | Purple | Star | Travel, awe, big moments, ideas |

### Anatomy of a quest card

| Field | Meaning |
|---|---|
| Domain | Color and icon of the disc you gain |
| Age | Young / Middle / Old: the age you must have reached to take it |
| Years | How far you move (2–6), before discounts |
| Points | Scored at the end only if this card's disc is kept (1–4) |
| Requirement | Some cards: "needs N discs of a domain in your tower" |
| Power | Some cards: an ability (Section 7) |
| Reflection | Some Old cards: +1 point per disc of their domain in your kept stretch |

---

## 3. Setup

1. Place the life track in the middle of the table.
2. Sort the quest cards into three decks by age and shuffle each.
3. **Market:** deal face up **3 Young, 2 Middle and 2 Old** cards, in three labeled rows.
4. Put the memory discs in a supply within reach.
5. Each player takes a pawn and a tower base.
6. Sort the Doorway tiles for your player count and stack them 1st on top.
7. Choose a first player (the youngest player, for tradition). Place all pawns on space 0 in a stack: the first player **on top**, then clockwise, with the last player at the bottom.

No one starts with any discs or cards.

---

## 4. Whose Turn Is It?

There are no rounds. **The player furthest back on the track takes the next turn.**

- If several pawns share the rearmost space, the pawn **on top** goes first.
- When your pawn ends its move on an occupied space, place it **on top** of the pawns already there.
- You may take several turns in a row if you remain furthest back.
- Players who have reached the Doorway take no more turns and are ignored when working out who is furthest back.

---

## 5. Your Turn: Quest or Rush

Choose **exactly one**.

### A. Quest

1. **Choose** a face-up market card that is legal for you:
   - its age is your age or younger (Section 6), and
   - you meet its requirement, counting the discs already in your tower.
2. **Pay years:** printed years, minus your experience discount for that domain, minus any power discounts. The cost is **never less than 1**.
3. **Move** your pawn forward that many spaces (stopping at 40; see Section 9).
4. **Gain the memory:** take a disc of the card's domain and place it **on top** of your tower. Place the card at the end of your card row, so the row matches your tower bottom to top.
5. **Resolve** the card's power if it says "immediately".
6. **Milestones:** if your move crossed or landed on 10, 20 or 30 for the first time, resolve each Milestone (Section 8).
7. **Refill** the empty slot from the same age deck. If that deck is empty, leave the slot empty.

### B. Rush

1. *(Optional)* Discard one face-up market card of any age and refill that slot from its deck.
2. **Move** your pawn to the space **directly ahead of the nearest pawn in front of you** (strictly ahead of you, and not yet at the Doorway).
   - If there is no such pawn, move **3 spaces**.
   - Rush bonuses from powers are added after this.
3. Resolve any Milestones you crossed.
4. You gain no disc.

Rush is always legal. If you have no legal quest, you must Rush.

---

## 6. Ages

Your age is set by **your own pawn's position**.

| Age | Spaces | You may take |
|---|---|---|
| Young | 0–13 | Young cards |
| Middle | 14–27 | Young or Middle cards |
| Old | 28–39 | Young, Middle or Old cards |

Your age is checked at the **start** of your turn, before you move.

The market always shows all three ages, so you can plan ahead. Older players may still take Young cards, which leaves fewer options for younger players.

---

## 7. The Engine: Experience and Powers

### Experience discount

For **every 2 discs of a domain** already in your tower, quests of that domain cost **1 year less**.

| Discs of that domain | Discount |
|---|---|
| 0–1 | 0 |
| 2–3 | −1 |
| 4–5 | −2 |
| 6–7 | −3 |
| 8+ | −4 |

Count the discs **before** adding the new one.

### Powers

Powers become active the moment you take the card and stay active for the rest of the game, **even if that card later falls away at the Doorway**. There are seven kinds:

| Power | Cards | Effect |
|---|---|---|
| Cross-domain discount | 5 (one per domain) | Quests of another domain cost 1 year less. Love → Family → Play → Wonder → Work → Love. |
| Rush bonus | Learn to rest | Whenever you Rush, move 1 extra space. |
| Reach older | Old friends | Once per game, take a quest one age older than you (Young may take Middle; Middle may take Old). |
| Ignore requirement | Say yes more | Once per game, ignore one quest's requirement. |
| Swap now | Keep a diary | Immediately swap two adjacent discs in your tower (and their cards). The new disc may be one of them. |
| Next quest discount | Quit the good job | Your **next** quest costs 2 years less. If you Rush first, the discount waits for your next quest. |
| Doorway bonus | Make peace with it | At the Doorway, you may keep 1 extra disc. |

All discounts stack. The minimum cost is still 1 year. Once-per-game powers are marked with a reminder token, which you flip when used. You may choose when to use them; they are never forced.

### Reflection (scoring only)

Five Old cards, one per domain, have **Reflection**: at the end, if the card's disc is in your kept stretch, score **+1 for each disc of that domain** in your kept stretch, including its own.

Unlike powers, Reflection only counts if the card is kept.

---

## 8. Milestones

Spaces **10, 20 and 30** are Milestones. The first time your pawn **lands on or passes** each one, you may swap **two adjacent discs** in your tower, and their cards.

- A single move that crosses two Milestones gives two swaps.
- Swaps are optional.
- Milestones are per player: each player gets each Milestone once.

---

## 9. Reaching the Doorway

When your pawn reaches **space 40**, you arrive. Extra movement is ignored. A quest that would take you past 40 is still allowed; you gain its disc and arrive.

Take the top Doorway tile. It shows how many discs you keep:

| Players | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| 4 | 9 | 8 | 7 | 6 |
| 3 | 9 | 8 | 7 | — |
| 2 | 9 | 7 | — | — |

Then choose **one unbroken stretch** of your tower, up to that many discs (plus any Doorway bonus). Discard every disc outside it, along with its card. If your tower is no taller than your allowance, you keep everything.

You may choose your stretch right away, or wait until the game ends; it changes nothing for other players. You take no more turns.

**The game ends when every player has arrived.**

---

## 10. Scoring and Winning

Score only the discs (and cards) in your kept stretch:

1. **Card points:** the printed points on each kept card.
2. **Full life:** **+6** for each complete set of all five domains. (Sets = the count of your rarest domain in the stretch.)
3. **Passion:** your longest run of discs of one domain, touching in your tower:

| Run length | 1–2 | 3 | 4 | 5+ |
|---|---|---|---|---|
| Points | 0 | 3 | 6 | 10 |

4. **Reflection:** for each kept Reflection card, +1 per kept disc of its domain.

**Highest total wins.**

### Tiebreakers
1. Most discs kept.
2. Arrived at the Doorway earlier.
3. Shared victory.

---

## 11. Solo Challenge

Play the normal rules alone, with these changes:

- Your Doorway allowance is **8**.
- Market: at the **end of each of your turns**, discard the leftmost card of each age row and slide the rest left before refilling. The world moves on without you.
- Rush moves you **4 spaces** (plus Rush bonuses).

| Score | Rating |
|---|---|
| Under 25 | A quiet life |
| 25–34 | A good life |
| 35–44 | A full life |
| 45+ | Everything you could bring |

---

## 12. Rules Clarifications (complete)

### Turns and movement
- **Furthest back** means the lowest space number among players who haven't arrived.
- **Ties** on a space: the top pawn goes first. Stack order only changes when a pawn arrives on that space.
- **Start of game:** all pawns share space 0, so the top pawn goes first.
- **Rush with no pawn ahead** (for example, everyone else has arrived): move 3 spaces.
- **Rush when the nearest pawn ahead is on space 39:** you move to 40 and arrive.

### Market
- **Taking a card from a row** is the only way that row changes, except Rush (discard one card) and the solo challenge.
- **Empty deck:** the slot stays empty for the rest of the game.
- **Visible cards you can't take** (wrong age, unmet requirement) stay in the market.

### Requirements and ages
- **Requirements** count the discs in your tower at the moment you take the card, before the new disc is added.
- **Discs that a Milestone swap moves** still count; requirements only care about how many, not where.
- **Old friends** stretches your age by exactly one step. It does not also waive requirements.
- **Old friends and Say yes more** may be used on the same quest.

### Costs
- **Order of discounts:** add every discount together, subtract from printed years, then apply the minimum of 1.
- **Quit the good job** applies to your next quest even if it's many turns later. It cannot be saved past that quest.

### Tower and cards
- **You can never reorder your tower** except by Milestones and Keep a diary.
- **Your card row mirrors your tower.** When you swap discs, swap their cards.
- **Requirements, discounts and powers** use your whole tower during play. Only scoring uses the kept stretch.

### The Doorway
- **The stretch must be unbroken:** consecutive discs in your tower, with no gaps.
- **Make peace with it** adds 1 to your allowance even if the card itself falls away.
- **A tower shorter than your allowance:** keep everything.
- **Arrival order** is simply the order players reached space 40.

### Scoring
- **Passion** looks for consecutive discs of the same domain in your kept stretch. Only your single longest run scores.
- **Full life** sets don't need to be in any order or adjacent.
- **A disc can count** toward card points, a Full life set, a Passion run and a Reflection bonus at the same time.

### Table talk
- Everything is public: towers, card rows, the market, and positions.

---

## 13. Tunable Values

These are the dials for playtesting. The web prototype exposes all of them as config.

| Key | Default | Notes |
|---|---|---|
| `trackLength` | 40 | Try 36 if games run long |
| `ageBands` | Young 0–13, Middle 14–27, Old 28–39 | |
| `milestones` | 10, 20, 30 | |
| `market` | Young 3, Middle 2, Old 2 | |
| `experienceStep` | 2 discs per −1 year | Try 3 if specialists snowball |
| `minCost` | 1 | |
| `rushNoPawnAhead` | 3 | |
| `rushDiscard` | on | Rush may discard 1 market card |
| `doorway.4p` | 9, 8, 7, 6 | Widen to 10, 7, 5, 3 if arriving first doesn't matter |
| `doorway.3p` | 9, 8, 7 | |
| `doorway.2p` | 9, 7 | |
| `fullLifeBonus` | 6 | |
| `passion` | 3: 3, 4: 6, 5+: 10 | |
| `reflection` | +1 per disc | |
| `solo.doorway` | 8 | |
| `solo.rush` | 4 | |

### Things to watch
- **Doorway irrelevance:** if towers rarely exceed the allowance, the core choice disappears.
- **Specialist snowball:** one domain making everything nearly free.
- **First-player advantage.**
- **Stale market for Young players.**

---

## 14. Strategies

**The specialist.** Go deep in one or two domains. Experience makes those quests cheap, so you fit more in. Aim for a big Passion run and a Reflection card. Risk: no Full life sets.

**The generalist.** Spread across domains and plan for all five to appear close together. Aim for one or two Full life sets. Risk: few discounts, so fewer quests.

**The late bloomer.** Let others rush. Take extra turns while furthest back and build a dense later life. Arrive last with a small Doorway but a strong final stretch. Risk: the stretch you want is longer than your Doorway.

**The early leaver.** Take a few high-value cards, rush hard, arrive first and keep almost everything. Risk: a big Doorway with little to put through it.

### Tips
- **Plan your stretch.** Decide roughly which chapter of your life you're building toward.
- **The engine trap.** The discs that built your discounts sit at the bottom of your tower. They may not be the ones you keep.
- **Watch who's behind you.** Taking a Young card when you're older can starve a younger player.
- **Rush with purpose.** Rushing gives the next turn to whoever you jumped past. Use the Rush discard to remove a card they want.

---

## 15. The Complete Card List

| Age | Cards | Years (range, avg) | Points (range, avg) | Points per year |
|---|---|---|---|---|
| Young | 25 | 2–4, 2.8 | 1–3, 1.8 | 0.64 |
| Middle | 20 | 3–5, 4.2 | 1–4, 2.9 | 0.69 |
| Old | 15 | 4–6, 5.1 | 3–4, 3.6 | 0.71 |

Special cards: 11 with powers, 5 with Reflection. Young cards never have requirements.

### Love (Pink)

| ID | Name | Age | Years | Pts | Requirement | Power / Reflection |
|---|---|---|---|---|---|---|
| PK-Y1 | First crush | Young | 2 | 1 | — | — |
| PK-Y2 | Write a terrible love letter | Young | 2 | 1 | — | — |
| PK-Y3 | Dance badly at a wedding | Young | 3 | 2 | — | — |
| PK-Y4 | Have your heart broken | Young | 3 | 2 | — | — |
| PK-Y5 | Fall in love | Young | 4 | 3 | — | — |
| PK-M1 | Someone who stays | Middle | 3 | 2 | — | Power: Your Family quests cost 1 year less. |
| PK-M2 | Move in together | Middle | 4 | 3 | — | — |
| PK-M3 | Learn how to apologise | Middle | 5 | 3 | 1 Love | — |
| PK-M4 | Start over with someone new | Middle | 5 | 4 | 2 Love | — |
| PK-O1 | Still holding hands | Old | 4 | 3 | 1 Love | — |
| PK-O2 | Grow old with someone | Old | 5 | 4 | 2 Love | — |
| PK-O3 | Write it all down for them | Old | 6 | 4 | 1 Family | Reflection: +1 per kept Love disc |

### Work (Gold)

| ID | Name | Age | Years | Pts | Requirement | Power / Reflection |
|---|---|---|---|---|---|---|
| GD-Y1 | First job | Young | 2 | 1 | — | — |
| GD-Y2 | Get fired from a cafe | Young | 2 | 1 | — | — |
| GD-Y3 | Learn a trade | Young | 3 | 2 | — | — |
| GD-Y4 | Pull an all-nighter that mattered | Young | 3 | 2 | — | — |
| GD-Y5 | Make your first real money | Young | 4 | 3 | — | — |
| GD-M1 | Make enough to slow down | Middle | 3 | 2 | — | Power: Your Love quests cost 1 year less. |
| GD-M2 | Get very good at something | Middle | 5 | 3 | 1 Work | — |
| GD-M3 | Quit the good job | Middle | 4 | 3 | — | Power: Your next quest costs 2 years less. |
| GD-M4 | Build something with your name on it | Middle | 5 | 4 | 2 Work | — |
| GD-O1 | Become someone's mentor | Old | 4 | 3 | 1 Work | — |
| GD-O2 | Retire on your own terms | Old | 5 | 4 | 2 Work | — |
| GD-O3 | Teach what you know | Old | 6 | 4 | 1 Work | Reflection: +1 per kept Work disc |

### Play (Green)

| ID | Name | Age | Years | Pts | Requirement | Power / Reflection |
|---|---|---|---|---|---|---|
| GR-Y1 | Build a fort | Young | 2 | 1 | — | — |
| GR-Y2 | Keep a diary | Young | 2 | 1 | — | Power: Immediately swap two adjacent discs in your tower. |
| GR-Y3 | Learn an instrument | Young | 3 | 2 | — | — |
| GR-Y4 | Join a team you're bad on | Young | 3 | 2 | — | — |
| GR-Y5 | Win something that doesn't matter | Young | 4 | 3 | — | — |
| GR-M1 | A hobby that takes you places | Middle | 3 | 2 | — | Power: Your Wonder quests cost 1 year less. |
| GR-M2 | Learn to rest | Middle | 3 | 1 | — | Power: Whenever you Rush, move 1 extra space. |
| GR-M3 | Get good at something useless | Middle | 4 | 3 | — | — |
| GR-M4 | Finish the long project | Middle | 5 | 4 | 2 Play | — |
| GR-O1 | Take up something new at sixty | Old | 5 | 3 | — | — |
| GR-O2 | Play with the grandkids | Old | 5 | 4 | 1 Family | — |
| GR-O3 | Master the thing you love | Old | 6 | 4 | 2 Play | Reflection: +1 per kept Play disc |

### Family (Orange)

| ID | Name | Age | Years | Pts | Requirement | Power / Reflection |
|---|---|---|---|---|---|---|
| OR-Y1 | Call your mother | Young | 2 | 1 | — | — |
| OR-Y2 | Fight with your sibling | Young | 2 | 1 | — | — |
| OR-Y3 | Make a best friend | Young | 3 | 2 | — | — |
| OR-Y4 | Leave home | Young | 3 | 2 | — | — |
| OR-Y5 | Be there when it mattered | Young | 4 | 3 | — | — |
| OR-M1 | Kids who drag you outside | Middle | 3 | 2 | — | Power: Your Play quests cost 1 year less. |
| OR-M2 | Old friends | Middle | 4 | 2 | — | Power: Once per game, take a quest one age older than you. |
| OR-M3 | Raise someone | Middle | 5 | 4 | 1 Love | — |
| OR-M4 | Look after your parents | Middle | 5 | 3 | 1 Family | — |
| OR-O1 | Host every holiday | Old | 4 | 3 | 1 Family | — |
| OR-O2 | Make peace with it | Old | 5 | 3 | 1 Family | Power: At the Doorway, keep 1 extra disc. |
| OR-O3 | Leave something behind | Old | 6 | 4 | 2 Family | Reflection: +1 per kept Family disc |

### Wonder (Purple)

| ID | Name | Age | Years | Pts | Requirement | Power / Reflection |
|---|---|---|---|---|---|---|
| PU-Y1 | See the sea | Young | 2 | 1 | — | — |
| PU-Y2 | Say yes more | Young | 2 | 1 | — | Power: Once per game, ignore one quest's requirement. |
| PU-Y3 | Stay up for a meteor shower | Young | 3 | 2 | — | — |
| PU-Y4 | Get lost in a city | Young | 3 | 2 | — | — |
| PU-Y5 | Travel alone | Young | 4 | 3 | — | — |
| PU-M1 | Come back with ideas | Middle | 3 | 2 | — | Power: Your Work quests cost 1 year less. |
| PU-M2 | Live somewhere new | Middle | 5 | 3 | — | — |
| PU-M3 | Change your mind about something big | Middle | 4 | 3 | — | — |
| PU-M4 | See something you can't explain | Middle | 5 | 4 | 2 Wonder | — |
| PU-O1 | Stand somewhere very old | Old | 4 | 3 | 1 Wonder | — |
| PU-O2 | Go back to the first place | Old | 5 | 4 | 1 Wonder | — |
| PU-O3 | Wonder at the ordinary | Old | 6 | 4 | 1 Wonder | Reflection: +1 per kept Wonder disc |

---

## 16. Worked Example

A 3-player game. All pawns start on 0: Priya on top, then Arun, then Meera.

1. **Priya** (top of stack) takes *Fall in love* (Pink, Young, 4 years, 3 points). She moves to 4 and puts a Pink disc on her tower.
2. **Arun** is now on top of the stack at 0. He takes *Keep a diary* (Green, 2 years). He moves to 2. Its swap does nothing yet, since he has only one disc.
3. **Meera** is furthest back at 0. She takes *See the sea* (Purple, 2 years) and moves to 2, landing on top of Arun.
4. **Meera** is now on top at space 2, so she goes before Arun. She Rushes: she discards *First crush* from the market (Priya might want it), then moves to space 5, just ahead of Priya.
5. **Arun** (space 2) is furthest back. He takes *Learn an instrument* (Green, 3 years) and moves to 5, landing on top of Meera.
6. **Priya** (space 4) is furthest back...

**Later.** Priya is at space 18 (Middle). Her tower holds 2 Gold discs. She takes *Get very good at something* (Gold, Middle, 5 years, needs 1 Gold). Her experience discount is −1, so it costs 4 years. She moves to 22, crossing the Milestone at 20, and swaps two adjacent discs to bring her Pinks together.

**The Doorway.** Arun arrives second in a 3-player game, so he may keep 8. His tower (bottom to top) is:

`Green, Purple, Gold, Gold, Gold, Pink, Orange, Purple, Green, Gold, Orange`

He keeps discs 3–10: `Gold, Gold, Gold, Pink, Orange, Purple, Green, Gold`.
- **Full life:** 1 set → +6
- **Passion:** a run of 3 Gold → +3
- **Reflection:** if *Teach what you know* is kept, +4 (four Gold discs)
- Plus card points.

---

## 17. Paper Prototype

- A strip of paper numbered 0–40, with 10, 20, 30 circled and age bands shaded.
- 4 coins as pawns.
- 60 index cards from Section 15.
- 12 chips in each of 5 colors, stacked in a cup or on a straw.
- Paper slips for the Doorway tiles and reminder tokens.

Play solo first, controlling 2–4 players, then with friends.

---

## 18. Quick Reference

**Who goes:** furthest back. Ties: top pawn.

**On your turn, choose one:**
- **QUEST:** take a legal card → pay years (minus discounts, min 1) → move → disc on top → Milestones → refill.
- **RUSH:** (optional: discard 1 market card) → jump just ahead of the nearest pawn in front (or 3 spaces).

**Ages:** Young 0–13 · Middle 14–27 · Old 28–39. Take your age or younger.

**Experience:** −1 year per 2 discs of that domain.

**Milestones (10 / 20 / 30):** swap two adjacent discs.

**Doorway (4p):** 9 / 8 / 7 / 6 discs, one unbroken stretch.

**Score:** card points + 6 per full set + longest run (3 / 6 / 10) + Reflection.