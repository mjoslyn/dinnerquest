import type { Meal, Seat, Theme, Upgrade } from './types'

export function getCostPoints(cost: string): number {
  const costMap: Record<string, number> = { $: 1, $$: 2, $$$: 3 }
  return costMap[cost] || 0
}

export function getBudgetPoints(budgetCap: string, mealCount: number): number | null {
  switch (budgetCap) {
    case 'tight':
      return Math.floor(mealCount * 1.3)
    case 'moderate':
      return Math.floor(mealCount * 1.8)
    case 'fancy':
      return Math.floor(mealCount * 2.5)
    default:
      return null
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Pick `count` meals from `allMeals`, excluding allergens, with the pool
 * balanced around the players' combined diet preference.
 */
export function pickRandomMeals(
  allMeals: Meal[],
  count: number,
  excludeAllergens: string[] = [],
  avgDietPreference = 3
): Meal[] {
  let meals = allMeals
  if (excludeAllergens.length > 0) {
    meals = meals.filter((meal) => !meal.allergens.some((a) => excludeAllergens.includes(a)))
  }

  const targetVeggie = Math.max(0, ((5 - avgDietPreference) / 5) * count)
  const targetMeaty = Math.max(0, ((avgDietPreference - 1) / 5) * count)

  const veggieMeals = shuffle(meals.filter((m) => m.dietScore <= 2))
  const meatyMeals = shuffle(meals.filter((m) => m.dietScore >= 4))
  const neutralMeals = meals.filter((m) => m.dietScore === 3)

  const balanced: Meal[] = []
  for (let i = 0; i < targetVeggie && veggieMeals.length > 0; i++) balanced.push(veggieMeals.pop()!)
  for (let i = 0; i < targetMeaty && meatyMeals.length > 0; i++) balanced.push(meatyMeals.pop()!)

  const remaining = shuffle([...neutralMeals, ...veggieMeals, ...meatyMeals])
  while (balanced.length < count && remaining.length > 0) balanced.push(remaining.pop()!)

  return shuffle(balanced).slice(0, count)
}

/**
 * Draw upgrades for a player: distinct types, flavored to the game's theme
 * when one is set (falls back to the whole deck for 'plain').
 */
export function pickRandomUpgrades(allUpgrades: Upgrade[], count = 2, theme: Theme = 'plain'): Upgrade[] {
  let deck = allUpgrades
  if (theme !== 'plain') {
    const themed = deck.filter((u) => u.theme === theme)
    if (themed.length > 0) deck = themed
  }

  const selected: Upgrade[] = []
  const remaining = shuffle([...deck])
  while (selected.length < count && remaining.length > 0) {
    const next = remaining.pop()!
    if (selected.some((u) => u.type === next.type)) continue
    selected.push(next)
  }
  return selected
}

export function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
}

export const themedPlayerNames: Partial<Record<Theme, { A: string; B: string }[]>> = {
  fantasy: [
    { A: 'Sage', B: 'Knight' },
    { A: 'Ranger', B: 'Mage' },
    { A: 'Paladin', B: 'Rogue' },
    { A: 'Druid', B: 'Warrior' }
  ],
  cyberpunk: [
    { A: 'Neon', B: 'Glitch' },
    { A: 'Cipher', B: 'Blaze' },
    { A: 'Zero', B: 'Pulse' },
    { A: 'Ghost', B: 'Virus' }
  ],
  western: [
    { A: 'Dusty', B: 'Colt' },
    { A: 'Tex', B: 'Bandit' },
    { A: 'Marshal', B: 'Outlaw' },
    { A: 'Rider', B: 'Maverick' }
  ],
  noir: [
    { A: 'Shadow', B: 'Smoke' },
    { A: 'Ace', B: 'Fedora' },
    { A: 'Gumshoe', B: 'Dame' },
    { A: 'Sleuth', B: 'Whisper' }
  ],
  pirate: [
    { A: 'Captain', B: 'Bosun' },
    { A: 'Jolly', B: 'Bones' },
    { A: 'Anchor', B: 'Compass' },
    { A: 'Storm', B: 'Tide' }
  ],
  medieval: [
    { A: 'Lord', B: 'Lady' },
    { A: 'Duke', B: 'Duchess' },
    { A: 'Baron', B: 'Baroness' },
    { A: 'Squire', B: 'Herald' }
  ],
  space: [
    { A: 'Commander', B: 'Pilot' },
    { A: 'Nova', B: 'Cosmo' },
    { A: 'Orion', B: 'Vega' },
    { A: 'Astro', B: 'Stellar' }
  ],
  horror: [
    { A: 'Raven', B: 'Specter' },
    { A: 'Crypt', B: 'Phantom' },
    { A: 'Dusk', B: 'Shade' },
    { A: 'Wraith', B: 'Ghoul' }
  ]
}

export function getThemedPlayerNames(theme: Theme): { A: string; B: string } | null {
  const names = themedPlayerNames[theme]
  if (!names) return null
  return names[Math.floor(Math.random() * names.length)]
}

export function otherSeat(seat: Seat): Seat {
  return seat === 'A' ? 'B' : 'A'
}
