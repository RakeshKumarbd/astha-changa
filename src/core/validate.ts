// Checks a rule set before it is saved or played. Errors make a game impossible
// or endless; warnings point at rules that are legal but probably unintended.

import { maxPlayers } from './board';
import { MAX_COWRIES, MIN_COWRIES, throwOdds } from './cowrie';
import { MAX_PIECES, MIN_PIECES, type RuleConfig } from './state';

export type ProblemCode =
  | 'cowries'
  | 'pieces'
  | 'tableLength'
  | 'badMove'
  | 'allBonus'
  | 'noEntry'
  | 'unreachableCentre'
  | 'streak'
  | 'tooManyPlayers'
  | 'noBonus'
  | 'slowEntry';

export interface Problem {
  level: 'error' | 'warning';
  code: ProblemCode;
  /** The rule the problem belongs to, so an editor can show it next to that field. */
  field: keyof RuleConfig | 'players';
  vars?: Record<string, number | string>;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function validateRules(rules: RuleConfig, playerCount?: number): Problem[] {
  const out: Problem[] = [];
  const err = (code: ProblemCode, field: Problem['field'], vars?: Problem['vars']) => out.push({ level: 'error', code, field, vars });
  const warn = (code: ProblemCode, field: Problem['field'], vars?: Problem['vars']) => out.push({ level: 'warning', code, field, vars });

  if (!(rules.cowries >= MIN_COWRIES && rules.cowries <= MAX_COWRIES)) err('cowries', 'cowries', { min: MIN_COWRIES, max: MAX_COWRIES });
  if (!(rules.piecesPerPlayer >= MIN_PIECES && rules.piecesPerPlayer <= MAX_PIECES)) {
    err('pieces', 'piecesPerPlayer', { min: MIN_PIECES, max: MAX_PIECES });
  }
  if (playerCount !== undefined && playerCount > maxPlayers(rules.boardSize)) {
    err('tooManyPlayers', 'players', { max: maxPlayers(rules.boardSize), size: rules.boardSize });
  }
  if (rules.throwTable.length !== rules.cowries + 1) {
    err('tableLength', 'throwTable');
    return out; // the checks below read the table
  }

  const finalIndex = rules.boardSize * rules.boardSize - 1;
  const values = [...new Set(rules.throwTable)];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > finalIndex)) err('badMove', 'throwTable', { max: finalIndex });

  const bonus = values.filter((v) => rules.bonusThrows.includes(v));
  if (bonus.length === values.length) err('allBonus', 'bonusThrows');
  else if (bonus.length === 0) warn('noBonus', 'bonusThrows');

  if (rules.bonusStreakLimit !== null && rules.bonusStreakLimit < 2) err('streak', 'bonusStreakLimit');

  const piecesCanBeOff = !rules.startOnHome || !rules.captureSendsHome;
  const entry = values.filter((v) => rules.entryThrows.includes(v));
  if (piecesCanBeOff && entry.length === 0) err('noEntry', 'entryThrows');
  else if (piecesCanBeOff) {
    const chance = throwOdds(rules).filter(([v]) => entry.includes(v)).reduce((a, [, p]) => a + p, 0);
    if (chance < 0.1) warn('slowEntry', 'entryThrows', { percent: Math.round(chance * 100) });
  }

  // Pieces only ever stand on multiples of the common step, so the centre must be one.
  const step = values.reduce(gcd);
  if (rules.exactFinish && finalIndex % step !== 0) err('unreachableCentre', 'throwTable', { step });

  return out;
}

export const hasErrors = (problems: Problem[]): boolean => problems.some((p) => p.level === 'error');
