// Custom rule options and more-than-4-player boards.

import { describe, expect, it } from 'vitest';
import { cellCol, cellId, cellRow, createBoard, homeCell, maxPlayers, playerPath, seatLayout } from '../src/core/board';
import { applyMove, applyThrow, legalMoves, targetIndex, winningTeam } from '../src/core/rules';
import { DEFAULT_RULES, OFF_BOARD, boardFor, createGame, migrateGame, migrateRules, type GameState } from '../src/core/state';

describe('homes and seats', () => {
  it('fits 6 players on 5×5 and 8 on bigger boards', () => {
    expect(maxPlayers(5)).toBe(6);
    expect(maxPlayers(7)).toBe(8);
    expect(() => seatLayout(5, 7)).toThrow();
    expect(seatLayout(7, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the classic side seats for 2–4 players', () => {
    expect(seatLayout(5, 2)).toEqual([0, 4]);
    expect(seatLayout(5, 3)).toEqual([0, 2, 4]);
    expect(seatLayout(5, 4)).toEqual([0, 2, 4, 6]);
  });

  it.each([5, 7, 9] as const)('a path from every home on %i×%i covers the board once', (size) => {
    for (let pos = 0; pos < 8; pos++) {
      const path = playerPath(size, homeCell(size, pos));
      expect(path[0]).toBe(homeCell(size, pos));
      expect(new Set(path).size).toBe(size * size);
      expect(path[path.length - 1]).toBe(cellId(size, (size - 1) / 2, (size - 1) / 2));
      for (let i = 1; i < path.length; i++) {
        const dr = Math.abs(cellRow(size, path[i]!) - cellRow(size, path[i - 1]!));
        const dc = Math.abs(cellCol(size, path[i]!) - cellCol(size, path[i - 1]!));
        expect(Math.max(dr, dc)).toBe(1); // one step, possibly diagonal when turning in at a corner
      }
    }
  });

  it('clockwise boards go left along the bottom first', () => {
    const p = playerPath(5, homeCell(5, 0), { outerClockwise: true, alternateInner: true });
    expect(p[1]).toBe(cellId(5, 4, 1));
  });

  it('without alternating, inner rings go the same way as the outer ring', () => {
    const alt = playerPath(5, homeCell(5, 0));
    const same = playerPath(5, homeCell(5, 0), { outerClockwise: false, alternateInner: false });
    expect(alt[16]).toBe(same[16]); // both step inward at the same square
    expect(alt[17]).not.toBe(same[17]); // then turn opposite ways
  });

  it('every home in play is safe, even a corner on 5×5', () => {
    const board = createBoard(5, [homeCell(5, 0), homeCell(5, 1)]);
    expect(board.safe.has(homeCell(5, 1))).toBe(true);
  });
});

function moveState(rules: Parameters<typeof createGame>[1], p0: number[], p1: number[], pending: number[]): GameState {
  const s = createGame(2, rules);
  s.players[0]!.pieces = p0;
  s.players[1]!.pieces = p1;
  s.pending = pending;
  s.phase = 'move';
  return s;
}

/** Path index for player 1 (top) of the square player 0 reaches at index i. */
const opponentIndexAt = (s: GameState, i: number) => boardFor(s).paths[1]!.indexOf(boardFor(s).paths[0]![i]!);

describe('rule options', () => {
  it('pieces per player', () => {
    expect(createGame(2, { piecesPerPlayer: 6 }).players[0]!.pieces).toHaveLength(6);
  });

  it('without exact finish, a big throw still reaches the centre', () => {
    const s = moveState({ exactFinish: false }, [23, 0, 0, 0], [0, 0, 0, 0], [8]);
    s.players[0]!.hasCaptured = true;
    expect(targetIndex(s, 0, 0, 8)).toBe(24);
  });

  it('a cut piece can be sent off the board instead of home', () => {
    let s = moveState({ captureSendsHome: false }, [0, 0, 0, 0], [0, 0, 0, 0], [1]);
    s.players[1]!.pieces[0] = opponentIndexAt(s, 1);
    s = applyMove(s, { piece: 0, throwValue: 1 });
    expect(s.players[1]!.pieces[0]).toBe(OFF_BOARD);
  });

  it('cutting need not give another throw', () => {
    let s = moveState({ captureGivesThrow: false }, [0, 0, 0, 0], [0, 0, 0, 0], [1]);
    s.players[1]!.pieces[0] = opponentIndexAt(s, 1);
    s = applyMove(s, { piece: 0, throwValue: 1 });
    expect(s.current).toBe(1);
    expect(s.players[0]!.hasCaptured).toBe(true);
  });

  it('custom throw table and bonus results', () => {
    let s = createGame(2, { throwTable: [5, 1, 2, 3, 6], bonusThrows: [5] });
    s = applyThrow(s, 5);
    expect(s.phase).toBe('throw');
    s = applyThrow(s, 6);
    expect(s.phase).toBe('move');
    expect(new Set(legalMoves(s).map((m) => m.throwValue))).toEqual(new Set([5, 6]));
  });
});

describe('teams', () => {
  const specs = [{ team: 0 }, { team: 1 }, { team: 0 }, { team: 1 }];

  it('teammates never cut each other', () => {
    const s = createGame(specs);
    const board = boardFor(s);
    // Put player 2 (teammate) one square ahead of player 0.
    s.players[2]!.pieces[0] = board.paths[2]!.indexOf(board.paths[0]![1]!);
    s.pending = [1];
    s.phase = 'move';
    const m = legalMoves(s).find((x) => x.piece === 0)!;
    expect(m.captures).toEqual([]);
  });

  it('a team wins only when every member has finished', () => {
    let s = createGame(specs);
    const final = boardFor(s).finalIndex;
    s.players[0]!.pieces = [final, final, final, final - 1];
    s.players[0]!.hasCaptured = true;
    s.pending = [1];
    s.phase = 'move';
    s = applyMove(s, { piece: 3, throwValue: 1 });
    expect(s.phase).toBe('throw'); // teammate still playing
    expect(s.finishOrder).toEqual([0]);
    expect(winningTeam(s)).toBeNull();

    s.players[2]!.pieces = [final, final, final, final - 1];
    s.players[2]!.hasCaptured = true;
    s.current = 2;
    s.pending = [1];
    s.phase = 'move';
    s = applyMove(s, { piece: 3, throwValue: 1 });
    expect(s.phase).toBe('over');
    expect(winningTeam(s)).toBe(0);
  });
});

describe('migration', () => {
  it('fills missing fields from the defaults', () => {
    expect(migrateRules({})).toEqual(DEFAULT_RULES);
    expect(migrateRules('junk')).toEqual(DEFAULT_RULES);
  });

  it('reads version-1 rules: pieces off the board, three-in-a-row limit', () => {
    const r = migrateRules({ boardSize: 7, entryThrows: [4, 8], captureRequiredForInner: true, pairBlocks: false, threeBonusForfeit: true, stopAtFirstWinner: true });
    expect(r).toMatchObject({ boardSize: 7, startOnHome: false, captureSendsHome: false, bonusStreakLimit: 3 });
  });

  it('rejects out-of-range values', () => {
    const r = migrateRules({ piecesPerPlayer: 40, cowries: 1, boardSize: 6, throwTable: [1, 2] });
    expect(r.piecesPerPlayer).toBe(4);
    expect(r.cowries).toBe(4);
    expect(r.boardSize).toBe(5);
    expect(r.throwTable).toEqual(DEFAULT_RULES.throwTable);
  });

  it('turns old saved games with seats into homes', () => {
    const old = {
      rules: { boardSize: 7, entryThrows: [4, 8], captureRequiredForInner: true, pairBlocks: false, threeBonusForfeit: false, stopAtFirstWinner: true },
      players: [{ seat: 0, pieces: [3, -1, -1, -1], hasCaptured: false }, { seat: 2, pieces: [0, -1, -1, -1], hasCaptured: true }],
      current: 0, phase: 'throw', pending: [], bonusStreak: 0, finishOrder: [],
    } as unknown as GameState;
    const s = migrateGame(old);
    expect(s.players.map((p) => [p.position, p.color, p.home])).toEqual([
      [0, 0, homeCell(7, 0)],
      [4, 2, homeCell(7, 4)],
    ]);
    expect(s.players[1]!.pieces).toEqual([0, -1, -1, -1]);
  });
});
