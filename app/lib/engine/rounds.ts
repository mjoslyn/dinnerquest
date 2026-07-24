import { pickRandomMeals, pickRandomUpgrades } from './rules'
import type { GameState, Meal, MealId, Player, Seat, Upgrade } from './types'

export interface LockDeps {
  /** Full meal catalog, for pool refills. */
  allMeals: Meal[]
  /** Full upgrade deck, for replacing used upgrades between rounds. */
  allUpgrades: Upgrade[]
}

function completeGame(state: GameState, prioritizedHarmonies: MealId[], allHarmonies: MealId[]): GameState {
  return {
    ...state,
    status: 'complete',
    results: {
      finalMenu: prioritizedHarmonies.slice(0, state.settings.mealCount),
      harmonies: allHarmonies,
      conflicts: []
    }
  }
}

/** Replace a player's permanently-used upgrades with fresh draws for the new round. */
function refreshPlayerUpgrades(player: Player, state: GameState, deps: LockDeps): Player {
  if (!player.upgrades?.length) return { ...player, usedRedrawId: undefined }

  const usedIds = new Set(
    [player.usedLockId, player.usedTakeoutId, player.usedCustomId].filter(Boolean) as string[]
  )
  const newUpgrades = player.upgrades.map((upgrade) => {
    if (!usedIds.has(upgrade.id)) return upgrade
    const held = new Set(player.upgrades.map((u) => u.id))
    const replacement = pickRandomUpgrades(
      deps.allUpgrades.filter((u) => !held.has(u.id)),
      1,
      state.theme
    )[0]
    return replacement ?? upgrade
  })

  // Redraw resets every round; lock/takeout/custom stay marked used so the
  // original card can't be replayed (its replacement is a different id).
  return { ...player, upgrades: newUpgrades, usedRedrawId: undefined }
}

/**
 * Lock a player's draft and advance the game, per the original round model:
 * - A locks: record picks, form harmonies against B's accumulated picks;
 *   complete if enough, otherwise it's B's turn (same round).
 * - B locks: form harmonies against A's accumulated picks; complete if
 *   enough, otherwise prune + refill the pool and start the next round.
 */
export function lockDraft(state: GameState, seat: Seat, deps: LockDeps): GameState {
  const player = state.players[seat]
  if (!player) throw new Error(`Player ${seat} has not joined`)
  if (player.locked) return state

  state = {
    ...state,
    players: { ...state.players, [seat]: { ...player, locked: true } }
  }

  const harmonies = state.harmoniesSoFar || []

  if (seat === 'A') {
    const picks = state.players.A.picks
    const playerBAllPicks = state.playerBAllPicks || []
    const newHarmonies = picks.filter((id) => playerBAllPicks.includes(id) && !harmonies.includes(id))
    const allHarmonies = [...harmonies, ...newHarmonies]

    state = {
      ...state,
      harmoniesSoFar: allHarmonies,
      playerAAllPicks: [...(state.playerAAllPicks || []), ...picks]
    }

    if (allHarmonies.length >= state.settings.mealCount) {
      // Older harmonies first (locks/takeout/earlier rounds), then this round's.
      const oldHarmonies = harmonies.filter((id) => !newHarmonies.includes(id))
      return completeGame(state, [...oldHarmonies, ...newHarmonies], allHarmonies)
    }
    return state
  }

  // Seat B locks: resolve the round.
  const playerAPicks = state.players.A.picks
  const playerBPicks = state.players.B!.picks
  const playerAAllPicks = state.playerAAllPicks || []
  const playerBAllPicks = [...(state.playerBAllPicks || []), ...playerBPicks]

  const newHarmoniesFromB = playerBPicks.filter(
    (id) => playerAAllPicks.includes(id) && !harmonies.includes(id)
  )
  const allHarmonies = [...harmonies, ...newHarmoniesFromB]

  state = { ...state, playerBAllPicks, harmoniesSoFar: allHarmonies }

  const allPickedThisRound = new Set<MealId>([...playerAPicks, ...playerBPicks])
  const usedMeals = [...(state.usedMeals || []), ...allPickedThisRound]

  if (allHarmonies.length >= state.settings.mealCount) {
    // This round's full harmonies first, then earlier partials.
    return completeGame(state, [...newHarmoniesFromB, ...harmonies], allHarmonies)
  }

  // Prune pool: drop harmonies and unpicked meals; keep this round's picks and
  // earlier partial harmonies.
  let newPool = state.pool.filter((meal) => {
    if (allHarmonies.includes(meal.id)) return false
    if (allPickedThisRound.has(meal.id)) return true
    const isPartialHarmony =
      (playerAAllPicks.includes(meal.id) || playerBAllPicks.includes(meal.id)) &&
      !harmonies.includes(meal.id)
    return isPartialHarmony
  })

  // Refill to (meals still needed) x 5.
  const mealsStillNeeded = state.settings.mealCount - allHarmonies.length
  const mealsNeeded = mealsStillNeeded * 5 - newPool.length
  if (mealsNeeded > 0) {
    const avgDiet =
      ((state.players.A.dietPreference || 3) + (state.players.B!.dietPreference || 3)) / 2
    const existingIds = new Set<MealId>([...newPool.map((m) => m.id), ...allHarmonies])
    const candidates = deps.allMeals.filter((m) => !existingIds.has(m.id))
    newPool = [
      ...newPool,
      ...pickRandomMeals(candidates, mealsNeeded, state.settings.allergies || [], avgDiet)
    ]
  }

  return {
    ...state,
    currentRound: state.currentRound + 1,
    status: 'drafting',
    pool: newPool,
    usedMeals,
    players: {
      A: refreshPlayerUpgrades({ ...state.players.A, picks: [], locked: false }, state, deps),
      B: refreshPlayerUpgrades({ ...state.players.B!, picks: [], locked: false }, state, deps)
    }
  }
}
