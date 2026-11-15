// Screen for making and editing a rule set: every rule, a tappable board preview
// for safe squares, a cowrie table with odds, live problem checks and a test run.

import { BOARD_SIZES, defaultSafeCells, maxPlayers, type BoardSize, type CellId } from '../core/board';
import { MAX_COWRIES, MIN_COWRIES, defaultThrowTable, openCountOdds } from '../core/cowrie';
import { encodeRules } from '../core/share';
import { simulate } from '../core/simulate';
import { DEFAULT_RULES, MAX_PIECES, MIN_PIECES, createGame, type RuleConfig } from '../core/state';
import { hasErrors, validateRules, type Problem } from '../core/validate';
import { BoardView } from './BoardView';
import { rulesLink, shareText } from './platform';
import { button, checkbox, el, segmented, toast } from './dom';
import { t, type TextKey } from './i18n';
import { deleteRuleSet, saveRuleSet, type RuleSet } from './rulesets';

export interface RuleEditorEvents {
  /** Called with the saved set's id, or null when leaving without saving. */
  onDone(savedId: string | null): void;
}

type Section = 'board' | 'pieces' | 'cowries' | 'cutting' | 'finish';

/** Which section each rule lives in, so problems can be shown in the right place. */
const SECTION_OF: Partial<Record<keyof RuleConfig | 'players', Section>> = {
  boardSize: 'board', safeCells: 'board', outerClockwise: 'board', alternateInner: 'board', players: 'board',
  piecesPerPlayer: 'pieces', startOnHome: 'pieces', entryThrows: 'pieces',
  cowries: 'cowries', throwTable: 'cowries', bonusThrows: 'cowries', bonusStreakLimit: 'cowries',
  captureRequiredForInner: 'cutting', enterIfNothingToCut: 'cutting', captureSendsHome: 'cutting', captureGivesThrow: 'cutting', pairBlocks: 'cutting',
  exactFinish: 'finish', stopAtFirstWinner: 'finish',
};

export const problemText = (p: Problem): string => t(`problem_${p.code}` as TextKey, p.vars ?? {});

/** Share a rule set: the system share sheet where there is one, otherwise copy it. */
export async function shareRuleSet(host: HTMLElement, name: string, rules: RuleConfig): Promise<void> {
  const code = await encodeRules(name, rules);
  const link = rulesLink(code);
  const text = link ? t('shareMessage', { name }) : t('shareMessageCode', { name, code });
  const result = await shareText(name, text, link);
  if (result === 'copied') toast(host, t('copied'));
  if (result === 'failed') toast(host, t('shareFailed', { code }));
}

export class RuleEditor {
  readonly el = el('main', { className: 'editor' });
  private draft: RuleConfig;
  private name: string;
  private id: string | undefined;
  private open = new Set<Section>(['board']);
  private testResult = '';

  constructor(set: RuleSet | null, private events: RuleEditorEvents) {
    this.draft = structuredClone(set?.rules ?? DEFAULT_RULES);
    // Built-in sets are edited as a copy.
    this.id = set && !set.builtIn ? set.id : undefined;
    this.name = set ? (set.builtIn ? t('copyName', { name: set.name }) : set.name) : t('myRules');
    this.render();
  }

  private update(fn: (r: RuleConfig) => void): void {
    fn(this.draft);
    this.testResult = '';
    this.render();
  }

  private section(id: Section, titleKey: TextKey, problems: Problem[], ...body: Node[]): HTMLDetailsElement {
    const mine = problems.filter((p) => SECTION_OF[p.field] === id);
    const summary = el('summary', {}, t(titleKey));
    if (mine.length) summary.append(el('span', { className: hasErrors(mine) ? 'flag error' : 'flag warning', textContent: '!' }));
    const d = el('details', { className: 'editor-section', open: this.open.has(id) }, summary, ...body);
    for (const p of mine) d.append(el('p', { className: `problem ${p.level}`, textContent: problemText(p) }));
    d.addEventListener('toggle', () => (d.open ? this.open.add(id) : this.open.delete(id)));
    return d;
  }

  private field(label: string, control: Node): HTMLElement {
    return el('div', { className: 'field' }, el('span', { className: 'field-label', textContent: label }), control);
  }

