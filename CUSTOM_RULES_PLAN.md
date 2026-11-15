# Custom Game Rules — Plan

Goal: players can make their own rule set ("our family's rules"), save it under a name, pick it when
starting a game, and share it with others. Everything stays offline: no account or server needed.

---

## 1. What exists today

- `RuleConfig` in [src/core/state.ts](src/core/state.ts) already has 7 switches: board size, start on
  home, entry throws, cut before going inside, pair blocks, three 4s/8s lose the turn, stop at first winner.
- The menu shows 5 of them as "House rules" checkboxes.
- **Still hard-coded** (must become rules first):
  - 4 cowries, and the mapping of shells to moves (all open = 8, all closed = 4) — `src/core/cowrie.ts`
  - which throws give another throw (4 and 8) — `cowrie.ts`, `rules.ts`, `GameScreen.ts`
  - `ThrowValue` type limited to 1, 2, 3, 4, 8 — used in 6 files
  - 4 pieces per player — `state.ts`
  - path directions (outer anticlockwise, inner rings alternate) — `board.ts`
  - safe squares only as a fixed default per board size
  - the bot's throw odds table (`THROW_ODDS`), which assumes 4 fair cowries — `src/ai/bot.ts`

---

## 2. Rules a player can customise

| Group | Rule | Choices | Default (video) |
|---|---|---|---|
| **Board** | Size | 5×5, 7×7, (9×9 later) | 5×5 |
| | Safe squares | tap squares on a board preview to cross/uncross | 4 homes + centre |
| | Outer ring direction | anticlockwise / clockwise | anticlockwise |
| | Inner rings | alternate direction / same direction | alternate |
| **Pieces** | Pieces per player | 2–6 | 4 |
| | Where pieces start | on home square / off the board | on home |
| | Throws that bring a piece in (when off board) | any of the throw values | 4, 8 |
| **Cowries** | Number of shells | 2–7 | 4 |
| | Move for each count of open shells | editable table, e.g. 0 open → 4 | 1,2,3 / all open 8 / all closed 4 |
| | Which results give another throw | tick boxes per result | 4, 8 |
| | Bonus-throw streak limit | off / lose turn after N in a row | off |
| **Cutting** | Must cut before going inside | yes / no | yes |
| | Cut piece goes to | its home / off the board | home |
| | Cutting gives another throw | yes / no | yes |
| | Pairs (jodi) | off / pair blocks the square | off |
| **Finishing** | Exact throw to reach centre | yes / no (extra steps are wasted) | yes |
| | Game ends | first player finishes / play on for all places | first finishes |
| **Players** | Teams | none / partners sit opposite (4 players) | none |

