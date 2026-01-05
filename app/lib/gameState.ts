/**
 * Game state management
 */

import { generateId } from './urlCodec';
import type { Meal } from './gameData';

export interface GameSettings {
  mealCount: 3 | 5 | 7 | 10;
  budgetCap: 'tight' | 'moderate' | 'fancy' | 'none';
  allergies: string[];
}

export interface Upgrade {
  id: string;
  name?: string;
  emoji?: string;
  type?: 'theme' | 'lock' | 'takeout' | 'redraw';
  effect?: string;
  themeStyle?: string;
  rejectionText?: string;
  undoText?: string;
  description?: string;
}

export interface Player {
  name: string;
  dietPreference: number;
  upgrades: Upgrade[];
  picks: number[];
  locked: boolean;
  usedThemeRound?: number;
  usedThemeId?: string;
  usedLockId?: string;
  usedTakeoutId?: string;
}

export interface ConflictResult {
  meal: number;
  winner: 'A' | 'B';
  playerABid: number;
  playerBBid: number;
}

export interface GameResults {
  finalMenu: number[];
  harmonies: number[];
  conflicts: ConflictResult[];
}

export interface TakeoutMeal {
  id: string;
  name: string;
  emoji: string;
  cost: '$' | '$$' | '$$$';
  estimatedPrice: number;
  time: number;
  cuisine: string;
}

export interface GameState {
  id: string;
  settings: GameSettings;
  players: {
    A: Player | null;
    B: Player | null;
  };
  pool: Meal[];
  results: GameResults | null;
  status: 'setup' | 'waiting' | 'drafting' | 'revealing' | 'complete';
  currentRound: number;
  harmoniesSoFar: (number | string)[];
  usedMeals: number[];
  playerAAllPicks: number[];
  playerBAllPicks: number[];
  takeoutMeals: TakeoutMeal[];
  checkedIngredients?: string[];
  theme?: string;
  playerBName?: string;
  currentDay?: number;
}

/**
 * Create initial game state with settings
 */
export function createInitialState(
  playerAName: string,
  settings: GameSettings,
  theme?: string,
  playerBName?: string
): GameState {
  const gameId = generateId();

  return {
    id: gameId,
    settings,
    players: {
      A: {
        name: playerAName,
        dietPreference: 3,
        upgrades: [],
        picks: [],
        locked: false
      },
      B: null
    },
    pool: [],
    results: null,
    status: 'waiting',
    currentRound: 1,
    harmoniesSoFar: [],
    usedMeals: [],
    playerAAllPicks: [],
    playerBAllPicks: [],
    takeoutMeals: [],
    ...(theme && { theme }),
    ...(playerBName && { playerBName })
  };
}

/**
 * Add player B to existing game
 */
export function addPlayerB(state: GameState, playerName?: string): GameState {
  const name = playerName || state.playerBName || 'Player B';
  return {
    ...state,
    players: {
      ...state.players,
      B: {
        name,
        dietPreference: 3,
        upgrades: [],
        picks: [],
        locked: false
      }
    },
    status: 'setup'
  };
}

/**
 * Set player diet preference
 */
export function setDietPreference(
  state: GameState,
  playerId: 'A' | 'B',
  dietPreference: number
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        dietPreference
      }
    }
  };
}

/**
 * Set player upgrades
 */
export function setPlayerUpgrades(
  state: GameState,
  playerId: 'A' | 'B',
  upgrades: Upgrade[]
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        upgrades
      }
    }
  };
}

/**
 * Generate meal pool based on settings
 */
export function generateMealPool(state: GameState, meals: Meal[]): GameState {
  const poolSize = state.settings.mealCount * 5;

  return {
    ...state,
    pool: meals.slice(0, poolSize),
    status: 'drafting'
  };
}

/**
 * Update player's picks
 */
export function updatePlayerPicks(
  state: GameState,
  playerId: 'A' | 'B',
  picks: number[]
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        picks
      }
    }
  };
}

/**
 * Lock in player's draft
 */
export function lockPlayerDraft(state: GameState, playerId: 'A' | 'B'): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        locked: true
      }
    }
  };
}

/**
 * Check if both players have locked in
 */
export function bothPlayersLocked(state: GameState): boolean {
  return !!(state.players.A?.locked && state.players.B?.locked);
}

/**
 * Set game results
 */
export function setGameResults(state: GameState, results: GameResults): GameState {
  return {
    ...state,
    results,
    status: 'complete'
  };
}
