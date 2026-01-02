import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';

export async function GET({ url, redirect }) {
  const state = decodeGameState(url.searchParams);

  if (!state) {
    return new Response('Invalid game state', { status: 400 });
  }

  // Check if player B has joined
  if (state.players.B) {
    // Partner joined - redirect to game
    const params = encodeGameState(state);
    return new Response('', {
      status: 200,
      headers: {
        'HX-Redirect': `/game?${params.toString()}&player=A`
      }
    });
  }

  // Still waiting
  return new Response(
    `<div class="status status-waiting">
      <div class="status-icon">⏳</div>
      <p>Waiting for partner to join...</p>
    </div>`,
    {
      headers: { 'Content-Type': 'text/html' }
    }
  );
}
