import type { Context } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { ensureUser, serviceClient } from './db/supabase'
import { GameNotFound, VersionConflict, getParticipant, loadGame, type GameRow, type Participant } from './db/games'
import { UpgradeError } from './engine/upgrades'

export { ensureUser }

export interface GameContext {
  db: SupabaseClient
  user: User
  participant: Participant
  game: GameRow
}

/** Load a game the caller participates in, or throw an ApiError. */
export async function requireGame(c: Context, gameId: string): Promise<GameContext> {
  const db = serviceClient(c.env)
  const user = await ensureUser(c)
  const game = await loadGame(db, gameId)
  const participant = await getParticipant(db, gameId, user.id)
  if (!participant) throw new ApiError(403, 'You are not part of this game')
  return { db, user, participant, game }
}

export class ApiError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message)
  }
}

/** Uniform JSON error handling for API routes. */
export async function apiHandler(c: Context, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
    if (err instanceof GameNotFound) return c.json({ error: 'Game not found' }, 404)
    if (err instanceof VersionConflict) return c.json({ error: 'Game changed, refresh and retry' }, 409)
    if (err instanceof UpgradeError) return c.json({ error: err.message }, 400)
    console.error(err)
    return c.json({ error: 'Internal error' }, 500)
  }
}
