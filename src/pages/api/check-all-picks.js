export const prerender = false;

import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';
import { resolveDay } from '../../lib/gameLogic.js';

export async function GET({ url, redirect }) {
  const playerId = url.searchParams.get('player') || 'A';
  const state = decodeGameState(url.searchParams);

  if (!state) {
    return new Response('Invalid state', { status: 400 });
  }

  // Check if both players have picked for all days
  const allDaysPicked = state.week.every(day =>
    day.picks.A !== null && day.picks.B !== null
  );

  if (allDaysPicked) {
    // Resolve all days at once
    state.week.forEach((day, dayIndex) => {
      resolveDay(state, dayIndex);
      day.phase = 'complete';
    });

    // Mark game as complete
    state.status = 'complete';
    state.currentDay = 6;

    // Redirect to complete page
    const params = encodeGameState(state);
    return redirect(`${import.meta.env.BASE_URL}/complete?${params.toString()}`);
  }

  // Still waiting - return waiting state HTML (HTMX will replace the div)
  const otherPlayerId = playerId === 'A' ? 'B' : 'A';
  const otherPlayerName = state.players[otherPlayerId].name;
  const stateParams = encodeGameState(state).toString();

  return new Response(
    `<div
      hx-get="/api/check-all-picks?${stateParams}&player=${playerId}"
      hx-trigger="every 2s"
      hx-swap="outerHTML"
      hx-target="body"
    >
      <div class="status status-waiting">
        <div class="status-icon">⏳</div>
        <p>Waiting for ${otherPlayerName} to plan their week...</p>
      </div>
    </div>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    }
  );
}
