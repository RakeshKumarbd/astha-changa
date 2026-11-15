// SVG board: the paper grid with crossed safe squares, path arrows, each player's
// yard of waiting pieces, and the pieces themselves (seed shapes, one per colour).

import { cellCol, cellRow, type Board, type CellId } from '../core/board';
import type { Move, PieceRef } from '../core/rules';
import { OFF_BOARD, boardFor, type GameState } from '../core/state';
import { t } from './i18n';
import { sfx } from './sound';

const NS = 'http://www.w3.org/2000/svg';
const CELL = 100;
/** Space round the grid: room for the yards when pieces wait off the board, else a thin border. */
const YARD_MARGIN = 92;
const PLAIN_MARGIN = 24;
const HOP_MS = 170;

/** Player colours; index = PlayerState.color. */
export const PLAYER_COLORS = ['#b3261e', '#2e7d32', '#c4911f', '#2a2a2a', '#1f5fa8', '#6a3d9a', '#e0701b', '#f3efe4'];

/** Colour for lines drawn on the paper (arrows, home edges): white needs a darker ink to show. */
const lineColor = (color: number): string => (color === 7 ? '#8f877a' : PLAYER_COLORS[color]!);

/** Seed outlines (drawn about the origin, roughly 56 units wide), one per colour so colour isn't the only cue. */
const SEED_PATHS = [
  // red kidney bean
  'M-27,-2 C-27,-18 -12,-22 -2,-16 C4,-12 10,-20 20,-16 C30,-11 30,10 14,18 C0,25 -27,16 -27,-2 Z',
  // green moong (round)
  'M0,-22 C13,-22 23,-12 23,0 C23,13 13,22 0,22 C-13,22 -23,13 -23,0 C-23,-12 -13,-22 0,-22 Z',
  // gold peanut
  'M-13,-16 C-30,-16 -31,16 -13,16 C-5,16 -3,10 0,10 C3,10 5,16 13,16 C31,16 30,-16 13,-16 C5,-16 3,-10 0,-10 C-3,-10 -5,-16 -13,-16 Z',
  // black almond
  'M-27,0 C-15,-17 13,-19 27,0 C13,19 -15,17 -27,0 Z',
  // blue square tile
  'M-17,-19 H17 Q23,-19 23,-13 V13 Q23,19 17,19 H-17 Q-23,19 -23,13 V-13 Q-23,-19 -17,-19 Z',
  // purple heart
  'M0,22 C-27,6 -24,-22 0,-11 C24,-22 27,6 0,22 Z',
  // orange rice grain
  'M-29,0 C-29,-12 29,-12 29,0 C29,12 -29,12 -29,0 Z',
  // white triangle
  'M0,-23 C6,-23 25,11 21,17 C17,23 -17,23 -21,17 C-25,11 -6,-23 0,-23 Z',
];

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const keyOf = (r: PieceRef) => `${r.player}:${r.piece}`;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface Spot {
  x: number;
  y: number;
  scale: number;
}

export interface BoardViewOptions {
  /** Editor mode: squares are tappable (to cross/uncross them) and pieces are hidden. */
  onCellClick?: (cell: CellId) => void;
}

/** A small seed icon for menus and banners. */
export function seedIcon(color: number, size = 22): SVGSVGElement {
  const s = svg('svg', { viewBox: '-32 -32 64 64', width: size, height: size, class: 'seed-icon', 'aria-hidden': 'true' });
  s.append(svg('path', { d: SEED_PATHS[color]!, fill: PLAYER_COLORS[color]!, stroke: 'rgba(0,0,0,.55)', 'stroke-width': 3 }));
  return s;
}

export class BoardView {
  readonly el: SVGSVGElement;
  onPieceClick: (ref: PieceRef) => void = () => {};

  private board: Board;
  private margin: number;
  private hasYards: boolean;
  private hints: SVGGElement;
  private pieceEls = new Map<string, SVGGElement>();
  private targets = new Map<string, CellId>();

