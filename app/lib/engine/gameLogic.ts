import { getBudgetPoints, getCostPoints } from './rules'
import type { GameState, Meal, MealId, Seat, TakeoutMeal } from './types'

type MealLike = Meal | TakeoutMeal

/** All meals a state can reference: pool + extra lookups + synthetic takeout/custom meals. */
export function mealLookup(state: GameState, allMeals: Meal[] | null = null): MealLike[] {
  return [...(allMeals ?? state.pool), ...(state.takeoutMeals || [])]
}

export function findMeal(state: GameState, id: MealId, allMeals: Meal[] | null = null): MealLike | undefined {
  return mealLookup(state, allMeals).find((m) => m.id === id)
}

/**
 * Meal IDs the other player has picked (across rounds) that are not yet
 * harmonies — pickable to complete a harmony instantly.
 */
export function partialHarmonyIds(state: GameState, seat: Seat): MealId[] {
  const harmonies = state.harmoniesSoFar || []
  let otherPicks: MealId[] = []
  if (state.currentRound === 1 && seat === 'B') {
    otherPicks = state.players.A?.picks || []
  } else if (state.currentRound > 1) {
    otherPicks = seat === 'A' ? state.playerBAllPicks || [] : state.playerAAllPicks || []
  }
  return otherPicks.filter((id) => !harmonies.includes(id))
}

export function validateDraft(
  state: GameState,
  seat: Seat,
  allMeals: Meal[] | null = null
): { valid: boolean; errors: string[] } {
  const player = state.players[seat]
  if (!player) return { valid: false, errors: ['Player has not joined'] }
  const { settings } = state
  const errors: string[] = []

  const harmonies = state.harmoniesSoFar || []
  const totalUniqueMeals = new Set<MealId>([...harmonies, ...player.picks])
  const mealsNeeded = settings.mealCount - totalUniqueMeals.size
  if (mealsNeeded > 0) {
    errors.push(`Must pick at least ${mealsNeeded} more meals`)
  }

  // Picks must come from the pool, partial harmonies, existing harmonies, or
  // synthetic takeout/custom meals.
  const poolIds = state.pool.map((m) => m.id as MealId)
  const takeoutIds = (state.takeoutMeals || []).map((m) => m.id as MealId)
  const validMealIds = new Set<MealId>([
    ...poolIds,
    ...partialHarmonyIds(state, seat),
    ...harmonies,
    ...takeoutIds
  ])
  const invalidPicks = player.picks.filter((id) => !validMealIds.has(id))
  if (invalidPicks.length > 0) {
    errors.push('Some picks are not in the meal pool')
  }

  if (new Set(player.picks).size !== player.picks.length) {
    errors.push('Cannot pick the same meal twice')
  }

  // Budget is cumulative: harmonies already locked plus current picks.
  // Synthetic takeout/custom meals are intentionally not costed (matches the
  // original: they never appeared in the meal lookup).
  const currentPicksCost = player.picks.reduce((sum: number, mealId) => {
    const meal = state.pool.find((m) => m.id === mealId)
    return sum + (meal ? getCostPoints(meal.cost) : 0)
  }, 0)
  const mealsForLookup = allMeals || state.pool
  const harmoniesCost = harmonies.reduce((sum: number, mealId) => {
    const meal = mealsForLookup.find((m) => m.id === mealId)
    return sum + (meal ? getCostPoints(meal.cost) : 0)
  }, 0)

  const cumulativeCost = harmoniesCost + currentPicksCost
  const budgetLimit = getBudgetPoints(settings.budgetCap, settings.mealCount)
  if (budgetLimit !== null && cumulativeCost > budgetLimit) {
    errors.push(`Total cost (${cumulativeCost}) exceeds budget (${budgetLimit})`)
  }

  return { valid: errors.length === 0, errors }
}

export interface Stats {
  harmonies: number
  conflicts: number
  totalTime: number
  totalCost: number
  topCuisine: string
  playerAWins: number
  playerBWins: number
}

export function calculateStats(state: GameState, allMeals: Meal[] | null = null): Stats {
  if (!state.results) {
    return {
      harmonies: 0,
      conflicts: 0,
      totalTime: 0,
      totalCost: 0,
      topCuisine: 'N/A',
      playerAWins: 0,
      playerBWins: 0
    }
  }

  const lookup = mealLookup(state, allMeals)
  let totalTime = 0
  let totalCost = 0
  let playerAWins = 0
  let playerBWins = 0
  const cuisineCounts: Record<string, number> = {}

  for (const mealId of state.results.finalMenu) {
    const meal = lookup.find((m) => m.id === mealId)
    if (meal) {
      totalTime += meal.time
      totalCost += getCostPoints(meal.cost)
      cuisineCounts[meal.cuisine] = (cuisineCounts[meal.cuisine] || 0) + 1
    }
  }

  for (const conflict of state.results.conflicts) {
    if (conflict.winner === 'A') playerAWins++
    if (conflict.winner === 'B') playerBWins++
  }

  let topCuisine = 'Various'
  let maxCount = 0
  for (const [cuisine, count] of Object.entries(cuisineCounts)) {
    if (count > maxCount) {
      maxCount = count
      topCuisine = cuisine
    }
  }

  return {
    harmonies: state.results.harmonies.length,
    conflicts: state.results.conflicts.length,
    totalTime,
    totalCost,
    topCuisine,
    playerAWins,
    playerBWins
  }
}
