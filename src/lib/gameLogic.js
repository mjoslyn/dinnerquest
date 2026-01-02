import { getCostPoints, getBudgetPoints } from './gameDataClient.js';

/**
 * Get total tokens for a player (mealCount * 2 + upgrades)
 * @param {import('./gameState.js').Player} player
 * @param {number} mealCount
 * @returns {number}
 */
export function getPlayerTokenLimit(player, mealCount) {
  let baseTokens = mealCount * 2;

  // Check for token boost upgrade
  const hasTokenBoost = player.upgrades.some(u => u.id === 'token-boost');
  if (hasTokenBoost) {
    baseTokens += 2;
  }

  return baseTokens;
}

/**
 * Validate a player's draft
 * @param {import('./gameState.js').GameState} state
 * @param {string} playerId - 'A' or 'B'
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDraft(state, playerId) {
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

  // Check token total (meal count * 2)
  const tokenLimit = getPlayerTokenLimit(player, settings.mealCount);
  const tokenTotal = Object.values(player.tokens).reduce((sum, t) => sum + t, 0);

  // Each pick costs 1 token automatically, so total tokens = picks + additional
  const totalTokensUsed = player.picks.length + tokenTotal;
  if (totalTokensUsed > tokenLimit) {
    errors.push(`Cannot use more than ${tokenLimit} tokens (currently using ${totalTokensUsed}: ${player.picks.length} for picks + ${tokenTotal} additional)`);
  }

  // Check token range (1-3 additional per meal)
  const invalidTokens = Object.values(player.tokens).filter(t => t < 0 || t > 3);
  if (invalidTokens.length > 0) {
    errors.push('Additional tokens per meal must be 0-3');
  }

  // Check tokens only on picked meals
  const tokenMealIds = Object.keys(player.tokens).map(Number);
  const tokensOnNonPicks = tokenMealIds.filter(id => !player.picks.includes(id));
  if (tokensOnNonPicks.length > 0) {
    errors.push('Tokens must only be on picked meals');
  }

  // Check budget (cumulative across all rounds)
  const currentPicksCost = player.picks.reduce((sum, mealId) => {
    const meal = state.pool.find(m => m.id === mealId);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  // Add cost of harmonies already locked in
  const harmoniesCost = (state.harmoniesSoFar || []).reduce((sum, mealId) => {
    const meal = state.pool.find(m => m.id === mealId);
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
      const playerABid = playerA.tokens[mealId] || 0;
      const playerBBid = playerB.tokens[mealId] || 0;

      // Weighted random based on bids
      const totalBids = playerABid + playerBBid + 2; // +2 base so 0 bids have chance
      const aChance = (playerABid + 1) / totalBids;
      const winner = Math.random() < aChance ? 'A' : 'B';

      conflicts.push({
        meal: mealId,
        winner,
        playerABid,
        playerBBid
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

  // Over budget - need to swap out lowest-token conflict winners
  const conflictMeals = conflicts
    .map(c => ({
      mealId: c.meal,
      winningBid: c.winner === 'A' ? c.playerABid : c.playerBBid,
      winner: c.winner
    }))
    .filter(c => menuIds.includes(c.mealId))
    .sort((a, b) => a.winningBid - b.winningBid); // Lowest bids first

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
        tokens: {},
        ready: false
      },
      B: {
        ...state.players.B,
        picks: [],
        tokens: {},
        ready: false
      }
    },
    results: null
  };

  return newState;
}
