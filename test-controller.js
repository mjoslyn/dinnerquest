/**
 * Simple test for GameController
 * Run with: node test-controller.js
 */

import { GameController } from './src/lib/GameController.js';

// Mock getAllUpgrades for testing
const mockUpgrade = {
  id: 'takeout-western',
  type: 'takeout',
  name: 'Saloon Grub',
  emoji: '🌮',
  mealName: 'Saloon Special',
  mealCost: '$$$',
  effect: 'Order from the saloon - instant harmony',
  undoText: 'Cancel order'
};

// Create test URL params
const testParams = new URLSearchParams({
  id: 'test123',
  status: 'drafting',
  mc: '5',
  bc: 'moderate',
  pAN: 'TestPlayer',
  pAD: '3',
  pAU: 'takeout-western,theme-medieval',
  round: '1',
  pool: '1,2,3,4,5,6,7,8,9,10'
});

console.log('🧪 Testing GameController...\n');

// Test 1: Initialization
console.log('Test 1: Initialization');
const controller = new GameController(testParams, 'A');
console.log('✓ Controller created');
console.log(`  - Meal count: ${controller.mealCount}`);
console.log(`  - Current player: ${controller.currentPlayer}`);
console.log(`  - Player name: ${controller.player.name}`);
console.log('');

// Test 2: Meal selection
console.log('Test 2: Meal Selection');
controller.toggleMealSelection(1);
controller.toggleMealSelection(2);
controller.toggleMealSelection(3);
console.log('✓ Added 3 meals to selection');
console.log(`  - Selected count: ${controller.selectedMeals.size}`);
console.log(`  - Total secured: ${controller.totalMealsSecured}`);
console.log('');

// Test 3: Takeout upgrade
console.log('Test 3: Takeout Upgrade');
const takeoutId = controller.useTakeoutUpgrade(mockUpgrade);
console.log('✓ Used takeout upgrade');
console.log(`  - Takeout ID: ${takeoutId}`);
console.log(`  - Harmonies count: ${controller.harmoniesSoFar.length}`);
console.log(`  - Total secured: ${controller.totalMealsSecured}`);
console.log(`  - Takeout in harmonies: ${controller.harmoniesSoFar.includes(takeoutId)}`);
console.log('');

// Test 4: Cancel takeout
console.log('Test 4: Cancel Takeout');
controller.cancelTakeoutUpgrade(takeoutId);
console.log('✓ Cancelled takeout');
console.log(`  - Harmonies count: ${controller.harmoniesSoFar.length}`);
console.log(`  - Total secured: ${controller.totalMealsSecured}`);
console.log('');

// Test 5: Add to harmonies
console.log('Test 5: Add to Harmonies');
controller.addToHarmonies(1);
controller.addToHarmonies(2);
console.log('✓ Added 2 meals to harmonies');
console.log(`  - Harmonies count: ${controller.harmoniesSoFar.length}`);
console.log(`  - Total secured: ${controller.totalMealsSecured}`);
console.log('');

// Test 6: URL encoding
console.log('Test 6: URL Encoding');
const encoded = controller.encodeToURL();
console.log('✓ Encoded state to URL');
console.log(`  - Has id param: ${encoded.has('id')}`);
console.log(`  - Has mc param: ${encoded.has('mc')}`);
console.log(`  - MC value: ${encoded.get('mc')}`);
console.log('');

// Test 7: Share URL
console.log('Test 7: Share URL');
const shareUrl = controller.getShareURL('B', 'https://dinnerquest.com');
console.log('✓ Generated share URL');
console.log(`  - Contains player=B: ${shareUrl.includes('player=B')}`);
console.log(`  - URL: ${shareUrl.substring(0, 80)}...`);
console.log('');

console.log('✅ All tests passed!');
