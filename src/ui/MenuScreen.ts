// Start screen: pick a rule set, set up 2–8 players, resume a saved game, read
// the rules, and import rule sets others have shared.

import type { BotLevel } from '../ai/bot';
import { maxPlayers } from '../core/board';
import { rulesSummary } from '../core/rulesText';
import { decodeRules, extractCode } from '../core/share';
import { PLAYER_COLORS, seedIcon } from './BoardView';
import { button, checkbox, el, segmented, showDialog } from './dom';
import { colorName, getLang, seatName, setLang, t } from './i18n';
import { shareRuleSet } from './RuleEditor';
import { getRuleSet, listRuleSets, saveRuleSet, type RuleSet } from './rulesets';
import {
  defaultColorFor,
  freeColor,
  loadGame,
  loadSetup,
  newPlayer,
  saveSetup,
  seatPlayers,
  teamName,
  type PlayerSetup,
  type Setup,
} from './setup';

export interface MenuEvents {
  onStart(setup: Setup): void;
  onResume(): void;
  /** Open the rule editor on a set, or on a new set when null. */
  onEditRules(set: RuleSet | null): void;
  onLanguage(): void;
}

export class MenuScreen {
  readonly el = el('main', { className: 'menu' });
  private setup: Setup = loadSetup();

  constructor(private events: MenuEvents, importCode?: string) {
    this.fitPlayers();
    this.render();
    if (importCode) void this.confirmImport(importCode);
  }

  private get ruleSet(): RuleSet {
    return getRuleSet(this.setup.rulesetId);
  }

  private update(fn: (s: Setup) => void): void {
    fn(this.setup);
    this.fitPlayers();
    saveSetup(this.setup);
    this.render();
  }

  /** Keep the player list valid for the chosen board: not too many players, no shared colours or seats. */
  private fitPlayers(): void {
    const s = this.setup;
    if (!listRuleSets().some((r) => r.id === s.rulesetId)) s.rulesetId = 'video';
    const max = maxPlayers(this.ruleSet.rules.boardSize);
    if (s.players.length > max) s.players.length = max;
    const seen = new Set<number>();
    for (const p of s.players) {
      if (seen.has(p.color)) p.color = freeColor(s.players.filter((q) => q !== p), p.color);
      seen.add(p.color);
    }
    const seats = new Set<number>();
    for (const p of s.players) {
      if (p.position !== null && seats.has(p.position)) p.position = null;
      if (p.position !== null) seats.add(p.position);
    }
    if (s.teams && (s.players.length < 4 || s.players.length % 2 === 1)) s.teams = false;
  }

  private render(): void {
    const s = this.setup;
    const set = this.ruleSet;
    const rules = set.rules;
    const max = maxPlayers(rules.boardSize);

    const lang = button(t('language'), 'link lang-btn', () => {
      setLang(getLang() === 'en' ? 'hi' : 'en');
      this.events.onLanguage();
      this.render();
    });
    const header = el('header', { className: 'menu-head' },
      el('h1', { textContent: t('title') }),
      el('p', { className: 'subtitle', textContent: t('subtitle') }),
      lang,
    );

    const actions = el('div', { className: 'menu-actions' });
    if (loadGame()) actions.append(button(t('resume'), 'secondary', () => this.events.onResume()));
    actions.append(
      button(t('rules'), 'secondary', () => this.showRules(set)),
      button(t('importRules'), 'secondary', () => this.showImport()),
    );

    // rule set picker
    const picker = el('select', { className: 'level rules-select' });
    picker.setAttribute('aria-label', t('rulesLabel'));
    for (const r of listRuleSets()) picker.append(el('option', { value: r.id, textContent: r.name, selected: r.id === set.id }));
    picker.addEventListener('change', () => this.update((x) => (x.rulesetId = picker.value)));
    const rulesRow = el('div', { className: 'rules-row' },
      picker,
      button(t('edit'), 'secondary small', () => this.events.onEditRules(set)),
      button(t('newRules'), 'secondary small', () => this.events.onEditRules(null)),
      button(t('share'), 'secondary small', () => void shareRuleSet(this.el, set.name, rules)),
    );
    const brief = el('p', { className: 'help',
      textContent: `${rules.boardSize}×${rules.boardSize} · ${rules.piecesPerPlayer} ${t('secPieces').toLowerCase()} · ${rules.cowries} ${t('secCowries').toLowerCase()}` });

    // players
    const counts: [number, string, boolean][] = [2, 3, 4, 5, 6, 7, 8].map((n) => [n, String(n), n > max]);
    const count = segmented<number>(t('players'), counts, s.players.length, (n) =>
      this.update((x) => {
        while (x.players.length < n) {
          const prefer = defaultColorFor(x.players.length, n, rules.boardSize);
          x.players.push(newPlayer('bot', freeColor(x.players, prefer)));
        }
        x.players.length = n;
      }),
    );
    const seated = seatPlayers(s, rules);
    const rows = el('div', { className: 'player-rows' }, ...s.players.map((p, i) => this.playerRow(p, i, seated)));

    const form = el('section', { className: 'card setup' },
      el('h2', { textContent: t('newGame') }),
      el('div', { className: 'field stacked' }, el('span', { className: 'field-label', textContent: t('rulesLabel') }), rulesRow),
      brief,
      el('div', { className: 'field stacked' }, el('span', { className: 'field-label', textContent: t('players') }), count),
      el('p', { className: 'help', textContent: t('maxPlayersNote', { max, size: rules.boardSize }) }),
    );
    if (s.players.length >= 4 && s.players.length % 2 === 0) {
      form.append(checkbox(t('teams'), s.teams, (v) => this.update((x) => (x.teams = v))));
    }
    form.append(rows);
    if (s.players.filter((p) => p.kind === 'human').length >= 2) {
      form.append(checkbox(t('passScreen'), s.passScreen, (v) => this.update((x) => (x.passScreen = v))));
    }
    form.append(button(t('start'), 'primary start-btn', () => this.events.onStart(structuredClone(this.setup))));

    const footer = el('footer', { className: 'menu-foot' },
      el('a', { href: './support.html', textContent: t('help') }),
      ' · ',
      el('a', { href: './privacy.html', textContent: t('privacy') }),
    );

    this.el.replaceChildren(header, actions, form, footer);
  }

