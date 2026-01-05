/**
 * Upgrade UI handlers - separated from main game logic
 */

import { getAllMeals } from './gameDataClient.js';

/**
 * Render upgrade cards HTML
 * @param {Array} upgrades - Player's upgrades
 * @returns {string} HTML string
 */
export function renderUpgradeCards(upgrades) {
  if (!upgrades || upgrades.length === 0) return '';

  return upgrades.map(upgrade => `
    <div class="upgrade-card" data-upgrade-id="${upgrade.id}">
      ${upgrade.type === 'theme' ? '<div class="theme-badge">THEME</div>' : ''}
      ${upgrade.type === 'takeout' ? '<div class="takeout-badge">TAKEOUT</div>' : ''}
      ${upgrade.type === 'lock' ? '<div class="lock-badge">LOCK AN ITEM</div>' : ''}
      ${upgrade.type === 'redraw' ? '<div class="redraw-badge">REDRAW</div>' : ''}
      ${upgrade.type === 'custom' ? '<div class="custom-badge">CUSTOM MEAL</div>' : ''}
      <div class="upgrade-emoji">${upgrade.emoji}</div>
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-effect">${upgrade.effect}</div>
      <button class="btn-use-upgrade" data-upgrade-id="${upgrade.id}">Use</button>
    </div>
  `).join('');
}

/**
 * Render harmony cards HTML
 * @param {Array} harmonyMeals - Meals in harmonies
 * @returns {string} HTML string
 */
export function renderHarmonyCards(harmonyMeals) {
  return harmonyMeals.map(meal => `
    <div class="harmony-card locked">
      <span class="meal-emoji">${meal.emoji}</span>
      <div class="meal-name">${meal.name}</div>
    </div>
  `).join('');
}

/**
 * Setup takeout upgrade UI
 * @param {GameController} controller
 * @param {Object} upgrade - The takeout upgrade
 * @param {HTMLElement} upgradeCard
 * @param {Function} onUpdate - Callback when upgrade is used/cancelled
 */
export function setupTakeoutUpgradeUI(controller, upgrade, upgradeCard, onUpdate) {
  const takeoutId = controller.useTakeoutUpgrade(upgrade);
  const takeoutMeal = controller.takeoutMeals.get(takeoutId);

  // Create or update harmonies section
  let harmoniesSection = document.querySelector('.harmonies-section');
  if (!harmoniesSection) {
    harmoniesSection = document.createElement('div');
    harmoniesSection.className = 'harmonies-section';
    harmoniesSection.innerHTML = '<h3>Harmonies (Locked In)</h3><div class="harmony-grid"></div>';
    const draftInfo = document.querySelector('.draft-info');
    draftInfo.parentNode.insertBefore(harmoniesSection, draftInfo);
  }
  harmoniesSection.style.display = 'block';

  // Add harmony card
  const harmonyGrid = harmoniesSection.querySelector('.harmony-grid');
  const harmonyCard = document.createElement('div');
  harmonyCard.className = 'harmony-card locked takeout-harmony-card';
  harmonyCard.dataset.mealId = takeoutId;
  harmonyCard.innerHTML = `
    <span class="meal-emoji">${takeoutMeal.emoji}</span>
    <div class="meal-name">${takeoutMeal.name}</div>
  `;
  harmonyGrid.appendChild(harmonyCard);

  // Update button
  const useBtn = upgradeCard.querySelector('.btn-use-upgrade');
  useBtn.disabled = true;
  useBtn.textContent = 'Used';
  useBtn.classList.add('btn-used');

  // Create undo button
  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn-undo-lock';
  undoBtn.textContent = upgrade.undoText || 'Cancel order';
  undoBtn.addEventListener('click', () => {
    controller.cancelTakeoutUpgrade(takeoutId);

    // Remove harmony card
    harmonyCard.remove();

    // Hide harmonies section if empty
    if (harmonyGrid.children.length === 0) {
      harmoniesSection.style.display = 'none';
    }

    // Remove undo button
    undoBtn.remove();

    // Re-enable use button
    useBtn.disabled = false;
    useBtn.textContent = 'Use';
    useBtn.classList.remove('btn-used');

    onUpdate();
  });
  upgradeCard.appendChild(undoBtn);

  onUpdate();
}

