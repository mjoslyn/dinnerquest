// Parses the /content collections (MDX frontmatter + JSON) into row objects
// matching the Supabase content tables. Node-only (fs, gray-matter) — never
// imported by the Worker.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

const CONTENT_DIR = join(import.meta.dirname, '../../content')

const mealSchema = z.object({
  id: z.number(),
  name: z.string(),
  emoji: z.string(),
  time: z.number(),
  cost: z.enum(['$', '$$', '$$$']),
  estimatedPrice: z.number().optional(),
  cuisine: z.string(),
  tags: z.array(z.string()).default([]),
  allergens: z.array(z.enum(['dairy', 'gluten', 'nuts', 'shellfish', 'soy', 'eggs', 'fish'])).default([]),
  dietScore: z.number().min(1).max(5),
  ingredients: z.array(z.string()).default([])
})

const upgradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  type: z.enum(['theme', 'lock', 'takeout', 'redraw', 'custom']),
  effect: z.string(),
  themeStyle: z.string().optional(),
  rejectionText: z.string().optional(),
  undoText: z.string().optional(),
  mealName: z.string().optional(),
  mealCost: z.string().optional()
})

const narrativeSchema = z.object({
  type: z.enum(['conflict', 'harmony', 'intro']),
  messages: z.array(z.string())
})

const grocerySectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  emoji: z.string().optional()
})

const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  section: z.string(),
  commonNames: z.array(z.string()).default([])
})

const THEMES = ['fantasy', 'cyberpunk', 'western', 'noir', 'pirate', 'medieval', 'space', 'horror']

function mdxFiles(dir: string) {
  return readdirSync(join(CONTENT_DIR, dir))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => ({ file: f, ...matter(readFileSync(join(CONTENT_DIR, dir, f), 'utf8')) }))
}

function jsonFiles(dir: string) {
  return readdirSync(join(CONTENT_DIR, dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CONTENT_DIR, dir, f), 'utf8')))
}

function themeFromId(id: string): string | null {
  const suffix = id.slice(id.lastIndexOf('-') + 1)
  return THEMES.includes(suffix) ? suffix : null
}

export function parseMeals() {
  return mdxFiles('meals').map(({ file, data, content }) => {
    const m = mealSchema.parse(data)
    return {
      id: m.id,
      name: m.name,
      emoji: m.emoji,
      time_minutes: m.time,
      cost: m.cost,
      estimated_price: m.estimatedPrice ?? null,
      cuisine: m.cuisine,
      tags: m.tags,
      allergens: m.allergens,
      diet_score: m.dietScore,
      ingredients: m.ingredients,
      description: content.trim()
    }
  })
}

export function parseUpgrades() {
  return mdxFiles('upgrades')
    .map(({ data, content }) => ({ u: upgradeSchema.parse(data), description: content.trim() }))
    .filter(({ u }) => u.type !== 'theme') // theme upgrades removed: themes are now a picker
    .map(({ u, description }) => ({
      id: u.id,
      name: u.name,
      emoji: u.emoji,
      type: u.type,
      effect: u.effect,
      theme: themeFromId(u.id),
      rejection_text: u.rejectionText ?? null,
      undo_text: u.undoText ?? null,
      meal_name: u.mealName ?? null,
      meal_cost: u.mealCost ?? null,
      description
    }))
}

export function parseNarrative() {
  return mdxFiles('narrative').flatMap(({ file, data }) => {
    const n = narrativeSchema.parse(data)
    const theme = themeFromId(file.replace(/\.mdx$/, ''))
    return n.messages.map((message) => ({ type: n.type, theme, message }))
  })
}

export function parseGrocerySections() {
  return jsonFiles('grocery-sections').map((raw) => {
    const s = grocerySectionSchema.parse(raw)
    return { id: s.id, name: s.name, sort_order: s.sortOrder, emoji: s.emoji ?? null }
  })
}

export function parseIngredients() {
  return jsonFiles('ingredients').map((raw) => {
    const i = ingredientSchema.parse(raw)
    return { id: i.id, name: i.name, section: i.section, common_names: i.commonNames }
  })
}
