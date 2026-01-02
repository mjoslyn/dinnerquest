import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Read all ingredient files to build a lookup map
const ingredientsDir = '/Users/michaeljoslyn/work/dinner-quest/src/content/ingredients';
const ingredientFiles = fs.readdirSync(ingredientsDir);

const ingredientLookup = new Map();

for (const file of ingredientFiles) {
  const content = JSON.parse(fs.readFileSync(path.join(ingredientsDir, file), 'utf-8'));

  // Map all common names to the ingredient ID
  for (const commonName of content.commonNames) {
    ingredientLookup.set(commonName.toLowerCase(), content.id);
  }
}

console.log(`Loaded ${ingredientLookup.size} ingredient mappings`);

// Process all meal files
const mealsDir = '/Users/michaeljoslyn/work/dinner-quest/src/content/meals';
const mealFiles = fs.readdirSync(mealsDir).filter(f => f.endsWith('.mdx'));

let updatedCount = 0;
let unmappedIngredients = new Set();

for (const mealFile of mealFiles) {
  const filePath = path.join(mealsDir, mealFile);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Extract ingredients line using regex
  const ingredientsMatch = content.match(/^ingredients: \[(.*?)\]$/m);

  if (!ingredientsMatch) {
    console.log(`No ingredients found in ${mealFile}`);
    continue;
  }

  const ingredientsStr = ingredientsMatch[1];

  // Parse ingredients array
  const ingredients = ingredientsStr
    .split(',')
    .map(s => s.trim().replace(/^"|"$/g, ''))
    .filter(s => s.length > 0);

  // Map to IDs
  const ingredientIds = [];
  for (const ingredient of ingredients) {
    const id = ingredientLookup.get(ingredient.toLowerCase());
    if (id) {
      ingredientIds.push(id);
    } else {
      unmappedIngredients.add(ingredient);
      console.warn(`Could not map ingredient: "${ingredient}" in ${mealFile}`);
    }
  }

  // Create new ingredients line
  const newIngredientsLine = `ingredients: [${ingredientIds.map(id => `"${id}"`).join(', ')}]`;

  // Replace the old line
  content = content.replace(/^ingredients: \[.*?\]$/m, newIngredientsLine);

  // Remove grocerySections field if present (for pork-chops.mdx)
  content = content.replace(/^grocerySections: \[.*?\]\n/m, '');

  // Write back
  fs.writeFileSync(filePath, content);
  updatedCount++;
}

console.log(`\nUpdated ${updatedCount} meal files`);

if (unmappedIngredients.size > 0) {
  console.log(`\nUnmapped ingredients (${unmappedIngredients.size}):`);
  for (const ing of unmappedIngredients) {
    console.log(`  - ${ing}`);
  }
}
