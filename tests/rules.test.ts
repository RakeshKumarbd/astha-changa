import { describe, expect, it } from 'vitest';
import { cellId } from '../src/core/board';
import { applyMove, applyThrow, legalMoves, targetIndex } from '../src/core/rules';
import { OFF_BOARD, boardFor, createGame, type GameState, type RuleConfig } from '../src/core/state';

/** The detailed tests below use a 7×7 board with pieces waiting off the board until a 4 or 8. */
const SEVEN: Partial<RuleConfig> = { boardSize: 7, startOnHome: false, captureSendsHome: false };
const board7 = boardFor(createGame(2, SEVEN));

/** Path index on a player's path of the 7×7 cell at (r, c). Player 1 sits at the top. */
const idx = (player: number, r: number, c: number) => board7.paths[player]!.indexOf(cellId(7, r, c));

/** A 2-player game (seats 0 and 2) with pieces placed and player 0 holding these throws. */
function setup(p0: number[], p1: number[], pending: number[], rules: Partial<RuleConfig> = {}): GameState {
  const s = createGame(2, { ...SEVEN, ...rules });
  s.players[0]!.pieces = p0;
  s.players[1]!.pieces = p1;
  s.pending = pending;
  s.phase = 'move';
  return s;
}

const OFF = [OFF_BOARD, OFF_BOARD, OFF_BOARD, OFF_BOARD];

describe('setup', () => {
  it('two players sit opposite each other', () => {
    expect(createGame(2).players.map((p) => p.position)).toEqual([0, 4]);
    expect(createGame(4).players.map((p) => p.position)).toEqual([0, 2, 4, 6]);
  });

  it('rejects bad player counts', () => {
    expect(() => createGame(1)).toThrow();
    expect(() => createGame(7)).toThrow(); // 5×5 fits at most 6
  });
});

describe('throwing', () => {
  it('a 4 or 8 means throw again before moving', () => {
    let s = createGame(2);
    s = applyThrow(s, 4);
    expect(s.phase).toBe('throw');
    s = applyThrow(s, 8);
    expect(s.phase).toBe('throw');
    s = applyThrow(s, 2);
    expect(s.phase).toBe('move');
    expect(s.pending).toEqual([4, 8, 2]);
  });

  it('passes the turn when no throw can be used', () => {
    const s = applyThrow(createGame(2, SEVEN), 3); // nobody on the board, 3 cannot enter
    expect(s.current).toBe(1);
    expect(s.phase).toBe('throw');
    expect(s.pending).toEqual([]);
  });

  it('cannot throw during the move phase', () => {
    expect(() => applyThrow(setup([0, ...OFF.slice(1)], OFF, [2]), 1)).toThrow();
  });

  it('three bonus throws in a row forfeit the turn when that rule is on', () => {
    let s = createGame(2, { bonusStreakLimit: 3 });
    s = applyThrow(applyThrow(applyThrow(s, 4), 8), 4);
    expect(s.current).toBe(1);
    expect(s.pending).toEqual([]);
  });
});

describe('entering', () => {
  it('a piece enters on its home square only with a 4 or 8', () => {
    const s = setup(OFF, OFF, [4, 8, 2]);
    expect(targetIndex(s, 0, 0, 4)).toBe(0);
    expect(targetIndex(s, 0, 0, 8)).toBe(0);
    expect(targetIndex(s, 0, 0, 2)).toBeNull();
  });

  it('entry throws are configurable', () => {
    const s = setup(OFF, OFF, [1], { entryThrows: [1, 2, 3, 4, 8] });
    expect(targetIndex(s, 0, 0, 1)).toBe(0);
  });
});

