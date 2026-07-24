export type Cost = '$' | '$$' | '$$$'
export type BudgetCap = 'tight' | 'moderate' | 'fancy' | 'none'
export type MealCount = 3 | 5 | 7 | 10
export type Seat = 'A' | 'B'
export type GameStatus = 'waiting' | 'setup' | 'drafting' | 'complete'
export type Theme =
  | 'plain'
  | 'fantasy'
  | 'cyberpunk'
  | 'western'
  | 'noir'
  | 'pirate'
  | 'medieval'
  | 'space'
  | 'horror'

export const THEMES: Theme[] = [
  'plain',
  'fantasy',
  'cyberpunk',
  'western',
  'noir',
  'pirate',
  'medieval',
  'space',
  'horror'
]

export interface Meal {
  id: number
  name: string
  emoji: string
  time: number
  cost: Cost
  estimatedPrice?: number | null
  cuisine: string
  tags: string[]
  allergens: string[]
  dietScore: number
  ingredients: string[]
  description?: string
}

export interface Upgrade {
  id: string
  name: string
  emoji: string
  type: 'lock' | 'takeout' | 'redraw' | 'custom'
  effect: string
  theme: string | null
  rejectionText?: string | null
  undoText?: string | null
  mealName?: string | null
  mealCost?: string | null
}

/** Synthetic meal minted by takeout/custom upgrades. Lives in state.takeoutMeals. */
export interface TakeoutMeal {
  id: string
  name: string
  emoji: string
  cost: Cost
  estimatedPrice: number
  time: number
  cuisine: string
}

export type MealId = number | string

export interface GameSettings {
  mealCount: MealCount
  budgetCap: BudgetCap
  allergies: string[]
}

export interface Player {
  name: string
  dietPreference: number
  upgrades: Upgrade[]
  picks: MealId[]
  locked: boolean
  usedLockId?: string
  usedTakeoutId?: string
  usedCustomId?: string
  usedRedrawId?: string
}

export interface ConflictResult {
  meal: MealId
  winner: Seat
  playerABid: number
  playerBBid: number
}

export interface GameResults {
  finalMenu: MealId[]
  harmonies: MealId[]
  conflicts: ConflictResult[]
}

export interface GameState {
  id: string
  settings: GameSettings
  players: { A: Player; B: Player | null }
  pool: Meal[]
  results: GameResults | null
  status: GameStatus
  currentRound: number
  harmoniesSoFar: MealId[]
  usedMeals: MealId[]
  playerAAllPicks: MealId[]
  playerBAllPicks: MealId[]
  takeoutMeals: TakeoutMeal[]
  theme: Theme
  playerBName?: string
}
