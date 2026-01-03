import { getCollection } from 'astro:content';

/**
 * @typedef {Object} Meal
 * @property {number} id
 * @property {string} name
 * @property {string} emoji
 * @property {number} time - Minutes to prepare
 * @property {string} cost - $ to $$$
 * @property {string} cuisine
 * @property {string[]} tags
 * @property {string[]} allergens
 * @property {number} dietScore - 1 (veggie) to 5 (meaty)
 * @property {string[]} ingredients - List of ingredients needed
 * @property {string} description
 */

/**
 * Get all meals from the collection
 * @returns {Promise<Meal[]>}
 */
export async function getAllMeals() {
  const meals = await getCollection('meals');
  return meals.map(meal => ({
    ...meal.data,
    description: meal.body
  })).sort((a, b) => a.id - b.id);
}

/**
 * Get random meals from the pool, filtered and balanced
 * @param {number} count
 * @param {string[]} excludeAllergens
 * @param {number} avgDietPreference - Average of both players' diet preferences (1-5)
 * @returns {Promise<Meal[]>}
 */
export async function getRandomMeals(count, excludeAllergens = [], avgDietPreference = 3) {
  let meals = await getAllMeals();

  // Filter out meals with excluded allergens
  if (excludeAllergens.length > 0) {
    meals = meals.filter(meal =>
      !meal.allergens.some(allergen => excludeAllergens.includes(allergen))
    );
  }

  // Balance pool based on diet preference
  // If avg is low (veggie), bias toward low dietScore meals
  // If avg is high (meaty), bias toward high dietScore meals
  const balanced = [];
  const targetVeggie = Math.max(0, (5 - avgDietPreference) / 5 * count);
  const targetMeaty = Math.max(0, (avgDietPreference - 1) / 5 * count);

  // Categorize meals
  const veggieMeals = meals.filter(m => m.dietScore <= 2);
  const meatyMeals = meals.filter(m => m.dietScore >= 4);
  const neutralMeals = meals.filter(m => m.dietScore === 3);

  // Shuffle each category
  const shuffleArray = (arr) => arr.sort(() => Math.random() - 0.5);
  shuffleArray(veggieMeals);
  shuffleArray(meatyMeals);
  shuffleArray(neutralMeals);

  // Build balanced pool
  for (let i = 0; i < targetVeggie && veggieMeals.length > 0; i++) {
    balanced.push(veggieMeals.pop());
  }
  for (let i = 0; i < targetMeaty && meatyMeals.length > 0; i++) {
    balanced.push(meatyMeals.pop());
  }

  // Fill remainder with neutral and any remaining
  const remaining = [...neutralMeals, ...veggieMeals, ...meatyMeals];
  shuffleArray(remaining);
  while (balanced.length < count && remaining.length > 0) {
    balanced.push(remaining.pop());
  }

  // Final shuffle
  return shuffleArray(balanced).slice(0, count);
}

/**
 * Get all upgrades from the collection
 * @returns {Promise<Array>}
 */
export async function getAllUpgrades() {
  const upgrades = await getCollection('upgrades');
  return upgrades.map(upgrade => ({
    ...upgrade.data,
    description: upgrade.body
  }));
}

/**
 * Get random upgrades for a player
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function getRandomUpgrades(count = 2) {
  const allUpgrades = await getAllUpgrades();
  const shuffled = allUpgrades.sort(() => Math.random() - 0.5);

  const selected = [];
  let hasTakeout = false;
  let hasLock = false;

  for (const upgrade of shuffled) {
    // Skip if we already have max of this type
    if (upgrade.type === 'takeout' && hasTakeout) continue;
    if (upgrade.type === 'lock' && hasLock) continue;

    selected.push(upgrade);

    if (upgrade.type === 'takeout') hasTakeout = true;
    if (upgrade.type === 'lock') hasLock = true;

    if (selected.length >= count) break;
  }

  return selected;
}

/**
 * Get narrative messages by type
 * @param {string} type - 'conflict', 'harmony', or 'intro'
 * @returns {Promise<string[]>}
 */
export async function getNarrativeMessages(type) {
  const narrative = await getCollection('narrative');
  const entry = narrative.find(n => n.data.type === type);
  return entry ? entry.data.messages : [];
}

/**
 * Get random message from array
 * @param {string[]} messages
 * @returns {string}
 */
export function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get cost in points
 * @param {string} cost - $ to $$$
 * @returns {number}
 */
export function getCostPoints(cost) {
  const costMap = { '$': 1, '$$': 2, '$$$': 3 };
  return costMap[cost] || 0;
}

/**
 * Get budget cap in points
 * @param {string} budgetCap - 'tight', 'moderate', 'fancy', or 'none'
 * @param {number} mealCount - Number of meals for the week
 * @returns {number | null} - Points allowed, or null for no limit
 */
