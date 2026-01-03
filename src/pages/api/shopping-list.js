import { getAllMeals, generateShoppingList } from '../../lib/gameData.js';

export const prerender = false;

export async function GET({ request }) {
  try {
    const url = new URL(request.url);
    const mealIdsParam = url.searchParams.get('ids');

    if (!mealIdsParam) {
      return new Response(JSON.stringify({ error: 'Missing meal IDs' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mealIds = mealIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    // Fetch all meals and filter to just the requested ones
    const allMeals = await getAllMeals();
    const meals = mealIds
      .map(id => allMeals.find(m => m.id === id))
      .filter(meal => meal !== undefined);

    // Generate shopping list
    const shoppingList = await generateShoppingList(meals);

    return new Response(JSON.stringify(shoppingList), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
