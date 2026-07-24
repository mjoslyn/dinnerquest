import { createRoute } from 'honox/factory'
import GameBoard from '../../islands/game-board'
import { serviceClient, getUser } from '../../lib/db/supabase'
import { GameNotFound, getParticipant, listParticipants, loadGame, redactState } from '../../lib/db/games'
import { getAllMeals } from '../../lib/db/content'
import { partialHarmonyIds, validateDraft } from '../../lib/engine/gameLogic'
import { themeClass, themeSubtitles } from '../../lib/theme'
import type { MealId } from '../../lib/engine/types'

export default createRoute(async (c) => {
  const gameId = c.req.param('id')!
  const db = serviceClient(c.env)

  let game
  try {
    game = await loadGame(db, gameId)
  } catch (err) {
    if (err instanceof GameNotFound) {
      return c.render(
        <div class="panel">
          <div class="panel-title">QUEST NOT FOUND</div>
          <p>This game does not exist (or has been lost to time).</p>
          <p>
            <a href="/">Start a new quest</a>
          </p>
        </div>,
        { title: 'Dinner Quest - Not Found' }
      )
    }
    throw err
  }

  const state = game.state
  const hostName = state.players.A.name
  const head = {
    title: `Dinner Quest - ${hostName}'s Quest`,
    ogTitle: `${hostName}'s Dinner Quest - Round ${state.currentRound}`,
    ogDescription: `Two players drafting ${state.settings.mealCount} dinners for the week.`,
    themeClass: themeClass(game.theme),
    subtitle: themeSubtitles[game.theme] ?? themeSubtitles.plain
  }

  const user = await getUser(c)
  const participant = user ? await getParticipant(db, gameId, user.id) : null

  if (!participant) {
    const participants = await listParticipants(db, gameId)
    if (!participants.some((p) => p.seat === 'B') && state.status === 'waiting') {
      return c.redirect(`/join/${gameId}`)
    }
    // Public shell (crawlers, third parties): no game state exposed.
    return c.render(
      <div class="panel">
        <div class="panel-title">A QUEST IS UNDERWAY</div>
        <p>Two adventurers are drafting their week of dinners.</p>
        <p>
          <a href="/">Start your own quest</a>
        </p>
      </div>,
      head
    )
  }

  // Build the initial seat-scoped view (same shape as GET /api/games/:id) so
  // the island renders instantly without a client fetch.
  const seat = participant.seat
  const visible = redactState(state, seat)
  const inPool = new Set(state.pool.map((m) => m.id as MealId))
  const takeoutIds = new Set((state.takeoutMeals || []).map((m) => m.id as MealId))
  const partials = partialHarmonyIds(visible, seat)
  const referencedIds = [
    ...new Set<MealId>([
      ...(state.harmoniesSoFar || []),
      ...(state.results?.finalMenu || []),
      ...partials
    ])
  ].filter((id) => !inPool.has(id) && !takeoutIds.has(id))

  let referencedMeals: unknown[] = []
  let validation = null
  if (referencedIds.length > 0 || state.status === 'drafting') {
    const allMeals = await getAllMeals(db)
    referencedMeals = allMeals.filter((m) => referencedIds.includes(m.id))
    if (state.status === 'drafting') validation = validateDraft(state, seat, allMeals)
  }

  const initial = {
    seat,
    version: game.version,
    state: visible,
    partialHarmonies: partials,
    referencedMeals,
    validation
  }

  return c.render(
    <GameBoard
      gameId={gameId}
      initial={initial as never}
      supabaseUrl={c.env.SUPABASE_URL}
      supabaseAnonKey={c.env.SUPABASE_ANON_KEY}
    />,
    head
  )
})
