import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameState, Seat, Theme } from '../engine/types'

export interface GameRow {
  state: GameState
  version: number
  theme: Theme
  created_by: string
}

export interface Participant {
  game_id: string
  user_id: string
  seat: Seat
  display_name: string
}

export class GameNotFound extends Error {}
export class VersionConflict extends Error {}

export async function loadGame(db: SupabaseClient, id: string): Promise<GameRow> {
  const { data, error } = await db
    .from('games')
    .select('state,version,theme,created_by')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`load game: ${error.message}`)
  if (!data) throw new GameNotFound(id)
  return data as GameRow
}

export async function createGame(db: SupabaseClient, state: GameState, userId: string): Promise<void> {
  const { error } = await db.from('games').insert({
    id: state.id,
    state,
    theme: state.theme,
    created_by: userId
  })
  if (error) throw new Error(`create game: ${error.message}`)
  await addParticipant(db, state.id, userId, 'A', state.players.A.name)
}

/** Optimistic-concurrency save: fails with VersionConflict when the row moved. */
export async function saveGame(
  db: SupabaseClient,
  id: string,
  state: GameState,
  expectedVersion: number
): Promise<number> {
  const { data, error } = await db
    .from('games')
    .update({
      state,
      theme: state.theme,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('version')
  if (error) throw new Error(`save game: ${error.message}`)
  if (!data || data.length === 0) throw new VersionConflict(id)
  return expectedVersion + 1
}

export async function addParticipant(
  db: SupabaseClient,
  gameId: string,
  userId: string,
  seat: Seat,
  displayName: string
): Promise<void> {
  const { error } = await db.from('participants').insert({
    game_id: gameId,
    user_id: userId,
    seat,
    display_name: displayName
  })
  if (error) throw new Error(`add participant: ${error.message}`)
}

export async function getParticipant(
  db: SupabaseClient,
  gameId: string,
  userId: string
): Promise<Participant | null> {
  const { data, error } = await db
    .from('participants')
    .select('game_id,user_id,seat,display_name')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`get participant: ${error.message}`)
  return data as Participant | null
}

export async function listParticipants(db: SupabaseClient, gameId: string): Promise<Participant[]> {
  const { data, error } = await db
    .from('participants')
    .select('game_id,user_id,seat,display_name')
    .eq('game_id', gameId)
  if (error) throw new Error(`list participants: ${error.message}`)
  return data as Participant[]
}

/**
 * Seat-scoped view: hide the opponent's in-progress picks until they lock.
 * (After lock their picks surface as partial harmonies, as in the original
 * open-information flow.)
 */
export function redactState(state: GameState, seat: Seat): GameState {
  const other: Seat = seat === 'A' ? 'B' : 'A'
  const otherPlayer = state.players[other]
  if (!otherPlayer || otherPlayer.locked || state.status === 'complete') return state
  return {
    ...state,
    players: {
      ...state.players,
      [other]: { ...otherPlayer, picks: [], upgrades: [] }
    }
  }
}

/**
 * Notify subscribers on channel game:{id} that state changed. Server-side we
 * must use the Realtime HTTP broadcast endpoint (no WebSockets in a Worker
 * request). Errors are swallowed: clients fall back to slow polling.
 */
export async function broadcastGameUpdate(
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string },
  gameId: string,
  payload: { version: number; status: string; round: number }
): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        messages: [{ topic: `game:${gameId}`, event: 'state', payload, private: false }]
      })
    })
  } catch {
    // Realtime being down should never fail a game mutation.
  }
}
