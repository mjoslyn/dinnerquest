import { getAllMeals } from '../../lib/gameData.js';

export const prerender = false;

export async function GET() {
  try {
    const meals = await getAllMeals();

    return new Response(JSON.stringify(meals), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
