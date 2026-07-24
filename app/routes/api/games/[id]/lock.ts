import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, requireGame } from '../../../../lib/api-helpers'
import { broadcastGameUpdate, saveGame } from '../../../../lib/db/games'
import { getAllMeals, getAllUpgrades } from '../../../../lib/db/content'
import { validateDraft } from '../../../../lib/engine/gameLogic'
import { lockDraft } from '../../../../lib/engine/rounds'

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, participant, game } = await requireGame(c, c.req.param('id')!)
    const seat = participant.seat
    const state = game.state

    if (state.status !== 'drafting') throw new ApiError(400, 'Game is not in drafting')
    if (state.players[seat]?.locked) throw new ApiError(400, 'Draft already locked')
    // Sequential turns, as in the original flow: A drafts first each round.
    if (seat === 'B' && !state.players.A.locked) {
      throw new ApiError(400, "Waiting for your partner to lock first")
    }

    const [allMeals, allUpgrades] = await Promise.all([getAllMeals(db), getAllUpgrades(db)])
    const validation = validateDraft(state, seat, allMeals)
    if (!validation.valid) throw new ApiError(400, validation.errors.join('; '))

    const next = lockDraft(state, seat, { allMeals, allUpgrades })
    const version = await saveGame(db, next.id, next, game.version)
    await broadcastGameUpdate(c.env, next.id, { version, status: next.status, round: next.currentRound })
    return c.json({ ok: true, version, status: next.status })
  })
)
