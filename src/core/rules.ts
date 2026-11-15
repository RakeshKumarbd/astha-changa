// Turn flow and move rules. Every function here is pure: it returns a new state.
//
// A turn: throw → (a bonus result means throw again) → spend each throw on a move,
// in any order and on any pieces → a cut may earn one more throw → the turn
// passes when no throws are left or none of them can be used.

import {
  OFF_BOARD,
  boardFor,
  hasFinished,
  pieceCell,
  sameTeam,
  teamRanking,
  type GameState,
} from './state';

export interface PieceRef {
  player: number;
  piece: number;
}

export interface Move {
  player: number;
  piece: number;
  throwValue: number;
  from: number;
  to: number;
  captures: PieceRef[];
}

export const isBonus = (state: GameState, value: number): boolean => state.rules.bonusThrows.includes(value);

/** Path index a piece would reach with this throw, ignoring other pieces; null if it cannot move. */
export function targetIndex(state: GameState, player: number, piece: number, steps: number): number | null {
  const { rules } = state;
  const board = boardFor(state);
  const p = state.players[player]!;
  const from = p.pieces[piece]!;

  if (from === OFF_BOARD) return rules.entryThrows.includes(steps) ? 0 : null;
  if (from === board.finalIndex) return null;

  let to = from + steps;
  if (rules.captureRequiredForInner && !p.hasCaptured && from < board.outerLength && to >= board.outerLength) {
    to %= board.outerLength; // not allowed inside yet: keep circling the outer ring
  }
  if (to > board.finalIndex) return rules.exactFinish ? null : board.finalIndex;
  return to;
}

/** Pieces of other teams standing on a cell, grouped by player. */
function opponentsOn(state: GameState, player: number, cell: number): Map<number, number[]> {
  const found = new Map<number, number[]>();
  state.players.forEach((p, pi) => {
    if (sameTeam(state, pi, player)) return;
    p.pieces.forEach((_, k) => {
      if (pieceCell(state, pi, k) !== cell) return;
      found.set(pi, [...(found.get(pi) ?? []), k]);
    });
  });
  return found;
}

function moveFor(state: GameState, player: number, piece: number, throwValue: number): Move | null {
  const to = targetIndex(state, player, piece, throwValue);
  if (to === null) return null;
  const board = boardFor(state);
  const cell = board.paths[player]![to]!;
  const captures: PieceRef[] = [];
  if (!board.safe.has(cell)) {
    const opponents = opponentsOn(state, player, cell);
    if (state.rules.pairBlocks) {
      const perTeam = new Map<number, number>();
      for (const [op, pieces] of opponents) {
        const team = state.players[op]!.team;
        perTeam.set(team, (perTeam.get(team) ?? 0) + pieces.length);
      }
      if ([...perTeam.values()].some((n) => n >= 2)) return null;
    }
    for (const [op, pieces] of opponents) for (const k of pieces) captures.push({ player: op, piece: k });
  }
  return { player, piece, throwValue, from: state.players[player]!.pieces[piece]!, to, captures };
}

/** Every move the current player may make with their unused throws. */
export function legalMoves(state: GameState): Move[] {
  if (state.phase !== 'move') return [];
  const player = state.current;
  const moves: Move[] = [];
  for (const v of new Set(state.pending)) {
    state.players[player]!.pieces.forEach((_, piece) => {
      const m = moveFor(state, player, piece, v);
      if (m) moves.push(m);
    });
  }
  return moves;
}

function nextPlayer(state: GameState): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (state.current + step) % n;
    if (!state.finishOrder.includes(i)) return i;
  }
  return state.current;
}

function endTurn(s: GameState): GameState {
  s.pending = [];
  s.bonusStreak = 0;
  s.current = nextPlayer(s);
  s.phase = 'throw';
  return s;
}

/** In the move phase, pass the turn if none of the remaining throws can be used. */
function settle(s: GameState): GameState {
  return legalMoves(s).length === 0 ? endTurn(s) : s;
}

export function applyThrow(state: GameState, value: number): GameState {
  if (state.phase !== 'throw') throw new Error(`cannot throw during ${state.phase} phase`);
  const s = structuredClone(state);
  s.pending.push(value);
  if (isBonus(s, value)) {
    s.bonusStreak++;
    if (s.rules.bonusStreakLimit !== null && s.bonusStreak >= s.rules.bonusStreakLimit) return endTurn(s);
    return s; // throw again before moving
  }
  s.phase = 'move';
  return settle(s);
}

/** Teams that still have a player with pieces left to bring home. */
function teamsStillPlaying(s: GameState): number[] {
  return [...new Set(s.players.filter((_, i) => !s.finishOrder.includes(i)).map((p) => p.team))];
}

export function applyMove(state: GameState, choice: { piece: number; throwValue: number }): GameState {
  const move = legalMoves(state).find((m) => m.piece === choice.piece && m.throwValue === choice.throwValue);
  if (!move) throw new Error(`illegal move: piece ${choice.piece} by ${choice.throwValue}`);

  const s = structuredClone(state);
  const player = s.players[move.player]!;
  player.pieces[move.piece] = move.to;
  s.pending.splice(s.pending.indexOf(move.throwValue), 1);
  const sentTo = s.rules.captureSendsHome ? 0 : OFF_BOARD;
  for (const c of move.captures) s.players[c.player]!.pieces[c.piece] = sentTo;
  if (move.captures.length > 0) player.hasCaptured = true;

  if (hasFinished(s, move.player)) {
    s.finishOrder.push(move.player);
    const teamDone = teamRanking(s).includes(player.team);
    const left = teamsStillPlaying(s);
    if ((s.rules.stopAtFirstWinner && teamDone) || left.length <= 1) {
      if (!s.rules.stopAtFirstWinner) {
        s.finishOrder.push(...s.players.map((_, i) => i).filter((i) => !s.finishOrder.includes(i)));
      }
      s.pending = [];
      s.phase = 'over';
      return s;
    }
    return endTurn(s);
  }

  if (move.captures.length > 0 && s.rules.captureGivesThrow) {
    s.phase = 'throw'; // a cut earns another throw; unused throws are kept
    return s;
  }
  return s.pending.length === 0 ? endTurn(s) : settle(s);
}

/** The winning team, or null while the game is on. */
export function winningTeam(state: GameState): number | null {
  return teamRanking(state)[0] ?? null;
}
