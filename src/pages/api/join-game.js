import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';
import { addPlayerB } from '../../lib/gameState.js';

export async function POST({ request, url, redirect }) {
  try {
    const formData = await request.formData();
    const playerName = formData.get('playerName');

    if (!playerName) {
      return new Response('Player name required', { status: 400 });
    }

    const state = decodeGameState(url.searchParams);
    if (!state) {
      return new Response('Invalid game state', { status: 400 });
    }

    const newState = addPlayerB(state, playerName);
    const newParams = encodeGameState(newState);

    // Use Astro's redirect
    return redirect(`/dinnerquest/game?${newParams.toString()}&player=B`);
  } catch (error) {
    console.error('Form processing error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
