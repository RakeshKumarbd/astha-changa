import { describe, expect, it } from 'vitest';
import { defaultThrowTable, openCountOdds, seededRng, throwCowries, throwOdds, valueFromShells } from '../src/core/cowrie';

const FOUR = { cowries: 4, throwTable: defaultThrowTable(4) };

describe('cowrie throws', () => {
  it('counts open shells; all open = 8 (Ashta), all closed = 4 (Changa)', () => {
    expect(valueFromShells([true, false, false, false], FOUR.throwTable)).toBe(1);
    expect(valueFromShells([true, true, false, false], FOUR.throwTable)).toBe(2);
    expect(valueFromShells([true, true, true, false], FOUR.throwTable)).toBe(3);
    expect(valueFromShells([true, true, true, true], FOUR.throwTable)).toBe(8);
    expect(valueFromShells([false, false, false, false], FOUR.throwTable)).toBe(4);
  });

  it('default table for 4 shells matches the video', () => {
    expect(defaultThrowTable(4)).toEqual([4, 1, 2, 3, 8]);
    expect(defaultThrowTable(2)).toEqual([2, 1, 4]);
  });

  it('odds follow the binomial counts and merge equal moves', () => {
    expect(openCountOdds(4).map((p) => p * 16)).toEqual([1, 4, 6, 4, 1]);
    const merged = throwOdds({ cowries: 2, throwTable: [1, 1, 3] });
    expect(merged).toEqual([[1, 0.75], [3, 0.25]]);
  });

  it('throws use the number of shells in the rules', () => {
    const t = throwCowries(seededRng(3), { cowries: 7, throwTable: defaultThrowTable(7) });
    expect(t.shells).toHaveLength(7);
  });

  it('seeded throws repeat exactly', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 50; i++) expect(throwCowries(a, FOUR)).toEqual(throwCowries(b, FOUR));
  });

  it('matches the expected odds (1:4, 2:6, 3:4, 4:1, 8:1 out of 16)', () => {
    const rng = seededRng(7);
    const n = 160_000;
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 8: 0 };
    for (let i = 0; i < n; i++) counts[throwCowries(rng, FOUR).value]!++;
    const expected: Record<number, number> = { 1: 4, 2: 6, 3: 4, 4: 1, 8: 1 };
    for (const v of [1, 2, 3, 4, 8]) expect(counts[v]! / n).toBeCloseTo(expected[v]! / 16, 2);
  });
});
