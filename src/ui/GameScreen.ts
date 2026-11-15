// The playing screen: board, cowries, turn banner and controls. Drives bot turns.

import { chooseMove } from '../ai/bot';
import { throwCowries } from '../core/cowrie';
import { rulesSummary } from '../core/rulesText';
import { applyMove, applyThrow, isBonus, legalMoves, winningTeam, type Move, type PieceRef } from '../core/rules';
import { OFF_BOARD, boardFor, type GameState } from '../core/state';
import { BoardView, PLAYER_COLORS, seedIcon } from './BoardView';
import { CowrieView } from './CowrieView';
import { button, el, showDialog } from './dom';
import { getLang, t } from './i18n';
import { playerName, saveGame, teamName, type PlayerSetup, type Setup } from './setup';
import { buzz } from './platform';
import { isMuted, setMuted, sfx } from './sound';

const BOT_THROW_DELAY = 650;
const BOT_MOVE_DELAY = 450;
const PASS_PAUSE = 1100;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GameScreenEvents {
  onMenu(): void;
  onPlayAgain(): void;
}

export class GameScreen {
  readonly el: HTMLElement;
  private state: GameState;
  private board: BoardView;
  private cowries: CowrieView;
  private selected: number | null = null;
  private busy = false;
  private alive = true;
  private message = '';
  /** The last person who had the device, for the "pass the phone" screen. */
  private lastHuman = -1;

  private banner: HTMLElement;
  private status: HTMLElement;
  private chips: HTMLElement;
  private throwBtn: HTMLButtonElement;

  /** `players` is in the same (turn) order as `state.players`. */
  constructor(private players: PlayerSetup[], private setup: Setup, state: GameState, private events: GameScreenEvents) {
    this.state = state;
    this.board = new BoardView(state);
    this.board.onPieceClick = (ref) => this.onPieceClick(ref);
    this.cowries = new CowrieView(state.rules.cowries);

    this.el = document.createElement('main');
    this.el.className = 'game';
    this.el.innerHTML = `
      <header class="topbar">
        <button class="icon-btn menu-btn" type="button"></button>
        <div class="banner" aria-live="polite"></div>
        <button class="icon-btn rules-btn" type="button">?</button>
        <button class="icon-btn sound-btn" type="button"></button>
      </header>
      <div class="board-wrap"></div>
      <section class="controls">
        <div class="cowrie-slot"></div>
        <p class="status" aria-live="polite"></p>
        <div class="chips"></div>
        <button class="primary throw-btn" type="button"></button>
      </section>`;
    this.banner = this.el.querySelector('.banner')!;
    this.status = this.el.querySelector('.status')!;
    this.chips = this.el.querySelector('.chips')!;
    this.throwBtn = this.el.querySelector('.throw-btn')!;
    this.el.querySelector('.board-wrap')!.append(this.board.el);
    this.el.querySelector('.cowrie-slot')!.append(this.cowries.el);

    const menuBtn = this.el.querySelector<HTMLButtonElement>('.menu-btn')!;
    menuBtn.textContent = '☰';
    menuBtn.setAttribute('aria-label', t('menu'));
    menuBtn.addEventListener('click', () => {
      this.destroy();
      this.events.onMenu();
    });
    const rulesBtn = this.el.querySelector<HTMLButtonElement>('.rules-btn')!;
    rulesBtn.setAttribute('aria-label', t('rules'));
    rulesBtn.addEventListener('click', () => this.showRules());
    const soundBtn = this.el.querySelector<HTMLButtonElement>('.sound-btn')!;
    const paintSound = () => {
      soundBtn.textContent = isMuted() ? '🔇' : '🔊';
      soundBtn.setAttribute('aria-label', t('sound'));
      soundBtn.setAttribute('aria-pressed', String(!isMuted()));
    };
    paintSound();
    soundBtn.addEventListener('click', () => {
      setMuted(!isMuted());
      paintSound();
    });

    this.throwBtn.textContent = t('throw');
    this.throwBtn.addEventListener('click', () => void this.doThrow());

    this.board.render(state);
    this.refresh();
    this.next();
  }

  destroy(): void {
    this.alive = false;
  }

