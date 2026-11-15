// Board geometry: the square grid, each player's path to the centre, and safe squares.
//
// Cells are numbered row-major: id = row * size + col, with row 0 at the top.
// Homes sit on the outer ring at one of 8 positions, numbered going anticlockwise
// round the board from the middle of the bottom edge:
//   0 bottom, 1 bottom-right corner, 2 right, 3 top-right, 4 top, 5 top-left, 6 left, 7 bottom-left.

export type BoardSize = 5 | 7 | 9;
export type CellId = number;

export const BOARD_SIZES: readonly BoardSize[] = [5, 7, 9];
export const HOME_POSITIONS = 8;

export interface PathOptions {
  /** Direction round the outer ring. The video plays anticlockwise. */
  outerClockwise: boolean;
  /** Each inner ring reverses direction from the one outside it. */
  alternateInner: boolean;
}

export const DEFAULT_PATH_OPTIONS: PathOptions = { outerClockwise: false, alternateInner: true };

export interface Board {
  size: BoardSize;
  /** One home per player, in player order. */
  homes: CellId[];
  /** paths[player][i] = cell for path index i. Index 0 is the player's home, the last index is the centre. */
  paths: CellId[][];
  /** Number of path squares on the outer ring (before the piece turns inward). */
  outerLength: number;
  /** Path index of the centre (finish). */
  finalIndex: number;
  centre: CellId;
  safe: ReadonlySet<CellId>;
}

export const cellId = (size: number, r: number, c: number): CellId => r * size + c;
export const cellRow = (size: number, id: CellId): number => Math.floor(id / size);
export const cellCol = (size: number, id: CellId): number => id % size;

/** Most players a board fits: the 5×5 board is too small for all 8 homes. */
export const maxPlayers = (size: BoardSize): number => (size === 5 ? 6 : 8);

/** The home square at one of the 8 positions (see top of file). */
export function homeCell(size: number, position: number): CellId {
  const n = size - 1;
  const m = n / 2;
  const rc: [number, number][] = [[n, m], [n, n], [m, n], [0, n], [0, m], [0, 0], [m, 0], [n, 0]];
  const [r, c] = rc[position]!;
  return cellId(size, r, c);
}

/**
 * Default home positions for a player count, in turn order. Up to 4 players use
 * the middle of the sides; more players also use corners, spread round the board.
 */
export function seatLayout(size: BoardSize, count: number): number[] {
  if (count < 2 || count > maxPlayers(size)) throw new Error(`${count} players don't fit a ${size}×${size} board`);
  const fixed: Record<number, number[]> = { 2: [0, 4], 3: [0, 2, 4], 4: [0, 2, 4, 6] };
  return fixed[count] ?? Array.from({ length: count }, (_, i) => Math.round((i * HOME_POSITIONS) / count));
}

/** Cells of ring k (0 = outermost), in clockwise order starting at the ring's top-left corner. */
export function ringClockwise(size: number, k: number): CellId[] {
  const lo = k;
  const hi = size - 1 - k;
  if (lo === hi) return [cellId(size, lo, lo)];
  const out: CellId[] = [];
  for (let c = lo; c <= hi; c++) out.push(cellId(size, lo, c));
  for (let r = lo + 1; r <= hi; r++) out.push(cellId(size, r, hi));
  for (let c = hi - 1; c >= lo; c--) out.push(cellId(size, hi, c));
  for (let r = hi - 1; r > lo; r--) out.push(cellId(size, r, lo));
  return out;
}

/** The square one ring further in. From a corner that is the inner ring's corner (a diagonal step). */
function inwardNeighbour(size: number, k: number, id: CellId): CellId {
  const r = cellRow(size, id);
  const c = cellCol(size, id);
  const lo = k;
  const hi = size - 1 - k;
  const dr = r === lo ? 1 : r === hi ? -1 : 0;
  const dc = c === lo ? 1 : c === hi ? -1 : 0;
  return cellId(size, r + dr, c + dc);
}

/**
 * A player's path from their home: round the outer ring to the square before home,
 * step inward, round that ring, and so on, finishing on the centre square.
 */
export function playerPath(size: number, home: CellId, opts: PathOptions = DEFAULT_PATH_OPTIONS): CellId[] {
  const mid = (size - 1) / 2;
  const outerStep = opts.outerClockwise ? 1 : -1;
  const path: CellId[] = [];
  let start = home;
  for (let k = 0; k <= mid; k++) {
    const ring = ringClockwise(size, k);
    if (ring.length === 1) {
      path.push(ring[0]!);
      break;
    }
    const startIdx = ring.indexOf(start);
    if (startIdx < 0) throw new Error(`path start ${start} is not on ring ${k}`);
    const step = opts.alternateInner && k % 2 === 1 ? -outerStep : outerStep;
    for (let i = 0; i < ring.length; i++) {
      path.push(ring[(startIdx + step * i + ring.length) % ring.length]!);
    }
    start = inwardNeighbour(size, k, path[path.length - 1]!);
  }
  return path;
}

/**
 * Default crossed squares: the middle of each side and the centre (as drawn in the
 * video). Bigger boards also cross their four outer corners.
 */
export function defaultSafeCells(size: BoardSize): CellId[] {
  const sides = [0, 2, 4, 6].map((p) => homeCell(size, p));
  const centre = cellId(size, (size - 1) / 2, (size - 1) / 2);
  const corners = size === 5 ? [] : [1, 3, 5, 7].map((p) => homeCell(size, p));
  return [...sides, centre, ...corners];
}

/**
 * Build the board for a set of homes (default: the four sides). Every home and the
 * centre are always safe, on top of the chosen safe squares.
 */
export function createBoard(
  size: BoardSize,
  homes: CellId[] = [0, 2, 4, 6].map((p) => homeCell(size, p)),
  opts: PathOptions & { safeCells?: readonly CellId[] } = DEFAULT_PATH_OPTIONS,
): Board {
  const mid = (size - 1) / 2;
  const centre = cellId(size, mid, mid);
  const paths = homes.map((h) => playerPath(size, h, opts));
  return {
    size,
    homes,
    paths,
    outerLength: 4 * (size - 1),
    finalIndex: size * size - 1,
    centre,
    safe: new Set([...(opts.safeCells ?? defaultSafeCells(size)), ...homes, centre]),
  };
}