/**
 * Setup lock upgrade UI
 * @param {GameController} controller
 * @param {Object} upgrade - The lock upgrade
 * @param {HTMLElement} upgradeCard
 * @param {Function} onMealSelected - Callback when meal is selected to lock
 * @param {Function} onUpdate - Callback when upgrade is used/cancelled
 */
export function setupLockUpgradeUI(controller, upgrade, upgradeCard, onMealSelected, onUpdate) {
  const useBtn = upgradeCard.querySelector('.btn-use-upgrade');
  useBtn.textContent = 'Click a meal...';
  useBtn.disabled = true;

  // Add visual indicator to meal cards
  document.querySelectorAll('.meal-card').forEach(card => {
    card.classList.add('lockable');
  });

  // Return handler for when meal is clicked
  return async (mealId) => {
    // Remove lockable indicators
    document.querySelectorAll('.meal-card').forEach(card => {
      card.classList.remove('lockable');
    });

    // Find the meal data
    const lockedMeal = (await getAllMeals()).find(m => m.id === mealId);
    if (!lockedMeal) return;

    controller.useLockUpgrade(upgrade, mealId);

    // Create or update harmonies section
    let harmoniesSection = document.querySelector('.harmonies-section');
    if (!harmoniesSection) {
      harmoniesSection = document.createElement('div');
      harmoniesSection.className = 'harmonies-section';
      harmoniesSection.innerHTML = '<h3>Harmonies (Locked In)</h3><div class="harmony-grid"></div>';
      const draftInfo = document.querySelector('.draft-info');
      draftInfo.parentNode.insertBefore(harmoniesSection, draftInfo);
    }
    harmoniesSection.style.display = 'block';

    // Add harmony card
    const harmonyGrid = harmoniesSection.querySelector('.harmony-grid');
    const harmonyCard = document.createElement('div');
    harmonyCard.className = 'harmony-card locked lock-harmony-card';
    harmonyCard.dataset.mealId = mealId;
    harmonyCard.innerHTML = `
      <span class="meal-emoji">${upgrade.emoji}${lockedMeal.emoji}</span>
      <div class="meal-name">${lockedMeal.name}</div>
    `;
    harmonyGrid.appendChild(harmonyCard);

    // Mark meal card as locked in the pool (don't remove it)
    const mealCardInPool = document.querySelector(`.meal-card[data-meal-id="${mealId}"]`);
    if (mealCardInPool) {
      mealCardInPool.classList.add('locked', 'selected');
    }

    // Update button
    useBtn.textContent = 'Used';
    useBtn.classList.add('btn-used');

    // Create undo button
    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn-undo-lock';
    undoBtn.textContent = upgrade.undoText || 'Undo';
    undoBtn.addEventListener('click', () => {
      controller.cancelLockUpgrade(mealId);

      // Remove locked state from meal card
      const mealCard = document.querySelector(`.meal-card[data-meal-id="${mealId}"]`);
      if (mealCard) {
        mealCard.classList.remove('selected', 'locked');
      }

      // Remove harmony card
      harmonyCard.remove();

      // Hide harmonies section if empty
      if (harmonyGrid.children.length === 0) {
        harmoniesSection.style.display = 'none';
      }

      // Remove undo button
      undoBtn.remove();

      // Re-enable use button
      useBtn.disabled = false;
      useBtn.textContent = 'Use';
      useBtn.classList.remove('btn-used');

      onUpdate();
    });
    upgradeCard.appendChild(undoBtn);

    onUpdate();
  };
}
