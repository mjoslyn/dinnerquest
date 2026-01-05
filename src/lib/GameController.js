/**
 * GameController - Manages game state transitions and validation
 * Keeps URL-based state approach but centralizes updates
 */

import { decodeGameState, encodeGameState } from './urlCodec.js';
import { validateDraft } from './gameLogic.js';

export class GameController {
  /**
   * @param {URLSearchParams} urlParams
   * @param {string} currentPlayer - 'A' or 'B'
   */
  constructor(urlParams, currentPlayer) {
    this.state = decodeGameState(urlParams);
    this.currentPlayer = currentPlayer;
    this.selectedMeals = new Set();
    this.takeoutMeals = new Map();

    // Restore takeout meals from state
    if (this.state.takeoutMeals && this.state.takeoutMeals.length > 0) {
      this.state.takeoutMeals.forEach(meal => {
        this.takeoutMeals.set(meal.id, meal);
      });
    }
  }

  /**
   * Get current player object
   */
  get player() {
    return this.state.players[this.currentPlayer];
  }

  /**
   * Get meal count setting
   */
  get mealCount() {
    return this.state.settings.mealCount;
  }

  /**
   * Get current round
   */
  get currentRound() {
    return this.state.currentRound;
  }

  /**
   * Get harmonies accumulated so far
   */
  get harmoniesSoFar() {
    return this.state.harmoniesSoFar || [];
  }

  /**
   * Calculate total meals secured (harmonies + current picks)
   */
  get totalMealsSecured() {
    const allMealIds = new Set([...this.harmoniesSoFar, ...Array.from(this.selectedMeals)]);
    return allMealIds.size;
  }

  /**
   * Toggle meal selection
   * @param {number} mealId
   * @returns {boolean} - true if selected, false if deselected
   */
  toggleMealSelection(mealId) {
    if (this.selectedMeals.has(mealId)) {
      this.selectedMeals.delete(mealId);
      return false;
    } else {
      this.selectedMeals.add(mealId);
      return true;
    }
  }

  /**
   * Add a meal to harmonies (locked in)
   * @param {number|string} mealId
   */
  addToHarmonies(mealId) {
    if (!this.state.harmoniesSoFar.includes(mealId)) {
      this.state = {
        ...this.state,
        harmoniesSoFar: [...this.state.harmoniesSoFar, mealId]
      };
    }
  }

  /**
   * Remove a meal from harmonies
   * @param {number|string} mealId
   */
  removeFromHarmonies(mealId) {
    this.state = {
      ...this.state,
      harmoniesSoFar: this.state.harmoniesSoFar.filter(id => id !== mealId)
    };
  }

  /**
   * Use a takeout upgrade
   * @param {Object} upgrade - The upgrade object
   * @returns {string} - The takeout meal ID
   */
  useTakeoutUpgrade(upgrade) {
    const takeoutId = `takeout-${Date.now()}`;

    const takeoutMeal = {
      id: takeoutId,
      name: upgrade.mealName || 'Takeout',
      emoji: upgrade.emoji,
      cost: upgrade.mealCost || '$$$',
      estimatedPrice: upgrade.mealCost === '$' ? 10 : upgrade.mealCost === '$$' ? 20 : 30,
      time: 0,
      cuisine: 'Takeout'
    };

    // Store takeout meal
    this.takeoutMeals.set(takeoutId, takeoutMeal);

    // Add to harmonies and selected meals
    this.addToHarmonies(takeoutId);
    this.selectedMeals.add(takeoutId);

    // Persist to state
    this.state = {
      ...this.state,
      takeoutMeals: [...(this.state.takeoutMeals || []), takeoutMeal]
    };

    // Mark upgrade as used
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.currentPlayer]: {
          ...this.player,
          usedTakeoutId: upgrade.id
        }
      }
    };

    return takeoutId;
  }

  /**
   * Cancel a takeout upgrade
   * @param {string} takeoutId
   */
  cancelTakeoutUpgrade(takeoutId) {
    // Remove from harmonies and selected meals
    this.removeFromHarmonies(takeoutId);
    this.selectedMeals.delete(takeoutId);
    this.takeoutMeals.delete(takeoutId);

    // Remove from state
    this.state = {
      ...this.state,
      takeoutMeals: (this.state.takeoutMeals || []).filter(meal => meal.id !== takeoutId)
    };

    // Clear used upgrade flag
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.currentPlayer]: {
          ...this.player,
          usedTakeoutId: undefined
        }
      }
    };
  }

  /**
   * Use a lock upgrade on a meal
   * @param {Object} upgrade - The upgrade object
   * @param {number} mealId - The meal to lock
   */
  useLockUpgrade(upgrade, mealId) {
    // Add to harmonies and selected meals
    this.addToHarmonies(mealId);
    this.selectedMeals.add(mealId);

    // Mark upgrade as used
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.currentPlayer]: {
          ...this.player,
          usedLockId: upgrade.id
        }
      }
    };
  }

  /**
   * Cancel a lock upgrade
   * @param {number} mealId
   */
  cancelLockUpgrade(mealId) {
    // Remove from harmonies and selected meals
    this.removeFromHarmonies(mealId);
    this.selectedMeals.delete(mealId);

    // Clear used upgrade flag
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.currentPlayer]: {
          ...this.player,
          usedLockId: undefined
        }
      }
    };
  }

  /**
   * Update player picks in state
   */
  updatePlayerPicks() {
    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.currentPlayer]: {
          ...this.player,
          picks: Array.from(this.selectedMeals)
        }
      }
    };
  }

  /**
   * Validate current draft
   * @param {Array} allMeals - All available meals for lookup
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate(allMeals) {
    this.updatePlayerPicks();
    return validateDraft(this.state, this.currentPlayer, allMeals);
  }

  /**
   * Encode current state to URL
   * @returns {URLSearchParams}
   */
  encodeToURL() {
    this.updatePlayerPicks();
    return encodeGameState(this.state);
  }

  /**
   * Get shareable URL for other player
   * @param {string} targetPlayer - 'A' or 'B'
   * @param {string} [origin] - Optional origin, defaults to window.location.origin
   * @returns {string}
   */
  getShareURL(targetPlayer, origin) {
    const encoded = this.encodeToURL();
    const playerBJoined = this.state.players.B !== null;
    const targetPage = playerBJoined ? '/game' : '/waiting';
    const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseOrigin}${targetPage}?${encoded.toString()}&player=${targetPlayer}`;
  }
}
