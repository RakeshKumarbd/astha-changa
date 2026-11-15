// Named rule sets: three built in (read-only) plus any the player makes or imports.

import { DEFAULT_RULES, migrateRules, type RuleConfig } from '../core/state';
import { t, type TextKey } from './i18n';

export interface RuleSet {
  id: string;
  name: string;
  rules: RuleConfig;
  builtIn: boolean;
  updatedAt: number;
}

const BUILT_IN: { id: string; nameKey: TextKey; rules: Partial<RuleConfig> }[] = [
  { id: 'video', nameKey: 'setVideo', rules: {} },
  { id: 'big', nameKey: 'setBig', rules: { boardSize: 7, startOnHome: false, captureSendsHome: false } },
  { id: 'quick', nameKey: 'setQuick', rules: { piecesPerPlayer: 2, captureRequiredForInner: false } },
];

const KEY = 'astha-changa:rulesets:v1';

interface Stored {
  id: string;
  name: string;
  rules: unknown;
  updatedAt: number;
}

function readStored(): Stored[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((s): s is Stored => typeof s?.id === 'string' && typeof s?.name === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(list: Stored[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function listRuleSets(): RuleSet[] {
  const builtIn = BUILT_IN.map((b) => ({
    id: b.id,
    name: t(b.nameKey),
    rules: migrateRules({ ...DEFAULT_RULES, ...b.rules }),
    builtIn: true,
    updatedAt: 0,
  }));
  const mine = readStored().map((s) => ({ id: s.id, name: s.name, rules: migrateRules(s.rules), builtIn: false, updatedAt: s.updatedAt }));
  return [...builtIn, ...mine];
}

export const getRuleSet = (id: string): RuleSet => listRuleSets().find((s) => s.id === id) ?? listRuleSets()[0]!;

const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Save a player's rule set (built-ins are never overwritten: they are saved as a new set). */
export function saveRuleSet(set: { id?: string; name: string; rules: RuleConfig }): RuleSet {
  const list = readStored();
  const isBuiltIn = BUILT_IN.some((b) => b.id === set.id);
  const id = set.id && !isBuiltIn ? set.id : newId();
  const entry: Stored = { id, name: set.name.trim() || t('myRules'), rules: set.rules, updatedAt: Date.now() };
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  writeStored(list);
  return { ...entry, rules: migrateRules(entry.rules), builtIn: false };
}

export function deleteRuleSet(id: string): void {
  writeStored(readStored().filter((s) => s.id !== id));
}
