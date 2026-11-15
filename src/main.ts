import '@fontsource/baloo-2/400.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import { GameScreen } from './ui/GameScreen';
import { getLang, setLang, t } from './ui/i18n';
import { MenuScreen } from './ui/MenuScreen';
import { exitApp, hideSplash, initNative, isNative } from './ui/platform';
import { RuleEditor } from './ui/RuleEditor';
import { getRuleSet, type RuleSet } from './ui/rulesets';
import { loadGame, loadSetup, saveSetup, startState, type Setup } from './ui/setup';
import './styles.css';

const root = document.getElementById('app')!;
let game: GameScreen | null = null;
let screen: 'menu' | 'editor' | 'game' = 'menu';

function show(el: HTMLElement, name: typeof screen): void {
  game?.destroy();
  game = null;
  screen = name;
  root.replaceChildren(el);
  window.scrollTo(0, 0);
}

function showMenu(importCode?: string): void {
  show(new MenuScreen({ onStart: startGame, onResume: resumeGame, onEditRules: editRules, onLanguage: () => (document.title = t('title')) }, importCode).el, 'menu');
}

function editRules(set: RuleSet | null): void {
  show(new RuleEditor(set, {
    onDone: (savedId) => {
      if (savedId) saveSetup({ ...loadSetup(), rulesetId: savedId });
      showMenu();
    },
  }).el, 'editor');
}

function startGame(setup: Setup): void {
  const { players, state } = startState(setup, getRuleSet(setup.rulesetId).rules);
  const g = new GameScreen(players, setup, state, { onMenu: () => showMenu(), onPlayAgain: () => startGame(setup) });
  show(g.el, 'game');
  game = g;
}

function resumeGame(): void {
  const saved = loadGame();
  if (!saved) return showMenu();
  const g = new GameScreen(saved.players, saved.setup, saved.state, {
    onMenu: () => showMenu(),
    onPlayAgain: () => startGame(saved.setup),
  });
  show(g.el, 'game');
  game = g;
}

/** Android back button: close a dialog, else go back to the menu (games are saved), else leave the app. */
function onBack(): void {
  const dialogs = root.querySelectorAll<HTMLElement>('.overlay');
  const top = dialogs[dialogs.length - 1];
  if (top && !top.querySelector('.win-card')) {
    top.remove();
    return;
  }
  if (screen !== 'menu') showMenu();
  else exitApp();
}

/** A shared rule set arrives as …#rules=<code>; take it out of the address and offer to add it. */
function takeImportCode(): string | undefined {
  const m = /[#&]rules=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return undefined;
  history.replaceState(null, '', location.pathname + location.search);
  return m[1];
}

setLang(getLang());
document.title = t('title');
initNative(onBack);
showMenu(takeImportCode());
hideSplash();

// Offline support for the web version; the apps already have everything on the device.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative()) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
