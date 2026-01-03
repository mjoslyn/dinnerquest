import { generateId } from './urlCodec.js';

/**
 * @typedef {Object} GameSettings
 * @property {3 | 5 | 7 | 10} mealCount
 * @property {'tight' | 'moderate' | 'fancy' | 'none'} budgetCap
 * @property {string[]} allergies
 */

/**
 * @typedef {Object} Player
 * @property {string} name
 * @property {number} dietPreference - 1 (veggie) to 5 (meaty)
 * @property {Array} upgrades - Array of upgrade objects
 * @property {number[]} picks - Array of meal IDs
 * @property {boolean} locked
 * @property {number} [usedThemeRound] - Round number when theme was used (limits to one per round)
 * @property {string} [usedThemeId] - ID of the theme that was used
 * @property {string} [usedLockId] - ID of the lock upgrade that was permanently used
 * @property {string} [usedTakeoutId] - ID of the takeout upgrade that was permanently used
 */

/**
 * @typedef {Object} ConflictResult
 * @property {number} meal - Meal ID
 * @property {string} winner - 'A' or 'B'
 * @property {number} playerABid
 * @property {number} playerBBid
 */

/**
 * @typedef {Object} GameResults
 * @property {number[]} finalMenu - Array of meal IDs
 * @property {number[]} harmonies - Array of meal IDs where players agreed
 * @property {ConflictResult[]} conflicts - Array of conflict resolutions
 */

/**
 * @typedef {Object} TakeoutMeal
 * @property {string} id - Unique takeout meal ID (e.g., 'takeout-123456')
 * @property {string} name
 * @property {string} emoji
 * @property {string} cost - '$', '$$', or '$$$'
 * @property {number} estimatedPrice
 * @property {number} time
 * @property {string} cuisine
 */

/**
 * @typedef {Object} GameState
 * @property {string} id
 * @property {GameSettings} settings
 * @property {{ A: Player | null, B: Player | null }} players
 * @property {import('./gameData.js').Meal[]} pool
 * @property {GameResults | null} results
 * @property {'setup' | 'waiting' | 'drafting' | 'revealing' | 'complete'} status
 * @property {number} currentRound - Current drafting round (1, 2, 3...)
 * @property {number[]} harmoniesSoFar - Accumulated harmonies across all rounds
 * @property {number[]} usedMeals - Meals that have been drafted (removed from pool)
 * @property {number[]} playerAAllPicks - All meals Player A has picked across all rounds
 * @property {number[]} playerBAllPicks - All meals Player B has picked across all rounds
 * @property {TakeoutMeal[]} [takeoutMeals] - Takeout meals created from upgrades
 * @property {string} [theme] - Theme class name (e.g., 'theme-fantasy')
 */

/**
 * Create initial game state with settings
 * @param {string} playerAName - Name for Player A
 * @param {GameSettings} settings
 * @param {string} [theme] - Optional theme class name
 * @param {string} [playerBName] - Name for Player B (auto-generated themed name)
 * @returns {GameState}
 */
export function createInitialState(playerAName, settings, theme, playerBName) {
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
    ...(playerBName && { playerBName }) // Store Player B's name for when they join
  };
}

/**
 * Add player B to existing game
 * @param {GameState} state
 * @param {string} [playerName] - Optional name override (uses state.playerBName if not provided)
 * @returns {GameState}
 */
export function addPlayerB(state, playerName) {
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
 * @param {GameState} state
 * @param {string} playerId - 'A' or 'B'
 * @param {number} dietPreference - 1 to 5
 * @returns {GameState}
 */
export function setDietPreference(state, playerId, dietPreference) {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        dietPreference
      }
    }
  };
}

/**
 * Draw random upgrades for a player
 * @param {GameState} state
 * @param {string} playerId - 'A' or 'B'
 * @param {Array} upgrades - Pre-fetched upgrades
 * @returns {GameState}
 */
export function setPlayerUpgrades(state, playerId, upgrades) {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        upgrades
      }
    }
  };
}

/**
 * Generate meal pool based on settings and diet preferences
 * @param {GameState} state
 * @param {import('./gameData.js').Meal[]} meals - Pre-fetched meals
 * @returns {GameState}
 */
export function generateMealPool(state, meals) {
  const poolSize = state.settings.mealCount * 5;

  return {
    ...state,
    pool: meals.slice(0, poolSize),
    status: 'drafting'
  };
}

/**
 * Update player's picks
 * @param {GameState} state
 * @param {string} playerId
 * @param {number[]} picks - Array of meal IDs
 * @returns {GameState}
 */
export function updatePlayerPicks(state, playerId, picks) {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        picks
      }
    }
  };
}

/**
 * Lock in player's draft
 * @param {GameState} state
 * @param {string} playerId
 * @returns {GameState}
 */
export function lockPlayerDraft(state, playerId) {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        locked: true
      }
    }
  };
}

/**
 * Check if both players have locked in
 * @param {GameState} state
 * @returns {boolean}
 */
export function bothPlayersLocked(state) {
  return state.players.A?.locked && state.players.B?.locked;
}

/**
 * Set game results
 * @param {GameState} state
 * @param {GameResults} results
 * @returns {GameState}
 */
export function setGameResults(state, results) {
  return {
    ...state,
    results,
    status: 'complete'
  };
}
