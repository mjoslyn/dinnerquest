import { useState } from 'hono/jsx'

export default function JoinForm(props: { gameId: string; suggestedName: string }) {
  const [name, setName] = useState(props.suggestedName)
  const [diet, setDiet] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: Event) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/games/${props.gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, dietPreference: diet })
      })
      const body = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) throw new Error(body.error || 'Could not join game')
      window.location.href = `/game/${props.gameId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join game')
      setSubmitting(false)
    }
  }

  return (
    <form class="setup-form" onSubmit={submit}>
      <div class="form-section">
        <label class="form-label">Your name</label>
        <input
          type="text"
          class="setup-input"
          placeholder="Player B"
          maxlength={40}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="form-section">
        <label class="form-label">
          Your diet: {diet === 1 ? 'all veggie' : diet === 5 ? 'all meat' : diet === 3 ? 'balanced' : diet < 3 ? 'mostly veggie' : 'mostly meat'}
        </label>
        <input
          type="range"
          class="bid-slider"
          min={1}
          max={5}
          step={1}
          value={diet}
          onInput={(e) => setDiet(Number((e.target as HTMLInputElement).value))}
        />
        <div class="bid-label">
          <span>veggie</span>
          <span>meaty</span>
        </div>
      </div>
      {error && <div class="join-error">{error}</div>}
      <button type="submit" class="btn btn-primary" disabled={submitting}>
        {submitting ? 'Joining...' : 'Join the Quest'}
      </button>
    </form>
  )
}
