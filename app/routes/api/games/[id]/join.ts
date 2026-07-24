import { createRoute } from 'honox/factory'
import { ApiError, apiHandler, ensureUser } from '../../../../lib/api-helpers'
import { serviceClient } from '../../../../lib/db/supabase'
import {
  addParticipant,
  broadcastGameUpdate,
  getParticipant,
  listParticipants,
  loadGame,
  saveGame
} from '../../../../lib/db/games'
import { addPlayerB, generateMealPool, setDietPreference, setPlayerUpgrades } from '../../../../lib/engine/gameState'
import { pickRandomMeals, pickRandomUpgrades } from '../../../../lib/engine/rules'
import { getAllMeals, getAllUpgrades } from '../../../../lib/db/content'

export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const gameId = c.req.param('id')!
    const db = serviceClient(c.env)
    const user = await ensureUser(c)
    const body = await c.req.json<{ name?: string; dietPreference?: number }>().catch(() => ({}) as any)

    const existing = await getParticipant(db, gameId, user.id)
    if (existing) return c.json({ id: gameId, seat: existing.seat })

    const game = await loadGame(db, gameId)
    const taken = await listParticipants(db, gameId)
    if (taken.some((p) => p.seat === 'B')) throw new ApiError(409, 'This game already has two players')

    const diet = Math.min(5, Math.max(1, Number(body.dietPreference) || 3))
    let state = addPlayerB(game.state, body.name?.slice(0, 40))
    state = setDietPreference(state, 'B', diet)

    // Both players present: build the pool and deal upgrades, start drafting.
    const [allMeals, allUpgrades] = await Promise.all([getAllMeals(db), getAllUpgrades(db)])
    const avgDiet = (state.players.A.dietPreference + diet) / 2
    const pool = pickRandomMeals(allMeals, state.settings.mealCount * 5, state.settings.allergies, avgDiet)
    state = generateMealPool(state, pool)
    state = setPlayerUpgrades(state, 'A', pickRandomUpgrades(allUpgrades, 2, state.theme))
    state = setPlayerUpgrades(state, 'B', pickRandomUpgrades(allUpgrades, 2, state.theme))

    await addParticipant(db, gameId, user.id, 'B', state.players.B!.name)
    const version = await saveGame(db, gameId, state, game.version)
    await broadcastGameUpdate(c.env, gameId, { version, status: state.status, round: state.currentRound })
    return c.json({ id: gameId, seat: 'B' })
  })
)
