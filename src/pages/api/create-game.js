import { createInitialState } from '../../lib/gameState.js';
import { encodeGameState } from '../../lib/urlCodec.js';

export async function POST({ request, redirect }) {
  try {
    const formData = await request.formData();
    const playerName = formData.get('playerName');

    if (!playerName) {
      return new Response('Player name required', { status: 400 });
    }

    const state = createInitialState(playerName);
    const params = encodeGameState(state);

    // Use Astro's redirect
    return redirect(`/dinnerquest/waiting?${params.toString()}&player=A`);
  } catch (error) {
    console.error('Form processing error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
