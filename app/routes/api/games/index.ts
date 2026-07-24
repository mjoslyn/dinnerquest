import { createRoute } from 'honox/factory'
import { apiHandler, ensureUser } from '../../../lib/api-helpers'
import { serviceClient } from '../../../lib/db/supabase'
import { createGame } from '../../../lib/db/games'
import { createInitialState, setDietPreference } from '../../../lib/engine/gameState'
import { THEMES, type BudgetCap, type MealCount, type Theme } from '../../../lib/engine/types'

const MEAL_COUNTS = [3, 5, 7, 10]
const BUDGET_CAPS = ['tight', 'moderate', 'fancy', 'none']

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const body = await c.req.json<{
      playerName?: string
      playerBName?: string
      mealCount?: number
      budgetCap?: string
      allergies?: string[]
      theme?: string
      dietPreference?: number
    }>()

    const mealCount = (MEAL_COUNTS.includes(Number(body.mealCount)) ? Number(body.mealCount) : 5) as MealCount
    const budgetCap = (BUDGET_CAPS.includes(body.budgetCap ?? '') ? body.budgetCap : 'moderate') as BudgetCap
    const theme = (THEMES.includes(body.theme as Theme) ? body.theme : 'plain') as Theme
    const allergies = Array.isArray(body.allergies) ? body.allergies.map(String).slice(0, 10) : []
    const playerName = (body.playerName || 'Player A').slice(0, 40)

    const user = await ensureUser(c)
    let state = createInitialState(playerName, { mealCount, budgetCap, allergies }, theme, body.playerBName?.slice(0, 40))
    if (body.dietPreference) {
      state = setDietPreference(state, 'A', Math.min(5, Math.max(1, Number(body.dietPreference))))
    }

    await createGame(serviceClient(c.env), state, user.id)
    return c.json({ id: state.id }, 201)
  })
)
