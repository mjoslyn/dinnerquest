// End-to-end tests for the HonoX + Supabase version. Each player is a separate
// browser context (separate anonymous session cookies). UI drives game
// creation; game actions mix UI and the JSON API for robustness.
// Requires: `npx supabase start` + `npm run db:seed` (playwright launches vite).
import { test, expect } from '@playwright/test';

async function createGame(context, opts = {}) {
  const res = await context.request.post('/api/games', {
    data: {
      playerName: 'Alice',
      mealCount: 3,
      budgetCap: opts.budgetCap ?? 'none',
      allergies: [],
      theme: opts.theme ?? 'plain',
      dietPreference: 3
    }
  });
  expect(res.status()).toBe(201);
  const { id } = await res.json();
  return id;
}

async function joinGame(context, id) {
  const res = await context.request.post(`/api/games/${id}/join`, {
    data: { name: 'Bob', dietPreference: 3 }
  });
  expect(res.ok()).toBeTruthy();
}

async function getView(context, id) {
  const res = await context.request.get(`/api/games/${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test('full game: create, join, draft to harmony, complete with shopping list', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();

  const id = await createGame(ctxA);

  // A sees the waiting screen with the join link.
  await pageA.goto(`/game/${id}`);
  await expect(pageA.getByText('WAITING FOR YOUR PARTNER')).toBeVisible();
  await expect(pageA.getByText(`/join/${id}`)).toBeVisible();

  await joinGame(ctxB, id);

  // A's page flips to drafting without a reload (realtime or poll fallback).
  await expect(pageA.getByText(/ROUND 1/)).toBeVisible({ timeout: 20000 });

  // A drafts 3 meals through the UI.
  const cards = pageA.locator('.meal-card');
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await cards.nth(i).click();
    await expect(cards.nth(i)).toHaveClass(/selected/);
  }
  await expect
    .poll(async () => (await getView(ctxA, id)).state.players.A.picks.length)
    .toBe(3);
  const aPicks = (await getView(ctxA, id)).state.players.A.picks;

  // Lock via UI button (plain-theme label).
  await pageA.getByRole('button', { name: /Lock In Picks/i }).click();
  await expect(pageA.getByText(/Locked in\. Waiting/)).toBeVisible({ timeout: 10000 });

  // B sees A's locked picks as partial harmonies and completes by matching them.
  const viewB = await getView(ctxB, id);
  expect([...viewB.partialHarmonies].sort()).toEqual([...aPicks].sort());
  await ctxB.request.post(`/api/games/${id}/picks`, { data: { picks: aPicks } });
  const lockB = await ctxB.request.post(`/api/games/${id}/lock`);
  expect(lockB.ok()).toBeTruthy();
  expect((await lockB.json()).status).toBe('complete');

  // A's page flips to the complete screen and renders the shopping list.
  await expect(pageA.getByText('QUEST COMPLETE')).toBeVisible({ timeout: 20000 });
  await expect(pageA.getByText('SHOPPING LIST')).toBeVisible({ timeout: 10000 });
  await expect(pageA.locator('.shopping-item').first()).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('redaction: B cannot see A picks before A locks', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  const id = await createGame(ctxA);
  await joinGame(ctxB, id);

  const view = await getView(ctxA, id);
  const poolIds = view.state.pool.map((m) => m.id);
  await ctxA.request.post(`/api/games/${id}/picks`, { data: { picks: poolIds.slice(0, 3) } });

  const viewB = await getView(ctxB, id);
  expect(viewB.state.players.A.picks).toEqual([]);
  expect(viewB.partialHarmonies).toEqual([]);

  await ctxA.close();
  await ctxB.close();
});

test('turn order: B cannot lock before A', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  const id = await createGame(ctxA);
  await joinGame(ctxB, id);

  const viewB = await getView(ctxB, id);
  const poolIds = viewB.state.pool.map((m) => m.id);
  await ctxB.request.post(`/api/games/${id}/picks`, { data: { picks: poolIds.slice(0, 3) } });
  const lock = await ctxB.request.post(`/api/games/${id}/lock`);
  expect(lock.status()).toBe(400);
  expect((await lock.json()).error).toMatch(/partner/i);

  await ctxA.close();
  await ctxB.close();
});

test('budget: over-budget lock is rejected server-side', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  // tight budget: 3 meals x 1.3 = 3 points
  const id = await createGame(ctxA, { budgetCap: 'tight' });
  await joinGame(ctxB, id);

  const view = await getView(ctxA, id);
  const costMap = { $: 1, $$: 2, $$$: 3 };
  // Greedily pick the 3 most expensive meals; skip if the pool rolled all-$.
  const sorted = [...view.state.pool].sort((a, b) => costMap[b.cost] - costMap[a.cost]);
  const picks = sorted.slice(0, 3);
  const total = picks.reduce((s, m) => s + costMap[m.cost], 0);
  test.skip(total <= 3, 'pool rolled all cheap meals; nothing to exceed budget with');

  await ctxA.request.post(`/api/games/${id}/picks`, { data: { picks: picks.map((m) => m.id) } });
  const lock = await ctxA.request.post(`/api/games/${id}/lock`);
  expect(lock.status()).toBe(400);
  expect((await lock.json()).error).toMatch(/exceeds budget/i);

  await ctxA.close();
  await ctxB.close();
});

test('upgrades: using a dealt upgrade marks it used and updates state', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();

  const id = await createGame(ctxA);
  await joinGame(ctxB, id);

  const view = await getView(ctxA, id);
  const upgrade = view.state.players.A.upgrades[0];
  expect(upgrade).toBeTruthy();

  const body = { upgradeId: upgrade.id };
  if (upgrade.type === 'lock') body.mealId = view.state.pool[0].id;
  if (upgrade.type === 'custom') body.mealName = 'Test Meal';
  const res = await ctxA.request.post(`/api/games/${id}/upgrade`, { data: body });
  expect(res.ok()).toBeTruthy();

  const after = await getView(ctxA, id);
  const me = after.state.players.A;
  const usedFlag = {
    lock: me.usedLockId,
    takeout: me.usedTakeoutId,
    custom: me.usedCustomId,
    redraw: me.usedRedrawId
  }[upgrade.type];
  expect(usedFlag).toBe(upgrade.id);

  if (upgrade.type === 'lock') {
    expect(after.state.harmoniesSoFar).toContain(view.state.pool[0].id);
  }
  if (upgrade.type === 'takeout' || upgrade.type === 'custom') {
    expect(after.state.takeoutMeals.length).toBe(1);
    expect(after.state.harmoniesSoFar).toContain(after.state.takeoutMeals[0].id);
  }

  // Second use of a single-use upgrade must be rejected.
  const again = await ctxA.request.post(`/api/games/${id}/upgrade`, { data: body });
  expect(again.status()).toBe(400);

  await ctxA.close();
  await ctxB.close();
});
