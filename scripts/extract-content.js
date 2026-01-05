#!/usr/bin/env node

/**
 * Extract content from MDX files and generate static JSON data
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, '../src/content');
const outputDir = join(__dirname, '../app/data');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

/**
 * Parse YAML frontmatter from MDX file
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: content };

  const frontmatter = match[1];
  const body = match[2].trim();

  // Simple YAML parser for our use case
  const data = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of frontmatter.split('\n')) {
    // Array item
    if (line.match(/^\s*-\s*/)) {
      if (currentArray !== null) {
        const value = line.replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim();
        data[currentKey].push(value);
      }
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();

      // Check if it's an array start
      if (value === '' || value === '[]') {
        data[currentKey] = [];
        currentArray = currentKey;
        continue;
      }

      // Inline array like ["a", "b"]
      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).split(',').map(v =>
          v.trim().replace(/^["']|["']$/g, '')
        ).filter(v => v);
        data[currentKey] = items;
        currentArray = null;
        continue;
      }

      // String value
      value = value.replace(/^["']|["']$/g, '');

      // Type conversion
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      data[currentKey] = value;
      currentArray = null;
    }
  }

  return { data, body };
}

// Extract meals
console.log('Extracting meals...');
const mealsDir = join(contentDir, 'meals');
const meals = [];

for (const file of readdirSync(mealsDir)) {
  if (!file.endsWith('.mdx')) continue;
  const content = readFileSync(join(mealsDir, file), 'utf-8');
  const { data, body } = parseFrontmatter(content);
  meals.push({
    ...data,
    description: body
  });
}

// Sort by ID
meals.sort((a, b) => a.id - b.id);
writeFileSync(join(outputDir, 'meals.json'), JSON.stringify(meals, null, 2));
console.log(`  Extracted ${meals.length} meals`);

// Extract upgrades
console.log('Extracting upgrades...');
const upgradesDir = join(contentDir, 'upgrades');
const upgrades = [];

for (const file of readdirSync(upgradesDir)) {
  if (!file.endsWith('.mdx')) continue;
  const content = readFileSync(join(upgradesDir, file), 'utf-8');
  const { data, body } = parseFrontmatter(content);
  upgrades.push({
    ...data,
    description: body
  });
}

writeFileSync(join(outputDir, 'upgrades.json'), JSON.stringify(upgrades, null, 2));
console.log(`  Extracted ${upgrades.length} upgrades`);

// Extract ingredients
console.log('Extracting ingredients...');
const ingredientsDir = join(contentDir, 'ingredients');
const ingredients = [];

for (const file of readdirSync(ingredientsDir)) {
  if (!file.endsWith('.json')) continue;
  const content = readFileSync(join(ingredientsDir, file), 'utf-8');
  ingredients.push(JSON.parse(content));
}

writeFileSync(join(outputDir, 'ingredients.json'), JSON.stringify(ingredients, null, 2));
console.log(`  Extracted ${ingredients.length} ingredients`);

// Extract grocery sections
console.log('Extracting grocery sections...');
const sectionsDir = join(contentDir, 'grocery-sections');
const sections = [];

for (const file of readdirSync(sectionsDir)) {
  if (!file.endsWith('.json')) continue;
  const content = readFileSync(join(sectionsDir, file), 'utf-8');
  sections.push(JSON.parse(content));
}

sections.sort((a, b) => a.sortOrder - b.sortOrder);
writeFileSync(join(outputDir, 'grocery-sections.json'), JSON.stringify(sections, null, 2));
console.log(`  Extracted ${sections.length} grocery sections`);

console.log('Done! Data files written to app/data/');