  private render(): void {
    const r = this.draft;
    const problems = validateRules(r);

    // --- header
    const nameInput = el('input', { type: 'text', className: 'text-input', value: this.name, maxLength: 40 });
    nameInput.setAttribute('aria-label', t('ruleName'));
    nameInput.addEventListener('input', () => (this.name = nameInput.value));
    const head = el('header', { className: 'editor-head' },
      button('←', 'icon-btn', () => this.events.onDone(null)),
      nameInput,
    );
    head.firstElementChild!.setAttribute('aria-label', t('back'));

    // --- board
    const preview = new BoardView(createGame(Math.min(4, maxPlayers(r.boardSize)), r), { onCellClick: (c) => this.toggleSafe(c) });
    const board = this.section('board', 'secBoard', problems,
      this.field(t('boardSize'), segmented<BoardSize>(t('boardSize'), BOARD_SIZES.map((s) => [s, `${s}×${s}`]), r.boardSize, (v) =>
        this.update((x) => {
          x.boardSize = v;
          delete x.safeCells; // square numbers differ between sizes
        }))),
      this.field(t('outerDir'), segmented<boolean>(t('outerDir'), [[false, t('anticlockwise')], [true, t('clockwise')]], r.outerClockwise, (v) =>
        this.update((x) => (x.outerClockwise = v)))),
      checkbox(t('alternateInner'), r.alternateInner, (v) => this.update((x) => (x.alternateInner = v))),
      el('p', { className: 'help', textContent: t('safeHelp') }),
      el('div', { className: 'preview' }, preview.el),
      button(t('resetSafe'), 'secondary small', () => this.update((x) => delete x.safeCells)),
    );

    // --- pieces
    const values = [...new Set(r.throwTable)].sort((a, b) => a - b);
    const piecesCanBeOff = !r.startOnHome || !r.captureSendsHome;
    const pieces = this.section('pieces', 'secPieces', problems,
      this.field(t('piecesPerPlayer'), segmented<number>(t('piecesPerPlayer'),
        Array.from({ length: MAX_PIECES - MIN_PIECES + 1 }, (_, i) => [i + MIN_PIECES, String(i + MIN_PIECES)]), r.piecesPerPlayer, (v) =>
          this.update((x) => (x.piecesPerPlayer = v)))),
      checkbox(t('startOnHome'), r.startOnHome, (v) => this.update((x) => (x.startOnHome = v))),
    );
    if (piecesCanBeOff) pieces.append(this.field(t('entryThrows'), this.valueToggles(values, r.entryThrows, (list) => (r.entryThrows = list))));

    // --- cowries
    const odds = openCountOdds(r.cowries);
    const rows = r.throwTable.map((v, k) => {
      const move = el('input', { type: 'number', className: 'num-input', min: 1, max: r.boardSize ** 2 - 1, value: String(v) });
      move.setAttribute('aria-label', `${this.openLabel(k)}: ${t('tableMove')}`);
      move.addEventListener('change', () => this.update((x) => (x.throwTable[k] = Math.max(1, Math.round(Number(move.value) || 1)))));
      const again = el('input', { type: 'checkbox', checked: r.bonusThrows.includes(v) });
      again.setAttribute('aria-label', `${this.openLabel(k)}: ${t('tableAgain')}`);
      again.addEventListener('change', () => this.update((x) => {
        x.bonusThrows = again.checked ? [...new Set([...x.bonusThrows, v])] : x.bonusThrows.filter((b) => b !== v);
      }));
      return el('tr', {},
        el('th', { scope: 'row' }, this.shellIcons(k, r.cowries), el('span', { className: 'open-label', textContent: this.openLabel(k) })),
        el('td', {}, move),
        el('td', {}, again),
        el('td', { className: 'chance', textContent: `${Math.round(odds[k]! * 1000) / 10}%` }),
      );
    });
    const table = el('table', { className: 'throw-table' },
      el('thead', {}, el('tr', {}, ...[t('tableOpen'), t('tableMove'), t('tableAgain'), t('tableChance')].map((h) => el('th', { scope: 'col', textContent: h })))),
      el('tbody', {}, ...rows),
    );
    const streak = el('select', { className: 'level' });
    streak.setAttribute('aria-label', t('streak'));
    for (const v of [null, 2, 3, 4, 5]) {
      streak.append(el('option', { value: String(v ?? ''), textContent: v === null ? t('streakOff') : String(v), selected: r.bonusStreakLimit === v }));
    }
    streak.addEventListener('change', () => this.update((x) => (x.bonusStreakLimit = streak.value ? Number(streak.value) : null)));
    const cowries = this.section('cowries', 'secCowries', problems,
      this.field(t('cowries'), segmented<number>(t('cowries'),
        Array.from({ length: MAX_COWRIES - MIN_COWRIES + 1 }, (_, i) => [i + MIN_COWRIES, String(i + MIN_COWRIES)]), r.cowries, (n) =>
          this.update((x) => {
            x.cowries = n;
            x.throwTable = defaultThrowTable(n);
            x.bonusThrows = [n, 2 * n];
            x.entryThrows = [n, 2 * n];
          }))),
      el('div', { className: 'table-wrap' }, table),
      this.field(t('streak'), streak),
    );

    // --- cutting and finishing
    const cutting = this.section('cutting', 'secCutting', problems,
      checkbox(t('capReq'), r.captureRequiredForInner, (v) => this.update((x) => (x.captureRequiredForInner = v))),
      ...(r.captureRequiredForInner
        ? [checkbox(t('capFree'), r.enterIfNothingToCut, (v) => this.update((x) => (x.enterIfNothingToCut = v)))]
        : []),
      checkbox(t('capHome'), r.captureSendsHome, (v) => this.update((x) => (x.captureSendsHome = v))),
      checkbox(t('capThrow'), r.captureGivesThrow, (v) => this.update((x) => (x.captureGivesThrow = v))),
      checkbox(t('pairs'), r.pairBlocks, (v) => this.update((x) => (x.pairBlocks = v))),
    );
    const finish = this.section('finish', 'secFinish', problems,
      checkbox(t('exact'), r.exactFinish, (v) => this.update((x) => (x.exactFinish = v))),
      checkbox(t('playOn'), !r.stopAtFirstWinner, (v) => this.update((x) => (x.stopAtFirstWinner = !v))),
    );

    // --- actions
    const errors = hasErrors(problems);
    const save = button(t('save'), 'primary', () => {
      const saved = saveRuleSet({ id: this.id, name: this.name, rules: this.draft });
      this.events.onDone(saved.id);
    });
    save.disabled = errors;
    const test = button(t('test'), 'secondary', () => void this.runTest());
    test.disabled = errors;
    const result = el('p', { className: 'test-result', role: 'status', textContent: this.testResult });
    const actions = el('div', { className: 'editor-actions' },
      save,
      test,
      button(t('share'), 'secondary', () => void shareRuleSet(this.el, this.name, this.draft)),
      button(t('resetVideo'), 'secondary', () => {
        this.draft = structuredClone(DEFAULT_RULES);
        this.update(() => {});
      }),
    );
    if (this.id) {
      actions.append(button(t('delete'), 'secondary danger', () => {
        deleteRuleSet(this.id!);
        this.events.onDone(null);
      }));
    }

    this.el.replaceChildren(head, el('div', { className: 'card editor-body' }, board, pieces, cowries, cutting, finish, result, actions));
  }

