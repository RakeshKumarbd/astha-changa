import { describe, expect, it } from 'vitest';
import { cellCol, cellId, cellRow, createBoard, type BoardSize } from '../src/core/board';

describe.each([5, 7] as BoardSize[])('board size %i', (size) => {
  const board = createBoard(size);
  const mid = (size - 1) / 2;

  it('every seat path visits each square exactly once and ends on the centre', () => {
    for (const path of board.paths) {
      expect(path).toHaveLength(size * size);
      expect(new Set(path).size).toBe(size * size);
      expect(path[path.length - 1]).toBe(board.centre);
    }
    expect(board.finalIndex).toBe(size * size - 1);
    expect(board.outerLength).toBe(4 * (size - 1));
  });

  it('paths move one square at a time (the step onto the centre may be diagonal)', () => {
    for (const path of board.paths) {
      for (let i = 1; i < path.length; i++) {
        const dr = Math.abs(cellRow(size, path[i]!) - cellRow(size, path[i - 1]!));
        const dc = Math.abs(cellCol(size, path[i]!) - cellCol(size, path[i - 1]!));
        if (i === path.length - 1) expect(Math.max(dr, dc)).toBe(1);
        else expect(dr + dc).toBe(1);
      }
    }
  });

  it('homes are the middle of each side: bottom, right, top, left', () => {
    expect(board.homes).toEqual([
      cellId(size, size - 1, mid),
      cellId(size, mid, size - 1),
      cellId(size, 0, mid),
      cellId(size, mid, 0),
    ]);
  });

  it('the outer ring is covered before turning inward', () => {
    const outer = board.paths[0]!.slice(0, board.outerLength);
    for (const id of outer) {
      const r = cellRow(size, id);
      const c = cellCol(size, id);
      expect(r === 0 || c === 0 || r === size - 1 || c === size - 1).toBe(true);
    }
  });

  it('default safe squares are the homes and centre, plus the outer corners on 7×7', () => {
    expect(board.safe.size).toBe(size === 5 ? 5 : 9);
    for (const h of board.homes) expect(board.safe.has(h)).toBe(true);
    expect(board.safe.has(board.centre)).toBe(true);
    expect(board.safe.has(cellId(size, 0, 0))).toBe(size === 7);
  });
});

describe('7×7 seat 0 path directions', () => {
  const p = createBoard(7).paths[0]!;
  const at = (i: number) => [cellRow(7, p[i]!), cellCol(7, p[i]!)];

  it('goes anticlockwise round the outer ring (right along the bottom first)', () => {
    expect(at(0)).toEqual([6, 3]);
    expect(at(1)).toEqual([6, 4]);
    expect(at(3)).toEqual([6, 6]);
    expect(at(4)).toEqual([5, 6]);
    expect(at(23)).toEqual([6, 2]);
  });

  it('then steps in and goes clockwise round the second ring', () => {
    expect(at(24)).toEqual([5, 2]);
    expect(at(25)).toEqual([5, 1]);
    expect(at(26)).toEqual([4, 1]);
    expect(at(39)).toEqual([5, 3]);
  });

  it('then anticlockwise round the third ring into the centre', () => {
    expect(at(40)).toEqual([4, 3]);
    expect(at(41)).toEqual([4, 4]);
    expect(at(48)).toEqual([3, 3]);
  });
});
