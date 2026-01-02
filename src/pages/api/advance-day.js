import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';
import { advanceDay } from '../../lib/gameLogic.js';

export async function POST({ url }) {
  const state = decodeGameState(url.searchParams);
  if (!state) {
    return new Response('Invalid game state', { status: 400 });
  }

  const newState = advanceDay(state);
  const newParams = encodeGameState(newState);

  // Redirect based on game status
  if (newState.status === 'complete') {
    return new Response('', {
      status: 200,
      headers: {
        'HX-Redirect': `/dinnerquest/complete?${newParams.toString()}`
      }
    });
  } else {
    return new Response('', {
      status: 200,
      headers: {
        'HX-Redirect': `/dinnerquest/game?${newParams.toString()}&player=A`
      }
    });
  }
}
