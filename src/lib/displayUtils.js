/**
 * Display utilities for updating UI based on game state
 */

import { getCostPoints, getBudgetPoints } from './gameDataClient.js';

/**
 * Update all displays (meal count, budget, button states)
 * @param {GameController} controller
 * @param {Object} elements - DOM elements
 * @param {Array} allMeals - All meals for cost lookup
 * @param {Object} themeButtonText - Button text by theme
 * @param {string} currentTheme - Current theme ID
 */
export function updateDisplays(controller, elements, allMeals, themeButtonText, currentTheme) {
  const { pickCountEl, budgetDisplayEl, lockBtn, openLinkBtn, copyLinkBtn, draftActions, validationErrorsEl } = elements;

  // Calculate costs
  const { currentPicksCost, currentPicksUsd, harmoniesCost, harmoniesUsdTotal } =
    calculateCosts(controller, allMeals);

  const cumulativeCost = harmoniesCost + currentPicksCost;
  const cumulativeUsd = harmoniesUsdTotal + currentPicksUsd;

  // Update meal count display
  const totalMealsSecured = controller.totalMealsSecured;
  const mealCount = controller.mealCount;

  if (totalMealsSecured >= mealCount) {
    pickCountEl.textContent = 'Complete!';
  } else {
    pickCountEl.textContent = `${totalMealsSecured} / ${mealCount}`;
  }

  // Update budget display
  const budgetLimit = getBudgetPoints(controller.state.settings.budgetCap, mealCount);
  budgetDisplayEl.innerHTML = `${cumulativeCost} / ${budgetLimit ? budgetLimit : 'No limit'} <span class="usd-total">($${cumulativeUsd})</span>`;

  // Color coding
  pickCountEl.style.color = totalMealsSecured >= mealCount ? 'var(--primary)' : '#d35d5d';
  budgetDisplayEl.style.color = (budgetLimit && cumulativeCost > budgetLimit) ? 'var(--danger)' : 'var(--primary)';

  // Validate
  const validation = controller.validate(allMeals);

  // Show/hide validation errors (only after 3+ meals picked to avoid annoying early warnings)
  if (validationErrorsEl) {
    const shouldShowErrors = totalMealsSecured > 3 || totalMealsSecured > mealCount;

    if (validation.errors.length > 0 && shouldShowErrors) {
      validationErrorsEl.innerHTML = validation.errors.map(err => `<div class="error-item">${err}</div>`).join('');
      validationErrorsEl.style.display = 'block';
      validationErrorsEl.classList.add('slide-down');
    } else {
      validationErrorsEl.style.display = 'none';
      validationErrorsEl.classList.remove('slide-down');
    }
  }

  // Check if quest will be completed
  const questComplete = checkQuestComplete(controller);

  // Update button text
  const buttonTexts = themeButtonText[currentTheme] || themeButtonText['theme-fantasy'];
  if (questComplete) {
    lockBtn.textContent = buttonTexts?.complete || 'Return Triumphant';
  } else {
    lockBtn.textContent = buttonTexts?.inProgress || 'Seal & Dispatch';
  }

  // Update button states
  if (validation.valid) {
    lockBtn.disabled = false;
    openLinkBtn.disabled = false;
    copyLinkBtn.disabled = false;
    if (draftActions) {
      draftActions.classList.add('visible');
    }
  } else {
    lockBtn.disabled = true;
    openLinkBtn.disabled = true;
    copyLinkBtn.disabled = true;
    if (draftActions) {
      draftActions.classList.remove('visible');
    }
  }

  return { validation, questComplete };
}

/**
 * Calculate costs for current picks and harmonies
 * @param {GameController} controller
 * @param {Array} allMeals
 * @returns {Object} Cost breakdown
 */
function calculateCosts(controller, allMeals) {
  const currentPicksCost = Array.from(controller.selectedMeals).reduce((sum, id) => {
    const card = document.querySelector(`[data-meal-id="${id}"]`);
    if (!card || !card.dataset.cost) {
      const meal = allMeals.find(m => m.id === id) || controller.takeoutMeals.get(id);
      return sum + (meal ? getCostPoints(meal.cost) : 0);
    }
    return sum + parseInt(card.dataset.cost);
  }, 0);

  const currentPicksUsd = Array.from(controller.selectedMeals).reduce((sum, id) => {
    const card = document.querySelector(`[data-meal-id="${id}"]`);
    if (!card || card.dataset.usd === undefined) {
      const meal = allMeals.find(m => m.id === id) || controller.takeoutMeals.get(id);
      return sum + (meal ? (meal.estimatedPrice || 0) : 0);
    }
    return sum + parseInt(card.dataset.usd || 0);
  }, 0);

  const harmoniesCost = (controller.harmoniesSoFar).reduce((sum, mealId) => {
    const meal = allMeals.find(m => m.id === mealId) || controller.takeoutMeals.get(mealId);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  const harmoniesUsdTotal = (controller.harmoniesSoFar).reduce((sum, mealId) => {
    const meal = allMeals.find(m => m.id === mealId) || controller.takeoutMeals.get(mealId);
    return sum + (meal?.estimatedPrice || 0);
  }, 0);

  return { currentPicksCost, currentPicksUsd, harmoniesCost, harmoniesUsdTotal };
}

/**
 * Check if quest will be completed after this draft
 * @param {GameController} controller
 * @returns {boolean}
 */
function checkQuestComplete(controller) {
  const currentPlayer = controller.currentPlayer;
  const selectedMeals = controller.selectedMeals;
  const mealCount = controller.mealCount;
  const state = controller.state;

  if (currentPlayer === 'A') {
    const playerBAllPicks = state.playerBAllPicks || [];
    const newHarmonies = Array.from(selectedMeals).filter(mealId => playerBAllPicks.includes(mealId));
    const allHarmonies = [...new Set([...state.harmoniesSoFar, ...newHarmonies])];
    return allHarmonies.length >= mealCount;
  } else if (currentPlayer === 'B') {
    const playerAPicks = state.players.A.picks;
    const harmonies = Array.from(selectedMeals).filter(mealId => playerAPicks.includes(mealId));
    const allHarmonies = [...new Set([...state.harmoniesSoFar, ...harmonies])];
    return allHarmonies.length >= mealCount;
  }

  return false;
}

/**
 * Show share message
 * @param {HTMLElement} shareMessageEl
 * @param {string} message
 */
export function showShareMessage(shareMessageEl, message) {
  shareMessageEl.textContent = message;
  shareMessageEl.style.display = 'block';
}

/**
 * Hide share message
 * @param {HTMLElement} shareMessageEl
 */
export function hideShareMessage(shareMessageEl) {
  shareMessageEl.style.display = 'none';
}