export function getBudgetPoints(budgetCap, mealCount) {
  const budgetMap = {
    'tight': Math.floor(mealCount * 1.3),    // Mostly $ meals
    'moderate': Math.floor(mealCount * 1.8), // Mix of $ and $$
    'fancy': Math.floor(mealCount * 2.5),    // Allows some $$$
    'none': null                              // No limit
  };
  return budgetMap[budgetCap];
}

/**
 * Themed player name pairs for each theme
 * Each theme has multiple name pair options for variety
 */
export const themedPlayerNames = {
  'theme-fantasy': [
    { A: 'Sage', B: 'Knight' },
    { A: 'Ranger', B: 'Mage' },
    { A: 'Paladin', B: 'Rogue' },
    { A: 'Druid', B: 'Warrior' }
  ],
  'theme-cyberpunk': [
    { A: 'Neon', B: 'Glitch' },
    { A: 'Cipher', B: 'Blaze' },
    { A: 'Zero', B: 'Pulse' },
    { A: 'Ghost', B: 'Virus' }
  ],
  'theme-western': [
    { A: 'Dusty', B: 'Colt' },
    { A: 'Tex', B: 'Bandit' },
    { A: 'Marshal', B: 'Outlaw' },
    { A: 'Rider', B: 'Maverick' }
  ],
  'theme-noir': [
    { A: 'Shadow', B: 'Smoke' },
    { A: 'Ace', B: 'Fedora' },
    { A: 'Gumshoe', B: 'Dame' },
    { A: 'Sleuth', B: 'Whisper' }
  ],
  'theme-pirate': [
    { A: 'Captain', B: 'Bosun' },
    { A: 'Jolly', B: 'Bones' },
    { A: 'Anchor', B: 'Compass' },
    { A: 'Storm', B: 'Tide' }
  ],
  'theme-medieval': [
    { A: 'Lord', B: 'Lady' },
    { A: 'Duke', B: 'Duchess' },
    { A: 'Baron', B: 'Baroness' },
    { A: 'Squire', B: 'Herald' }
  ],
  'theme-space': [
    { A: 'Commander', B: 'Pilot' },
    { A: 'Nova', B: 'Cosmo' },
    { A: 'Orion', B: 'Vega' },
    { A: 'Astro', B: 'Stellar' }
  ],
  'theme-horror': [
    { A: 'Raven', B: 'Specter' },
    { A: 'Crypt', B: 'Phantom' },
    { A: 'Dusk', B: 'Shade' },
    { A: 'Wraith', B: 'Ghoul' }
  ]
};

/**
 * Get random themed player names for a theme
 * @param {string} theme - Theme class name (e.g., 'theme-fantasy')
 * @returns {{ A: string, B: string }} Player name pair
 */
export function getThemedPlayerNames(theme) {
  const names = themedPlayerNames[theme] || themedPlayerNames['theme-fantasy'];
  return names[Math.floor(Math.random() * names.length)];
}

// Removed getGrocerySection - now using content collections for ingredient categorization

/**
 * Generate shopping list from meals using content collections
 * @param {Meal[]} meals
 * @returns {Promise<Object>} Shopping list with by-meal and by-section views
 */
export async function generateShoppingList(meals) {
  const allIngredients = await getCollection('ingredients');
  const allSections = await getCollection('grocery-sections');

  // Build ingredient map with meal associations
  const ingredientMap = new Map();

  for (const meal of meals) {
    for (const ingredientId of meal.ingredients || []) {
      const ingredientEntry = allIngredients.find(i => i.id === ingredientId);
      if (!ingredientEntry) continue;

      const ingredient = ingredientEntry.data;

      if (!ingredientMap.has(ingredientId)) {
        ingredientMap.set(ingredientId, {
          id: ingredient.id,
          name: ingredient.name,
          section: ingredient.section,
          usedIn: []
        });
      }
      ingredientMap.get(ingredientId).usedIn.push(meal.name);
    }
  }

  // Build byMeal view
  const byMeal = meals.map(meal => ({
    mealId: meal.id,
    mealName: meal.name,
    emoji: meal.emoji,
    ingredients: (meal.ingredients || []).map(id => {
      const ingredientEntry = allIngredients.find(i => i.id === id);
      return ingredientEntry ? ingredientEntry.data.name : id;
    })
  }));

  // Group by section
  const sections = allSections
    .map(s => s.data)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const bySection = {};

  for (const section of sections) {
    const sectionIngredients = Array.from(ingredientMap.values())
      .filter(ing => ing.section === section.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (sectionIngredients.length > 0) {
      bySection[section.name] = sectionIngredients.map(ing => ({
        ingredient: ing.name,
        meals: ing.usedIn
      }));
    }
  }

  return { byMeal, bySection };
}