Out of scope for now: pairs that move together (the video's "tie two pieces on a 4" idea). It changes
move generation a lot; it can be added later as one more rule.

---

## 3. Engine changes (do first — everything else depends on them)

1. **Throw table instead of fixed values**
   - Add `cowries: number` and `throwTable: number[]` (index = number of open shells → squares to move).
   - Add `bonusThrows: number[]`.
   - Change `ThrowValue` from the literal union to `number`; `valueFromShells` reads the table.
   - Bot: compute throw odds from the table with the binomial formula instead of the fixed `THROW_ODDS`.
2. **Pieces per player**: replace `PIECES_PER_PLAYER` with `rules.piecesPerPlayer`.
3. **Path directions**: `createBoard(size, { outerClockwise, alternateInner })`; the board cache key includes them.
4. **New switches**: `captureSendsHome` (separate from `startOnHome`), `captureGivesThrow`, `exactFinish`,
   `bonusStreakLimit: number | null` (replaces `threeBonusForfeit`), `teams`.
5. **Version and migrate**: add `rulesVersion` to `RuleConfig`. `migrateRules(old)` fills new fields from
   defaults, so saved games and saved setups from before this change still load.
6. **Validation** — `validateRules(rules): Problem[]`:
   - hard errors: throw table length ≠ cowries + 1; a move of 0; every move bigger than the path;
     pieces start off the board but no throw can bring them in.
   - warnings: no bonus throws at all; very few safe squares with many players; all moves even (some squares unreachable).
7. **"Can this game end?" check**: run ~30 fast random games (the existing simulation code, moved into
   `src/core/simulate.ts`) with an action cap. Warn if some don't finish, and show the average game length.

Tests: unit tests for each new switch, `migrateRules`, `validateRules`, and the existing random-game
test run across a set of odd rule sets (2 cowries, 7 cowries, 2 pieces, 6 pieces, teams).

---

## 4. UI

### Menu
- "House rules" becomes a **Rules** row: a dropdown of rule sets, plus **Edit** and **New** buttons.
- Built-in sets (read-only, can be copied):
  - **Video rules (5×5)**: today's defaults.
  - **Big board (7×7)**: corners also safe, pieces wait off the board for a 4/8.
  - **Quick game**: 2 pieces each, no cut-before-inside rule.

### Rule editor screen
- Name field, then one collapsible section per group in the table above.
- **Board preview**: the real `BoardView` in a small size. Tap a square to toggle it safe. Arrows
  update when directions change.
- **Cowrie table**: one row per open-shell count, showing small shell pictures, the move number
  input, a "throw again" tick box, and the chance of that result (e.g. "6 in 16").
- Problems from `validateRules` are shown live next to the field they belong to; Save is disabled
  while there are hard errors.
- **Test** button runs the can-this-game-end check and shows "30 test games: all finished, about N turns each".
- Save / Save as copy / Delete / Reset to video rules.

### During a game
- A small "rules" chip in the top bar shows the rule set's name; tapping it shows a summary of
  those rules (generated from the config, in Hindi or English).
- The "How to play" text is generated from the active rules instead of being fixed text.

### Sharing
- **Share** turns the rule set into a short code (JSON → compressed → base64url).
- It can be shared as a link (`…/#rules=<code>`) or as text to paste into **Import**.
- Opening a link shows "Add these rules: <name>?" with a summary before saving.
- Imported rules go through `migrateRules` and `validateRules` before they are saved.

---

## 5. Storage

- `astha-changa:rulesets:v1` in localStorage: a list of `{ id, name, rules, createdAt, updatedAt }`.
- The setup stores the chosen rule set id; a saved game keeps a full copy of its rules, so editing or
  deleting a rule set never breaks a game in progress.
- Code: `src/ui/rulesets.ts` (load/save/import/export), `src/ui/RuleEditor.ts` (screen),
  `src/core/validate.ts`, `src/core/simulate.ts`, `src/core/rulesText.ts` (rules summary in both languages).

---

## 6. Milestones

| # | What | Done when |
|---|---|---|
| ✅ C1 | Engine: throw table, pieces per player, directions, new switches, migration | All current tests pass with defaults; new switch tests pass; old saves load |
| ✅ C2 | Validation and can-this-game-end check | Bad rule sets are caught in tests; simulation reports finish rate |
| ✅ C3 | Rules summary text (Hindi + English) from a config | "How to play" uses it; snapshot tests for the built-in sets |
| ✅ C4 | Rule set storage + menu dropdown + built-in sets | Choosing a set starts a game with those rules; resume still works |
| ✅ C5 | Rule editor screen with board preview and cowrie table | Can make, test, save, edit and delete a set on phone and desktop |
| ✅ C6 | Share code / link and import | A link opened in a fresh browser adds the same rules |
| ✅ C7 | Bot check | Bots play sensibly under odd rule sets (2 and 7 cowries, teams) in simulation |

Order matters: C1 → C2 → C3 can be built and tested without any new screens; C4–C6 build on them.

---

## 7. More players

### 7a. More than 4 players
Today a seat is one of the 4 sides, and seats 1–3 reuse seat 0's path rotated by 90°. That caps the game at 4.

**Change:** a seat is any **home square on the outer ring**, and each seat's path is built from its
own home (go round the outer ring to the square before home, step inward, spiral to the centre).
The path code already walks rings from any starting square; it only needs to stop relying on rotation.

| Board | Home squares | Max players |
|---|---|---|
| 5×5 | middle of each side | 4 |
| 5×5 crowded | sides + corners | 6 |
| 7×7 | sides + corners | 8 |
| 9×9 (new) | sides + corners | 8, with more room |

- Default seat layout per player count spreads players evenly round the ring, e.g. 6 players on 7×7 =
  4 sides + 2 opposite corners. Advanced: tap home squares on the board preview to place seats.
- Every home square is safe by default.
- Turn order follows the seats going anticlockwise round the board.
- When pieces wait off the board, the yards for corner seats sit diagonally outside the corners.

### 7b. Player options (per player)
- **Name**: typed name instead of "Red"/"Computer (Red)"; remembered for next time.
- **Colour and seed shape**: pick from 8 (adds blue, purple, orange, white, each with its own seed
  shape), no two players the same. Shape stays tied to the colour, so colour is never the only cue.
- **Person or computer**, and the computer's level (as now).
- **Seat**: which home square they start from.
- **Teams**: none, 2 v 2, 3 v 3, 4 v 4 (partners sit apart, alternating turns). A team wins when all its
  players finish. Teammates can't cut each other and may share any square. Bots treat a teammate's
  progress as their own.
- **Pass the phone**: with 2 or more people on one device, show a "Pass to <name>" screen between
  their turns (on/off).

### 7c. Engine and UI changes
- `createBoard(size, homes[])` builds a path per home square; `SEATS_FOR` becomes a seat-layout function
  `(boardSize, playerCount) → home squares`.
- `GameState.players[]` gets `name`, `color`, `shape`, `team`; `finishOrder` works per team when teams are on.
- Rules: `rules.teams` and `rules.homes` join the rule set, so a custom rule set can say
  "6 players on 7×7, these homes, teams of 3".
- Board drawing handles 8 colours and corner yards; pieces sharing a square already lay out in a grid
  (up to 16 per square — 8 players × 2 shows fine, 8 × 4 on the centre needs a "+N" badge).
- Menu: player count goes 2–8 (options above the board's max are disabled with a short reason).
  Each player row gets name, colour, person/computer, level, team.
- Bot: `pieceDanger` and evaluation loop over all opponents (fine for 8 players); teammates excluded.

### 7d. Milestones
| # | What | Done when |
|---|---|---|
| ✅ P1 | Paths from any home square; seat layouts for 5×5, 7×7 (and 9×9) | Board tests pass for every layout; random games with 5–8 players finish |
| ✅ P2 | Player names, colours, shapes (8 total) | Shown on banner, win screen, saved/resumed correctly |
| ✅ P3 | Menu for 2–8 players with per-player options | Can set up and play an 8-player game on phone and desktop |
| ✅ P4 | Teams + pass-the-phone screen | Team win, no team cutting, bots help teammates; tests pass |

P1 can go right after C1, since both change the engine. P2–P4 fit alongside C4–C5 (menu work).

---

## 8. Decisions (taken when building)
1. **Teams**: included — two teams alternating round the table (4, 6 or 8 players).
2. **Pairs that move together**: left out.
3. **Limits**: 2–7 cowries, 2–6 pieces, 5×5 / 7×7 / 9×9 boards.
4. **Max players**: 6 on 5×5, 8 on 7×7 and 9×9.
5. **Build order**: both together (they share the engine changes).
