/**
 * Client-side utilities for fetching game data from API endpoints
 * (Cannot use astro:content on client side)
 */

/**
 * Fetch all meals from API
 * @returns {Promise<Array>}
 */
export async function getAllMeals() {
  const response = await fetch('/api/meals');
  if (!response.ok) {
    throw new Error('Failed to fetch meals');
  }
  return response.json();
}

/**
 * Fetch all upgrades from API
 * @returns {Promise<Array>}
 */
export async function getAllUpgrades() {
  const response = await fetch('/api/upgrades?all=true');
  if (!response.ok) {
    throw new Error('Failed to fetch upgrades');
  }
  return response.json();
}

/**
 * Fetch random upgrades from API
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function getRandomUpgrades(count = 2) {
  const response = await fetch(`/api/upgrades?count=${count}`);
  if (!response.ok) {
    throw new Error('Failed to fetch upgrades');
  }
  return response.json();
}

/**
 * Get random meals filtered by criteria (client-side filtering)
 * @param {number} count
 * @param {string[]} excludeAllergens
 * @param {number} avgDietPreference
 * @returns {Promise<Array>}
 */
export async function getRandomMeals(count, excludeAllergens = [], avgDietPreference = 3) {
  const allMeals = await getAllMeals();

  // Filter by allergens
  let filtered = allMeals.filter(meal => {
    return !meal.allergens.some(allergen => excludeAllergens.includes(allergen));
  });

  // Weight by diet preference
  const weighted = filtered.map(meal => {
    const dietDiff = Math.abs(meal.dietScore - avgDietPreference);
    const weight = Math.max(1, 5 - dietDiff);
    return { meal, weight };
  });

  // Weighted random selection
  const selected = [];
  const available = [...weighted];

  while (selected.length < count && available.length > 0) {
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < available.length; i++) {
      random -= available[i].weight;
      if (random <= 0) {
        selected.push(available[i].meal);
        available.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

/**
 * Get cost points for a meal cost string
 * @param {string} cost - '$', '$$', or '$$$'
 * @returns {number}
 */
export function getCostPoints(cost) {
  const costMap = { '$': 1, '$$': 2, '$$$': 3 };
  return costMap[cost] || 0;
}

/**
 * Get budget points for a budget cap and meal count
 * @param {string} budgetCap - 'tight', 'moderate', 'fancy', or 'none'
 * @param {number} mealCount
 * @returns {number|null}
 */
export function getBudgetPoints(budgetCap, mealCount) {
  const budgetMap = {
    'tight': Math.floor(mealCount * 1.3),
    'moderate': Math.floor(mealCount * 1.8),
    'fancy': Math.floor(mealCount * 2.5),
    'none': null
  };
  return budgetMap[budgetCap];
}
