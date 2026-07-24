import { createRoute } from 'honox/factory'
import { apiHandler, requireGame } from '../../../../lib/api-helpers'
import { redactState } from '../../../../lib/db/games'
import { partialHarmonyIds, validateDraft } from '../../../../lib/engine/gameLogic'
import { getAllMeals } from '../../../../lib/db/content'

export const GET = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, participant, game } = await requireGame(c, c.req.param('id')!)
    const seat = participant.seat
    const allMeals = game.state.status === 'complete' ? await getAllMeals(db) : null
    return c.json({
      seat,
      version: game.version,
      state: redactState(game.state, seat),
      partialHarmonies: partialHarmonyIds(game.state, seat),
      validation:
        game.state.status === 'drafting' ? validateDraft(game.state, seat, allMeals) : null
    })
  })
)
