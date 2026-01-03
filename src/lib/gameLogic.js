import { getCostPoints, getBudgetPoints } from './gameDataClient.js';

/**
 * Validate a player's draft
 * @param {import('./gameState.js').GameState} state
 * @param {string} playerId - 'A' or 'B'
 * @param {Array} [allMeals] - Optional array of all meals for looking up harmonies (since they're removed from pool)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDraft(state, playerId, allMeals = null) {
  const player = state.players[playerId];
  const { settings } = state;
  const errors = [];

  // Check meal count (at least mealCount minus harmonies already secured)
  const mealsNeeded = settings.mealCount - (state.harmoniesSoFar?.length || 0);
  if (player.picks.length < mealsNeeded) {
    errors.push(`Must pick at least ${mealsNeeded} meals`);
  }

  // Check all picks are in pool
  const poolIds = state.pool.map(m => m.id);
  const invalidPicks = player.picks.filter(id => !poolIds.includes(id));
  if (invalidPicks.length > 0) {
    errors.push('Some picks are not in the meal pool');
  }

  // Check for duplicate picks
  const uniquePicks = new Set(player.picks);
  if (uniquePicks.size !== player.picks.length) {
    errors.push('Cannot pick the same meal twice');
  }

  // Check budget (cumulative across all rounds)
  const currentPicksCost = player.picks.reduce((sum, mealId) => {
    const meal = state.pool.find(m => m.id === mealId);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  // Add cost of harmonies already locked in
  // Use allMeals if provided (harmonies are removed from pool in later rounds)
  const mealsForLookup = allMeals || state.pool;
  const harmoniesCost = (state.harmoniesSoFar || []).reduce((sum, mealId) => {
    const meal = mealsForLookup.find(m => m.id === mealId);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  const cumulativeCost = harmoniesCost + currentPicksCost;
  const budgetLimit = getBudgetPoints(settings.budgetCap, settings.mealCount);
  if (budgetLimit !== null && cumulativeCost > budgetLimit) {
    errors.push(`Total cost (${cumulativeCost}) exceeds budget (${budgetLimit})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Resolve the draft and determine final menu
 * @param {import('./gameState.js').GameState} state
 * @returns {import('./gameState.js').GameResults}
 */
export function resolveDraft(state) {
  const playerA = state.players.A;
  const playerB = state.players.B;

  const harmonies = [];
  const conflicts = [];
  const finalMenuIds = new Set();

  // Find all picks and categorize
  const allPickedMeals = new Set([...playerA.picks, ...playerB.picks]);

  allPickedMeals.forEach(mealId => {
    const aHasPick = playerA.picks.includes(mealId);
    const bHasPick = playerB.picks.includes(mealId);

    if (aHasPick && bHasPick) {
      // Harmony! Both picked it
      harmonies.push(mealId);
      finalMenuIds.add(mealId);
    } else if (aHasPick || bHasPick) {
      // Conflict - only one picked it
      // 50/50 random resolution
      const winner = Math.random() < 0.5 ? 'A' : 'B';

      conflicts.push({
        meal: mealId,
        winner,
        playerABid: 0,
        playerBBid: 0
      });

      finalMenuIds.add(mealId);
    }
  });

  let finalMenu = Array.from(finalMenuIds);

  // Enforce budget if necessary
  const budgetLimit = getBudgetPoints(state.settings.budgetCap, state.settings.mealCount);
  if (budgetLimit !== null) {
    finalMenu = enforceBudget(finalMenu, state.pool, budgetLimit, conflicts);
  }

  return {
    finalMenu,
    harmonies,
    conflicts
  };
}

/**
 * Enforce budget by swapping out meals if over budget
 * @param {number[]} menuIds
 * @param {import('./gameData.js').Meal[]} pool
 * @param {number} budgetLimit
 * @param {import('./gameState.js').ConflictResult[]} conflicts
 * @returns {number[]}
 */
