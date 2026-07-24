import { useState } from 'hono/jsx'

export default function LinkAccount() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: Event) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/account/link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = (await res.json()) as { message?: string; error?: string }
      setMsg(res.ok ? data.message || 'Check your inbox' : data.error || 'Could not link email')
    } catch {
      setMsg('Network error - try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form class="setup-form" onSubmit={submit}>
      <label class="form-label">Save your progress with an email</label>
      <input
        type="email"
        class="setup-input"
        placeholder="you@example.com"
        value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
      />
      <button type="submit" class="btn" disabled={busy || !email}>
        {busy ? 'Linking...' : 'Link Email'}
      </button>
      {msg && <p class="share-message">{msg}</p>}
    </form>
  )
}
