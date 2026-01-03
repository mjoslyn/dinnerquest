/**
 * Client-side utilities for fetching game data from API endpoints
 * (Cannot use astro:content on client side)
 */

/**
 * Themed player name pairs for each theme
 * Each theme has multiple name pair options for variety
 */
const themedPlayerNames = {
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
    { A: 'Nebula', B: 'Comet' }
  ],
  'theme-horror': [
    { A: 'Raven', B: 'Specter' },
    { A: 'Shade', B: 'Wraith' },
    { A: 'Crypt', B: 'Haunt' },
    { A: 'Eerie', B: 'Dread' }
  ]
};

/**
 * Get a random themed player name pair
 * @param {string} theme
 * @returns {{ A: string, B: string }}
 */
export function getThemedPlayerNames(theme) {
  const names = themedPlayerNames[theme] || themedPlayerNames['theme-fantasy'];
  return names[Math.floor(Math.random() * names.length)];
}

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
 * @param {string} theme - Theme class name (e.g., 'theme-fantasy')
 * @returns {Promise<Array>}
 */
export async function getRandomUpgrades(count = 2, theme = null) {
  const themeParam = theme ? `&theme=${encodeURIComponent(theme)}` : '';
  const response = await fetch(`/api/upgrades?count=${count}${themeParam}`);
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
