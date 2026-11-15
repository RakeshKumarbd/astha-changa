// Store screenshots at each store's exact pixel size, taken from the running dev
// server (npm run dev) with Playwright. Mid-game positions come from seeded random
// games, so the shots are the same every time. Writes into store/.
async (page) => {
  const ROOT = '/Users/bd30/Documents/Games/Astha Changa Game/store';
  const URL = 'http://localhost:5173/';
  const devices = [
    { dir: 'ios-iphone-6.9', w: 440, h: 956, dpr: 3 }, // 1320×2868
    { dir: 'ios-ipad-13', w: 1032, h: 1376, dpr: 2 }, // 2064×2752
    { dir: 'android-phone', w: 360, h: 720, dpr: 3 }, // 1080×2160 (2:1, the most Play allows)
    { dir: 'android-tablet', w: 800, h: 1280, dpr: 2 }, // 1600×2560 (10")
  ];
  const browser = page.context().browser();
  const written = [];

  for (const d of devices) {
    const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(URL);
    await p.waitForSelector('.menu');

    const saves = await p.evaluate(async () => {
      const { seededRng } = await import('/src/core/cowrie.ts');
      const { playRandomGame } = await import('/src/core/simulate.ts');
      const find = (specs, rules) => {
        for (let seed = 1; seed < 2000; seed++) {
          const s = playRandomGame(specs, rules, seededRng(seed), 120 + (seed % 150)).state;
          const spread = s.players.every((pl) => pl.pieces.some((i) => i > 0));
          if (s.phase === 'move' && s.current === 0 && s.pending.length >= 2 && s.finishOrder.length === 0 && spread) return s;
        }
        throw new Error('no suitable position found');
      };
      const save = (specs, rules, teams) => {
        const state = find(specs, rules);
        const players = state.players.map((pl) => ({ kind: 'human', level: 'medium', name: pl.name, color: pl.color, position: pl.position }));
        return { players, setup: { players, rulesetId: 'video', teams, passScreen: false }, state };
      };
      const four = save(
        [{ name: 'Asha', team: 0 }, { name: 'Kabir', team: 1 }, { name: 'Meera', team: 0 }, { name: 'Ravi', team: 1 }],
        {},
        true,
      );
      const names = ['Asha', 'Isha', 'Kabir', 'Arjun', 'Meera', 'Diya', 'Ravi', 'Vikram'];
      const eight = save(names.map((name) => ({ name })), { boardSize: 7 }, false);
      return { four, eight };
    });

    const shot = async (name) => {
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(500);
      const path = `${ROOT}/${d.dir}/${name}.png`;
      await p.screenshot({ path });
      written.push(path);
    };
    const load = async (lang, save) => {
      await p.evaluate(([l, s]) => {
        localStorage.clear();
        localStorage.setItem('astha-changa:lang', l);
        localStorage.setItem('astha-changa:muted', '0');
        if (s) localStorage.setItem('astha-changa:save:v1', JSON.stringify(s));
        localStorage.setItem('astha-changa:setup:v2', JSON.stringify({
          players: [
            { kind: 'human', level: 'medium', name: 'Asha', color: 0, position: null },
            { kind: 'bot', level: 'hard', name: '', color: 2, position: null },
          ],
          rulesetId: 'video', teams: false, passScreen: true,
        }));
      }, [lang, save]);
      await p.reload();
      await p.waitForSelector('.menu');
      if (save) {
        await p.locator('.menu-actions button').first().click(); // Resume
        await p.waitForSelector('.game');
      }
    };

    await load('en', saves.four);
    await shot('01-game');

    await load('en', null);
    await shot('02-menu');

    await p.getByRole('button', { name: 'New', exact: true }).click();
    await p.waitForSelector('.editor');
    await shot('03-rule-editor');
    await p.evaluate(() => {
      const ds = [...document.querySelectorAll('details.editor-section')];
      ds.forEach((dd, i) => (dd.open = i === 2)); // only Cowries
    });
    await shot('04-cowrie-rules');

    await load('en', saves.eight);
    await shot('05-eight-players');

    await load('hi', saves.four);
    await shot('06-hindi');

    await ctx.close();
  }

  // Google Play feature graphic, 1024×500.
  const fg = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const fp = await fg.newPage();
  await fp.goto(URL);
  await fp.waitForSelector('.menu');
  await fp.evaluate(async () => {
    const { seedIcon } = await import('/src/ui/BoardView.ts');
    document.body.innerHTML = `
      <div style="width:1024px;height:500px;display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;
        background:radial-gradient(ellipse at 30% 40%, #6a4c39, #4a3527 60%, #33241a);font-family:'Baloo 2',sans-serif;color:#f7f1e3">
        <div id="art" style="flex:none;width:300px;height:300px;background:#f7f1e3;border-radius:18px;box-shadow:0 14px 30px rgba(0,0,0,.4);
          display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(5,1fr);border:6px solid #e6dcc4"></div>
        <div>
          <div style="font-size:84px;font-weight:800;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.3)">Astha Changa</div>
          <div style="font-size:52px;font-weight:600;color:#ffcf8a;margin-top:6px">अष्ट चंगा</div>
          <div style="font-size:28px;margin-top:14px;opacity:.9">The Indian cowrie board game</div>
          <div id="seeds" style="display:flex;gap:14px;margin-top:22px"></div>
        </div>
      </div>`;
    const art = document.getElementById('art');
    const safe = new Set([2, 10, 12, 14, 22]);
    for (let i = 0; i < 25; i++) {
      const c = document.createElement('div');
      c.style.cssText = 'border:2px solid #3b352c;position:relative;display:grid;place-items:center';
      if (safe.has(i)) c.style.background = 'linear-gradient(45deg,transparent 48%,#3b352c99 49%,#3b352c99 51%,transparent 52%),linear-gradient(-45deg,transparent 48%,#3b352c99 49%,#3b352c99 51%,transparent 52%)';
      const piece = { 22: 0, 14: 1, 2: 2, 10: 3, 17: 0, 7: 2, 13: 1 }[i];
      if (piece !== undefined) c.append(seedIcon(piece, 40));
      art.append(c);
    }
    const seeds = document.getElementById('seeds');
    for (let i = 0; i < 8; i++) seeds.append(seedIcon(i, 40));
    await document.fonts.ready;
  });
  await fp.waitForTimeout(300);
  const fgPath = `${ROOT}/play-feature-graphic.png`;
  await fp.screenshot({ path: fgPath });
  written.push(fgPath);
  await fg.close();

  return written;
}