  private playerRow(p: PlayerSetup, i: number, seated: PlayerSetup[]): HTMLElement {
    const s = this.setup;
    const defaultName = p.kind === 'bot' ? t('computerName', { color: colorName(p.color) }) : colorName(p.color);

    const colorBtn = el('button', { type: 'button', className: 'color-btn' }, seedIcon(p.color, 28));
    colorBtn.style.setProperty('--c', PLAYER_COLORS[p.color]!);
    colorBtn.setAttribute('aria-label', t('changeColor', { color: colorName(p.color) }));
    colorBtn.addEventListener('click', () => this.update((x) => (x.players[i]!.color = freeColor(x.players, (p.color + 1) % 8))));

    const name = el('input', { type: 'text', className: 'text-input name-input', value: p.name, placeholder: defaultName, maxLength: 20 });
    name.setAttribute('aria-label', `${t('nameLabel')} (${colorName(p.color)})`);
    name.addEventListener('change', () => {
      s.players[i]!.name = name.value.trim();
      saveSetup(s);
    });

    const kind = segmented<PlayerSetup['kind']>(defaultName, [['human', t('human')], ['bot', t('computer')]], p.kind, (k) =>
      this.update((x) => (x.players[i]!.kind = k)));

    const line2 = el('div', { className: 'player-extra' });
    if (p.kind === 'bot') {
      const level = el('select', { className: 'level' });
      level.setAttribute('aria-label', `${defaultName}: ${t('computer')}`);
      for (const lv of ['easy', 'medium', 'hard'] as BotLevel[]) level.append(el('option', { value: lv, textContent: t(lv), selected: lv === p.level }));
      level.addEventListener('change', () => this.update((x) => (x.players[i]!.level = level.value as BotLevel)));
      line2.append(level);
    }

    const seat = el('select', { className: 'level' });
    seat.setAttribute('aria-label', `${defaultName}: ${t('seat')}`);
    seat.append(el('option', { value: '', textContent: `${t('seat')}: ${t('autoSeat')}`, selected: p.position === null }));
    const takenByOthers = new Set(s.players.filter((q, j) => j !== i && q.position !== null).map((q) => q.position));
    for (let pos = 0; pos < 8; pos++) {
      seat.append(el('option', { value: String(pos), textContent: `${t('seat')}: ${seatName(pos)}`, selected: p.position === pos, disabled: takenByOthers.has(pos) }));
    }
    seat.addEventListener('change', () => this.update((x) => (x.players[i]!.position = seat.value === '' ? null : Number(seat.value))));
    line2.append(seat);

    if (s.teams) {
      const turn = seated.findIndex((q) => q.color === p.color);
      line2.append(el('span', { className: `team-badge team-${turn % 2}`, textContent: teamName(turn % 2) }));
    }

    return el('div', { className: 'player-row' }, el('div', { className: 'player-main' }, colorBtn, name, kind), line2);
  }

  private showRules(set: RuleSet): void {
    const back = button(t('back'), 'primary', () => close());
    const close = showDialog(this.el,
      el('h2', { textContent: `${t('rules')} — ${set.name}` }),
      el('ol', { className: 'rules-list' }, ...rulesSummary(set.rules, getLang()).map((line) => el('li', { textContent: line }))),
      back,
    );
  }

  private showImport(): void {
    const area = el('textarea', { className: 'text-input', rows: 3 });
    area.setAttribute('aria-label', t('importHelp'));
    const error = el('p', { className: 'problem error', role: 'alert' });
    const add = button(t('add'), 'primary', async () => {
      const code = extractCode(area.value);
      if (!(await decodeRules(code))) {
        error.textContent = t('importBad');
        return;
      }
      close();
      void this.confirmImport(code);
    });
    const close = showDialog(this.el,
      el('h2', { textContent: t('importRules') }),
      el('p', { textContent: t('importHelp') }),
      area,
      error,
      el('div', { className: 'row' }, add, button(t('cancel'), 'secondary', () => close())),
    );
  }

  /** Show what a shared code contains and save it only if the person agrees. */
  private async confirmImport(code: string): Promise<void> {
    const shared = await decodeRules(code);
    if (!shared) {
      const close = showDialog(this.el, el('p', { textContent: t('importBad') }), button(t('back'), 'primary', () => close()));
      return;
    }
    const add = button(t('add'), 'primary', () => {
      const saved = saveRuleSet({ name: shared.name, rules: shared.rules });
      close();
      this.update((x) => (x.rulesetId = saved.id));
    });
    const close = showDialog(this.el,
      el('h2', { textContent: t('addRules', { name: shared.name }) }),
      el('ol', { className: 'rules-list' }, ...rulesSummary(shared.rules, getLang()).map((line) => el('li', { textContent: line }))),
      el('div', { className: 'row' }, add, button(t('cancel'), 'secondary', () => close())),
    );
  }
}
