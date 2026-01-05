# game.astro Migration Checklist

## Step-by-Step Migration Plan

### ✅ Prerequisites (DONE)
- [x] Created GameController.js
- [x] Created upgradeHandlers.js
- [x] Created displayUtils.js
- [x] Documented architecture

### 🎯 Phase 1: Initialize Controller (Start Here)

**Current code (lines 58-168):**
```javascript
const params = new URLSearchParams(window.location.search);
let state = decodeGameState(params);
const currentPlayer = params.get('player') || 'A';
// ... lots of initialization
const mealCount = state.settings.mealCount;
let selectedMeals = new Set();
```

**New code:**
```javascript
import { GameController } from '../lib/GameController.js';
import { updateDisplays } from '../lib/displayUtils.js';
import { setupTakeoutUpgradeUI, setupLockUpgradeUI, renderUpgradeCards } from '../lib/upgradeHandlers.js';

const params = new URLSearchParams(window.location.search);
const controller = new GameController(params, params.get('player') || 'A');
const currentPlayer = controller.currentPlayer;
const state = controller.state; // For backward compatibility during migration
const mealCount = controller.mealCount;
const selectedMeals = controller.selectedMeals; // Reference to controller's Set
```

**Changes:**
- Replace `let state` with `const controller`
- Keep `state` reference for gradual migration
- Replace `selectedMeals` initialization with controller reference

**Test:** Verify page loads without errors

---

### 🎯 Phase 2: Replace updateDisplays Function (lines 298-396)

**Current code:**
```javascript
function updateDisplays() {
  const currentPicksCost = Array.from(selectedMeals).reduce(/* ... */);
  // ... 100 lines of display logic
}
```

**New code:**
```javascript
import { updateDisplays as updateDisplaysUtil } from '../lib/displayUtils.js';

const elements = {
  pickCountEl: document.getElementById('pick-count'),
  budgetDisplayEl: document.getElementById('budget-display'),
  lockBtn: document.getElementById('lock-btn'),
  openLinkBtn: document.getElementById('open-link-btn'),
  copyLinkBtn: document.getElementById('copy-link-btn'),
  draftActions: document.querySelector('.draft-actions')
};

function updateDisplays() {
  return updateDisplaysUtil(controller, elements, allMeals, themeButtonText, currentTheme);
}
```

**Changes:**
- Import utility function
- Define elements object once
- Wrap utility call

**Test:** Click meals, verify counts update correctly

---

### 🎯 Phase 3: Migrate Takeout Upgrade (lines 1256-1371)

**Current code:**
```javascript
if (upgrade.type === 'takeout') {
  // Track the active takeout upgrade
  activeTakeoutUpgrade = upgrade;

  // Create a fake meal ID for the takeout
  const takeoutId = `takeout-${Date.now()}`;
  // ... 100+ lines
}
```

**New code:**
```javascript
if (upgrade.type === 'takeout') {
  setupTakeoutUpgradeUI(
    controller,
    upgrade,
    document.querySelector(`.upgrade-card[data-upgrade-id="${upgrade.id}"]`),
    updateDisplays
  );
  return;
}
```

**Changes:**
- Replace entire takeout block with function call
- Much cleaner and easier to read

**Test:** Use takeout upgrade, verify harmony appears and counts update

---

### 🎯 Phase 4: Migrate Lock Upgrade (lines 1240-1253 + meal click handler)

**Current code:**
```javascript
if (upgrade.type === 'lock') {
  isSelectingToLock = true;
  activeLockUpgrade = upgrade;
  // ... modal logic
}

// Later in meal click handler:
if (isSelectingToLock && activeLockUpgrade) {
  // ... 100+ lines
}
```

**New code:**
```javascript
let lockMealHandler = null;

if (upgrade.type === 'lock') {
  lockMealHandler = setupLockUpgradeUI(
    controller,
    upgrade,
    document.querySelector(`.upgrade-card[data-upgrade-id="${upgrade.id}"]`),
    null,
    updateDisplays
  );
  return;
}

// In meal click handler:
if (lockMealHandler) {
  await lockMealHandler(mealId);
  lockMealHandler = null;
  return;
}
```

**Changes:**
- Replace lock state variables with handler function
- Cleaner separation of concerns

**Test:** Use lock upgrade, click meal, verify it locks correctly

---

### 🎯 Phase 5: Migrate Meal Selection (lines 399-496)

