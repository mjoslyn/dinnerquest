import { describe, expect, it } from 'vitest'
import { addPlayerB, createInitialState, generateMealPool, updatePlayerPicks } from './gameState'
import { partialHarmonyIds, validateDraft } from './gameLogic'
import { lockDraft, type LockDeps } from './rounds'
import {
  applyCustomUpgrade,
  applyLockUpgrade,
  applyRedrawUpgrade,
  applyTakeoutUpgrade,
  UpgradeError
} from './upgrades'
import { getBudgetPoints, pickRandomMeals, pickRandomUpgrades } from './rules'
import type { Cost, GameState, Meal, Upgrade } from './types'

function meal(id: number, cost: Cost = '$', dietScore = 3): Meal {
  return {
    id,
    name: `Meal ${id}`,
    emoji: 'M',
    time: 30,
    cost,
    cuisine: 'Test',
    tags: [],
    allergens: id % 7 === 0 ? ['nuts'] : [],
    dietScore,
    ingredients: []
  }
}

const ALL_MEALS: Meal[] = Array.from({ length: 60 }, (_, i) => meal(i + 1, '$', (i % 5) + 1))

function upgrade(id: string, type: Upgrade['type'], theme: string | null = 'fantasy'): Upgrade {
  return { id, name: id, emoji: 'U', type, effect: '', theme, mealName: 'Takeout Special', mealCost: '$$' }
}

const ALL_UPGRADES: Upgrade[] = ['fantasy', 'noir'].flatMap((theme) =>
  (['lock', 'takeout', 'redraw', 'custom'] as const).map((t) => upgrade(`${t}-${theme}`, t, theme))
)

const DEPS: LockDeps = { allMeals: ALL_MEALS, allUpgrades: ALL_UPGRADES }

/** A 3-meal game in drafting state with a deterministic pool of meals 1..15. */
function draftingState(): GameState {
  let state = createInitialState('Alice', { mealCount: 3, budgetCap: 'none', allergies: [] }, 'fantasy')
  state = addPlayerB(state, 'Bob')
  state = generateMealPool(state, ALL_MEALS.slice(0, 15))
  return state
}

describe('validateDraft', () => {
  it('requires enough meals counting existing harmonies once', () => {
    let state = draftingState()
    state = { ...state, harmoniesSoFar: [1] }
    state = updatePlayerPicks(state, 'A', [1, 2])
    const result = validateDraft(state, 'A')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('at least 1 more')

    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    expect(validateDraft(state, 'A').valid).toBe(true)
  })

  it('rejects picks outside the pool and duplicates', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 999])
    expect(validateDraft(state, 'A').errors).toContain('Some picks are not in the meal pool')

    state = { ...state, players: { ...state.players, A: { ...state.players.A, picks: [1, 1, 2] } } }
    expect(validateDraft(state, 'A').errors).toContain('Cannot pick the same meal twice')
  })

  it('enforces cumulative budget across harmonies and picks', () => {
    let state = draftingState()
    state = { ...state, settings: { ...state.settings, budgetCap: 'tight' } } // 3 * 1.3 = 3 points
    const expensive = state.pool.map((m) => ({ ...m, cost: '$$' as Cost }))
    state = { ...state, pool: expensive }
    state = updatePlayerPicks(state, 'A', [1, 2, 3]) // 6 points > 3
    const result = validateDraft(state, 'A')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('exceeds budget'))).toBe(true)
  })

  it('accepts synthetic takeout meals as valid picks', () => {
    let state = draftingState()
    state = {
      ...state,
      takeoutMeals: [
        { id: 'takeout-1', name: 'T', emoji: 'T', cost: '$$$', estimatedPrice: 30, time: 0, cuisine: 'Takeout' }
      ],
      harmoniesSoFar: ['takeout-1']
    }
    state = updatePlayerPicks(state, 'A', ['takeout-1', 1, 2])
    expect(validateDraft(state, 'A').valid).toBe(true)
  })
})

