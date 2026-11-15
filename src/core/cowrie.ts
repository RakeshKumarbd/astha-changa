// Throwing cowrie shells. The rule set's throw table says how far each count of
// open (mouth-up) shells moves. In the video, with 4 shells: 1–3 open move that
// many squares, all four open is 8 ("ashta") and all four closed is 4 ("changa").

export type Rng = () => number;

export interface CowrieThrow {
  /** true = shell landed open (mouth up). */
  shells: boolean[];
  value: number;
}

export interface ThrowRules {
  cowries: number;
  /** throwTable[k] = squares to move when k shells land open. */
  throwTable: number[];
}

export const MIN_COWRIES = 2;
export const MAX_COWRIES = 7;

/** k open → k squares; none open → n; all open → 2n. For 4 shells: 4, 1, 2, 3, 8. */
export function defaultThrowTable(cowries: number): number[] {
  return Array.from({ length: cowries + 1 }, (_, k) => (k === 0 ? cowries : k === cowries ? 2 * cowries : k));
}

export function valueFromShells(shells: readonly boolean[], table: readonly number[]): number {
  return table[shells.filter(Boolean).length]!;
}

export function throwCowries(rng: Rng, rules: ThrowRules): CowrieThrow {
  const shells = Array.from({ length: rules.cowries }, () => rng() < 0.5);
  return { shells, value: valueFromShells(shells, rules.throwTable) };
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Chance of each open-shell count with fair shells: C(n, k) / 2^n. */
export const openCountOdds = (cowries: number): number[] =>
  Array.from({ length: cowries + 1 }, (_, k) => choose(cowries, k) / 2 ** cowries);

/** Chance of each distinct move value (values shared by several counts are added up). */
export function throwOdds(rules: ThrowRules): [number, number][] {
  const odds = new Map<number, number>();
  openCountOdds(rules.cowries).forEach((p, k) => {
    const v = rules.throwTable[k]!;
    odds.set(v, (odds.get(v) ?? 0) + p);
  });
  return [...odds].sort((a, b) => a[0] - b[0]);
}

/** Small seedable PRNG (mulberry32) so games and tests can be replayed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
