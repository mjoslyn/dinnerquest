/**
 * Game logic - validation, draft resolution, stats calculation
 */

import type { GameState, GameResults } from './gameState';
import type { Meal } from './gameData';
import { getCostPoints, getBudgetPoints } from './gameData';

/**
 * Validate a player's draft
 */
export function validateDraft(
  state: GameState,
  playerId: 'A' | 'B',
  allMeals: Meal[] | null = null
): { valid: boolean; errors: string[] } {
  const player = state.players[playerId];
  if (!player) return { valid: false, errors: ['Player not found'] };

  const { settings } = state;
  const errors: string[] = [];

  // Check meal count (deduplicate harmonies and picks to avoid counting partial harmonies twice)
  const harmonies = state.harmoniesSoFar || [];
  const totalUniqueMeals = new Set([...harmonies, ...player.picks]);
  const mealsNeeded = settings.mealCount - totalUniqueMeals.size;
  if (mealsNeeded > 0) {
    errors.push(`Must pick at least ${mealsNeeded} more meals`);
  }

  // Check all picks are in pool (including partial harmonies from previous rounds)
  const poolIds = state.pool.map(m => m.id);
  const otherPlayerAllPicks = state.currentRound > 1
    ? (playerId === 'A' ? (state.playerBAllPicks || []) : (state.playerAAllPicks || []))
    : [];
  const partialHarmonyIds = otherPlayerAllPicks.filter(id => !harmonies.includes(id));
  const validMealIds = new Set([...poolIds, ...partialHarmonyIds, ...harmonies]);
  const invalidPicks = player.picks.filter(id => !validMealIds.has(id));
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
    if (typeof mealId === 'string') return sum; // Skip takeout IDs for now
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
 */
export function resolveDraft(state: GameState): GameResults {
  const playerA = state.players.A;
  const playerB = state.players.B;

  if (!playerA || !playerB) {
    return { finalMenu: [], harmonies: [], conflicts: [] };
  }

  const harmonies: number[] = [];
  const conflicts: GameResults['conflicts'] = [];
  const finalMenuIds = new Set<number>();

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
        winner: winner as 'A' | 'B',
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
 */
function enforceBudget(
  menuIds: number[],
  pool: Meal[],
  budgetLimit: number,
  conflicts: GameResults['conflicts']
): number[] {
  const getMeal = (id: number) => pool.find(m => m.id === id);
  const totalCost = menuIds.reduce((sum, id) => {
    const meal = getMeal(id);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

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
    if (meal) {
      currentMenu = currentMenu.filter(id => id !== conflict.mealId);
      currentCost -= getCostPoints(meal.cost);
    }
  }

  return currentMenu;
}

/**
 * Calculate final statistics
 */
export function calculateStats(state: GameState): {
  harmonies: number;
  conflicts: number;
  totalTime: number;
  totalCost: number;
  topCuisine: string;
  playerAWins: number;
  playerBWins: number;
} {
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
  const cuisineCounts: Record<string, number> = {};

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
 * Advance to the next day after resolving the current draft
 */
export function advanceDay(state: GameState): GameState {
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
  return {
    ...state,
    currentDay: nextDay,
    harmoniesSoFar,
    players: {
      A: state.players.A ? {
        ...state.players.A,
        picks: [],
        locked: false
      } : null,
      B: state.players.B ? {
        ...state.players.B,
        picks: [],
        locked: false
      } : null
    },
    results: null
  };
}
