import { describe, expect, it } from 'vitest';
import { rulesSummary } from '../src/core/rulesText';
import { DEFAULT_RULES, type RuleConfig } from '../src/core/state';
import { hasErrors, validateRules } from '../src/core/validate';

const rules = (r: Partial<RuleConfig>): RuleConfig => ({ ...DEFAULT_RULES, ...r });
const codes = (r: Partial<RuleConfig>, players?: number) => validateRules(rules(r), players).map((p) => p.code);

describe('validateRules', () => {
  it('the video rules have no problems', () => {
    expect(validateRules(DEFAULT_RULES, 4)).toEqual([]);
  });

  it('catches a throw table of the wrong length', () => {
    expect(codes({ cowries: 5 })).toContain('tableLength');
  });

  it('catches zero or oversized moves', () => {
    expect(codes({ throwTable: [4, 0, 2, 3, 8] })).toContain('badMove');
    expect(codes({ throwTable: [4, 1, 2, 3, 99] })).toContain('badMove');
  });

  it('catches endless throwing when every result is a bonus', () => {
    expect(codes({ bonusThrows: [1, 2, 3, 4, 8] })).toContain('allBonus');
  });

  it('warns when nothing gives an extra throw', () => {
    expect(codes({ bonusThrows: [] })).toEqual(['noBonus']);
  });

  it('catches pieces that can never come onto the board', () => {
    expect(codes({ startOnHome: false, entryThrows: [5] })).toContain('noEntry');
    expect(codes({ captureSendsHome: false, entryThrows: [] })).toContain('noEntry');
  });

  it('warns when coming onto the board is rare', () => {
    expect(codes({ startOnHome: false, entryThrows: [8] })).toContain('slowEntry'); // 1 in 16
  });

  it('catches a centre that moves can never land on exactly', () => {
    // 5×5 centre is path index 24; steps of 5 never land on it.
    expect(codes({ throwTable: [5, 5, 10, 5, 10] })).toContain('unreachableCentre');
    expect(codes({ throwTable: [5, 5, 10, 5, 10], exactFinish: false })).not.toContain('unreachableCentre');
  });

  it('catches too many players for the board', () => {
    expect(codes({}, 7)).toContain('tooManyPlayers');
    expect(codes({ boardSize: 7 }, 8)).not.toContain('tooManyPlayers');
  });

  it('hasErrors ignores warnings', () => {
    expect(hasErrors(validateRules(rules({ bonusThrows: [] })))).toBe(false);
    expect(hasErrors(validateRules(rules({ bonusThrows: [1, 2, 3, 4, 8] })))).toBe(true);
  });
});

describe('rulesSummary', () => {
  it('describes the video rules in English', () => {
    const text = rulesSummary(DEFAULT_RULES, 'en').join(' ');
    expect(text).toContain('5×5 board');
    expect(text).toContain('all open = 8');
    expect(text).toContain('all closed = 4');
    expect(text).toContain('A 4 or 8 gives you another throw');
    expect(text).toContain('must cut');
  });

  it('describes changed rules', () => {
    const text = rulesSummary(rules({ startOnHome: false, captureSendsHome: false, exactFinish: false, piecesPerPlayer: 3 }), 'en').join(' ');
    expect(text).toContain('3 pieces');
    expect(text).toContain('wait off the board');
    expect(text).toContain('off the board and you throw again');
    expect(text).toContain('big throw');
  });

  it('has Hindi text for the same rules', () => {
    const text = rulesSummary(DEFAULT_RULES, 'hi').join(' ');
    expect(text).toContain('सब खुली = 8');
    expect(text).toContain('सब बंद = 4');
  });
});
