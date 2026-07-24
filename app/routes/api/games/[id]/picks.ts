import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, requireGame } from '../../../../lib/api-helpers'
import { broadcastGameUpdate, saveGame } from '../../../../lib/db/games'
import { updatePlayerPicks } from '../../../../lib/engine/gameState'
import { partialHarmonyIds } from '../../../../lib/engine/gameLogic'
import type { MealId } from '../../../../lib/engine/types'

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, participant, game } = await requireGame(c, c.req.param('id')!)
    const seat = participant.seat
    const state = game.state

    if (state.status !== 'drafting') throw new ApiError(400, 'Game is not in drafting')
    if (state.players[seat]?.locked) throw new ApiError(400, 'Draft already locked')

    const body = await c.req.json<{ picks?: MealId[] }>()
    if (!Array.isArray(body.picks)) throw new ApiError(400, 'picks array required')

    const validIds = new Set<MealId>([
      ...state.pool.map((m) => m.id as MealId),
      ...partialHarmonyIds(state, seat),
      ...(state.harmoniesSoFar || []),
      ...(state.takeoutMeals || []).map((m) => m.id as MealId)
    ])
    const picks = [...new Set(body.picks)]
    if (picks.some((id) => !validIds.has(id))) throw new ApiError(400, 'Invalid meal in picks')

    const next = updatePlayerPicks(state, seat, picks)
    const version = await saveGame(db, game.state.id, next, game.version)
    await broadcastGameUpdate(c.env, next.id, { version, status: next.status, round: next.currentRound })
    return c.json({ ok: true, version })
  })
)
