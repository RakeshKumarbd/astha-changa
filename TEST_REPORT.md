# Full App Test — 2026-11-15

**Result: everything passes.** The test found 4 problems, and all 4 are fixed (listed at the end).

## Automated
| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | ✅ clean |
| Unit tests (`npm test`) | ✅ 115 / 115, in 8 files |
| Production build (`npm run build`) | ✅ 64 kB JS (22 kB gzipped) |

The unit tests cover:
- board paths from all 8 home positions on 5×5, 7×7 and 9×9
- every rule option
- teams
- validation
- share codes
- loading old saves
- bots under unusual rules
- random games played to the end with 20 different rule/player setups

## In the browser (dev server, desktop size unless noted)

**Menu and player setup — 12/12**
- Video rules are the default, with 2 players.
- 7 and 8 players are disabled on 5×5 and allowed on 7×7.
- Switching back to 5×5 trims the list to 6 players.
- The teams option appears only for 4, 6 or 8 players.
- Colours stay unique when cycled.
- A chosen seat is greyed out for everyone else.
- Typed names are saved.

**Gameplay — 28/28**
- Resume works.
- Movable pieces glow.
- A cut sends the piece home, marks the player as having cut, and gives another throw.
- "Changa! (4)" and "Ashta! (8)" show, with "Throw again".
- Two throws can be split across pieces using the throw chips.
- The turn passes to the bot, the bot plays, and the turn comes back.
- A throw with no possible move shows the message and passes the turn.
- Keyboard: Tab to a piece shows its target square, and Enter moves it.
- The rules dialog lists the active rules, and Escape closes it.
- The sound toggle works and is remembered.
- Menu → Resume brings back exactly the same game.
- Typed names show in the turn banner and the pass-the-phone screen.
- The pass-the-phone screen appears between two people sharing the device.

**Win screens — 11/11**
- Solo win shows "Asha wins!", clears the save, puts focus on Play again, and Play again starts a fresh game.
- Team win: when the first team member finishes, the game continues; finished players are skipped; when the second member finishes, "Team A wins! (Asha, Ravi)" appears.

**Rule editor, share and import — 24/24**
- New and Edit open correctly.
- Board size switches to 9×9 and 7×7, and the clockwise direction works.
- Pieces per player and start-off-board work, with entry-throw buttons.
- The "no throw brings them in" error appears on the section; Save and Test are disabled until it's fixed.
- The slow-entry warning appears.
- 6 shells give 7 table rows, and the chances add up to 100%.
- Move values, the bonus-streak limit, and the cutting and finishing options all work.
- Saved rules match what was entered, and the menu summary updates.
- Editing your own set keeps it in place instead of making a copy.
- "How to play" describes the custom set.
- An 8-player game with pieces waiting off the board shows the side and corner yards correctly.
- Share makes a link.
- Delete works.
- Import rejects a bad code; a good code shows a summary first and imports exactly the same rules.
- Reset and Back (without saving) leave the saved set unchanged.

**Old saves — 5/5**
- A save from the first version (7×7 board, `seat` field) shows Resume, loads correctly (8 pieces, yards, throws 4 and 2 pending), plays, and is upgraded on the next save.

**Phone size (320×640) and Hindi**
- No sideways page scrolling on the menu, how-to-play, import, rule editor (all sections open), game or in-game rules.
- No English left on screen in Hindi mode.
- The Throw button stays on screen during a game.

**Production build — offline**
- The service worker installs.
- After the second visit the JS, CSS, icons and fonts are cached.
- With the server stopped, the app still loads, starts a game and throws.
- The manifest and all 3 icons load.

## Problems found and fixed
1. **Player count buttons cut off on phones**: at 375px and narrower, the "8" button didn't fit. The rules picker and player count now each take a full line, with the buttons sharing the width.
2. **Cowrie table too wide at 320px**: the small shell pictures are hidden on very narrow screens, so the table fits.
3. **Board label not translated**: the screen-reader label "Game board" is now "खेल का बोर्ड" in Hindi.
4. **Name fallback**: a player's typed name now also comes from the setup if the game state doesn't have one.

## Notes (not bugs)
- The test runs drove the app with scripts and fixed several cowrie throws, so they don't depend on luck.
- Random-play test games average about 200 turns. Real players finish faster.
- The offline cache name is fixed (`astha-changa-v1`), so files from old versions are never cleared. When updates start shipping, bump the cache name in `public/sw.js` with each release.
