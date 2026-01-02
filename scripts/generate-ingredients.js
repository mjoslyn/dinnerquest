import fs from 'fs';
import path from 'path';

// The categorization logic from gameData.js
function getGrocerySection(ingredient) {
  const lowerIngredient = ingredient.toLowerCase();

  // Produce
  if (/lettuce|tomato|onion|garlic|bell pepper|pepper|cucumber|carrot|celery|spinach|kale|arugula|broccoli|cauliflower|zucchini|mushroom|potato|sweet potato|avocado|lemon|lime|basil|cilantro|parsley|dill|thyme|rosemary|ginger|jalape|scallion|green onion|cabbage|bok choy|snap pea|edamame|corn|bean sprout|mint|lettuce|romaine|asparagus|eggplant|butternut squash|cherry tomato|kale|red onion|snow pea/.test(lowerIngredient)) {
    return 'produce';
  }

  // Meat & Seafood
  if (/chicken|beef|pork|salmon|tuna|shrimp|fish|steak|ground beef|bacon|sausage|turkey|lamb|chorizo|cod|mahi|halibut|crab|lobster|fillet|ribs|brisket|chuck|sirloin|flank|ribeye|ahi|pancetta|belly/.test(lowerIngredient)) {
    return 'meat-seafood';
  }

  // Dairy
  if (/milk|cheese|yogurt|butter|cream|sour cream|mozzarella|parmesan|cheddar|feta|ricotta|goat cheese|blue cheese|provolone|swiss|cottage cheese|queso|gruyère|monterey|pecorino|buttermilk/.test(lowerIngredient)) {
    return 'dairy';
  }

  // Grains & Pasta
  if (/pasta|noodle|rice|bread|tortilla|bun|roll|pita|naan|couscous|quinoa|flour|oat|cereal|cracker|bagel|english muffin|spaghetti|penne|ziti|ramen|udon|soba|vermicelli|orzo|fettuccine|linguine|elbow|ditalini|arborio|dumpling wrapper|crust/.test(lowerIngredient)) {
    return 'grains-pasta';
  }

  // Canned & Jarred
  if (/canned|can of|tomato paste|tomato sauce|coconut milk|broth|stock|salsa|pesto|marinara|alfredo|enchilada sauce|soy sauce|fish sauce|hoisin|teriyaki|worcestershire|hot sauce|sriracha|tabasco|pickles|olives|capers|artichoke|bean|chickpea|black bean|kidney bean|cannellini|buffalo sauce/.test(lowerIngredient)) {
    return 'canned-jarred';
  }

  // Spices & Seasonings
  if (/salt|cumin|paprika|chili powder|cayenne|oregano|sage|cinnamon|nutmeg|turmeric|curry|coriander|cardamom|clove|bay leaf|red pepper flake|italian seasoning|garlic powder|onion powder|mustard powder|vanilla|taco seasoning|herbes de provence/.test(lowerIngredient) && !/fresh/.test(lowerIngredient) && !/bell/.test(lowerIngredient) && !/black pepper|pepper$/.test(lowerIngredient)) {
    return 'spices-seasonings';
  }

  // Oils & Condiments
  if (/oil|olive oil|vegetable oil|sesame oil|coconut oil|vinegar|balsamic|mustard|mayo|ketchup|bbq sauce|honey|maple syrup|jam|jelly|peanut butter|tahini|ranch|miso|tartar|guacamole|wasabi|mirin/.test(lowerIngredient)) {
    return 'oils-condiments';
  }

  // Frozen
  if (/frozen|hash brown/.test(lowerIngredient)) {
    return 'frozen';
  }

  // Bakery
  if (/bagel|croissant|muffin|donut|cake|cookie|pie|pastry|breadcrumb|pancake mix/.test(lowerIngredient)) {
    return 'bakery';
  }

  // Beverages
  if (/wine|beer|juice|soda|coffee|tea|water|vodka/.test(lowerIngredient)) {
    return 'beverages';
  }

  // Default
  return 'produce';
}

// Read unique ingredients
const ingredientsRaw = fs.readFileSync('/tmp/unique-ingredients.txt', 'utf-8')
  .split('\n')
  .filter(line => line.trim());

// Normalize and group ingredients
const ingredientMap = new Map();

for (const raw of ingredientsRaw) {
  const normalized = raw.toLowerCase().trim();

  // Create a canonical ID (kebab-case)
  let id = normalized
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Handle plurals - use plural form as canonical
  const singularId = id.replace(/s$/, '');

  if (ingredientMap.has(singularId) && !ingredientMap.has(id)) {
    // If singular exists, add to its commonNames
    const existing = ingredientMap.get(singularId);
    existing.commonNames.push(normalized);
    continue;
  }

  if (ingredientMap.has(id)) {
    // Add to existing commonNames
    const existing = ingredientMap.get(id);
    if (!existing.commonNames.includes(normalized)) {
      existing.commonNames.push(normalized);
    }
    continue;
  }

  // Create new ingredient entry
  const name = raw
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const section = getGrocerySection(normalized);

  ingredientMap.set(id, {
    id,
    name,
    section,
    commonNames: [normalized]
  });
}

// Create ingredients directory
const ingredientsDir = '/Users/michaeljoslyn/work/dinner-quest/src/content/ingredients';
if (!fs.existsSync(ingredientsDir)) {
  fs.mkdirSync(ingredientsDir, { recursive: true });
}

// Write JSON files
let count = 0;
for (const [id, data] of ingredientMap.entries()) {
  const filePath = path.join(ingredientsDir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  count++;
}

console.log(`Created ${count} ingredient JSON files`);
console.log(`Distribution by section:`);

// Count by section
const sectionCounts = {};
for (const data of ingredientMap.values()) {
  sectionCounts[data.section] = (sectionCounts[data.section] || 0) + 1;
}

Object.entries(sectionCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([section, count]) => {
    console.log(`  ${section}: ${count}`);
  });
