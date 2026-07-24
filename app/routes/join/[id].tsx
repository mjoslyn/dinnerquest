import { createRoute } from 'honox/factory'
import JoinForm from '../../islands/join-form'
import { serviceClient, getUser } from '../../lib/db/supabase'
import { GameNotFound, getParticipant, listParticipants, loadGame } from '../../lib/db/games'
import { themeClass, themeSubtitles } from '../../lib/theme'

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
          <p>This game link does not exist (or has been lost to time).</p>
          <p>
            <a href="/">Start a new quest</a>
          </p>
        </div>,
        { title: 'Dinner Quest - Not Found' }
      )
    }
    throw err
  }

  const user = await getUser(c)
  if (user) {
    const participant = await getParticipant(db, gameId, user.id)
    if (participant) return c.redirect(`/game/${gameId}`)
  }

  const participants = await listParticipants(db, gameId)
  const hostName = game.state.players.A.name
  const head = {
    title: `Dinner Quest - Join ${hostName}`,
    ogTitle: `${hostName} challenges you to a Dinner Quest`,
    ogDescription: `Draft ${game.state.settings.mealCount} dinners together. Join the quest!`,
    themeClass: themeClass(game.theme),
    subtitle: themeSubtitles[game.theme] ?? themeSubtitles.plain
  }

  if (participants.some((p) => p.seat === 'B')) {
    return c.render(
      <div class="panel">
        <div class="panel-title">QUEST FULL</div>
        <p>Two adventurers have already answered this call.</p>
        <p>
          <a href="/">Start your own quest</a>
        </p>
      </div>,
      head
    )
  }

  return c.render(
    <>
      <div class="panel">
        <div class="panel-title">JOIN {hostName.toUpperCase()}'S QUEST</div>
        <p class="panel-subtitle">
          {game.state.settings.mealCount} meals - budget {game.state.settings.budgetCap}
        </p>
        <JoinForm gameId={gameId} suggestedName={game.state.playerBName ?? ''} />
      </div>
      <div class="narrative">
        <p>
          <span class="highlight">{hostName}</span> has summoned you to plan the week's dinners.
        </p>
        <p>Set your diet preference and join the draft.</p>
      </div>
    </>,
    head
  )
})