  private openLabel(k: number): string {
    if (k === 0) return t('allClosed');
    if (k === this.draft.cowries) return t('allOpen');
    return String(k);
  }

  /** k open shells drawn as small pictures. */
  private shellIcons(open: number, total: number): HTMLElement {
    const span = el('span', { className: 'mini-shells' });
    span.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < total; i++) span.append(el('i', { className: i < open ? 'mini open' : 'mini' }));
    return span;
  }

  /** Toggle buttons for a set of move values (e.g. which throws bring a piece in). */
  private valueToggles(values: number[], chosen: number[], set: (list: number[]) => void): HTMLElement {
    const group = el('div', { className: 'value-toggles', role: 'group' });
    for (const v of values) {
      const on = chosen.includes(v);
      const b = button(String(v), 'chip', () => this.update(() => set(on ? chosen.filter((x) => x !== v) : [...chosen, v])));
      b.setAttribute('aria-pressed', String(on));
      group.append(b);
    }
    return group;
  }

  private toggleSafe(cell: CellId): void {
    this.update((x) => {
      const safe = new Set(x.safeCells ?? defaultSafeCells(x.boardSize));
      if (safe.has(cell)) safe.delete(cell);
      else safe.add(cell);
      x.safeCells = [...safe].sort((a, b) => a - b);
    });
  }

  private async runTest(): Promise<void> {
    const players = Math.min(4, maxPlayers(this.draft.boardSize));
    this.testResult = t('testing');
    this.render();
    const report = await simulate(players, this.draft, 20);
    this.testResult =
      report.finished < report.games
        ? t('testFail')
        : t('testResult', { finished: report.finished, games: report.games, turns: report.averageTurns });
    this.render();
  }
}