describe('partialHarmonyIds', () => {
  it('shows B the picks A locked in round 1', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    expect(partialHarmonyIds(state, 'B')).toEqual([1, 2, 3])
    expect(partialHarmonyIds(state, 'A')).toEqual([])
  })

  it('uses accumulated picks minus harmonies in later rounds', () => {
    let state = draftingState()
    state = { ...state, currentRound: 2, playerAAllPicks: [1, 2, 3], playerBAllPicks: [3, 4], harmoniesSoFar: [3] }
    expect(partialHarmonyIds(state, 'B')).toEqual([1, 2])
    expect(partialHarmonyIds(state, 'A')).toEqual([4])
  })
})

describe('lockDraft', () => {
  it('A locking records picks and stays in drafting', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    state = lockDraft(state, 'A', DEPS)
    expect(state.status).toBe('drafting')
    expect(state.players.A.locked).toBe(true)
    expect(state.playerAAllPicks).toEqual([1, 2, 3])
    expect(state.harmoniesSoFar).toEqual([])
  })

  it('B locking forms harmonies and completes when enough', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    state = lockDraft(state, 'A', DEPS)
    state = updatePlayerPicks(state, 'B', [1, 2, 3])
    state = lockDraft(state, 'B', DEPS)
    expect(state.status).toBe('complete')
    expect(state.results!.harmonies).toEqual([1, 2, 3])
    expect(state.results!.finalMenu).toEqual([1, 2, 3])
    expect(state.results!.conflicts).toEqual([])
  })

  it('B locking with partial overlap advances the round', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    state = lockDraft(state, 'A', DEPS)
    state = updatePlayerPicks(state, 'B', [1, 4, 5])
    state = lockDraft(state, 'B', DEPS)

    expect(state.status).toBe('drafting')
    expect(state.currentRound).toBe(2)
    expect(state.harmoniesSoFar).toEqual([1])
    expect(state.players.A.locked).toBe(false)
    expect(state.players.B!.locked).toBe(false)
    expect(state.players.A.picks).toEqual([])
    // Pool: harmony 1 dropped, partials 2,3,4,5 kept, refilled to (3-1)*5 = 10
    const poolIds = state.pool.map((m) => m.id)
    expect(poolIds).not.toContain(1)
    for (const id of [2, 3, 4, 5]) expect(poolIds).toContain(id)
    expect(state.pool.length).toBe(10)
  })

  it('completing via partial harmonies in round 2 works for A', () => {
    let state = draftingState()
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    state = lockDraft(state, 'A', DEPS)
    state = updatePlayerPicks(state, 'B', [1, 4, 5])
    state = lockDraft(state, 'B', DEPS)
    // Round 2: A picks B's partial harmonies 4 and 5 plus existing harmony 1.
    state = updatePlayerPicks(state, 'A', [4, 5])
    state = lockDraft(state, 'A', DEPS)
    expect(state.status).toBe('complete')
    expect(new Set(state.results!.harmonies)).toEqual(new Set([1, 4, 5]))
    // Old harmonies prioritized first for A completion.
    expect(state.results!.finalMenu[0]).toBe(1)
  })

  it('replaces used single-use upgrades on round advance', () => {
    let state = draftingState()
    state = {
      ...state,
      players: {
        ...state.players,
        A: {
          ...state.players.A,
          upgrades: [upgrade('lock-fantasy', 'lock'), upgrade('redraw-fantasy', 'redraw')]
        }
      }
    }
    state = applyLockUpgrade(state, 'A', 'lock-fantasy', 1)
    state = updatePlayerPicks(state, 'A', [1, 2, 3])
    state = lockDraft(state, 'A', DEPS)
    state = updatePlayerPicks(state, 'B', [10, 11, 12])
    state = lockDraft(state, 'B', DEPS)

    expect(state.currentRound).toBe(2)
    const ids = state.players.A.upgrades.map((u) => u.id)
    expect(ids).not.toContain('lock-fantasy')
    expect(ids).toContain('redraw-fantasy')
    expect(state.players.A.usedLockId).toBe('lock-fantasy')
  })
})

