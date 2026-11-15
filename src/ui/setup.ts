// Who is playing, and saving/resuming a game in progress.

import type { BotLevel } from '../ai/bot';
import { seatLayout } from '../core/board';
import { COLOR_FOR_POSITION, createGame, migrateGame, type GameState, type PlayerSpec, type RuleConfig } from '../core/state';
import { colorName, t } from './i18n';

export interface PlayerSetup {
  kind: 'human' | 'bot';
  level: BotLevel;
  /** Empty = use the colour's name. */
  name: string;
  color: number;
  /** Home position 0–7, or null to place automatically. */
  position: number | null;
}

export interface Setup {
  players: PlayerSetup[];
  rulesetId: string;
  /** Two teams, alternating round the table. */
  teams: boolean;
  passScreen: boolean;
}

export const newPlayer = (kind: PlayerSetup['kind'], color: number): PlayerSetup => ({ kind, level: 'medium', name: '', color, position: null });

export const DEFAULT_SETUP: Setup = {
  players: [newPlayer('human', 0), newPlayer('bot', 2)],
  rulesetId: 'video',
  teams: false,
  passScreen: true,
};

/** Display name for a player in a game: the typed name, else the colour (and "Computer" for bots). */
export function playerName(setup: PlayerSetup, state: GameState, player: number): string {
  const p = state.players[player]!;
  const typed = p.name || setup.name.trim();
  if (typed) return typed;
  return setup.kind === 'bot' ? t('computerName', { color: colorName(p.color) }) : colorName(p.color);
}

export const teamName = (team: number): string => (team === 0 ? t('teamA') : t('teamB'));

/** Seats every player (filling in automatic seats), in turn order going round the board. */
export function seatPlayers(setup: Setup, rules: RuleConfig): PlayerSetup[] {
  const auto = seatLayout(rules.boardSize, setup.players.length);
  const taken = new Set(setup.players.map((p) => p.position).filter((p): p is number => p !== null));
  const free = [...auto, ...[0, 1, 2, 3, 4, 5, 6, 7]].filter((p, i, a) => a.indexOf(p) === i && !taken.has(p));
  const seated = setup.players.map((p) => ({ ...p, position: p.position ?? free.shift()! }));
  return seated.sort((a, b) => a.position! - b.position!);
}

/** A new game from the setup: players in turn order, with teams alternating if chosen. */
export function startState(setup: Setup, rules: RuleConfig): { players: PlayerSetup[]; state: GameState } {
  const players = seatPlayers(setup, rules);
  const specs: PlayerSpec[] = players.map((p, i) => ({
    name: p.name.trim(),
    color: p.color,
    position: p.position!,
    team: setup.teams ? i % 2 : undefined,
  }));
  return { players, state: createGame(specs, rules) };
}

/** First colour not used by anyone else, preferring the default for that seat. */
export function freeColor(players: PlayerSetup[], prefer = 0): number {
  const used = new Set(players.map((p) => p.color));
  for (let i = 0; i < 8; i++) {
    const c = (prefer + i) % 8;
    if (!used.has(c)) return c;
  }
  return prefer;
}

export const defaultColorFor = (index: number, count: number, size: RuleConfig['boardSize']): number => {
  try {
    return COLOR_FOR_POSITION[seatLayout(size, count)[index]!]!;
  } catch {
    return index % 8;
  }
};

const SAVE_KEY = 'astha-changa:save:v1';
const SETUP_KEY = 'astha-changa:setup:v2';

export interface SaveData {
  /** Players in the same (turn) order as state.players. */
  players: PlayerSetup[];
  setup: Setup;
  state: GameState;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the game still plays, it just won't resume */
  }
}

/** Load a saved game, upgrading saves from older versions (which kept the setup's players in turn order). */
export function loadGame(): SaveData | null {
  const d = read<Partial<SaveData> & { setup?: { players?: unknown[] } }>(SAVE_KEY);
  if (!d?.state?.phase || d.state.phase === 'over' || !Array.isArray(d.setup?.players)) return null;
  try {
    const state = migrateGame(d.state);
    const players = (d.players ?? (d.setup.players as Partial<PlayerSetup>[]).map((p, i) => ({
      ...newPlayer(p.kind === 'bot' ? 'bot' : 'human', state.players[i]?.color ?? i),
      level: p.level ?? 'medium',
    }))) as PlayerSetup[];
    if (players.length !== state.players.length) return null;
    const setup = { ...DEFAULT_SETUP, ...(d.setup as Partial<Setup>), players };
    return { players, setup, state };
  } catch {
    return null;
  }
}
export const saveGame = (data: SaveData | null): void => write(SAVE_KEY, data);

export function loadSetup(): Setup {
  const s = read<Setup>(SETUP_KEY);
  if (!s || !Array.isArray(s.players) || s.players.length < 2) return structuredClone(DEFAULT_SETUP);
  return { ...structuredClone(DEFAULT_SETUP), ...s };
}
export const saveSetup = (setup: Setup): void => write(SETUP_KEY, setup);
