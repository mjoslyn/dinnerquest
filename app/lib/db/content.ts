import type { SupabaseClient } from '@supabase/supabase-js'
import type { Meal, Theme, Upgrade } from '../engine/types'

interface MealRow {
  id: number
  name: string
  emoji: string
  time_minutes: number
  cost: string
  estimated_price: number | null
  cuisine: string
  tags: string[]
  allergens: string[]
  diet_score: number
  ingredients: string[]
  description: string
}

function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    time: row.time_minutes,
    cost: row.cost as Meal['cost'],
    estimatedPrice: row.estimated_price,
    cuisine: row.cuisine,
    tags: row.tags,
    allergens: row.allergens,
    dietScore: row.diet_score,
    ingredients: row.ingredients,
    description: row.description
  }
}

export async function getAllMeals(db: SupabaseClient): Promise<Meal[]> {
  const { data, error } = await db.from('meals').select('*').order('id')
  if (error) throw new Error(`meals: ${error.message}`)
  return (data as MealRow[]).map(toMeal)
}

interface UpgradeRow {
  id: string
  name: string
  emoji: string
  type: Upgrade['type']
  effect: string
  theme: string | null
  rejection_text: string | null
  undo_text: string | null
  meal_name: string | null
  meal_cost: string | null
}

export async function getAllUpgrades(db: SupabaseClient): Promise<Upgrade[]> {
  const { data, error } = await db.from('upgrades').select('*')
  if (error) throw new Error(`upgrades: ${error.message}`)
  return (data as UpgradeRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    type: row.type,
    effect: row.effect,
    theme: row.theme,
    rejectionText: row.rejection_text,
    undoText: row.undo_text,
    mealName: row.meal_name,
    mealCost: row.meal_cost
  }))
}

export async function getNarrativeMessages(
  db: SupabaseClient,
  type: 'conflict' | 'harmony' | 'intro',
  theme: Theme = 'plain'
): Promise<string[]> {
  let query = db.from('narrative_messages').select('message,theme').eq('type', type)
  const { data, error } = await query
  if (error) throw new Error(`narrative: ${error.message}`)
  const rows = data as { message: string; theme: string | null }[]
  const themed = rows.filter((r) => r.theme === theme)
  const generic = rows.filter((r) => r.theme === null)
  return (themed.length > 0 ? themed : generic).map((r) => r.message)
}

export interface ShoppingList {
  byMeal: { mealId: number | string; mealName: string; emoji: string; ingredients: string[] }[]
  bySection: Record<string, { ingredient: string; meals: string[] }[]>
}

/** Meals here may include synthetic takeout/custom meals (no ingredients). */
export async function generateShoppingList(
  db: SupabaseClient,
  meals: { id: number | string; name: string; emoji: string; ingredients: string[] }[]
): Promise<ShoppingList> {
  const [{ data: ingredientRows, error: ingErr }, { data: sectionRows, error: secErr }] =
    await Promise.all([
      db.from('ingredients').select('id,name,section'),
      db.from('grocery_sections').select('id,name,sort_order').order('sort_order')
    ])
  if (ingErr) throw new Error(`ingredients: ${ingErr.message}`)
  if (secErr) throw new Error(`grocery_sections: ${secErr.message}`)

  const ingredientById = new Map(
    (ingredientRows as { id: string; name: string; section: string }[]).map((i) => [i.id, i])
  )

  const usage = new Map<string, { name: string; section: string; usedIn: string[] }>()
  for (const meal of meals) {
    for (const ingredientId of meal.ingredients || []) {
      const ingredient = ingredientById.get(ingredientId)
      if (!ingredient) continue
      if (!usage.has(ingredientId)) {
        usage.set(ingredientId, { name: ingredient.name, section: ingredient.section, usedIn: [] })
      }
      usage.get(ingredientId)!.usedIn.push(meal.name)
    }
  }

  const byMeal = meals.map((meal) => ({
    mealId: meal.id,
    mealName: meal.name,
    emoji: meal.emoji,
    ingredients: (meal.ingredients || []).map((id) => ingredientById.get(id)?.name ?? id)
  }))

  const bySection: ShoppingList['bySection'] = {}
  for (const section of sectionRows as { id: string; name: string }[]) {
    const items = [...usage.values()]
      .filter((u) => u.section === section.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ ingredient: u.name, meals: u.usedIn }))
    if (items.length > 0) bySection[section.name] = items
  }

  return { byMeal, bySection }
}
