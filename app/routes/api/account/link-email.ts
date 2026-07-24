import { createRoute } from 'honox/factory'
import { ApiError, apiHandler } from '../../../lib/api-helpers'
import { getAccessToken, getUser } from '../../../lib/db/supabase'

/**
 * Link an email address to the caller's (anonymous) account. Supabase sends a
 * confirmation link; once confirmed the account is permanent and keeps its
 * game history (the user id never changes).
 */
export const POST = createRoute((c) =>
  apiHandler(c, async () => {
    const user = await getUser(c)
    const token = getAccessToken(c)
    if (!user || !token) throw new ApiError(403, 'No session')

    const body = await c.req.json<{ email?: string }>()
    const email = body.email?.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'A valid email is required')
    }

    const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: c.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { msg?: string; error_description?: string }
      throw new ApiError(400, err.msg || err.error_description || 'Could not link email')
    }
    return c.json({ ok: true, message: 'Check your inbox to confirm the link' })
  })
)
