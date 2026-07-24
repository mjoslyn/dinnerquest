import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, requireGame } from '../../../../lib/api-helpers'
import { generateShoppingList, getAllMeals } from '../../../../lib/db/content'

export const GET = createRoute((c) =>
  apiHandler(c, async () => {
    const { db, game } = await requireGame(c, c.req.param('id')!)
    const state = game.state
    if (state.status !== 'complete' || !state.results) {
      throw new ApiError(400, 'Game is not complete yet')
    }

    const allMeals = await getAllMeals(db)
    const menuMeals = state.results.finalMenu
      .map(
        (id) =>
          allMeals.find((m) => m.id === id) ?? (state.takeoutMeals || []).find((m) => m.id === id)
      )
      .filter((m) => m !== undefined)
      .map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, ingredients: 'ingredients' in m ? m.ingredients : [] }))

    return c.json(await generateShoppingList(db, menuMeals))
  })
)
