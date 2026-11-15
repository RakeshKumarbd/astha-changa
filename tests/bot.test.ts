import { describe, expect, it } from 'vitest';
import { chooseMove, pieceDanger, type BotLevel } from '../src/ai/bot';
import { cellId } from '../src/core/board';
import { seededRng, throwCowries, throwOdds, type Rng } from '../src/core/cowrie';
import { applyMove, applyThrow } from '../src/core/rules';
import { OFF_BOARD, boardFor, createGame, type GameState, type PlayerSpec, type RuleConfig } from '../src/core/state';

const OFF = [OFF_BOARD, OFF_BOARD, OFF_BOARD, OFF_BOARD];
const SEVEN: Partial<RuleConfig> = { boardSize: 7, startOnHome: false, captureSendsHome: false };
const board7 = boardFor(createGame(2, SEVEN));
const idx = (player: number, r: number, c: number) => board7.paths[player]!.indexOf(cellId(7, r, c));

function setup(p0: number[], p1: number[], pending: number[]): GameState {
  const s = createGame(2, SEVEN);
  s.players[0]!.pieces = p0;
  s.players[1]!.pieces = p1;
  s.pending = pending;
  s.phase = 'move';
  return s;
}

it('throw odds add up to 1', () => {
  expect(throwOdds(createGame(2).rules).reduce((a, [, p]) => a + p, 0)).toBeCloseTo(1);
});

describe('pieceDanger', () => {
  it('is zero on a safe square and off the board', () => {
    const s = setup([0, OFF_BOARD, OFF_BOARD, OFF_BOARD], [idx(1, 6, 2), ...OFF.slice(1)], []);
    expect(pieceDanger(s, 0, 0)).toBe(0); // home square
    expect(pieceDanger(s, 0, 1)).toBe(0);
  });

  it('matches the chance of the exact throw needed', () => {
    // Opponent (seat 2) two squares behind player 0's piece on seat 0 index 2 (6,5).
    const behind = idx(1, 6, 5) - 2;
    const s = setup([2, ...OFF.slice(1)], [behind, ...OFF.slice(1)], []);
    expect(pieceDanger(s, 0, 0)).toBeCloseTo(6 / 16);
  });
});

describe.each<BotLevel>(['medium', 'hard'])('%s bot', (level) => {
  it('takes a capture when one is available', () => {
    const victim = idx(1, 6, 5); // seat 0 index 2, unsafe
    const s = setup([0, 5, OFF_BOARD, OFF_BOARD], [victim, ...OFF.slice(1)], [2]);
    const m = chooseMove(s, level, seededRng(1));
    expect(m.piece).toBe(0);
    expect(m.captures).toHaveLength(1);
  });

  it('finishes a piece when it can', () => {
    const s = setup([45, 10, OFF_BOARD, OFF_BOARD], OFF, [3]);
    s.players[0]!.hasCaptured = true;
    expect(chooseMove(s, level, seededRng(1)).piece).toBe(0);
  });
});

/** Plays one 2-player game; returns the winner. */
function duel(a: BotLevel, b: BotLevel, rng: Rng): number {
  const levels = [a, b];
  let s = createGame(2);
  for (let n = 0; n < 100_000 && s.phase !== 'over'; n++) {
    s = s.phase === 'throw' ? applyThrow(s, throwCowries(rng, s.rules).value) : applyMove(s, chooseMove(s, levels[s.current]!, rng));
  }
  return s.finishOrder[0]!;
}

it('hard beats easy most of the time', () => {
  let wins = 0;
  const games = 40;
  for (let g = 0; g < games; g++) {
    // Alternate who starts so going first doesn't skew the result.
    const hardFirst = g % 2 === 0;
    const w = duel(hardFirst ? 'hard' : 'easy', hardFirst ? 'easy' : 'hard', seededRng(100 + g));
    if ((w === 0) === hardFirst) wins++;
  }
  expect(wins / games).toBeGreaterThan(0.7);
}, 120_000);

describe('bots under custom rules', () => {
  it.each<[string, number | PlayerSpec[], Partial<RuleConfig>]>([
    ['2 shells', 3, { cowries: 2, throwTable: [2, 1, 4], bonusThrows: [2, 4] }],
    ['7 shells, 6 pieces', 2, { cowries: 7, throwTable: [7, 1, 2, 3, 4, 5, 6, 14], bonusThrows: [7, 14], piecesPerPlayer: 6 }],
    ['teams of 4 on 7×7', Array.from({ length: 8 }, (_, i) => ({ team: i % 2 })), { boardSize: 7 }],
  ])('medium and hard bots finish games with %s', (_, players, rules) => {
    const rng = seededRng(9);
    let s = createGame(players, rules);
    for (let n = 0; n < 100_000 && s.phase !== 'over'; n++) {
      const level: BotLevel = s.current % 2 === 0 ? 'hard' : 'medium';
      s = s.phase === 'throw' ? applyThrow(s, throwCowries(rng, s.rules).value) : applyMove(s, chooseMove(s, level, rng));
    }
    expect(s.phase).toBe('over');
  }, 120_000);

  it('a hard bot never cuts its teammate', () => {
    const s = createGame([{ team: 0 }, { team: 1 }, { team: 0 }, { team: 1 }]);
    const board = boardFor(s);
    s.players[2]!.pieces[0] = board.paths[2]!.indexOf(board.paths[0]![1]!);
    s.pending = [1];
    s.phase = 'move';
    expect(chooseMove(s, 'hard', seededRng(1)).captures).toEqual([]);
  });
});
