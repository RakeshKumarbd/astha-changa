// Computer opponent.
//   easy   — any legal move at random
//   medium — scores each move on its own: capture, finish, enter, reach safety, avoid danger
//   hard   — plays out every order of its remaining throws and scores the resulting position,
//            weighing how likely each piece is to be cut on the next throw

import { throwOdds, type Rng } from '../core/cowrie';
import { applyMove, legalMoves, targetIndex, type Move } from '../core/rules';
import { OFF_BOARD, boardFor, pieceCell, sameTeam, teamRanking, type GameState } from '../core/state';

export type BotLevel = 'easy' | 'medium' | 'hard';

const oddsCache = new Map<string, [number, number][]>();

/** Chance of each move value under these rules (fair shells). */
function oddsFor(state: GameState): [number, number][] {
  const key = `${state.rules.cowries}:${state.rules.throwTable.join(',')}`;
  let odds = oddsCache.get(key);
  if (!odds) oddsCache.set(key, (odds = throwOdds(state.rules)));
  return odds;
}

/** Chance that some other team can land on this piece with their next single throw. */
export function pieceDanger(state: GameState, player: number, piece: number): number {
  const board = boardFor(state);
  const cell = pieceCell(state, player, piece);
  if (cell === null || board.safe.has(cell)) return 0;
  let miss = 1;
  state.players.forEach((op, oi) => {
    if (sameTeam(state, oi, player) || state.finishOrder.includes(oi)) return;
    op.pieces.forEach((_, k) => {
      let hit = 0;
      for (const [v, p] of oddsFor(state)) {
        const t = targetIndex(state, oi, k, v);
        if (t !== null && board.paths[oi]![t] === cell) hit += p;
      }
      miss *= 1 - Math.min(1, hit);
    });
  });
  return 1 - miss;
}

/** Two moves are interchangeable if the same throw moves a piece from the same spot. */
function distinctMoves(moves: Move[]): Move[] {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${m.from}:${m.throwValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreMoveMedium(state: GameState, m: Move): number {
  const board = boardFor(state);
  const after = applyMove(state, m);
  const cell = board.paths[m.player]![m.to]!;
  let score = m.to * 0.5;
  score += m.captures.length * 100;
  if (m.to === board.finalIndex) score += 80;
  if (m.from === OFF_BOARD) score += 45;
  if (board.safe.has(cell)) score += 25;
  if (m.from !== OFF_BOARD) score += pieceDanger(state, m.player, m.piece) * 30;
  score -= pieceDanger(after, m.player, m.piece) * 60;
  return score;
}

function pieceValue(state: GameState, index: number): number {
  if (index === OFF_BOARD) return 0;
  return 10 + index + (index === boardFor(state).finalIndex ? 20 : 0);
}

function playerScore(state: GameState, player: number): number {
  const p = state.players[player]!;
  let score = p.hasCaptured ? 15 : 0;
  p.pieces.forEach((idx, k) => {
    const v = pieceValue(state, idx);
    score += v - pieceDanger(state, player, k) * v;
  });
  return score;
}

const teamScore = (state: GameState, team: number): number =>
  state.players.reduce((sum, p, i) => sum + (p.team === team ? playerScore(state, i) : 0), 0);

/** Position value from `me`'s team's point of view. */
export function evaluate(state: GameState, me: number): number {
  const myTeam = state.players[me]!.team;
  const ranking = teamRanking(state);
  if (ranking[0] === myTeam) return 1e6;
  if (state.phase === 'over') return -1e6;
  const others = [...new Set(state.players.map((p) => p.team))].filter((t) => t !== myTeam && !ranking.includes(t));
  const opp = others.reduce((sum, t) => sum + teamScore(state, t), 0) / Math.max(1, others.length);
  const extraThrow = state.current === me && state.phase === 'throw' ? 8 : 0;
  return teamScore(state, myTeam) - opp + extraThrow;
}

/** Best value reachable by spending the rest of this turn's throws. */
function bestLine(state: GameState, me: number): number {
  if (state.phase !== 'move' || state.current !== me) return evaluate(state, me);
  let best = -Infinity;
  for (const m of distinctMoves(legalMoves(state))) best = Math.max(best, bestLine(applyMove(state, m), me));
  return best;
}

export function chooseMove(state: GameState, level: BotLevel, rng: Rng): Move {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('bot asked to move with no legal moves');
  if (level === 'easy') return moves[Math.floor(rng() * moves.length)]!;

  const candidates = distinctMoves(moves);
  const score =
    level === 'medium'
      ? (m: Move) => scoreMoveMedium(state, m)
      : (m: Move) => bestLine(applyMove(state, m), state.current);
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const m of candidates) {
    const s = score(m) + rng() * 1e-3; // tiny jitter breaks ties without changing real preferences
    if (s > bestScore) {
      best = m;
      bestScore = s;
    }
  }
  return best;
}