  private name(player: number): string {
    return playerName(this.players[player]!, this.state, player);
  }

  private isHumanTurn(): boolean {
    return this.players[this.state.current]!.kind === 'human';
  }

  /** Moves for the selected throw, choosing another throw if the selected one can't be used. */
  private humanMoves(): Move[] {
    const all = legalMoves(this.state);
    if (this.selected === null || !all.some((m) => m.throwValue === this.selected)) {
      this.selected = all[0]?.throwValue ?? null;
    }
    return all.filter((m) => m.throwValue === this.selected);
  }

  private refresh(): void {
    const s = this.state;
    const p = s.players[s.current]!;
    const color = PLAYER_COLORS[p.color]!;
    const label = t('turnOf', { name: this.name(s.current) }) + (this.setup.teams ? ` · ${teamName(p.team)}` : '');
    this.banner.replaceChildren(seedIcon(p.color, 22), el('span', { textContent: label }));
    this.el.style.setProperty('--turn', color);

    const human = this.isHumanTurn() && !this.busy && s.phase !== 'over';
    this.throwBtn.disabled = !(human && s.phase === 'throw');
    this.throwBtn.textContent = s.pending.length > 0 && s.phase === 'throw' ? t('throwAgain') : t('throw');

    const moves = human && s.phase === 'move' ? this.humanMoves() : [];
    this.board.setMovable(moves);

    this.chips.replaceChildren();
    if (s.pending.length > 0) {
      this.chips.append(el('span', { className: 'chips-label', textContent: t('pickThrow') }));
      const usable = new Set(legalMoves(s).map((m) => m.throwValue));
      s.pending.forEach((v) => {
        const pickable = human && s.phase === 'move' && usable.has(v);
        const b = button(String(v), 'chip', () => {
          this.selected = v;
          this.refresh();
        });
        b.disabled = !pickable;
        b.setAttribute('aria-pressed', String(pickable && v === this.selected));
        this.chips.append(b);
      });
    }

    let msg = this.message;
    if (!msg && human) msg = s.phase === 'move' ? t('pickPiece') : '';
    if (!msg && !this.isHumanTurn() && s.phase !== 'over') msg = t('thinking', { name: this.name(s.current) });
    this.status.textContent = msg;
  }

  /** Decide what happens next: game over, a bot acting, or waiting for a person. */
  private next(): void {
    if (!this.alive) return;
    if (this.state.phase === 'over') {
      saveGame(null);
      this.showWinner();
      return;
    }
    saveGame({ players: this.players, setup: this.setup, state: this.state });
    this.refresh();
    if (this.isHumanTurn()) {
      this.maybePassScreen();
      return;
    }
    const level = this.players[this.state.current]!.level;
    if (this.state.phase === 'throw') {
      setTimeout(() => this.alive && void this.doThrow(true), BOT_THROW_DELAY);
    } else {
      setTimeout(() => {
        if (!this.alive) return;
        void this.doMove(chooseMove(this.state, level, Math.random), true);
      }, BOT_MOVE_DELAY);
    }
  }

  /** When several people share one device, cover the board until the next person is ready. */
  private maybePassScreen(): void {
    const current = this.state.current;
    const humans = this.players.filter((p) => p.kind === 'human').length;
    if (!this.setup.passScreen || humans < 2 || current === this.lastHuman) return;
    this.lastHuman = current;
    const p = this.state.players[current]!;
    const heading = el('h2', { className: 'pass-heading' }, seedIcon(p.color, 34), el('span', { textContent: t('passTo', { name: this.name(current) }) }));
    const ready = button(t('ready'), 'primary', () => close());
    const close = showDialog(this.el, heading, ready);
    ready.closest('.overlay')!.classList.add('pass-overlay');
  }

