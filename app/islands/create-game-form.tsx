import { useState } from 'hono/jsx'
import { THEMES, type Theme } from '../lib/engine/types'
import { getThemedPlayerNames } from '../lib/engine/rules'
import { themeLabels } from '../lib/theme'

const MEAL_COUNTS = [3, 5, 7, 10]
const BUDGETS = [
  { value: 'tight', title: 'Tight', desc: 'Mostly budget meals' },
  { value: 'moderate', title: 'Moderate', desc: 'Mix of options' },
  { value: 'fancy', title: 'Fancy', desc: 'Splurge worthy' },
  { value: 'none', title: 'No Limit', desc: "Sky's the limit" }
]
const ALLERGENS = ['dairy', 'gluten', 'nuts', 'shellfish', 'fish', 'soy', 'eggs']

export default function CreateGameForm() {
  const [mealCount, setMealCount] = useState(5)
  const [budgetCap, setBudgetCap] = useState('moderate')
  const [allergies, setAllergies] = useState<string[]>([])
  const [theme, setTheme] = useState<Theme>('plain')
  const [playerName, setPlayerName] = useState('')
  const [playerBName, setPlayerBName] = useState('')
  const [diet, setDiet] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function pickTheme(next: Theme) {
    setTheme(next)
    document.body.className = next === 'plain' ? '' : `theme-${next}`
    const names = getThemedPlayerNames(next)
    if (names) {
      setPlayerName(names.A)
      setPlayerBName(names.B)
    }
  }

  function toggleAllergy(a: string) {
    setAllergies(allergies.includes(a) ? allergies.filter((x) => x !== a) : [...allergies, a])
  }

  async function submit(e: Event) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName || 'Player A',
          playerBName: playerBName || undefined,
          mealCount,
          budgetCap,
          allergies,
          theme,
          dietPreference: diet
        })
      })
      const body = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !body.id) throw new Error(body.error || 'Could not create game')
      window.location.href = `/game/${body.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create game')
      setSubmitting(false)
    }
  }

  return (
    <form class="setup-form" onSubmit={submit}>
      <div class="form-section">
        <label class="form-label">How many meals for the week?</label>
        <div class="option-grid">
          {MEAL_COUNTS.map((n) => (
            <label class="option-card">
              <input
                type="radio"
                name="mealCount"
                value={n}
                checked={mealCount === n}
                onChange={() => setMealCount(n)}
              />
              <span class="option-content">
                <span class="option-number">{n}</span>
                <span class="option-text">meals</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">Budget for the week?</label>
        <div class="option-grid">
          {BUDGETS.map((b) => (
            <label class="option-card">
              <input
                type="radio"
                name="budgetCap"
                value={b.value}
                checked={budgetCap === b.value}
                onChange={() => setBudgetCap(b.value)}
              />
              <span class="option-content">
                <span class="option-title">{b.title}</span>
                <span class="option-desc">{b.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">Any allergies or restrictions?</label>
        <div class="allergen-grid">
          {ALLERGENS.map((a) => (
            <label class="allergen-checkbox">
              <input
                type="checkbox"
                name="allergies"
                value={a}
                checked={allergies.includes(a)}
                onChange={() => toggleAllergy(a)}
              />
              <span>{a}</span>
            </label>
          ))}
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">Pick a theme</label>
        <div class="option-grid theme-grid">
          {THEMES.map((t) => (
            <label class="option-card">
              <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => pickTheme(t)} />
              <span class="option-content">
                <span class="option-title">{themeLabels[t]}</span>
                <span class="option-desc">{t === 'plain' ? 'no frills' : t}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">Your name</label>
        <input
          type="text"
          class="setup-input"
          placeholder="Player A"
          maxlength={40}
          value={playerName}
          onInput={(e) => setPlayerName((e.target as HTMLInputElement).value)}
        />
        <label class="form-label">Partner's name (optional)</label>
        <input
          type="text"
          class="setup-input"
          placeholder="Player B"
          maxlength={40}
          value={playerBName}
          onInput={(e) => setPlayerBName((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="form-section">
        <label class="form-label">Your diet: {diet === 1 ? 'all veggie' : diet === 5 ? 'all meat' : diet === 3 ? 'balanced' : diet < 3 ? 'mostly veggie' : 'mostly meat'}</label>
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
        {submitting ? 'Conjuring...' : 'Conjure the Feast'}
      </button>
    </form>
  )
}