describe('upgrades', () => {
  function withUpgrades(state: GameState): GameState {
    return {
      ...state,
      players: {
        ...state.players,
        A: {
          ...state.players.A,
          upgrades: [
            upgrade('lock-fantasy', 'lock'),
            upgrade('takeout-fantasy', 'takeout'),
            upgrade('custom-fantasy', 'custom'),
            upgrade('redraw-fantasy', 'redraw')
          ]
        }
      }
    }
  }

  it('lock upgrade creates an instant harmony, single use', () => {
    let state = withUpgrades(draftingState())
    state = applyLockUpgrade(state, 'A', 'lock-fantasy', 2)
    expect(state.harmoniesSoFar).toContain(2)
    expect(state.players.A.picks).toContain(2)
    expect(() => applyLockUpgrade(state, 'A', 'lock-fantasy', 3)).toThrow(UpgradeError)
  })

  it('takeout upgrade mints a synthetic harmony meal', () => {
    let state = withUpgrades(draftingState())
    state = applyTakeoutUpgrade(state, 'A', 'takeout-fantasy')
    expect(state.takeoutMeals.length).toBe(1)
    const t = state.takeoutMeals[0]
    expect(t.name).toBe('Takeout Special')
    expect(t.cost).toBe('$$')
    expect(state.harmoniesSoFar).toContain(t.id)
    expect(() => applyTakeoutUpgrade(state, 'A', 'takeout-fantasy')).toThrow(UpgradeError)
  })

  it('custom upgrade uses the player-provided name', () => {
    let state = withUpgrades(draftingState())
    state = applyCustomUpgrade(state, 'A', 'custom-fantasy', 'Grandma Lasagna')
    expect(state.takeoutMeals[0].name).toBe('Grandma Lasagna')
    expect(state.takeoutMeals[0].cuisine).toBe('Custom')
    expect(() => applyCustomUpgrade(state, 'A', 'custom-fantasy', 'Again')).toThrow(UpgradeError)
  })

  it('redraw keeps picks and partial harmonies, refills the pool', () => {
    let state = withUpgrades(draftingState())
    state = updatePlayerPicks(state, 'A', [1, 2])
    state = applyRedrawUpgrade(state, 'A', 'redraw-fantasy', ALL_MEALS)
    const poolIds = state.pool.map((m) => m.id)
    expect(poolIds).toContain(1)
    expect(poolIds).toContain(2)
    expect(state.pool.length).toBe(15)
    expect(() => applyRedrawUpgrade(state, 'A', 'redraw-fantasy', ALL_MEALS)).toThrow(UpgradeError)
  })
})

describe('rules', () => {
  it('budget points match original formulas', () => {
    expect(getBudgetPoints('tight', 5)).toBe(6)
    expect(getBudgetPoints('moderate', 5)).toBe(9)
    expect(getBudgetPoints('fancy', 5)).toBe(12)
    expect(getBudgetPoints('none', 5)).toBeNull()
  })

  it('pickRandomMeals filters allergens and hits the count', () => {
    const picked = pickRandomMeals(ALL_MEALS, 15, ['nuts'], 3)
    expect(picked.length).toBe(15)
    expect(picked.every((m) => !m.allergens.includes('nuts'))).toBe(true)
    expect(new Set(picked.map((m) => m.id)).size).toBe(15)
  })

  it('pickRandomUpgrades draws distinct types themed to the game', () => {
    const drawn = pickRandomUpgrades(ALL_UPGRADES, 2, 'noir')
    expect(drawn.length).toBe(2)
    expect(new Set(drawn.map((u) => u.type)).size).toBe(2)
    expect(drawn.every((u) => u.theme === 'noir')).toBe(true)

    const plain = pickRandomUpgrades(ALL_UPGRADES, 2, 'plain')
    expect(plain.length).toBe(2)
  })
})