describe('moving', () => {
  it('each throw is spent separately and can go to different pieces', () => {
    let s = setup([OFF_BOARD, OFF_BOARD, OFF_BOARD, OFF_BOARD], OFF, [4, 2]);
    s = applyMove(s, { piece: 0, throwValue: 4 }); // enter
    expect(s.players[0]!.pieces[0]).toBe(0);
    expect(s.pending).toEqual([2]);
    s = applyMove(s, { piece: 0, throwValue: 2 });
    expect(s.players[0]!.pieces[0]).toBe(2);
    expect(s.current).toBe(1); // throws used up
  });

  it('keeps circling the outer ring until the player has captured', () => {
    const s = setup([22, ...OFF.slice(1)], OFF, [3]);
    expect(targetIndex(s, 0, 0, 3)).toBe(1);
  });

  it('goes inside once the player has captured', () => {
    const s = setup([22, ...OFF.slice(1)], OFF, [3]);
    s.players[0]!.hasCaptured = true;
    expect(targetIndex(s, 0, 0, 3)).toBe(25);
  });

  it('by default keeps circling even when there is nothing to cut', () => {
    const s = setup([22, ...OFF.slice(1)], OFF, [3]);
    expect(s.rules.enterIfNothingToCut).toBe(false);
    expect(targetIndex(s, 0, 0, 3)).toBe(1);
  });

  describe('with "go inside when nothing to cut"', () => {
    const FREE: Partial<RuleConfig> = { enterIfNothingToCut: true };

    it('goes inside when no other piece is on the outer ring', () => {
      const s = setup([22, ...OFF.slice(1)], OFF, [3], FREE);
      expect(targetIndex(s, 0, 0, 3)).toBe(25);
    });

    it('keeps circling while an opponent stands on a plain outer square', () => {
      const s = setup([22, ...OFF.slice(1)], [5, ...OFF.slice(1)], [3], FREE);
      expect(board7.safe.has(board7.paths[1]![5]!)).toBe(false);
      expect(targetIndex(s, 0, 0, 3)).toBe(1);
    });

    it('goes inside when opponents on the outer ring are all on safe squares', () => {
      const s = setup([22, ...OFF.slice(1)], [0, ...OFF.slice(1)], [3], FREE); // 0 = their home
      expect(targetIndex(s, 0, 0, 3)).toBe(25);
    });

    it('goes inside when opponents are only on inner rings', () => {
      const s = setup([22, ...OFF.slice(1)], [30, ...OFF.slice(1)], [3], FREE);
      expect(targetIndex(s, 0, 0, 3)).toBe(25);
    });

    it('a teammate on the outer ring does not hold you back', () => {
      const s = createGame([{ team: 0 }, { team: 1 }, { team: 0 }, { team: 1 }], { ...SEVEN, ...FREE });
      const b = boardFor(s);
      s.players[0]!.pieces = [22, ...OFF.slice(1)];
      s.players[2]!.pieces = [b.paths[2]!.indexOf(b.paths[0]![10]!), ...OFF.slice(1)];
      expect(b.safe.has(b.paths[0]![10]!)).toBe(false);
      s.pending = [3];
      s.phase = 'move';
      expect(targetIndex(s, 0, 0, 3)).toBe(25);
    });

    it('a blocking pair cannot be cut, so it does not hold you back', () => {
      const s = setup([22, ...OFF.slice(1)], [5, 5, OFF_BOARD, OFF_BOARD], [3], { ...FREE, pairBlocks: true });
      expect(targetIndex(s, 0, 0, 3)).toBe(25);
    });
  });

  it('goes inside freely when the capture rule is off', () => {
    const s = setup([22, ...OFF.slice(1)], OFF, [3], { captureRequiredForInner: false });
    expect(targetIndex(s, 0, 0, 3)).toBe(25);
  });

  it('needs an exact throw to reach the centre', () => {
    const s = setup([45, ...OFF.slice(1)], OFF, [3, 4]);
    s.players[0]!.hasCaptured = true;
    expect(targetIndex(s, 0, 0, 3)).toBe(48);
    expect(targetIndex(s, 0, 0, 4)).toBeNull();
  });

  it('own pieces may share a square', () => {
    const s = setup([1, 3, OFF_BOARD, OFF_BOARD], OFF, [2]);
    expect(legalMoves(s).some((m) => m.piece === 0 && m.to === 3)).toBe(true);
  });

  it('rejects an illegal move', () => {
    const s = setup([1, ...OFF.slice(1)], OFF, [2]);
    expect(() => applyMove(s, { piece: 1, throwValue: 2 })).toThrow();
    expect(() => applyMove(s, { piece: 0, throwValue: 3 })).toThrow();
  });
});

