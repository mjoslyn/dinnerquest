import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const ACCESS_COOKIE = 'dq-access'
const REFRESH_COOKIE = 'dq-refresh'
const YEAR = 60 * 60 * 24 * 365

type SupabaseEnv = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string }

function stateless(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Service-role client: bypasses RLS. Server-side mutations only. */
export function serviceClient(env: SupabaseEnv): SupabaseClient {
  return stateless(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Anon-key client with no session (for auth API calls). */
export function anonClient(env: SupabaseEnv): SupabaseClient {
  return stateless(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}

function setAuthCookies(c: Context, session: Session): void {
  const opts = { path: '/', httpOnly: true, sameSite: 'Lax' as const, maxAge: YEAR }
  setCookie(c, ACCESS_COOKIE, session.access_token, opts)
  setCookie(c, REFRESH_COOKIE, session.refresh_token, opts)
}

/** The caller's access token, if any (for user-scoped auth API calls). */
export function getAccessToken(c: Context): string | undefined {
  return getCookie(c, ACCESS_COOKIE)
}

/**
 * Resolve the session user from our auth cookies, refreshing the access
 * token when it has expired. Returns null when there is no usable session.
 */
export async function getUser(c: Context): Promise<User | null> {
  const supabase = anonClient(c.env)
  const access = getCookie(c, ACCESS_COOKIE)
  if (access) {
    const { data } = await supabase.auth.getUser(access)
    if (data.user) return data.user
  }
  const refresh = getCookie(c, REFRESH_COOKIE)
  if (refresh) {
    const { data } = await supabase.auth.refreshSession({ refresh_token: refresh })
    if (data.session) {
      setAuthCookies(c, data.session)
      return data.session.user
    }
  }
  return null
}

/** Session user, creating an anonymous session (cookie-backed) if none exists. */
export async function ensureUser(c: Context): Promise<User> {
  const existing = await getUser(c)
  if (existing) return existing
  const { data, error } = await anonClient(c.env).auth.signInAnonymously()
  if (error || !data.session) throw new Error(`anonymous sign-in failed: ${error?.message}`)
  setAuthCookies(c, data.session)
  return data.session.user
}
