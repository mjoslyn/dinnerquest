import { createRoute } from 'honox/factory'
import LinkAccount from '../islands/link-account'
import { getUser, serviceClient } from '../lib/db/supabase'
import { themeLabels } from '../lib/theme'
import type { Theme } from '../lib/engine/types'

interface HistoryRow {
  game_id: string
  seat: string
  display_name: string
  joined_at: string
  games: { status: string; theme: Theme; created_at: string } | null
}

export default createRoute(async (c) => {
  const user = await getUser(c)

  if (!user) {
    return c.render(
      <div class="panel">
        <div class="panel-title">YOUR QUESTS</div>
        <p>No quests yet. Games you play on this device will show up here.</p>
        <p>
          <a href="/">Start a quest</a>
        </p>
      </div>,
      { title: 'Dinner Quest - Account' }
    )
  }

  const db = serviceClient(c.env)
  const { data } = await db
    .from('participants')
    .select('game_id,seat,display_name,joined_at,games(status,theme,created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as unknown as HistoryRow[]

  const isAnonymous = user.is_anonymous ?? !user.email

  return c.render(
    <>
      <div class="panel">
        <div class="panel-title">YOUR QUESTS</div>
        {rows.length === 0 ? (
          <p>No quests yet.</p>
        ) : (
          <ul class="quest-history">
            {rows.map((row) => (
              <li class="quest-history-item">
                <a href={`/game/${row.game_id}`}>
                  <span class="quest-name">{row.display_name}</span>
                  <span class="quest-meta">
                    {row.games?.status ?? 'unknown'} - {themeLabels[row.games?.theme ?? 'plain'] ?? 'Plain'} -{' '}
                    {row.games?.created_at?.slice(0, 10) ?? ''}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p style="margin-top:16px">
          <a href="/">Start a new quest</a>
        </p>
      </div>

      <div class="panel">
        <div class="panel-title">{isAnonymous ? 'GUEST ACCOUNT' : 'ACCOUNT'}</div>
        {isAnonymous ? (
          <>
            <p style="margin-bottom:16px">
              You are playing as a guest. Link an email so your quests survive a cleared browser.
            </p>
            <LinkAccount />
          </>
        ) : (
          <p>Signed in as {user.email}</p>
        )}
      </div>
    </>,
    { title: 'Dinner Quest - Your Quests' }
  )
})
