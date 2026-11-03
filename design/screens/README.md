# design/screens

These are the artboards from the Claude Design canvas "Doorway — Playtest App". Each file is one artboard.

The files use the canvas's component format. The inline `style` attributes are the real design values; match them. These parts are mockup template syntax, so rebuild them as React instead of copying them:
- `{{…}}` holes;
- `<sc-for>` loops and `<sc-if>` conditions;
- the `<script type="text/x-dc">` blocks.

The script blocks hold the mockup data. They also hold the icon paths (`ICONS`) and both domain palettes, which you can reuse directly.

| File | Size on canvas | Interactive in the mockup |
|---|---|---|
| Main.dc.html | 1440 × 1180 (fluid page) | yes: select, preview, rush with discard, confirm, undo, why, rules, flag |
| Doorway.dc.html | 1440 × 940 (fluid page) | yes: slide, tap a disc, compare, hint, lock |
| Results.dc.html | 1440 × 1420 (fluid page) | yes: survey choices |
| Lobby.dc.html | 1440 × 1080 (fluid page) | yes: host/friend view, copy, seats, join |
| SimDashboard.dc.html | 1440 × 1700 (fluid page) | no — placeholder numbers |
| Sandbox.dc.html | 1440 × 1240 (fluid page) | yes: dials, diff, run |
| Feedback.dc.html | 1440 × 1240 (fluid page) | no — sample entries |
| TablePhone.dc.html | 390 × 1620 (fixed) | no |
| LobbyPhone.dc.html | 390 × 1180 (fixed) | no |

See `../DESIGN.md` for which screens are primary references.