**Current code:**
```javascript
document.querySelectorAll('.meal-card').forEach(card => {
  card.addEventListener('click', async (e) => {
    const mealId = parseInt(card.dataset.mealId);

    // Handle partial harmony
    if (otherPlayerPicksSet.has(mealId)) {
      if (selectedMeals.has(mealId)) {
        selectedMeals.delete(mealId);
        card.classList.remove('selected');
        state.harmoniesSoFar = state.harmoniesSoFar.filter(id => id !== mealId);
        // ... DOM manipulation
      } else {
        selectedMeals.add(mealId);
        card.classList.add('selected');
        state.harmoniesSoFar = [...state.harmoniesSoFar, mealId];
        // ... DOM manipulation
      }
      updateDisplays();
      return;
    }

    // Regular meal toggle
    if (selectedMeals.has(mealId)) {
      selectedMeals.delete(mealId);
      card.classList.remove('selected');
    } else {
      selectedMeals.add(mealId);
      card.classList.add('selected');
    }
    updateDisplays();
  });
});
```

**New code:**
```javascript
document.querySelectorAll('.meal-card').forEach(card => {
  card.addEventListener('click', async (e) => {
    const mealId = parseInt(card.dataset.mealId);

    // Check for lock handler first
    if (lockMealHandler) {
      await lockMealHandler(mealId);
      lockMealHandler = null;
      return;
    }

    // Handle partial harmony
    if (otherPlayerPicksSet.has(mealId)) {
      const isSelected = controller.toggleMealSelection(mealId);
      card.classList.toggle('selected', isSelected);

      if (isSelected) {
        controller.addToHarmonies(mealId);
        // Create harmony card in DOM
        renderPartialHarmonyCard(mealId, await getMeal(mealId));
      } else {
        controller.removeFromHarmonies(mealId);
        // Remove harmony card from DOM
        removeHarmonyCard(mealId);
      }

      updateDisplays();
      return;
    }

    // Regular meal toggle
    const isSelected = controller.toggleMealSelection(mealId);
    card.classList.toggle('selected', isSelected);
    updateDisplays();
  });
});
```

**Changes:**
- Use controller methods instead of direct Set/state manipulation
- Extract DOM manipulation to helper functions
- Clearer logic flow

**Test:** Click meals, verify selection works

---

### 🎯 Phase 6: Migrate Lock Button Handler (lines 597-1220)

**Current code:**
```javascript
lockBtn.addEventListener('click', async () => {
  // Mark player as locked
  state = {
    ...state,
    players: {
      ...state.players,
      [currentPlayer]: {
        ...player,
        picks: Array.from(selectedMeals),
        locked: true
      }
    }
  };
  // ... 600+ lines of round resolution logic
});
```

**New code:**
```javascript
lockBtn.addEventListener('click', async () => {
  // Update picks
  controller.updatePlayerPicks();

  // Mark as locked
  controller.state = {
    ...controller.state,
    players: {
      ...controller.state.players,
      [currentPlayer]: {
        ...controller.player,
        locked: true
      }
    }
  };

  // Rest of lock logic stays similar for now
  // TODO: Extract round resolution to separate module
});
```

**Changes:**
- Use controller method to update picks
- Round resolution logic can be extracted later

---

## Migration Order & Safety

1. ✅ **Safest**: Initialize controller alongside existing code
2. ✅ **Safe**: Replace updateDisplays (wrapper approach)
3. ⚠️ **Medium**: Migrate upgrades one at a time
4. ⚠️ **Medium**: Migrate meal selection
5. 🔴 **Risky**: Migrate lock button (test extensively)

## Testing Checklist After Each Phase

- [ ] Page loads without errors
- [ ] Can select/deselect regular meals
- [ ] Can select partial harmonies
- [ ] Takeout upgrade works
- [ ] Lock upgrade works
- [ ] Theme upgrade works (if implemented)
- [ ] Meal count displays correctly
- [ ] Budget displays correctly
- [ ] Lock button enables when valid
- [ ] Can complete a full game round
- [ ] URL encodes state correctly

## Rollback Plan

If something breaks:
1. `git stash` - Save changes
2. `git checkout src/pages/game.astro` - Restore working version
3. `git stash pop` - Reapply changes
4. Fix the specific issue
5. Test again

## Notes

- Keep both old and new patterns during migration
- Remove old code only after new code is tested
- Commit after each successful phase
- Don't rush - gradual is better than broken