function enforceBudget(menuIds, pool, budgetLimit, conflicts) {
  const getMeal = (id) => pool.find(m => m.id === id);
  const totalCost = menuIds.reduce((sum, id) => sum + getCostPoints(getMeal(id).cost), 0);

  if (totalCost <= budgetLimit) {
    return menuIds; // Within budget
  }

  // Over budget - need to swap out conflict winners (random order since no bids)
  const conflictMeals = conflicts
    .map(c => ({
      mealId: c.meal,
      winner: c.winner
    }))
    .filter(c => menuIds.includes(c.mealId))
    .sort(() => Math.random() - 0.5); // Random order

  let currentMenu = [...menuIds];
  let currentCost = totalCost;

  // Remove lowest-bid conflict winners until under budget
  for (const conflict of conflictMeals) {
    if (currentCost <= budgetLimit) break;

    const meal = getMeal(conflict.mealId);
    currentMenu = currentMenu.filter(id => id !== conflict.mealId);
    currentCost -= getCostPoints(meal.cost);
  }

  return currentMenu;
}

/**
 * Calculate final statistics
 * @param {import('./gameState.js').GameState} state
 * @returns {{
 *   harmonies: number,
 *   conflicts: number,
 *   totalTime: number,
 *   totalCost: number,
 *   topCuisine: string,
 *   playerAWins: number,
 *   playerBWins: number
 * }}
 */
export function calculateStats(state) {
  if (!state.results) {
    return {
      harmonies: 0,
      conflicts: 0,
      totalTime: 0,
      totalCost: 0,
      topCuisine: 'N/A',
      playerAWins: 0,
      playerBWins: 0
    };
  }

  const harmonies = state.results.harmonies.length;
  const conflicts = state.results.conflicts.length;
  let totalTime = 0;
  let totalCost = 0;
  let playerAWins = 0;
  let playerBWins = 0;
  const cuisineCounts = {};

  // Calculate stats from final menu
  state.results.finalMenu.forEach(mealId => {
    const meal = state.pool.find(m => m.id === mealId);
    if (meal) {
      totalTime += meal.time;
      totalCost += getCostPoints(meal.cost);
      cuisineCounts[meal.cuisine] = (cuisineCounts[meal.cuisine] || 0) + 1;
    }
  });

  // Count wins
  state.results.conflicts.forEach(conflict => {
    if (conflict.winner === 'A') playerAWins++;
    if (conflict.winner === 'B') playerBWins++;
  });

  // Find top cuisine
  let topCuisine = 'Various';
  let maxCount = 0;
  Object.entries(cuisineCounts).forEach(([cuisine, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topCuisine = cuisine;
    }
  });

  return {
    harmonies,
    conflicts,
    totalTime,
    totalCost,
    topCuisine,
    playerAWins,
    playerBWins
  };
}

/**
 * Apply upgrade effect
 * @param {import('./gameState.js').GameState} state
 * @param {string} playerId
 * @param {string} upgradeId
 * @param {any} upgradeData - Upgrade-specific data
 * @returns {import('./gameState.js').GameState}
 */
export function applyUpgrade(state, playerId, upgradeId, upgradeData) {
  // Most upgrades are passive and checked during validation/resolution
  // Active upgrades (like reroll) are handled here

  if (upgradeId === 'reroll' && upgradeData?.replaceMealId && upgradeData?.newMeal) {
    // Replace a meal in the pool
    const pool = state.pool.map(meal =>
      meal.id === upgradeData.replaceMealId ? upgradeData.newMeal : meal
    );
    return { ...state, pool };
  }

  // Other upgrades don't modify state directly
  return state;
}

/**
 * Advance to the next day after resolving the current draft
 * @param {import('./gameState.js').GameState} state
 * @returns {import('./gameState.js').GameState}
 */
export function advanceDay(state) {
  const currentDay = state.currentDay || 0;
  const nextDay = currentDay + 1;
  const totalDays = state.settings.mealCount;

  // Add current harmonies to the running list
  const harmoniesSoFar = [
    ...(state.harmoniesSoFar || []),
    ...(state.results?.harmonies || [])
  ];

  // Check if game is complete
  if (nextDay >= totalDays || harmoniesSoFar.length >= state.settings.mealCount) {
    return {
      ...state,
      status: 'complete',
      harmoniesSoFar
    };
  }

  // Reset players for next day
  const newState = {
    ...state,
    currentDay: nextDay,
    harmoniesSoFar,
    players: {
      A: {
        ...state.players.A,
        picks: [],
        ready: false
      },
      B: {
        ...state.players.B,
        picks: [],
        ready: false
      }
    },
    results: null
  };

  return newState;
}
