import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, requireGame } from '../../../../lib/api-helpers'
import { broadcastGameUpdate, saveGame } from '../../../../lib/db/games'
import { getAllMeals } from '../../../../lib/db/content'
import {
  applyCustomUpgrade,
  applyLockUpgrade,
  applyRedrawUpgrade,
  applyTakeoutUpgrade,
  cancelCustomUpgrade,
  cancelLockUpgrade,
  cancelTakeoutUpgrade
} from '../../../../lib/engine/upgrades'
import type { GameState, MealId } from '../../../../lib/engine/types'

interface UpgradeBody {
  upgradeId?: string
  action?: 'use' | 'cancel'
  type?: 'lock' | 'takeout' | 'redraw' | 'custom'
  mealId?: MealId
  mealName?: string
  /** takeout/custom synthetic meal id, for cancels */
  targetId?: string
}

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, participant, game } = await requireGame(c, c.req.param('id')!)
    const seat = participant.seat
    const state = game.state

    if (state.status !== 'drafting') throw new ApiError(400, 'Game is not in drafting')
    if (state.players[seat]?.locked) throw new ApiError(400, 'Draft already locked')

    const body = await c.req.json<UpgradeBody>()
    const action = body.action ?? 'use'
    let next: GameState

    if (action === 'cancel') {
      if (body.type === 'lock') {
        if (body.mealId === undefined) throw new ApiError(400, 'mealId required')
        next = cancelLockUpgrade(state, seat, body.mealId)
      } else if (body.type === 'takeout') {
        if (!body.targetId) throw new ApiError(400, 'targetId required')
        next = cancelTakeoutUpgrade(state, seat, body.targetId)
      } else if (body.type === 'custom') {
        if (!body.targetId) throw new ApiError(400, 'targetId required')
        next = cancelCustomUpgrade(state, seat, body.targetId)
      } else {
        throw new ApiError(400, 'Unknown cancel type')
      }
    } else {
      if (!body.upgradeId) throw new ApiError(400, 'upgradeId required')
      const upgrade = state.players[seat]!.upgrades.find((u) => u.id === body.upgradeId)
      if (!upgrade) throw new ApiError(400, 'You do not hold that upgrade')
      switch (upgrade.type) {
        case 'lock':
          if (body.mealId === undefined) throw new ApiError(400, 'mealId required')
          next = applyLockUpgrade(state, seat, upgrade.id, body.mealId)
          break
        case 'takeout':
          next = applyTakeoutUpgrade(state, seat, upgrade.id)
          break
        case 'custom':
          next = applyCustomUpgrade(state, seat, upgrade.id, body.mealName ?? '')
          break
        case 'redraw':
          next = applyRedrawUpgrade(state, seat, upgrade.id, await getAllMeals(db))
          break
        default:
          throw new ApiError(400, 'Unknown upgrade type')
      }
    }

    const version = await saveGame(db, next.id, next, game.version)
    await broadcastGameUpdate(c.env, next.id, { version, status: next.status, round: next.currentRound })
    return c.json({ ok: true, version, takeoutMeals: next.takeoutMeals })
  })
)
