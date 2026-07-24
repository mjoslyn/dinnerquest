import { useEffect, useMemo, useRef, useState } from 'hono/jsx'
import { createClient } from '@supabase/supabase-js'
import type { GameState, Meal, MealId, Seat, TakeoutMeal, Upgrade } from '../lib/engine/types'
import { getBudgetPoints, getCostPoints } from '../lib/engine/rules'
import { themeButtonText, themeClass } from '../lib/theme'

interface View {
  seat: Seat
  version: number
  state: GameState
  partialHarmonies: MealId[]
  referencedMeals: Meal[]
  validation: { valid: boolean; errors: string[] } | null
}

interface Props {
  gameId: string
  initial: View
  supabaseUrl: string
  supabaseAnonKey: string
}

type MealLike = Meal | TakeoutMeal

export default function GameBoard(props: Props) {
  const [view, setView] = useState<View>(props.initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  const [lockSelect, setLockSelect] = useState<string | null>(null) // upgradeId awaiting meal choice
  const [customFor, setCustomFor] = useState<string | null>(null) // upgradeId with open modal
  const [customName, setCustomName] = useState('')
  const viewRef = useRef<View>(view)
  viewRef.current = view

  const { seat, state } = view
  const me = state.players[seat]
  const otherSeat: Seat = seat === 'A' ? 'B' : 'A'
  const other = state.players[otherSeat]

  async function refetch() {
    try {
      const res = await fetch(`/api/games/${props.gameId}`)
      if (res.ok) {
        const next = (await res.json()) as View
        setView(next)
        document.body.className = themeClass(next.state.theme)
      }
    } catch {
      /* transient network failure; next poll will retry */
    }
  }

  // Realtime: refetch on broadcast, with slow-poll fallback.
  useEffect(() => {
    const client = createClient(props.supabaseUrl, props.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const channel = client
      .channel(`game:${props.gameId}`)
      .on('broadcast', { event: 'state' }, (msg) => {
        const v = (msg.payload as { version?: number })?.version
        if (!v || v !== viewRef.current!.version) refetch()
      })
      .subscribe()
    const poll = setInterval(() => {
      const s = viewRef.current!.state.status
      if (s !== 'complete') refetch()
    }, 15000)
    return () => {
      clearInterval(poll)
      channel.unsubscribe()
      client.removeAllChannels()
    }
  }, [])

  async function post(path: string, body?: object): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/games/${props.gameId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {})
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        setError((data as { error?: string }).error || 'Something went wrong')
        await refetch()
        return false
      }
      await refetch()
      return true
    } catch {
      setError('Network error - try again')
      return false
    } finally {
      setBusy(false)
    }
  }

  const mealById = useMemo(() => {
    const map = new Map<MealId, MealLike>()
    for (const m of view.referencedMeals || []) map.set(m.id, m)
    for (const m of state.pool) map.set(m.id, m)
    for (const m of state.takeoutMeals || []) map.set(m.id, m)
    return map
  }, [view])

  const harmonies = state.harmoniesSoFar || []
  const picks = me?.picks || []
  const mealCount = state.settings.mealCount
  const budgetLimit = getBudgetPoints(state.settings.budgetCap, mealCount)

  const securedIds = [...new Set<MealId>([...harmonies, ...picks])]
  const costOf = (id: MealId) => {
    const m = mealById.get(id)
    // Synthetic takeout/custom meals don't count against budget (original behavior)
    if (!m || typeof id === 'string') return 0
    return getCostPoints(m.cost)
  }
  const usdOf = (id: MealId) => mealById.get(id)?.estimatedPrice || 0
  const totalCost = securedIds.reduce((s: number, id) => s + costOf(id), 0)
  const totalUsd = securedIds.reduce((s: number, id) => s + usdOf(id), 0)

  const buttons = themeButtonText[state.theme] ?? themeButtonText.plain

  // ---------- actions ----------

  async function togglePick(mealId: MealId) {
    if (me?.locked || busy) return
    if (harmonies.includes(mealId)) return
    if (lockSelect) {
      const ok = await post('upgrade', { upgradeId: lockSelect, mealId })
      if (ok) setLockSelect(null)
      return
    }
    const next = picks.includes(mealId) ? picks.filter((id) => id !== mealId) : [...picks, mealId]
    setView({ ...view, state: { ...state, players: { ...state.players, [seat]: { ...me!, picks: next } } } })
    await post('picks', { picks: next })
  }

  async function useUpgrade(upgrade: Upgrade) {
    if (upgrade.type === 'lock') {
      setLockSelect(lockSelect === upgrade.id ? null : upgrade.id)
      return
    }
    if (upgrade.type === 'custom') {
      setCustomFor(upgrade.id)
      setCustomName('')
      return
    }
    await post('upgrade', { upgradeId: upgrade.id })
  }

  async function submitCustom() {
    if (!customName.trim()) return
    const ok = await post('upgrade', { upgradeId: customFor, mealName: customName.trim() })
    if (ok) setCustomFor(null)
  }

  function upgradeUsed(u: Upgrade): boolean {
    if (!me) return false
    return (
      me.usedLockId === u.id || me.usedTakeoutId === u.id || me.usedCustomId === u.id || me.usedRedrawId === u.id
    )
  }

  async function undoHarmony(mealId: MealId) {
    if (typeof mealId === 'string') {
      const type = mealId.startsWith('takeout-') ? 'takeout' : 'custom'
      await post('upgrade', { action: 'cancel', type, targetId: mealId })
    } else {
      await post('upgrade', { action: 'cancel', type: 'lock', mealId })
    }
  }

  /** Harmony entries I can still undo this round (created by my upgrades, pre-lock). */
  function canUndo(mealId: MealId): boolean {
    if (me?.locked) return false
    if (typeof mealId === 'string') {
      if (!picks.includes(mealId)) return false
      if (mealId.startsWith('takeout-')) return Boolean(me?.usedTakeoutId)
      return Boolean(me?.usedCustomId)
    }
    // A numeric pool meal in harmonies mid-round can only be my lock upgrade
    return Boolean(me?.usedLockId) && picks.includes(mealId) && state.pool.some((m) => m.id === mealId)
  }

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${props.gameId}` : `/join/${props.gameId}`

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setShareMsg('Link copied - send it to your partner')
    } catch {
      setShareMsg(joinUrl)
    }
  }

  async function shareJoinLink() {
    const message = `Join my Dinner Quest! ${joinUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Dinner Quest', text: message })
        setShareMsg('Shared')
      } catch {
        /* user cancelled */
      }
    } else {
      copyJoinLink()
    }
  }

  // ---------- phase: waiting for partner ----------

  if (state.status === 'waiting') {
    return (
      <div class="panel">
        <div class="panel-title">WAITING FOR YOUR PARTNER</div>
        <div class="status status-waiting">
          <p>The quest cannot begin alone.</p>
        </div>
        <div class="share-box">
          <div class="share-url">{joinUrl}</div>
          <button class="btn" onClick={shareJoinLink}>
            Share Invite
          </button>
          <button class="btn btn-secondary" onClick={copyJoinLink} style="margin-top:10px">
            Copy Link
          </button>
          {shareMsg && <div class="share-message">{shareMsg}</div>}
        </div>
        <div class="narrative">
          <p>
            Send the link to your partner. This page updates by itself when they join.
          </p>
        </div>
      </div>
    )
  }

  // ---------- phase: complete ----------

  if (state.status === 'complete' && state.results) {
    return <CompleteView view={view} mealById={mealById} gameId={props.gameId} />
  }

  // ---------- phase: drafting ----------

  const waitingForPartner =
    me?.locked || (seat === 'B' && !state.players.A.locked)

  return (
    <>
      <div class="panel">
        <div class="panel-title">
          {me?.name || `Player ${seat}`} - ROUND {state.currentRound}
        </div>

        {harmonies.length > 0 && (
          <div class="harmonies-section">
            <h3>Harmonies (Locked In)</h3>
            <div class="harmony-grid">
              {harmonies.map((id) => {
                const meal = mealById.get(id)
                if (!meal) return null
                const isCustom = typeof id === 'string' && id.startsWith('custom-')
                return (
                  <div class={`harmony-card locked ${isCustom ? 'custom-harmony-card' : ''}`}>
                    {isCustom && <div class="custom-meal-badge">CUSTOM</div>}
                    <span class="meal-emoji">{meal.emoji}</span>
                    <div class="meal-name">{meal.name}</div>
                    {canUndo(id) && (
                      <button class="btn-undo-lock" onClick={() => undoHarmony(id)}>
                        Undo
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div class="draft-info">
          <div class="info-row">
            <div class="info-item">
              <span class="info-label">Meals secured:</span>
              <span class="info-value">
                {securedIds.length} / {mealCount}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Budget:</span>
              <span class="info-value">
                {budgetLimit === null ? `${totalCost} pts` : `${totalCost} / ${budgetLimit}`}
                <span class="usd-total">(~${totalUsd})</span>
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div class="validation-errors slide-down">
            <div class="error-item">{error}</div>
          </div>
        )}

        {waitingForPartner ? (
          <div class="status status-waiting">
            <p>
              {me?.locked
                ? `Locked in. Waiting for ${other?.name || 'your partner'} to draft...`
                : `${state.players.A.name} is drafting. Your turn comes when they lock in.`}
            </p>
            <p style="margin-top:10px">This page updates by itself.</p>
          </div>
        ) : (
          <>
            {me && me.upgrades.length > 0 && (
              <div class="upgrades-section">
                <h3>Your Upgrades</h3>
                <div class="upgrades-grid">
                  {me.upgrades.map((u) => {
                    const used = upgradeUsed(u)
                    return (
                      <div class={`upgrade-card ${used ? 'used' : ''}`}>
                        <span class="upgrade-emoji">{u.emoji}</span>
                        <div class="upgrade-name">{u.name}</div>
                        <div class="upgrade-effect">{u.effect}</div>
                        <button
                          class={`btn-use-upgrade ${used ? 'btn-used' : ''}`}
                          disabled={used || busy}
                          onClick={() => useUpgrade(u)}
                        >
                          {used ? 'Used' : lockSelect === u.id ? 'Pick a meal...' : 'Use'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {lockSelect && (
              <div class="narrative">
                <p>Click a meal below to lock it into the menu.</p>
              </div>
            )}

            <div class="meal-pool">
              {state.pool.map((meal) => {
                const isPartial = view.partialHarmonies.includes(meal.id)
                const isSelected = picks.includes(meal.id)
                const isHarmony = harmonies.includes(meal.id)
                return (
                  <div
                    class={`meal-card ${isSelected ? 'selected' : ''} ${isHarmony ? 'locked' : ''} ${lockSelect ? 'lockable' : ''}`}
                    data-partial={isPartial ? 'true' : 'false'}
                    data-meal-id={meal.id}
                    onClick={() => togglePick(meal.id)}
                  >
                    {isPartial && <span class="partner-pick-star">*</span>}
                    <span class="meal-emoji">{meal.emoji}</span>
                    <div class="meal-title-row">
                      <span class="meal-name">{meal.name}</span>
                      <span class="meal-cost">({meal.cost})</span>
                    </div>
                    <div class="meal-meta">
                      <span>{meal.time}min</span>
                      <span>{meal.cuisine}</span>
                    </div>
                    {isPartial && <div class="partial-harmony-badge">Partner's Pick</div>}
                  </div>
                )
              })}
            </div>

            <div class="draft-actions">
              <button
                class="btn btn-primary"
                disabled={busy || !(view.validation?.valid ?? false)}
                onClick={() => post('lock')}
              >
                {buttons.inProgress}
              </button>
            </div>
            {view.validation && !view.validation.valid && (
              <div class="narrative">
                {view.validation.errors.map((e) => (
                  <p>{e}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {customFor && (
        <div class="modal-overlay" style="display:flex" onClick={(e) => e.target === e.currentTarget && setCustomFor(null)}>
          <div class="modal-content">
            <div class="modal-header">
              <h3>Create Your Custom Meal</h3>
              <button class="modal-close" onClick={() => setCustomFor(null)}>
                x
              </button>
            </div>
            <div class="modal-body">
              <p>Enter the name of your custom meal:</p>
              <input
                type="text"
                class="custom-meal-input"
                placeholder="e.g., Grandma's Secret Recipe"
                maxlength={50}
                value={customName}
                onInput={(e) => setCustomName((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => (e as KeyboardEvent).key === 'Enter' && submitCustom()}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setCustomFor(null)}>
                Cancel
              </button>
              <button class="btn btn-primary" disabled={busy} onClick={submitCustom}>
                Create Meal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- complete phase ----------

function CompleteView(props: { view: View; mealById: Map<MealId, MealLike>; gameId: string }) {
  const { view, mealById, gameId } = props
  const state = view.state
  const results = state.results!
  const [shopping, setShopping] = useState<{
    bySection: Record<string, { ingredient: string; meals: string[] }[]>
  } | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/games/${gameId}/shopping-list`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setShopping(data as any))
      .catch(() => {})
    try {
      const saved = localStorage.getItem(`dq-checked-${gameId}`)
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
  }, [])

  function toggleChecked(key: string) {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    try {
      localStorage.setItem(`dq-checked-${gameId}`, JSON.stringify(next))
    } catch {}
  }

  const menuMeals = results.finalMenu.map((id) => mealById.get(id)).filter(Boolean) as MealLike[]
  const totalTime = menuMeals.reduce((s, m) => s + (m.time || 0), 0)
  const totalUsd = menuMeals.reduce((s, m) => s + (m.estimatedPrice || 0), 0)

  async function copyMenu() {
    const text = `Our week of dinners:\n${menuMeals.map((m) => `- ${m.name}`).join('\n')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {}
  }

  return (
    <>
      <div class="panel">
        <div class="panel-title">QUEST COMPLETE</div>
        <div class="harmonies-section">
          <h3>Your Week of Dinners</h3>
          <div class="harmony-grid">
            {menuMeals.map((m) => (
              <div class="harmony-card locked">
                <span class="meal-emoji">{m.emoji}</span>
                <div class="meal-name">{m.name}</div>
                <div class="meal-name-small">
                  {m.time > 0 ? `${m.time}min - ` : ''}
                  {m.cost}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">{results.harmonies.length}</div>
            <div class="stat-label">harmonies</div>
          </div>
          <div class="stat">
            <div class="stat-value">{state.currentRound}</div>
            <div class="stat-label">rounds</div>
          </div>
          <div class="stat">
            <div class="stat-value">{totalTime}m</div>
            <div class="stat-label">total cook time</div>
          </div>
          <div class="stat">
            <div class="stat-value">${totalUsd}</div>
            <div class="stat-label">estimated cost</div>
          </div>
        </div>

        <button class="btn" onClick={copyMenu}>
          {copied ? 'Copied' : 'Copy Menu'}
        </button>
      </div>

      {shopping && Object.keys(shopping.bySection).length > 0 && (
        <div class="panel">
          <div class="panel-title">SHOPPING LIST</div>
          {Object.entries(shopping.bySection).map(([section, items]) => (
            <div class="shopping-section">
              <h3 class="shopping-section-title">{section}</h3>
              <ul class="shopping-list">
                {items.map((item) => {
                  const key = `${section}:${item.ingredient}`
                  return (
                    <li class={`shopping-item ${checked[key] ? 'checked' : ''}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[key])}
                          onChange={() => toggleChecked(key)}
                        />
                        <span class="ingredient-name">{item.ingredient}</span>
                        <span class="ingredient-meals">({item.meals.join(', ')})</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div class="narrative">
        <p>
          <a href="/">Start a new quest</a>
        </p>
      </div>
    </>
  )
}
