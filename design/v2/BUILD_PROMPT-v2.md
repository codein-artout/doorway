# Overnight build v2: Doorway in two views, Board and Analyst

You are continuing the Doorway playtest app, unattended and overnight. `main` already holds v1: the rules engine, bots, simulator, study reports, a local playable table, and `/designer`. CIAO has tested v1 and says the mechanics work but the design is basic.

Tonight's job is to give the game two views of the same state:
- **Board mode** should feel like a real board game on a table.
- **Analyst mode** is a scoresheet with the decision data.

Nobody is watching. Work through everything below, in order, until it all passes.

## 0. How to work tonight (read first, re-read after every context compaction)

1. **Never stop to ask.**
   - Do not use AskUserQuestion, and do not end a turn with a question.
   - When something is unclear, take the most reasonable reading and record it in `DECISIONS.md` under a new heading, `## v2`.
   - If you are blocked, record why, move on, and come back later.
2. **Keep `STATUS.md` current.** Add a `## v2` section with the current milestone, the finished milestones with commit hashes, what's next, blockers, and a time log in UTC.
   - After any context compaction, re-read `STATUS.md`, `DECISIONS.md`, `design/v2/DESIGN-v2.md` and this prompt (save it as `BUILD_PROMPT-v2.md` if it isn't in the repo), then continue.
3. **Commit and push** after every milestone, and at least every 45 minutes, to this session's branch.
   - Commit messages start with `N<n>:`.
   - Never force-push or rewrite history.
   - At the end, open a PR into `main`.
4. **Deadline.** CIAO's cloud credits expire at **2026-11-05 08:00 UTC** (13:30 IST).
   - Everything must be committed and pushed by **07:00 UTC**. Check `date -u` at every milestone.
   - If you are behind, keep the milestone order and cut items marked *(stretch)* first. Never ship a screen without its tests.
5. **Long commands.** Foreground commands must finish within 10 minutes. Run anything longer in the background.
6. **No deploys, sign-ups or secrets.** The build stays local-only, as in v1. Online rooms, the survey, telemetry and the deploy remain **out of scope**.
7. **Only stop when §4 "Done means" is fully true**, or the deadline forces a stop. If it does, `STATUS.md` must say exactly what's left.

## 1. Sources of truth

Read these before writing any code:

| Path | What it is |
|---|---|
| `README.md`, `STATUS.md`, `DECISIONS.md` | how v1 was actually built. Follow its structure, package names and conventions. |
| `design/v2/DESIGN-v2.md` | **binding** for the look of both modes, the view switch, and the Analyst metric definitions |
| `design/v2/screens/*.dc.html` | the mockups, with interactive logic for the table, Doorway and window scorer. Same mockup format as v1: rebuild them as real components and don't ship the mockup runtime. |
| `spec/` (rulebook, `cards.json`, `RULINGS.md`) | the game rules. **Unchanged tonight.** |
| `design/DESIGN.md` | v1 design. Still applies wherever DESIGN-v2 says nothing (copy rules, accessibility). |

**Precedence.** On look and metrics, DESIGN-v2 wins over DESIGN.md. On rules, RULINGS and the rulebook win over everything. `spec/` and `design/` are read-only; record any gaps as proposed decisions in `DECISIONS.md`.

## 2. Guardrails

- **The rules don't change.** The engine stays pure, and engine changes are additive helpers only.
- All v1 tests must still pass **unchanged**.
- **Simulation regression check:**
  1. In N1, before touching anything, run `pnpm sim --players 4 --games 1000 --bots greedy,tempo,specialist,generalist --seed v2-regress --out reports/runs/v2-before`. If v1's flags differ, use v1's equivalents and record them.
  2. In N3 and again in N10, run it with `--out …/v2-after`.
  3. The game and score outputs must be **identical**. Add a script that compares them, and make it part of `pnpm verify`.
- **Don't re-run the full study** or modify `reports/`, except to read `summary.json`.
- Keep game logic out of React components. Both views read the same game client and state; switching views never resets or replays the game.

## 3. Milestones (in order)

| # | Milestone |
|---|---|
| N1 | **Orientation and baseline.** Read the repo, run `pnpm install` and `pnpm verify` (it must be green before you change anything), run the regression baseline, and write a short map of the web app in `STATUS.md`. |
| N2 | **Themes and the view switch** (DESIGN-v2 §1–§4 tokens). Both token sets as CSS variables under `[data-view]`, with Tailwind wired to them. Fonts via `next/font`: Caprasimo, Gochi Hand, Nunito, IBM Plex Sans and IBM Plex Mono. Swap in the new muted domain colours and keep the colour-blind alternate. Build the **Board / Analyst** switch: in the header, via `?view=`, persisted in localStorage, and on the **V** key. Update the `/design-check` page so it shows every component in both views. |
| N3 | **Engine and bot hooks, additive only, each with tests:**<br>• `costBreakdown(state, player, cardId)` → `{ printed, experience, power, nextQuest, cost }`<br>• `previewMove(state, move)` → `{ landing, onTopOf, nextPlayer, queueAfter, scoreDeltaNow }`<br>• `windowScores(tower, allowance)` → every maximal window with its four parts and total<br>• An optional `explain(view)` on bot policies, returning the top candidates with per-feature contributions (natural for the weighted-feature bots; `random` returns none, `lookahead` returns visit counts or values). `explain` must be pure: it never consumes the bot's RNG or changes what `choose` returns.<br>• Per-game history helpers for the charts (position and score-if-walked-now by turn)<br>Run the regression check: it must be identical. |
| N4 | **Board table** (`Board-Table.dc.html`, `Board-Pieces.dc.html`): the board sheet with the serpentine geometry, bends, stage patterns, doodles, rosettes and Doorway arch; pawn figures with the turn speech bubble; card groups with sticky notes and the discard stamp; the action tray; turn order; player mats; and the Your life mat. Motion as specified, respecting reduced motion. Keep every v1 feature: undo, the move log (in a drawer), the rules panel, keyboard play, bots in any seat, bot speed and power toggles. |
| N5 | **Board Doorway and results** (`Board-Doorway.dc.html`, `Board-Results.dc.html`), and the **Board phone layout** (`Board-Phone.dc.html`, working down to 360 px). |
| N6 | **Analyst table** (`Analyst-Table.dc.html`): track ruler with queue now and after, the decision table (exact column definitions in DESIGN-v2 §4), preview line, players ledger with the spread note, your tower with the projection, *Why <bot> did that* (from `explain`), the log, and both charts. It must be fully playable; this is a second way to play, not a read-only view. |
| N7 | **Analyst window scorer and game report** (`Analyst-Doorway.dc.html`, `Analyst-Results.dc.html`), including:<br>• the allowance sensitivity table;<br>• *Played most like*: the agreement rate with each strategy, computed by asking every strategy for its move at each of the player's decision states;<br>• turning points (rules in DESIGN-v2), each linking to the replay at that move;<br>• this game versus the study (from `summary.json`).<br>The replay viewer must work in both views. |
| N8 | **`/designer` in the Analyst style.** Restyle the Analysis and Sandbox pages with Analyst tokens and components; keep their content and behaviour. Remove any leftover placeholder banners. |
| N9 | **Quality.** Playwright e2e:<br>• a full 2-player game against a bot at Instant speed in **each** view;<br>• switching views mid-game keeps the state and the selected move;<br>• the Doorway works in both views;<br>• 360 px smoke tests;<br>• axe on every page in both views with zero serious or critical violations.<br>Also check contrast for both token sets in a unit test. |
| N10 | **Wrap-up.** Update `README.md` (the two views and how to switch, screenshots in `docs/`), `STATUS.md` (final state) and `DECISIONS.md`. Run the regression check. From a **fresh clone** of the branch, run `pnpm install && pnpm verify && pnpm e2e`. Then open a PR titled "Doorway v0.2 — Board & Analyst modes" with screenshots of both views and a list of any *(stretch)* items skipped. |

*(Stretch, in this order:)*
1. Animated card-to-chip flight.
2. A Lookahead rank (L#) column in the decision table.
3. A hand-drawn wobble filter on the board's ink lines (SVG turbulence, off when reduced motion is on).

## 4. Done means

Everything below holds, from a fresh clone of the pushed branch:

- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm verify` pass. `pnpm e2e` passes, or any blocker that comes only from the environment is documented in `STATUS.md` with the suite still present.
- [ ] Every v1 test passes unchanged, and the simulation regression output is identical to the N1 baseline.
- [ ] Board mode and Analyst mode both work for the table, Doorway and results, match `design/v2/`, and can be switched at any moment without losing the game.
- [ ] Analyst metrics follow the DESIGN-v2 definitions, and the "Why <bot> did that" panel comes from the real `explain()` output.
- [ ] `/designer` uses the Analyst style.
- [ ] `README.md`, `STATUS.md` and `DECISIONS.md` are updated, everything is pushed, and the PR is open.
