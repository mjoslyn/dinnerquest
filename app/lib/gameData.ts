/**
 * Game data - meals, upgrades, and static content
 */

import mealsData from '../data/meals.json';
import upgradesData from '../data/upgrades.json';
import ingredientsData from '../data/ingredients.json';
import grocerySectionsData from '../data/grocery-sections.json';
import type { Upgrade } from './gameState';

export interface Meal {
  id: number;
  name: string;
  emoji: string;
  time: number;
  cost: '$' | '$$' | '$$$';
  estimatedPrice: number;
  cuisine: string;
  tags: string[];
  allergens: string[];
  dietScore: number;
  ingredients: string[];
  description: string;
}

export interface Ingredient {
  id: string;
  name: string;
  section: string;
  commonNames?: string[];
}

export interface GrocerySection {
  id: string;
  name: string;
  sortOrder: number;
  emoji: string;
}

// Cast imported data to proper types
const meals: Meal[] = mealsData as Meal[];
const upgrades: Upgrade[] = upgradesData as Upgrade[];
const ingredients: Ingredient[] = ingredientsData as Ingredient[];
const grocerySections: GrocerySection[] = grocerySectionsData as GrocerySection[];

/**
 * Get all meals
 */
export function getAllMeals(): Meal[] {
  return meals;
}

/**
 * Get meal by ID
 */
export function getMealById(id: number): Meal | undefined {
  return meals.find(m => m.id === id);
}

/**
 * Get random meals from the pool, filtered and balanced
 */
export function getRandomMeals(
  count: number,
  excludeAllergens: string[] = [],
  avgDietPreference: number = 3
): Meal[] {
  // Filter out meals with excluded allergens
  let filtered = meals.filter(meal =>
    !meal.allergens.some(allergen => excludeAllergens.includes(allergen))
  );

  // Balance pool based on diet preference
  const balanced: Meal[] = [];
  const targetVeggie = Math.max(0, (5 - avgDietPreference) / 5 * count);
  const targetMeaty = Math.max(0, (avgDietPreference - 1) / 5 * count);

  // Categorize meals
  const veggieMeals = filtered.filter(m => m.dietScore <= 2);
  const meatyMeals = filtered.filter(m => m.dietScore >= 4);
  const neutralMeals = filtered.filter(m => m.dietScore === 3);

  // Shuffle each category
  const shuffleArray = <T>(arr: T[]): T[] => arr.sort(() => Math.random() - 0.5);
  shuffleArray(veggieMeals);
  shuffleArray(meatyMeals);
  shuffleArray(neutralMeals);

  // Build balanced pool
  for (let i = 0; i < targetVeggie && veggieMeals.length > 0; i++) {
    balanced.push(veggieMeals.pop()!);
  }
  for (let i = 0; i < targetMeaty && meatyMeals.length > 0; i++) {
    balanced.push(meatyMeals.pop()!);
  }

  // Fill remainder with neutral and any remaining
  const remaining = [...neutralMeals, ...veggieMeals, ...meatyMeals];
  shuffleArray(remaining);
  while (balanced.length < count && remaining.length > 0) {
    balanced.push(remaining.pop()!);
  }

  // Final shuffle
  return shuffleArray(balanced).slice(0, count);
}

/**
 * Get all upgrades
 */
export function getAllUpgrades(): Upgrade[] {
  return upgrades;
}

/**
 * Get upgrade by ID
 */
export function getUpgradeById(id: string): Upgrade | undefined {
  return upgrades.find(u => u.id === id);
}

/**
 * Get random upgrades for a player
 */
export function getRandomUpgrades(count: number = 2, theme: string | null = null): Upgrade[] {
  // Filter upgrades: include ALL theme upgrades, but filter non-theme upgrades by current theme
  let availableUpgrades = upgrades;
  if (theme) {
    // Extract theme name from class (e.g., 'theme-fantasy' -> 'fantasy')
    const themeName = theme.replace('theme-', '');
    availableUpgrades = upgrades.filter(upgrade => {
      // Include all theme upgrades regardless of current theme
      if (upgrade.type === 'theme') return true;
      // For non-theme upgrades, only include ones matching current theme
      return upgrade.id.endsWith(`-${themeName}`);
    });
  }

  const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5);

  const selected: Upgrade[] = [];
  let hasTakeout = false;
  let hasLock = false;
  let hasRedraw = false;

  for (const upgrade of shuffled) {
    // Skip if we already have max of this type
    if (upgrade.type === 'takeout' && hasTakeout) continue;
    if (upgrade.type === 'lock' && hasLock) continue;
    if (upgrade.type === 'redraw' && hasRedraw) continue;

    selected.push(upgrade);

    if (upgrade.type === 'takeout') hasTakeout = true;
    if (upgrade.type === 'lock') hasLock = true;
    if (upgrade.type === 'redraw') hasRedraw = true;

    if (selected.length >= count) break;
  }

  return selected;
}

/**
 * Hydrate upgrade IDs with full upgrade data
 */
export function hydrateUpgrades(upgradeIds: { id: string }[]): Upgrade[] {
  return upgradeIds.map(u => getUpgradeById(u.id) || u as Upgrade);
}

/**
 * Get cost in points
 */
export function getCostPoints(cost: string): number {
  const costMap: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3 };
  return costMap[cost] || 0;
}

/**
 * Get budget cap in points
 */
export function getBudgetPoints(budgetCap: string, mealCount: number): number | null {
  const budgetMap: Record<string, number | null> = {
    'tight': Math.floor(mealCount * 1.3),
    'moderate': Math.floor(mealCount * 1.8),
    'fancy': Math.floor(mealCount * 2.5),
    'none': null
  };
  return budgetMap[budgetCap] ?? null;
}

/**
 * Themed player name pairs for each theme
 */
const themedPlayerNames: Record<string, { A: string; B: string }[]> = {
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
 */
export function getThemedPlayerNames(theme: string): { A: string; B: string } {
  const names = themedPlayerNames[theme] || themedPlayerNames['theme-fantasy'];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Generate shopping list from meal IDs
 */
export function generateShoppingList(mealIds: number[]): {
  byMeal: { mealId: number; mealName: string; emoji: string; ingredients: string[] }[];
  bySection: Record<string, { ingredient: string; meals: string[] }[]>;
} {
  const selectedMeals = mealIds
    .map(id => meals.find(m => m.id === id))
    .filter((m): m is Meal => m !== undefined);

  // Build ingredient map with meal associations
  const ingredientMap = new Map<string, { id: string; name: string; section: string; usedIn: string[] }>();

  for (const meal of selectedMeals) {
    for (const ingredientId of meal.ingredients || []) {
      const ingredientEntry = ingredients.find(i => i.id === ingredientId);
      if (!ingredientEntry) continue;

      if (!ingredientMap.has(ingredientId)) {
        ingredientMap.set(ingredientId, {
          id: ingredientEntry.id,
          name: ingredientEntry.name,
          section: ingredientEntry.section,
          usedIn: []
        });
      }
      ingredientMap.get(ingredientId)!.usedIn.push(meal.name);
    }
  }

  // Build byMeal view
  const byMeal = selectedMeals.map(meal => ({
    mealId: meal.id,
    mealName: meal.name,
    emoji: meal.emoji,
    ingredients: (meal.ingredients || []).map(id => {
      const ingredientEntry = ingredients.find(i => i.id === id);
      return ingredientEntry ? ingredientEntry.name : id;
    })
  }));

  // Group by section
  const bySection: Record<string, { ingredient: string; meals: string[] }[]> = {};

  for (const section of grocerySections) {
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
