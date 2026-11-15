// Game state, rule options and setup.

import {
  BOARD_SIZES,
  createBoard,
  homeCell,
  maxPlayers,
  seatLayout,
  type Board,
  type BoardSize,
  type CellId,
} from './board';
import { MAX_COWRIES, MIN_COWRIES, defaultThrowTable } from './cowrie';

/** Piece position: OFF_BOARD while waiting to enter, otherwise an index into the player's path. */
export const OFF_BOARD = -1;
export const MIN_PIECES = 2;
export const MAX_PIECES = 6;
export const RULES_VERSION = 2;

export interface RuleConfig {
  rulesVersion: number;
  boardSize: BoardSize;
  /** Crossed squares; undefined = the board's default. Homes and the centre are always safe too. */
  safeCells?: CellId[];
  outerClockwise: boolean;
  alternateInner: boolean;
  piecesPerPlayer: number;
  /** Pieces begin on their home square; otherwise they wait off the board until an entry throw. */
  startOnHome: boolean;
  /** Throws that bring a waiting piece onto its home square. Entering uses up the throw. */
  entryThrows: number[];
  cowries: number;
  /** throwTable[k] = squares to move when k shells land open. */
  throwTable: number[];
  /** Results that give another throw. */
  bonusThrows: number[];
  /** That many bonus throws in a row forfeit the turn; null = no limit. */
  bonusStreakLimit: number | null;
  /** A player must cut once before their pieces may leave the outer ring; until then they keep circling. */
  captureRequiredForInner: boolean;
  /** With captureRequiredForInner: if no other team has a piece on the outer ring that could be cut, go inside anyway. */
  enterIfNothingToCut: boolean;
  /** A cut piece goes back to its home square; otherwise off the board. */
  captureSendsHome: boolean;
  captureGivesThrow: boolean;
  /** Two or more of one team's pieces on an unsafe square block other teams from landing there. */
  pairBlocks: boolean;
  /** Reaching the centre needs the exact number; otherwise extra steps are wasted. */
  exactFinish: boolean;
  /** End the game when the first team finishes; otherwise play on for the other places. */
  stopAtFirstWinner: boolean;
}

/** The rules from the reference video. */
export const DEFAULT_RULES: RuleConfig = {
  rulesVersion: RULES_VERSION,
  boardSize: 5,
  outerClockwise: false,
  alternateInner: true,
  piecesPerPlayer: 4,
  startOnHome: true,
  entryThrows: [4, 8],
  cowries: 4,
  throwTable: defaultThrowTable(4),
  bonusThrows: [4, 8],
  bonusStreakLimit: null,
  captureRequiredForInner: true,
  enterIfNothingToCut: false,
  captureSendsHome: true,
  captureGivesThrow: true,
  pairBlocks: false,
  exactFinish: true,
  stopAtFirstWinner: true,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const intIn = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const intList = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => Number.isInteger(x));

/**
 * Turn anything that looks like rules (an old save, an imported code, a partial
 * override) into a full RuleConfig, falling back to the defaults field by field.
 * Version-1 rules (before this format) had pieces waiting off the board unless
 * `startOnHome` was set, and `threeBonusForfeit` instead of a streak limit.
 */
export function migrateRules(raw: unknown): RuleConfig {
  const r = isObj(raw) ? raw : {};
  const v1 = r.rulesVersion === undefined && Object.keys(r).length > 0 && 'entryThrows' in r;
  const out: RuleConfig = structuredClone(DEFAULT_RULES);
  const bool = (k: keyof RuleConfig) => {
    if (typeof r[k] === 'boolean') (out[k] as boolean) = r[k] as boolean;
  };

  if (BOARD_SIZES.includes(r.boardSize as BoardSize)) out.boardSize = r.boardSize as BoardSize;
  const cells = out.boardSize * out.boardSize;
  if (intList(r.safeCells) && r.safeCells.every((c) => c >= 0 && c < cells)) out.safeCells = [...r.safeCells];
  (['outerClockwise', 'alternateInner', 'startOnHome', 'captureRequiredForInner', 'enterIfNothingToCut',
    'captureSendsHome', 'captureGivesThrow', 'pairBlocks', 'exactFinish', 'stopAtFirstWinner'] as const).forEach(bool);
  if (intIn(r.piecesPerPlayer, MIN_PIECES, MAX_PIECES)) out.piecesPerPlayer = r.piecesPerPlayer;
  if (intIn(r.cowries, MIN_COWRIES, MAX_COWRIES)) {
    out.cowries = r.cowries;
    out.throwTable = defaultThrowTable(r.cowries);
    out.bonusThrows = [r.cowries, 2 * r.cowries];
  }
  if (intList(r.throwTable) && r.throwTable.length === out.cowries + 1) out.throwTable = [...r.throwTable];
  if (intList(r.bonusThrows)) out.bonusThrows = [...r.bonusThrows];
  if (intList(r.entryThrows)) out.entryThrows = [...r.entryThrows];
  if (r.bonusStreakLimit === null || intIn(r.bonusStreakLimit, 2, 10)) out.bonusStreakLimit = r.bonusStreakLimit as number | null;

  if (v1) {
    if (r.startOnHome === undefined) out.startOnHome = false;
    out.captureSendsHome = out.startOnHome;
    if (r.threeBonusForfeit === true) out.bonusStreakLimit = 3;
  }
  out.rulesVersion = RULES_VERSION;
  return out;
}

