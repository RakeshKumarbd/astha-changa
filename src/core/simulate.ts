// Plays quick random games under a rule set, to check that games can actually finish.

import { seededRng, throwCowries, type Rng } from './cowrie';
import { applyMove, applyThrow, legalMoves } from './rules';
import { createGame, type GameState, type PlayerSpec, type RuleConfig } from './state';

export interface RandomGame {
  state: GameState;
  /** Number of times the turn passed to another player. */
  turns: number;
  finished: boolean;
}

export function playRandomGame(
  players: number | PlayerSpec[],
  rules: Partial<RuleConfig>,
  rng: Rng,
  maxActions = 50_000,
  onStep?: (s: GameState) => void,
): RandomGame {
  let s = createGame(players, rules);
  let turns = 0;
  for (let n = 0; n < maxActions && s.phase !== 'over'; n++) {
    const before = s.current;
    if (s.phase === 'throw') {
      s = applyThrow(s, throwCowries(rng, s.rules).value);
    } else {
      const moves = legalMoves(s);
      s = applyMove(s, moves[Math.floor(rng() * moves.length)]!);
    }
    if (s.current !== before) turns++;
    onStep?.(s);
  }
  return { state: s, turns, finished: s.phase === 'over' };
}

export interface SimulationReport {
  games: number;
  finished: number;
  /** Average turns per finished game (each player's turn counts once). */
  averageTurns: number;
}

/**
 * Play `games` random games one at a time, yielding between games so a page stays
 * responsive. Random play is a rough guide: real players finish faster.
 */
export async function simulate(
  players: number | PlayerSpec[],
  rules: Partial<RuleConfig>,
  games = 30,
  seed = 1,
): Promise<SimulationReport> {
  let finished = 0;
  let turns = 0;
  for (let g = 0; g < games; g++) {
    const r = playRandomGame(players, rules, seededRng(seed + g), 20_000);
    if (r.finished) {
      finished++;
      turns += r.turns;
    }
    await new Promise((res) => setTimeout(res, 0));
  }
  return { games, finished, averageTurns: finished ? Math.round(turns / finished) : 0 };
}
