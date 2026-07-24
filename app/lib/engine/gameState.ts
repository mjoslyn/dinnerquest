import type { GameSettings, GameState, Meal, MealId, Player, Seat, Theme, Upgrade } from './types'

export function generateGameId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
}

function newPlayer(name: string): Player {
  return { name, dietPreference: 3, upgrades: [], picks: [], locked: false }
}

export function createInitialState(
  playerAName: string,
  settings: GameSettings,
  theme: Theme = 'plain',
  playerBName?: string
): GameState {
  return {
    id: generateGameId(),
    settings,
    players: { A: newPlayer(playerAName), B: null },
    pool: [],
    results: null,
    status: 'waiting',
    currentRound: 1,
    harmoniesSoFar: [],
    usedMeals: [],
    playerAAllPicks: [],
    playerBAllPicks: [],
    takeoutMeals: [],
    theme,
    ...(playerBName && { playerBName })
  }
}

export function addPlayerB(state: GameState, playerName?: string): GameState {
  const name = playerName || state.playerBName || 'Player B'
  return {
    ...state,
    players: { ...state.players, B: newPlayer(name) },
    status: 'setup'
  }
}

function updatePlayer(state: GameState, seat: Seat, patch: Partial<Player>): GameState {
  const player = state.players[seat]
  if (!player) throw new Error(`Player ${seat} has not joined`)
  return {
    ...state,
    players: { ...state.players, [seat]: { ...player, ...patch } }
  }
}

export function setDietPreference(state: GameState, seat: Seat, dietPreference: number): GameState {
  return updatePlayer(state, seat, { dietPreference })
}

export function setPlayerUpgrades(state: GameState, seat: Seat, upgrades: Upgrade[]): GameState {
  return updatePlayer(state, seat, { upgrades })
}

export function generateMealPool(state: GameState, meals: Meal[]): GameState {
  const poolSize = state.settings.mealCount * 5
  return { ...state, pool: meals.slice(0, poolSize), status: 'drafting' }
}

export function updatePlayerPicks(state: GameState, seat: Seat, picks: MealId[]): GameState {
  return updatePlayer(state, seat, { picks })
}

export function lockPlayerDraft(state: GameState, seat: Seat): GameState {
  return updatePlayer(state, seat, { locked: true })
}

export function bothPlayersLocked(state: GameState): boolean {
  return Boolean(state.players.A?.locked && state.players.B?.locked)
}

export function setTheme(state: GameState, theme: Theme): GameState {
  return { ...state, theme }
}