export interface PlayerSpec {
  name?: string;
  /** Colour/seed index 0–7. */
  color?: number;
  /** Home position 0–7 (see board.ts). */
  position?: number;
  /** Players with the same team number win together and never cut each other. */
  team?: number;
}

export interface PlayerState {
  name: string;
  color: number;
  position: number;
  home: CellId;
  team: number;
  /** Path index per piece, or OFF_BOARD. */
  pieces: number[];
  hasCaptured: boolean;
}

export type Phase = 'throw' | 'move' | 'over';

export interface GameState {
  rules: RuleConfig;
  /** In turn order. */
  players: PlayerState[];
  /** Index into players of whose turn it is. */
  current: number;
  phase: Phase;
  /** Throws made this turn that have not been used yet. */
  pending: number[];
  /** Consecutive bonus throws this turn. */
  bonusStreak: number;
  /** Player indices in the order they finished. */
  finishOrder: number[];
}

/** Default colour for each home position: sides get red, green, gold, black; corners the other four. */
export const COLOR_FOR_POSITION = [0, 4, 1, 5, 2, 6, 3, 7];

/** Players are given in turn order; anything left out of a spec gets a sensible default. */
export function createGame(players: number | PlayerSpec[], rules: Partial<RuleConfig> = {}): GameState {
  const full = migrateRules({ ...DEFAULT_RULES, ...rules });
  const specs: PlayerSpec[] = typeof players === 'number' ? Array.from({ length: players }, () => ({})) : players;
  if (specs.length < 2 || specs.length > maxPlayers(full.boardSize)) {
    throw new Error(`${specs.length} players don't fit a ${full.boardSize}×${full.boardSize} board`);
  }
  const layout = seatLayout(full.boardSize, specs.length);
  const positions = specs.map((s, i) => s.position ?? layout[i]!);
  if (new Set(positions).size !== positions.length) throw new Error('two players share a home');
  const start = full.startOnHome ? 0 : OFF_BOARD;
  return {
    rules: full,
    players: specs.map((s, i) => ({
      name: s.name ?? '',
      color: s.color ?? COLOR_FOR_POSITION[positions[i]!]!,
      position: positions[i]!,
      home: homeCell(full.boardSize, positions[i]!),
      team: s.team ?? 100 + i,
      pieces: Array<number>(full.piecesPerPlayer).fill(start),
      hasCaptured: false,
    })),
    current: 0,
    phase: 'throw',
    pending: [],
    bonusStreak: 0,
    finishOrder: [],
  };
}

/**
 * Bring a saved game from an older version up to date: old saves stored a `seat`
 * (0–3, one per side) instead of a home position, colour and team.
 */
export function migrateGame(raw: GameState): GameState {
  const s = structuredClone(raw);
  s.rules = migrateRules(raw.rules);
  s.players = s.players.map((p, i) => {
    const old = p as PlayerState & { seat?: number };
    if (old.seat === undefined) return p;
    const position = old.seat * 2;
    return {
      name: '',
      color: old.seat,
      position,
      home: homeCell(s.rules.boardSize, position),
      team: 100 + i,
      pieces: old.pieces,
      hasCaptured: old.hasCaptured,
    };
  });
  return s;
}

const boardCache = new Map<string, Board>();

export function boardFor(state: Pick<GameState, 'rules' | 'players'>): Board {
  const { rules } = state;
  const homes = state.players.map((p) => p.home);
  const key = [rules.boardSize, rules.outerClockwise, rules.alternateInner, rules.safeCells?.join(',') ?? '', homes.join(',')].join('|');
  let board = boardCache.get(key);
  if (!board) {
    board = createBoard(rules.boardSize, homes, {
      outerClockwise: rules.outerClockwise,
      alternateInner: rules.alternateInner,
      safeCells: rules.safeCells,
    });
    boardCache.set(key, board);
  }
  return board;
}

/** Board cell a piece stands on, or null when it is off the board. */
export function pieceCell(state: GameState, player: number, piece: number): CellId | null {
  const idx = state.players[player]!.pieces[piece]!;
  return idx === OFF_BOARD ? null : boardFor(state).paths[player]![idx]!;
}

export function hasFinished(state: GameState, player: number): boolean {
  const final = boardFor(state).finalIndex;
  return state.players[player]!.pieces.every((i) => i === final);
}

export const sameTeam = (state: GameState, a: number, b: number): boolean => state.players[a]!.team === state.players[b]!.team;

/** Teams in the order they completed (every member finished). */
export function teamRanking(state: GameState): number[] {
  const done: number[] = [];
  state.finishOrder.forEach((p, idx) => {
    const team = state.players[p]!.team;
    if (done.includes(team)) return;
    const finishedSoFar = state.finishOrder.slice(0, idx + 1);
    const members = state.players.map((x, i) => (x.team === team ? i : -1)).filter((i) => i >= 0);
    if (members.every((m) => finishedSoFar.includes(m))) done.push(team);
  });
  return done;
}
