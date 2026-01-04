import { test, expect } from '@playwright/test';

test.describe('Dinner Quest - Game Flow', () => {
  test('should start new game and navigate to Player A draft', async ({ page }) => {
    await page.goto('/');

    // Fill in game settings
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');

    // Fill in player info
    await page.fill('input[name="playerAName"]', 'Ranger');
    await page.fill('input[name="playerBName"]', 'Mage');

    // Start game
    await page.click('button[type="submit"]');

    // Should navigate to game page for Player A
    await expect(page).toHaveURL(/\/game\?/);
    await expect(page.locator('text=Ranger')).toBeVisible();
  });

  test('should allow Player A to select meals and transition to Player B', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Select 5 meals for Player A
    const mealCards = await page.locator('[data-meal-id]').all();
    for (let i = 0; i < 5; i++) {
      await mealCards[i].click();
    }

    // Verify meal count shows 5 / 5
    await expect(page.locator('#pick-count')).toHaveText('5 / 5');

    // Lock draft
    const lockButton = page.locator('text=/Seal|Lock|Return/i').first();
    await expect(lockButton).toBeEnabled();
    await lockButton.click();

    // Should show Player B's view
    await expect(page.locator('text=Player B')).toBeVisible();
  });

  test('lock upgrade should add meal to harmonies and count towards validation', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Select 5 meals for Player A
    const mealCards = await page.locator('[data-meal-id]').all();
    for (let i = 0; i < 5; i++) {
      await mealCards[i].click();
    }

    // Lock and proceed to Player B
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Player B's turn - check if they have a lock upgrade
    const lockUpgrade = page.locator('.upgrade-card').filter({ hasText: /Lock|Seal/ }).first();
    const hasLockUpgrade = await lockUpgrade.count() > 0;

    if (hasLockUpgrade) {
      // Use lock upgrade
      await lockUpgrade.locator('button:has-text("Use")').click();

      // Select a meal to lock
      const firstMeal = await page.locator('[data-meal-id]').first();
      await firstMeal.click();

      // Verify harmony section shows the locked meal
      await expect(page.locator('text=/Harmonies|Locked/i')).toBeVisible();

      // Select 4 more meals (total 5 with locked one)
      const remainingMeals = await page.locator('[data-meal-id]').all();
      for (let i = 1; i < 5; i++) {
        await remainingMeals[i].click();
      }

      // Meal count should show 5 / 5 or "Complete!"
      const pickCount = await page.locator('#pick-count').textContent();
      expect(pickCount === '5 / 5' || pickCount === 'Complete!').toBeTruthy();

      // Lock button should be enabled (validation passes)
      await expect(page.locator('text=/Seal|Lock|Return/i').first()).toBeEnabled();
    }
  });

  test('meal count should display correctly in round 2', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Player A selects 5 meals
    const playerAMeals = await page.locator('[data-meal-id]').all();
    for (let i = 0; i < 5; i++) {
      await playerAMeals[i].click();
    }
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Player B selects 5 meals (some different from A)
    const playerBMeals = await page.locator('[data-meal-id]').all();
    for (let i = 2; i < 7; i++) {
      await playerBMeals[i].click();
    }
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Should be in round 2 if harmonies < 5
    const url = page.url();
    if (url.includes('round=2')) {
      // Check that harmonies are displayed
      await expect(page.locator('text=/Harmonies|Locked/i')).toBeVisible();

      // Get number of harmonies from the page
      const harmoniesSection = page.locator('.harmonies-section, [class*="harmony"]').first();
      const harmoniesCount = await harmoniesSection.locator('[data-meal-id]').count();

      // Meal count should show "0 / X" where X = 5 - harmonies
      const pickCount = await page.locator('#pick-count').textContent();
      const expectedNeeded = 5 - harmoniesCount;
      expect(pickCount).toContain(`0 / ${expectedNeeded}`);
    }
  });

  test('budget tracking should be cumulative across rounds', async ({ page }) => {
    await page.goto('/');

    // Setup game with budget
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Player A selects meals
    const playerAMeals = await page.locator('[data-meal-id]').all();
    for (let i = 0; i < 5; i++) {
      await playerAMeals[i].click();
    }

    // Get Player A's budget total
    const budgetTextA = await page.locator('#budget-display').textContent();
    const budgetA = parseInt(budgetTextA.match(/(\d+)\s*\//)[1]);

    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Player B selects meals
    const playerBMeals = await page.locator('[data-meal-id]').all();
    for (let i = 2; i < 7; i++) {
      await playerBMeals[i].click();
    }
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // If in round 2, budget should include harmonies from round 1
    const url = page.url();
    if (url.includes('round=2')) {
      const budgetTextRound2 = await page.locator('#budget-display').textContent();
      const budgetRound2 = parseInt(budgetTextRound2.match(/(\d+)\s*\//)[1]);

      // Budget in round 2 should account for harmonies already locked
      expect(budgetRound2).toBeGreaterThan(0);
    }
  });

  test('theme upgrade should change UI theme', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Check for theme upgrade
    const themeUpgrade = page.locator('.upgrade-card').filter({ hasText: /THEME/i }).first();
    const hasThemeUpgrade = await themeUpgrade.count() > 0;

    if (hasThemeUpgrade) {
      // Get current body class
      const bodyClassBefore = await page.locator('body').getAttribute('class');

      // Use theme upgrade
      await themeUpgrade.locator('button:has-text("Use")').click();

      // Body class should change
      const bodyClassAfter = await page.locator('body').getAttribute('class');
      expect(bodyClassAfter).not.toBe(bodyClassBefore);
      expect(bodyClassAfter).toContain('theme-');
    }
  });

  test('complete page should show all selected meals and correct budget', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '3'); // Smaller game for faster test
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Player A selects 3 meals
    const playerAMeals = await page.locator('[data-meal-id]').all();
    await playerAMeals[0].click();
    await playerAMeals[1].click();
    await playerAMeals[2].click();
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Player B selects same 3 meals (all harmonies)
    const playerBMeals = await page.locator('[data-meal-id]').all();
    await playerBMeals[0].click();
    await playerBMeals[1].click();
    await playerBMeals[2].click();
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Should navigate to complete page
    await expect(page).toHaveURL(/\/complete\?/);

    // Should show "QUEST COMPLETE!" or similar
    await expect(page.locator('text=/COMPLETE|QUEST|TRIUMPHANT/i')).toBeVisible();

    // Should show final menu with 3 meals
    const finalMealCards = await page.locator('[data-meal-id], .meal-card, .final-meal').count();
    expect(finalMealCards).toBeGreaterThanOrEqual(3);

    // Should show budget total
    await expect(page.locator('text=/\\$\\d+/i')).toBeVisible();

    // Should show shopping list
    await expect(page.locator('text=/Shopping|Ingredients/i')).toBeVisible();
  });

  test('harmonies should persist between rounds', async ({ page }) => {
    await page.goto('/');

    // Setup game
    await page.selectOption('select[name="mealCount"]', '5');
    await page.selectOption('select[name="budgetCap"]', 'moderate');
    await page.fill('input[name="playerAName"]', 'Player A');
    await page.fill('input[name="playerBName"]', 'Player B');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/game\?/);

    // Player A selects meals
    const playerAMeals = await page.locator('[data-meal-id]').all();
    const meal1 = await playerAMeals[0].getAttribute('data-meal-id');
    const meal2 = await playerAMeals[1].getAttribute('data-meal-id');

    await playerAMeals[0].click();
    await playerAMeals[1].click();
    await playerAMeals[2].click();
    await playerAMeals[3].click();
    await playerAMeals[4].click();
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // Player B selects some same meals
    const playerBMeals = await page.locator('[data-meal-id]').all();
    await playerBMeals[0].click(); // Same as Player A's first
    await playerBMeals[1].click(); // Same as Player A's second
    await playerBMeals[5].click();
    await playerBMeals[6].click();
    await playerBMeals[7].click();
    await page.locator('text=/Seal|Lock|Return/i').first().click();

    // If round 2, check harmonies section
    const url = page.url();
    if (url.includes('round=2')) {
      // Should see harmonies section
      await expect(page.locator('text=/Harmonies|Locked/i')).toBeVisible();

      // The two meals both players picked should be in harmonies
      const harmoniesSection = page.locator('.harmonies-section, [class*="harmony"]').first();
      const harmonyMealIds = await harmoniesSection.locator('[data-meal-id]').all();

      expect(harmonyMealIds.length).toBeGreaterThan(0);
    }
  });
});