  private async doThrow(byBot = false): Promise<void> {
    if (this.busy || this.state.phase !== 'throw' || (!byBot && !this.isHumanTurn())) return;
    this.busy = true;
    this.message = '';
    this.refresh();
    const result = throwCowries(Math.random, this.state.rules);
    await this.cowries.roll(result);
    if (!this.alive) return;

    const before = this.state;
    this.state = applyThrow(before, result.value);
    this.selected = null;
    const bonus = isBonus(before, result.value);

    if (this.state.current !== before.current) {
      // the turn passed straight away
      this.message = `${this.name(before.current)}: ${bonus ? t('lostTurn') : `${result.value} — ${t('noMove')}`}`;
      sfx.noMove();
      this.refresh();
      await wait(PASS_PAUSE);
    } else if (bonus) {
      this.message = `${this.bonusLabel(result.value)} ${t('throwAgain')}`;
      sfx.bonus();
      buzz();
    } else {
      this.message = '';
    }
    this.busy = false;
    this.next();
  }

  /** "Changa!" and "Ashta!" with the video's 4 shells; just the number otherwise. */
  private bonusLabel(v: number): string {
    const classic = this.state.rules.cowries === 4;
    if (classic && v === 4) return t('changa');
    if (classic && v === 8) return t('ashta');
    return t('bonus', { n: v });
  }

  private onPieceClick(ref: PieceRef): void {
    if (this.busy || !this.isHumanTurn() || this.state.phase !== 'move' || ref.player !== this.state.current) return;
    const all = legalMoves(this.state);
    const move =
      all.find((m) => m.piece === ref.piece && m.throwValue === this.selected) ?? all.find((m) => m.piece === ref.piece);
    if (move) void this.doMove(move);
  }

  private async doMove(move: Move, byBot = false): Promise<void> {
    if (this.busy || (!byBot && !this.isHumanTurn())) return;
    this.busy = true;
    this.message = '';
    this.refresh();

    const before = this.state;
    const after = applyMove(before, move);
    await this.board.animateMove(after, move);
    if (!this.alive) return;
    this.state = after;

    const who = this.name(move.player);
    if (move.captures.length > 0) {
      const victims = [...new Set(move.captures.map((c) => this.name(c.player)))].join(', ');
      const extra = after.phase !== 'over' && after.rules.captureGivesThrow ? ` ${t('extraThrow')}` : '';
      this.message = t('cut', { a: who, b: victims }) + extra;
      sfx.capture();
      buzz(true);
    } else if (move.to === boardFor(after).finalIndex) {
      this.message = t('home', { name: who });
      sfx.home();
      buzz();
    } else if (move.from === OFF_BOARD) {
      this.message = t('enters', { name: who });
    } else {
      this.message = '';
    }
    if (after.current !== before.current) this.message = '';
    this.busy = false;
    this.next();
  }

  private showRules(): void {
    const back = button(t('back'), 'primary', () => close());
    const close = showDialog(
      this.el,
      el('h2', { textContent: t('rules') }),
      el('ol', { className: 'rules-list' }, ...rulesSummary(this.state.rules, getLang()).map((line) => el('li', { textContent: line }))),
      back,
    );
  }

  private showWinner(): void {
    sfx.win();
    this.refresh();
    const s = this.state;
    const team = winningTeam(s)!;
    const members = s.players.map((_, i) => i).filter((i) => s.players[i]!.team === team);
    const first = s.players[members[0]!]!;
    const heading = this.setup.teams
      ? t('teamWins', { team: teamName(team), names: members.map((i) => this.name(i)).join(', ') })
      : t('wins', { name: this.name(members[0]!) });
    const h = el('h2', { textContent: heading });
    h.style.color = first.color === 7 ? 'var(--ink)' : PLAYER_COLORS[first.color]!;

    const again = button(t('playAgain'), 'primary', () => {
      this.destroy();
      this.events.onPlayAgain();
    });
    const menu = button(t('menu'), 'secondary', () => {
      this.destroy();
      this.events.onMenu();
    });
    const parts: Node[] = [h];
    if (s.finishOrder.length > 1 && !this.setup.teams) {
      parts.push(el('ol', {}, ...s.finishOrder.map((p) => el('li', { textContent: this.name(p) }))));
    }
    parts.push(el('div', { className: 'row' }, again, menu));
    const card = el('div', { className: 'card win-card', role: 'dialog' }, ...parts);
    card.setAttribute('aria-modal', 'true');
    this.el.append(el('div', { className: 'overlay' }, card));
    again.focus();
  }
}