describe('capturing', () => {
  // Seat 0 index 2 is (6,5): bottom row, not a corner or home, so unsafe.
  const target = idx(1, 6, 5);

  it('landing on an opponent sends it home, unlocks the inner rings and earns a throw', () => {
    let s = setup([0, ...OFF.slice(1)], [target, ...OFF.slice(1)], [2, 3]);
    s = applyMove(s, { piece: 0, throwValue: 2 });
    expect(s.players[1]!.pieces[0]).toBe(OFF_BOARD);
    expect(s.players[0]!.hasCaptured).toBe(true);
    expect(s.current).toBe(0);
    expect(s.phase).toBe('throw');
    expect(s.pending).toEqual([3]); // unused throw is kept
  });

  it('captures every opponent piece on the square', () => {
    let s = setup([0, ...OFF.slice(1)], [target, target, OFF_BOARD, OFF_BOARD], [2]);
    s = applyMove(s, { piece: 0, throwValue: 2 });
    expect(s.players[1]!.pieces.slice(0, 2)).toEqual([OFF_BOARD, OFF_BOARD]);
  });

  it('no capture on a safe square', () => {
    // Seat 0 index 3 is the bottom-right corner (6,6).
    const corner = idx(1, 6, 6);
    const s = setup([0, ...OFF.slice(1)], [corner, ...OFF.slice(1)], [3]);
    const m = legalMoves(s).find((x) => x.piece === 0)!;
    expect(m.captures).toEqual([]);
  });

  it('with the pair rule, two opponent pieces block the square', () => {
    const s = setup([0, ...OFF.slice(1)], [target, target, OFF_BOARD, OFF_BOARD], [2], { pairBlocks: true });
    expect(legalMoves(s)).toEqual([]);
  });
});

describe('winning', () => {
  it('the game ends when a player brings all four pieces to the centre', () => {
    let s = setup([48, 48, 48, 45], OFF, [3]);
    s.players[0]!.hasCaptured = true;
    s = applyMove(s, { piece: 3, throwValue: 3 });
    expect(s.phase).toBe('over');
    expect(s.finishOrder).toEqual([0]);
  });

  it('play continues for the other places when stopAtFirstWinner is off', () => {
    let s = createGame(3, { ...SEVEN, stopAtFirstWinner: false });
    s.players[0]!.pieces = [48, 48, 48, 45];
    s.players[0]!.hasCaptured = true;
    s.pending = [3];
    s.phase = 'move';
    s = applyMove(s, { piece: 3, throwValue: 3 });
    expect(s.phase).toBe('throw');
    expect(s.finishOrder).toEqual([0]);
    expect(s.current).toBe(1);
  });
});

describe('rules from the video (defaults)', () => {
  const board5 = boardFor(createGame(2));

  it('plays on a 5×5 board with every piece starting on its home square', () => {
    const s = createGame(2);
    expect(s.rules.boardSize).toBe(5);
    expect(s.players.map((p) => p.pieces)).toEqual([[0, 0, 0, 0], [0, 0, 0, 0]]);
  });

  it('any throw can move a piece from home', () => {
    const s = applyThrow(createGame(2), 1);
    expect(s.phase).toBe('move');
    expect(legalMoves(s).map((m) => m.to)).toContain(1);
  });

  it('only the four homes and the centre are safe', () => {
    expect([...board5.safe].sort((a, b) => a - b)).toEqual(
      [cellId(5, 0, 2), cellId(5, 2, 0), cellId(5, 2, 2), cellId(5, 2, 4), cellId(5, 4, 2)].sort((a, b) => a - b),
    );
  });

  it('a cut piece goes back to its home square, not off the board', () => {
    // Seat 0 index 1 is (4,3); put the opponent (seat 2) there.
    const victim = board5.paths[1]!.indexOf(board5.paths[0]![1]!);
    let s = createGame(2);
    s.players[1]!.pieces = [victim, 0, 0, 0];
    s.pending = [1];
    s.phase = 'move';
    s = applyMove(s, { piece: 0, throwValue: 1 });
    expect(s.players[1]!.pieces[0]).toBe(0);
    expect(s.players[0]!.hasCaptured).toBe(true);
  });

  it('must still cut before going inside', () => {
    const s = createGame(2);
    s.players[0]!.pieces = [15, 0, 0, 0]; // last outer square on 5×5
    s.pending = [2];
    s.phase = 'move';
    expect(targetIndex(s, 0, 0, 2)).toBe(1);
    s.players[0]!.hasCaptured = true;
    expect(targetIndex(s, 0, 0, 2)).toBe(17);
  });
});
