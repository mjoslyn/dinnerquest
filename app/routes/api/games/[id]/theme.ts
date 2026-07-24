import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, requireGame } from '../../../../lib/api-helpers'
import { broadcastGameUpdate, saveGame } from '../../../../lib/db/games'
import { setTheme } from '../../../../lib/engine/gameState'
import { THEMES, type Theme } from '../../../../lib/engine/types'

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, game } = await requireGame(c, c.req.param('id')!)
    const body = await c.req.json<{ theme?: string }>()
    if (!THEMES.includes(body.theme as Theme)) throw new ApiError(400, 'Unknown theme')

    const next = setTheme(game.state, body.theme as Theme)
    const version = await saveGame(db, next.id, next, game.version)
    await broadcastGameUpdate(c.env, next.id, { version, status: next.status, round: next.currentRound })
    return c.json({ ok: true, version, theme: next.theme })
  })
)
