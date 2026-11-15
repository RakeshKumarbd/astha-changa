import { describe, expect, it } from 'vitest';
import { decodeRules, encodeRules, extractCode } from '../src/core/share';
import { DEFAULT_RULES, migrateRules } from '../src/core/state';

describe('share codes', () => {
  it('round-trips a custom rule set', async () => {
    const rules = migrateRules({ ...DEFAULT_RULES, boardSize: 7, piecesPerPlayer: 3, safeCells: [0, 6, 24], bonusStreakLimit: 3 });
    const code = await encodeRules('Nani ke niyam', rules);
    expect(code).toMatch(/^[zj][A-Za-z0-9_-]+$/);
    expect(await decodeRules(code)).toEqual({ name: 'Nani ke niyam', rules });
  });

  it('keeps codes short for the default rules', async () => {
    expect((await encodeRules('Video', DEFAULT_RULES)).length).toBeLessThan(60);
  });

  it('returns null for junk instead of throwing', async () => {
    expect(await decodeRules('')).toBeNull();
    expect(await decodeRules('zzzz')).toBeNull();
    expect(await decodeRules('x123')).toBeNull();
  });

  it('cleans unsafe values on the way in', async () => {
    const bad = 'j' + btoa(JSON.stringify({ n: 'x', r: { piecesPerPlayer: 99 } })).replace(/=+$/, '');
    expect((await decodeRules(bad))!.rules.piecesPerPlayer).toBe(4);
  });

  it('finds the code inside a link', () => {
    expect(extractCode('https://example.test/#rules=zAbC_-1')).toBe('zAbC_-1');
    expect(extractCode('  zAbC  ')).toBe('zAbC');
  });
});

it('finds the code inside a shared message', () => {
  expect(extractCode('Astha Changa rules: Nani. In the game, tap Import rules and paste this code: zAbCdEfGhIjKlMnOpQr_-1')).toBe('zAbCdEfGhIjKlMnOpQr_-1');
});
