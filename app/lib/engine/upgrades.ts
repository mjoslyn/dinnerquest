import type { Cost, GameState, MealId, Seat, TakeoutMeal, Upgrade } from './types'
import { partialHarmonyIds } from './gameLogic'
import { pickRandomMeals } from './rules'
import type { Meal } from './types'

function getHeldUpgrade(state: GameState, seat: Seat, upgradeId: string): Upgrade {
  const player = state.players[seat]
  if (!player) throw new UpgradeError(`Player ${seat} has not joined`)
  const upgrade = player.upgrades.find((u) => u.id === upgradeId)
  if (!upgrade) throw new UpgradeError('You do not hold that upgrade')
  return upgrade
}

export class UpgradeError extends Error {}

function updateSeat(state: GameState, seat: Seat, patch: Partial<GameState['players']['A']>): GameState {
  return {
    ...state,
    players: { ...state.players, [seat]: { ...state.players[seat]!, ...patch } }
  }
}

function addHarmony(state: GameState, mealId: MealId): GameState {
  if (state.harmoniesSoFar.includes(mealId)) return state
  return { ...state, harmoniesSoFar: [...state.harmoniesSoFar, mealId] }
}

function removeHarmony(state: GameState, mealId: MealId): GameState {
  return { ...state, harmoniesSoFar: state.harmoniesSoFar.filter((id) => id !== mealId) }
}

function addPick(state: GameState, seat: Seat, mealId: MealId): GameState {
  const picks = state.players[seat]!.picks
  if (picks.includes(mealId)) return state
  return updateSeat(state, seat, { picks: [...picks, mealId] })
}

function removePick(state: GameState, seat: Seat, mealId: MealId): GameState {
  return updateSeat(state, seat, {
    picks: state.players[seat]!.picks.filter((id) => id !== mealId)
  })
}

/** Lock upgrade: secure one meal straight into the harmonies. Single use. */
export function applyLockUpgrade(state: GameState, seat: Seat, upgradeId: string, mealId: MealId): GameState {
  const upgrade = getHeldUpgrade(state, seat, upgradeId)
  if (upgrade.type !== 'lock') throw new UpgradeError('Not a lock upgrade')
  if (state.players[seat]!.usedLockId) throw new UpgradeError('Lock upgrade already used')
  const inPool = state.pool.some((m) => m.id === mealId)
  const isPartial = partialHarmonyIds(state, seat).includes(mealId)
  if (!inPool && !isPartial) throw new UpgradeError('Meal is not available to lock')

  state = addHarmony(state, mealId)
  state = addPick(state, seat, mealId)
  return updateSeat(state, seat, { usedLockId: upgradeId })
}

export function cancelLockUpgrade(state: GameState, seat: Seat, mealId: MealId): GameState {
  state = removeHarmony(state, mealId)
  state = removePick(state, seat, mealId)
  return updateSeat(state, seat, { usedLockId: undefined })
}

function mintTakeoutMeal(upgrade: Upgrade, kind: 'takeout' | 'custom', name: string): TakeoutMeal {
  const cost = (upgrade.mealCost || (kind === 'takeout' ? '$$$' : '$')) as Cost
  return {
    id: `${kind}-${Date.now()}`,
    name,
    emoji: upgrade.emoji,
    cost,
    estimatedPrice: kind === 'takeout' ? (cost === '$' ? 10 : cost === '$$' ? 20 : 30) : 20,
    time: kind === 'takeout' ? 0 : 30,
    cuisine: kind === 'takeout' ? 'Takeout' : 'Custom'
  }
}

/** Takeout upgrade: mint a synthetic meal as an instant harmony. Single use. */
export function applyTakeoutUpgrade(state: GameState, seat: Seat, upgradeId: string): GameState {
  const upgrade = getHeldUpgrade(state, seat, upgradeId)
  if (upgrade.type !== 'takeout') throw new UpgradeError('Not a takeout upgrade')
  if (state.players[seat]!.usedTakeoutId) throw new UpgradeError('Takeout upgrade already used')

  const meal = mintTakeoutMeal(upgrade, 'takeout', upgrade.mealName || 'Takeout')
  state = { ...state, takeoutMeals: [...(state.takeoutMeals || []), meal] }
  state = addHarmony(state, meal.id)
  state = addPick(state, seat, meal.id)
  return updateSeat(state, seat, { usedTakeoutId: upgradeId })
}

export function cancelTakeoutUpgrade(state: GameState, seat: Seat, takeoutId: string): GameState {
  state = {
    ...state,
    takeoutMeals: (state.takeoutMeals || []).filter((m) => m.id !== takeoutId)
  }
  state = removeHarmony(state, takeoutId)
  state = removePick(state, seat, takeoutId)
  return updateSeat(state, seat, { usedTakeoutId: undefined })
}

/** Custom upgrade: the player names their own meal; instant harmony. Single use. */
export function applyCustomUpgrade(state: GameState, seat: Seat, upgradeId: string, mealName: string): GameState {
  const upgrade = getHeldUpgrade(state, seat, upgradeId)
  if (upgrade.type !== 'custom') throw new UpgradeError('Not a custom upgrade')
  if (state.players[seat]!.usedCustomId) throw new UpgradeError('Custom upgrade already used')
  if (!mealName.trim()) throw new UpgradeError('Meal name is required')

  const meal = mintTakeoutMeal(upgrade, 'custom', mealName.trim())
  state = { ...state, takeoutMeals: [...(state.takeoutMeals || []), meal] }
  state = addHarmony(state, meal.id)
  state = addPick(state, seat, meal.id)
  return updateSeat(state, seat, { usedCustomId: upgradeId })
}

export function cancelCustomUpgrade(state: GameState, seat: Seat, customId: string): GameState {
  state = {
    ...state,
    takeoutMeals: (state.takeoutMeals || []).filter((m) => m.id !== customId)
  }
  state = removeHarmony(state, customId)
  state = removePick(state, seat, customId)
  return updateSeat(state, seat, { usedCustomId: undefined })
}

/**
 * Redraw upgrade: reroll the pool, preserving partial harmonies and the
 * player's current picks. Once per round.
 */
export function applyRedrawUpgrade(
  state: GameState,
  seat: Seat,
  upgradeId: string,
  allMeals: Meal[]
): GameState {
  const upgrade = getHeldUpgrade(state, seat, upgradeId)
  if (upgrade.type !== 'redraw') throw new UpgradeError('Not a redraw upgrade')
  if (state.players[seat]!.usedRedrawId) throw new UpgradeError('Redraw already used this round')

  const partials = partialHarmonyIds(state, seat)
  const picks = state.players[seat]!.picks
  const keepIds = new Set<MealId>([...partials, ...picks])
  const mealsToKeep = state.pool.filter((m) => keepIds.has(m.id))

  const targetPoolSize = (state.settings.mealCount - (state.harmoniesSoFar?.length || 0)) * 5
  const mealsNeeded = Math.max(0, targetPoolSize - mealsToKeep.length)

  const avgDiet =
    ((state.players.A?.dietPreference || 3) + (state.players.B?.dietPreference || 3)) / 2
  const excludeIds = new Set<MealId>([
    ...keepIds,
    ...(state.harmoniesSoFar || []),
    ...(state.usedMeals || [])
  ])
  const candidates = allMeals.filter((m) => !excludeIds.has(m.id))
  const fresh = pickRandomMeals(candidates, mealsNeeded, state.settings.allergies || [], avgDiet)

  state = { ...state, pool: [...mealsToKeep, ...fresh] }
  return updateSeat(state, seat, { usedRedrawId: upgradeId })
}
