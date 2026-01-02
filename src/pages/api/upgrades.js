import { getRandomUpgrades } from '../../lib/gameData.js';

export const prerender = false;

export async function GET({ url }) {
  try {
    const count = parseInt(url.searchParams.get('count') || '2');
    const upgrades = await getRandomUpgrades(count);

    return new Response(JSON.stringify(upgrades), {
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
