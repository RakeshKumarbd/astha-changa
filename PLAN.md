# Astha Changa (Ashta Chamma / Chowka Bara) — Game Plan

Source reference: "Indian Ludo | Astha Changa" by The mom's vlog — https://youtu.be/bHW8hQ29LQE

The video shows a 5×5 grid drawn on paper, crossed (X) safe squares, arrows showing where each
player turns inward, 4 cowrie shells (kaudi) as dice, and seeds/beans as pieces. The rules below come
from the video's Hindi auto-captions and frames; the two points it leaves unclear were decided by you
(marked 🟡).

---

## 1. Game rules (as built — the defaults)

### Board
- **5×5 grid** (25 squares). A 7×7 board is available as an option.
- **Home square** for each player is the middle square of their side (crossed).
- **Safe squares** (crossed): the 4 home squares and the centre only. (The 7×7 option also crosses its corners.)
- **Centre square** = finish.

### Players and pieces
- 2–4 players, 4 pieces each, **all starting on their home square**. Any throw can move them.
- 2-player mode uses opposite sides.
- House rule (off): pieces wait off the board until a 4 or 8.

### Throwing cowries (4 shells)
| Shells open (mouth up) | Move | Extra throw? |
|---|---|---|
| 1 | 1 | No |
| 2 | 2 | No |
| 3 | 3 | No |
| 4 (all open) | **8 — "Ashta"** | **Yes** |
| 0 (all closed) | **4 — "Changa"** | **Yes** |

- Each throw is used separately and can be split across pieces.
- Three 4s/8s in a row → turn lost (house rule, off).

### Movement path
1. Start at your home square.
2. Go **anticlockwise around the outer ring** back to the square just before home.
3. Turn inward there and go **clockwise** round the inner ring, then to the **centre**.
- Exact throw needed to reach the centre.

### Capturing ("cutting")
- Landing on an opponent's piece on a **non-safe** square sends it back to its home square.
- Pieces of different players can share a safe square.
- 🟡 **A player must cut at least one opponent piece before entering the inner ring.** Until then, pieces keep circling the outer ring.
- A cut earns an extra throw.
- 🟡 No pairs (jodi): pieces always move one at a time. (A "pair blocks" house rule exists, off.)

### Winning
- First player to get all 4 pieces to the centre wins. Others can play on for 2nd and 3rd place (house rule).

---

## 2. Tech choice (recommendation)

**Web game: TypeScript + Vite + HTML Canvas (or plain DOM/SVG), PWA-installable.**
- Runs on phone and desktop browsers with no store install, and can be wrapped later with Capacitor for Android/iOS.
- A 2D board game needs no engine. Unity/Flutter would also work if you prefer one of them.

```
astha-changa/
  src/
    core/            # pure game logic, no UI — fully unit tested
      board.ts       # grid, path per player, safe squares (config-driven)
      cowrie.ts      # throw generator (seedable RNG)
      rules.ts       # legal moves, capture, entry, inner-ring gate, win
      state.ts       # GameState + reducer (applyMove, applyThrow)
    ai/
      bot.ts         # computer opponent
    ui/
      BoardView.ts   # draw grid, X marks, arrows, pieces
      CowrieView.ts  # shell-throw animation
      Hud.ts         # turn indicator, throw result, move picker
    main.ts
  tests/
```

---

## 3. Build milestones

### M1 — Core rules engine (no graphics) ✅ done — `src/core/`, tests in `tests/` (`npm test`)
- Inner rings alternate direction: ring 1 clockwise, ring 2 anticlockwise. Entering uses up the 4/8 throw.
- Board model + path generation per player for 7×7 (and 5×5).
- Cowrie throw with probabilities from 4 fair shells (seedable for tests).
- Legal-move generator, capture logic, the "must cut before going inside" gate, exact-finish, win check.
- Unit tests for every rule, especially extra throws and capture-then-enter.

### M2 — Playable hot-seat version ✅ done — `src/ui/` (`npm run dev`)
- Draw the board like the paper one: grid, X marks on safe squares, path arrows.
- Pieces in 4 colours (styled after seeds/beans in the video).
- Tap "Throw" → shells animate → highlight movable pieces → tap a piece to move.
- Turn banner, move log, and a "no legal move — pass" message.

### M3 — Computer opponent ✅ done — `src/ai/bot.ts`
- Easy: random legal move.
- Medium: priority order: capture > finish a piece > reach safe square > enter new piece > advance the furthest piece.
- Hard: 1–2 turn look-ahead using throw probabilities (expectimax).

### M4 — Polish ✅ done — sounds are synthesized, PWA via `public/`
- Cowrie sound, piece hop animation, capture effect, win screen.
- Rules screen in **Hindi and English**, with house-rule toggles (board size, entry rule, pair rule).
- Save/resume the game in local storage.

### M4b — Custom rules and more players ✅ done
- Make, save and share your own rule sets; up to 8 players with names, colours and teams.
- Full plan: [CUSTOM_RULES_PLAN.md](CUSTOM_RULES_PLAN.md).

### M5 — Optional extras
- Online multiplayer with rooms (e.g. Supabase realtime or WebSockets).
- Android/iOS app via Capacitor.

---

## 4. Rule questions — answered
1. Board size: **5×5** (video).
2. Safe squares: **4 homes + centre** (video).
3. Entry: **pieces start on home; any throw moves** (video).
4. Cut before going inside: **yes** (your choice; video unclear).
5. Pairs: **none** (your choice; the video mentions moving two pieces tied together on a 4).
6. Throw values: **all open = 8 (Ashta), all closed = 4 (Changa)** (video). Ring directions as built: outer anticlockwise, inner clockwise.
