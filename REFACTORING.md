# Game Architecture Refactoring Guide

## Overview

The game.astro file has been refactored to use a cleaner architecture while maintaining URL-based state management.

## New Architecture

### 1. GameController (`src/lib/GameController.js`)
Centralizes state management without being a full Redux-style store.

**Benefits:**
- Single source of truth for game state
- Cleaner state updates through methods
- Easier to test and debug
- Keeps URL-based state approach

**Usage:**
```javascript
import { GameController } from '../lib/GameController.js';

// Initialize
const params = new URLSearchParams(window.location.search);
const controller = new GameController(params, 'A');

// Access state
const mealCount = controller.mealCount;
const player = controller.player;
const totalMeals = controller.totalMealsSecured;

// Update state
controller.toggleMealSelection(mealId);
controller.addToHarmonies(mealId);
controller.useTakeoutUpgrade(upgrade);

// Validate and encode
const validation = controller.validate(allMeals);
const encoded = controller.encodeToURL();
```

### 2. upgradeHandlers (`src/lib/upgradeHandlers.js`)
Extracts upgrade UI logic from main file.

**Benefits:**
- Separates rendering from business logic
- Reusable upgrade components
- Easier to add new upgrade types

**Usage:**
```javascript
import { setupTakeoutUpgradeUI, setupLockUpgradeUI } from '../lib/upgradeHandlers.js';

// Takeout upgrade
setupTakeoutUpgradeUI(controller, upgrade, upgradeCard, () => {
  updateDisplays(controller, elements, allMeals, themeButtonText, currentTheme);
});

// Lock upgrade
const lockHandler = setupLockUpgradeUI(controller, upgrade, upgradeCard, onMealSelected, onUpdate);
```

### 3. displayUtils (`src/lib/displayUtils.js`)
Centralizes all display updates.

**Benefits:**
- One function updates all displays consistently
- Easier to debug display issues
- Consistent validation and button state logic

**Usage:**
```javascript
import { updateDisplays } from '../lib/displayUtils.js';

const elements = {
  pickCountEl: document.getElementById('pick-count'),
  budgetDisplayEl: document.getElementById('budget-display'),
  lockBtn: document.getElementById('lock-btn'),
  openLinkBtn: document.getElementById('open-link-btn'),
  copyLinkBtn: document.getElementById('copy-link-btn'),
  draftActions: document.querySelector('.draft-actions')
};

const { validation, questComplete } = updateDisplays(
  controller,
  elements,
  allMeals,
  themeButtonText,
  currentTheme
);
```

## Migration Strategy

### Phase 1: Add New Architecture (DONE ✓)
- Created GameController
- Created upgradeHandlers
- Created displayUtils

### Phase 2: Gradual Migration (IN PROGRESS)
Migrate game.astro piece by piece:

1. **Replace scattered state updates** with GameController methods
2. **Replace inline upgrade handlers** with upgradeHandlers functions
3. **Replace updateDisplays function** with displayUtils version
4. **Test after each change** to ensure nothing breaks

### Phase 3: Cleanup
- Remove duplicate code
- Remove unused variables
- Document remaining patterns

## Example: Before & After

### Before (Old Pattern)
```javascript
// Scattered throughout file
let selectedMeals = new Set();
let state = decodeGameState(params);

// Inline upgrade handler (100+ lines)
if (upgrade.type === 'takeout') {
  const takeoutId = `takeout-${Date.now()}`;
  const takeoutMeal = { /* ... */ };
  takeoutMeals.set(takeoutId, takeoutMeal);
  state.harmoniesSoFar = [...state.harmoniesSoFar, takeoutId];
  selectedMeals.add(takeoutId);
  state = { ...state, takeoutMeals: [...] };
  // ... 80 more lines of DOM manipulation
}

// Inline display updates
function updateDisplays() {
  const currentPicksCost = /* ... */;
  const currentPicksUsd = /* ... */;
  // ... 100 lines
}
```

### After (New Pattern)
```javascript
// Centralized
const controller = new GameController(params, currentPlayer);

// Upgrade handler (clean)
import { setupTakeoutUpgradeUI } from '../lib/upgradeHandlers.js';
if (upgrade.type === 'takeout') {
  setupTakeoutUpgradeUI(controller, upgrade, upgradeCard, () => {
    updateDisplays(controller, elements, allMeals, themeButtonText, currentTheme);
  });
}

// Display updates (clean)
import { updateDisplays } from '../lib/displayUtils.js';
updateDisplays(controller, elements, allMeals, themeButtonText, currentTheme);
```

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| Lines in game.astro | ~2700 | Target: ~800 |
| State management | Scattered | Centralized |
| Upgrade logic | Inline | Extracted modules |
| Display updates | Mixed with logic | Separated |
| Testability | Hard | Easy |
| Debugging | Difficult | Simple |
| Adding features | Risky | Safe |

## Next Steps

1. Test current implementation locally
2. Gradually migrate game.astro sections
3. Add unit tests for GameController
4. Document any edge cases discovered

## Key Principles

- **Keep URL-based state** - It's a feature, not a bug
- **Gradual migration** - Don't break working code
- **Test frequently** - After each small change
- **Document patterns** - Help future you understand decisions