  constructor(state: GameState, opts: BoardViewOptions = {}) {
    this.board = boardFor(state);
    this.hasYards = !opts.onCellClick && (!state.rules.startOnHome || !state.rules.captureSendsHome);
    this.margin = this.hasYards ? YARD_MARGIN : PLAIN_MARGIN;
    const size = this.board.size * CELL + 2 * this.margin;
    this.el = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'board', role: 'img', 'aria-label': t('boardLabel') });

    this.el.append(this.drawGrid(state));
    this.hints = svg('g', { class: 'hints' });
    this.el.append(this.hints);
    if (opts.onCellClick) {
      this.el.removeAttribute('role');
      this.el.append(this.drawCellButtons(opts.onCellClick));
      return;
    }

    const pieces = svg('g', { class: 'pieces' });
    state.players.forEach((p, pi) => {
      p.pieces.forEach((_, k) => {
        const g = this.makePiece(p.color);
        const ref = { player: pi, piece: k };
        g.addEventListener('click', (e) => {
          if (e.detail > 0) g.blur(); // mouse/touch: don't leave a keyboard focus ring behind
          this.onPieceClick(ref);
        });
        g.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          this.onPieceClick(ref);
        });
        g.addEventListener('focus', () => this.showTarget(ref));
        g.addEventListener('blur', () => this.showTarget(null));
        g.addEventListener('pointerenter', () => this.showTarget(ref));
        g.addEventListener('pointerleave', () => this.showTarget(null));
        this.pieceEls.set(keyOf(ref), g);
        pieces.append(g);
      });
    });
    this.el.append(pieces);
  }

  private centre(id: CellId): { x: number; y: number } {
    const n = this.board.size;
    return { x: this.margin + cellCol(n, id) * CELL + CELL / 2, y: this.margin + cellRow(n, id) * CELL + CELL / 2 };
  }

  /** Where a player's waiting pieces sit: outside their side, or diagonally outside their corner. */
  private yard(position: number, home: CellId): { x: number; y: number; dir: 'h' | 'v' | 'corner' } {
    const c = this.centre(home);
    const full = this.board.size * CELL + 2 * this.margin;
    const out = this.margin / 2 + 4;
    const at = { x: c.x, y: c.y };
    if (c.x < full / 2 - 1) at.x = this.margin - out;
    if (c.x > full / 2 + 1) at.x = full - this.margin + out;
    const vertical = c.y < full / 2 - 1 || c.y > full / 2 + 1;
    if (c.y < full / 2 - 1) at.y = this.margin - out;
    if (c.y > full / 2 + 1) at.y = full - this.margin + out;
    if (position % 2 === 1) return { ...at, dir: 'corner' };
    return { ...at, dir: vertical ? 'h' : 'v' };
  }

  private drawGrid(state: GameState): SVGGElement {
    const g = svg('g', { class: 'grid' });
    const n = this.board.size;
    const span = n * CELL;
    const m = this.margin;

    g.append(svg('rect', { x: m - 14, y: m - 14, width: span + 28, height: span + 28, rx: 10, class: 'paper' }));

    for (const p of this.hasYards ? state.players : []) {
      const y = this.yard(p.position, p.home);
      const count = p.pieces.length;
      const long = count * 56 + 30;
      const [w, h] = y.dir === 'h' ? [long, 76] : y.dir === 'v' ? [76, long] : [96, 50 + Math.ceil(count / 2) * 40];
      g.append(svg('rect', { x: y.x - w / 2, y: y.y - h / 2, width: w, height: h, rx: 36, class: 'yard', fill: PLAYER_COLORS[p.color]! }));
    }

    for (let i = 0; i <= n; i++) {
      const o = m + i * CELL;
      g.append(svg('line', { x1: m, y1: o, x2: m + span, y2: o, class: 'ink' }));
      g.append(svg('line', { x1: o, y1: m, x2: o, y2: m + span, class: 'ink' }));
    }

    for (const id of this.board.safe) {
      const { x, y } = this.centre(id);
      const d = CELL / 2 - 6;
      g.append(svg('path', { d: `M${x - d},${y - d} L${x + d},${y + d} M${x + d},${y - d} L${x - d},${y + d}`, class: 'cross' }));
    }
    const c = this.centre(this.board.centre);
    g.append(svg('circle', { cx: c.x, cy: c.y, r: 30, class: 'centre-mark' }));

    // Home squares get a coloured edge; arrows show where each player starts and where they turn inward.
    state.players.forEach((p, pi) => {
      const color = lineColor(p.color);
      const home = this.centre(p.home);
      g.append(svg('rect', {
        x: home.x - CELL / 2 + 4, y: home.y - CELL / 2 + 4, width: CELL - 8, height: CELL - 8, rx: 6,
        class: 'home', stroke: color,
      }));
      const path = this.board.paths[pi]!;
      g.append(this.arrow(path[0]!, path[1]!, color));
      g.append(this.arrow(path[this.board.outerLength - 1]!, path[this.board.outerLength]!, color));
    });
    return g;
  }

  /** Invisible buttons over every square, for the rule editor's safe-square picker. */
  private drawCellButtons(onClick: (cell: CellId) => void): SVGGElement {
    const g = svg('g', { class: 'cell-buttons' });
    const n = this.board.size;
    for (let id = 0; id < n * n; id++) {
      const { x, y } = this.centre(id);
      const r = svg('rect', { x: x - CELL / 2, y: y - CELL / 2, width: CELL, height: CELL, class: 'cell-hit', tabindex: 0, role: 'button' });
      r.setAttribute('aria-label', `${cellRow(n, id) + 1}, ${cellCol(n, id) + 1}${this.board.safe.has(id) ? ' ✕' : ''}`);
      r.setAttribute('aria-pressed', String(this.board.safe.has(id)));
      r.addEventListener('click', () => onClick(id));
      r.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onClick(id);
      });
      g.append(r);
    }
    return g;
  }

  /** A short arrow between two neighbouring squares. */
  private arrow(from: CellId, to: CellId, color: string): SVGPathElement {
    const a = this.centre(from);
    const b = this.centre(to);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const L = 14;
    const tip = { x: mx + dx * L, y: my + dy * L };
    const tail = { x: mx - dx * L, y: my - dy * L };
    const w = 8;
    const d = `M${tail.x},${tail.y} L${tip.x},${tip.y} M${tip.x - dx * w - dy * w},${tip.y - dy * w - dx * w} L${tip.x},${tip.y} L${tip.x - dx * w + dy * w},${tip.y - dy * w + dx * w}`;
    return svg('path', { d, class: 'arrow', stroke: color });
  }

  private makePiece(color: number): SVGGElement {
    const g = svg('g', { class: `piece color-${color}`, tabindex: -1 });
    g.append(svg('circle', { r: 36, class: 'glow' }));
    g.append(svg('path', { d: SEED_PATHS[color]!, fill: PLAYER_COLORS[color]!, class: 'seed' }));
    g.append(svg('ellipse', { cx: -7, cy: -7, rx: 8, ry: 4.5, class: 'sheen' }));
    return g;
  }

  /** Where every piece should stand: pieces sharing a square are arranged in a small grid. */
  private layout(state: GameState): Map<string, Spot> {
    const spots = new Map<string, Spot>();
    const byCell = new Map<CellId, string[]>();
    state.players.forEach((p, pi) => {
      p.pieces.forEach((idx, k) => {
        const key = keyOf({ player: pi, piece: k });
        if (idx === OFF_BOARD) {
          const y = this.yard(p.position, p.home);
          if (y.dir === 'corner') {
            const rows = Math.ceil(p.pieces.length / 2);
            spots.set(key, { x: y.x + ((k % 2) - 0.5) * 40, y: y.y + (Math.floor(k / 2) - (rows - 1) / 2) * 40, scale: 0.62 });
          } else {
            const off = (k - (p.pieces.length - 1) / 2) * 56;
            spots.set(key, { x: y.x + (y.dir === 'h' ? off : 0), y: y.y + (y.dir === 'h' ? 0 : off), scale: 0.9 });
          }
        } else {
          const cell = this.board.paths[pi]![idx]!;
          byCell.set(cell, [...(byCell.get(cell) ?? []), key]);
        }
      });
    });
    for (const [cell, keys] of byCell) {
      const { x, y } = this.centre(cell);
      const cols = Math.ceil(Math.sqrt(keys.length));
      const step = (CELL * 0.86) / cols;
      const scale = keys.length === 1 ? 1.05 : (1.7 / cols) * 0.62;
      const rows = Math.ceil(keys.length / cols);
      keys.forEach((key, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        spots.set(key, { x: x + (c - (cols - 1) / 2) * step, y: y + (r - (rows - 1) / 2) * step, scale });
      });
    }
    return spots;
  }

  private place(el: SVGGElement, s: Spot): void {
    el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
  }

  render(state: GameState): void {
    for (const [key, spot] of this.layout(state)) this.place(this.pieceEls.get(key)!, spot);
  }

  /** Mark the pieces the player may move, remembering the square each would reach. */
  setMovable(moves: Move[]): void {
    this.targets.clear();
    for (const m of moves) this.targets.set(keyOf(m), this.board.paths[m.player]![m.to]!);
    for (const [key, el] of this.pieceEls) {
      const on = this.targets.has(key);
      el.classList.toggle('movable', on);
      el.setAttribute('tabindex', on ? '0' : '-1');
      el.setAttribute('role', on ? 'button' : 'img');
    }
    this.showTarget(null);
  }

  private showTarget(ref: PieceRef | null): void {
    this.hints.replaceChildren();
    const cell = ref ? this.targets.get(keyOf(ref)) : undefined;
    if (cell === undefined) return;
    const { x, y } = this.centre(cell);
    this.hints.append(svg('rect', { x: x - CELL / 2 + 3, y: y - CELL / 2 + 3, width: CELL - 6, height: CELL - 6, rx: 8, class: 'target' }));
  }

  /** Hop a piece square by square along its path, then settle everything into place. */
  async animateMove(after: GameState, move: Move): Promise<void> {
    this.setMovable([]);
    const el = this.pieceEls.get(keyOf(move))!;
    const path = this.board.paths[move.player]!;
    const steps: number[] = [];
    if (move.from === OFF_BOARD) steps.push(0);
    else if (move.to < move.from) {
      // circling the outer ring
      for (let i = move.from + 1; i < this.board.outerLength; i++) steps.push(i);
      for (let i = 0; i <= move.to; i++) steps.push(i);
    } else for (let i = move.from + 1; i <= move.to; i++) steps.push(i);

    el.classList.add('moving');
    for (const i of steps) {
      const { x, y } = this.centre(path[i]!);
      this.place(el, { x, y, scale: 1.1 });
      sfx.hop();
      await delay(HOP_MS);
    }
    el.classList.remove('moving');
    for (const c of move.captures) this.pieceEls.get(keyOf(c))!.classList.add('captured');
    this.render(after);
    await delay(move.captures.length ? 450 : 150);
    for (const c of move.captures) this.pieceEls.get(keyOf(c))!.classList.remove('captured');
  }
}
