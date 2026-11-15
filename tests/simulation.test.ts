// Plays many random games to completion and checks the state stays valid throughout.

import { describe, expect, it } from 'vitest';
import { defaultThrowTable, seededRng } from '../src/core/cowrie';
import { legalMoves, winningTeam } from '../src/core/rules';
import { playRandomGame, simulate } from '../src/core/simulate';
import { OFF_BOARD, boardFor, type GameState, type PlayerSpec, type RuleConfig } from '../src/core/state';

function checkInvariants(s: GameState, rules: Partial<RuleConfig>): void {
  const board = boardFor(s);
  if (s.phase === 'move') expect(legalMoves(s).length).toBeGreaterThan(0); // move phase is never a dead end
  for (const p of s.players) {
    expect(p.pieces).toHaveLength(s.rules.piecesPerPlayer);
    for (const i of p.pieces) expect(i === OFF_BOARD || (i >= 0 && i <= board.finalIndex)).toBe(true);
    if (!p.hasCaptured && rules.captureRequiredForInner !== false) {
      for (const i of p.pieces) expect(i < board.outerLength).toBe(true);
    }
  }
}

const teams4: PlayerSpec[] = [{ team: 0 }, { team: 1 }, { team: 0 }, { team: 1 }];
const teams8: PlayerSpec[] = Array.from({ length: 8 }, (_, i) => ({ team: i % 2 }));

describe('random games', () => {
  it.each<[string, number | PlayerSpec[], Partial<RuleConfig>]>([
    ['2 players, video rules', 2, {}],
    ['3 players', 3, {}],
    ['4 players', 4, {}],
    ['6 players on 5×5', 6, {}],
    ['8 players on 7×7', 8, { boardSize: 7 }],
    ['8 players on 9×9', 8, { boardSize: 9 }],
    ['4 players on 7×7', 4, { boardSize: 7 }],
    ['pieces wait off the board', 4, { startOnHome: false }],
    ['7×7, wait off board', 2, { boardSize: 7, startOnHome: false, captureSendsHome: false }],
    ['pair blocks + streak limit', 2, { pairBlocks: true, bonusStreakLimit: 3 }],
    ['play on for all places', 4, { stopAtFirstWinner: false }],
    ['2 shells', 3, { cowries: 2, throwTable: defaultThrowTable(2), bonusThrows: [2, 4] }],
    ['7 shells', 3, { cowries: 7, throwTable: defaultThrowTable(7), bonusThrows: [7, 14] }],
    ['2 pieces each', 4, { piecesPerPlayer: 2 }],
    ['6 pieces each', 2, { piecesPerPlayer: 6 }],
    ['no exact finish', 3, { exactFinish: false }],
    ['cut piece goes off the board', 3, { captureSendsHome: false }],
    ['clockwise, no alternating', 3, { outerClockwise: true, alternateInner: false }],
    ['teams of 2', teams4, {}],
    ['teams of 4 on 7×7, play on', teams8, { boardSize: 7, stopAtFirstWinner: false }],
  ])('%s: games always finish', (_, players, rules) => {
    const count = typeof players === 'number' ? players : players.length;
    const seeds = count > 4 ? 4 : 12; // big tables are slow to play out with checks on every step
    for (let seed = 1; seed <= seeds; seed++) {
      const r = playRandomGame(players, rules, seededRng(seed), 200_000, (s) => checkInvariants(s, rules));
      expect(r.finished).toBe(true);
      expect(winningTeam(r.state)).not.toBeNull();
      if (rules.stopAtFirstWinner === false) expect(r.state.finishOrder).toHaveLength(count);
    }
  }, 120_000);
});

it('simulate reports how many games finished', async () => {
  const report = await simulate(2, {}, 5);
  expect(report).toMatchObject({ games: 5, finished: 5 });
  expect(report.averageTurns).toBeGreaterThan(0);
});
