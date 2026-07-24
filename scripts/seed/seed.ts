// Seeds/updates Supabase content tables from /content. Idempotent: upserts on
// primary keys; narrative_messages (identity pk) is replaced wholesale.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed/seed.ts
// (reads .env if present)
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseMeals,
  parseUpgrades,
  parseNarrative,
  parseGrocerySections,
  parseIngredients
} from './parse-content.ts'

const envPath = join(import.meta.dirname, '../../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in env or .env)')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function upsert(table: string, rows: object[], chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + chunkSize))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`${table}: ${rows.length} rows`)
}

const sections = parseGrocerySections()
const ingredients = parseIngredients()
const meals = parseMeals()
const upgrades = parseUpgrades()
const narrative = parseNarrative()

await upsert('grocery_sections', sections)
await upsert('ingredients', ingredients)
await upsert('meals', meals)
await upsert('upgrades', upgrades)

const { error: delErr } = await db.from('narrative_messages').delete().neq('id', 0)
if (delErr) throw new Error(`narrative_messages delete: ${delErr.message}`)
await upsert('narrative_messages', narrative)

console.log('Seed complete.')
