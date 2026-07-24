import { createRoute } from 'honox/factory'
import { apiHandler, requireGame } from '../../../../lib/api-helpers'
import { redactState } from '../../../../lib/db/games'
import { partialHarmonyIds, validateDraft } from '../../../../lib/engine/gameLogic'
import { getAllMeals } from '../../../../lib/db/content'
import type { MealId } from '../../../../lib/engine/types'

export const GET = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, participant, game } = await requireGame(c, c.req.param('id')!)
    const seat = participant.seat
    const state = game.state
    // Compute the caller-visible view from the REDACTED state so partial
    // harmonies never leak the opponent's unlocked in-progress picks.
    const visible = redactState(state, seat)

    // Meals referenced by the state but no longer in the pool (harmonies are
    // pruned on round advance; the final menu needs full meal data too).
    const inPool = new Set(state.pool.map((m) => m.id as MealId))
    const takeoutIds = new Set((state.takeoutMeals || []).map((m) => m.id as MealId))
    const referencedIds = [
      ...new Set<MealId>([
        ...(state.harmoniesSoFar || []),
        ...(state.results?.finalMenu || []),
        ...partialHarmonyIds(visible, seat)
      ])
    ].filter((id) => !inPool.has(id) && !takeoutIds.has(id))

    let referencedMeals: unknown[] = []
    let validation = null
    if (referencedIds.length > 0 || state.status === 'drafting') {
      const allMeals = await getAllMeals(db)
      referencedMeals = allMeals.filter((m) => referencedIds.includes(m.id))
      if (state.status === 'drafting') validation = validateDraft(state, seat, allMeals)
    }

    return c.json({
      seat,
      version: game.version,
      state: visible,
      partialHarmonies: partialHarmonyIds(visible, seat),
      referencedMeals,
      validation
    })
  })
)
