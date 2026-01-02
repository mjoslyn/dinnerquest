export const prerender = false;

import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';
import { resolveDraft } from '../../lib/gameLogic.js';

export async function POST({ request, url, redirect }) {
  const data = await request.json();
  const { picks, playerId } = data;
  const state = decodeGameState(url.searchParams);

  if (!state) {
    return new Response('Invalid state', { status: 400 });
  }

  // Update all days with player's picks
  // picks is an object like { 0: 5, 1: 12, 2: 3, ... } where key is day index, value is meal ID
  Object.entries(picks).forEach(([dayIndex, mealId]) => {
    const day = state.week[parseInt(dayIndex)];
    day.picks[playerId] = parseInt(mealId);
    // Set bid to 0 for all picks (bidding removed for simplicity)
    day.bids[playerId] = 0;
  });

  // Check if both players have picked for all days
  const allDaysPicked = state.week.every(day =>
    day.picks.A !== null && day.picks.B !== null
  );

  if (allDaysPicked) {
    // Resolve all days at once
    state.week.forEach((day, dayIndex) => {
      resolveDraft(state, dayIndex);
      day.phase = 'complete';
    });

    // Mark game as complete
    state.status = 'complete';
    state.currentDay = 6;

    // Redirect to complete page
    const params = encodeGameState(state);
    return redirect(`${import.meta.env.BASE_URL}/complete?${params.toString()}`);
  }

  // Not all picks submitted yet, go back to game page
  const params = encodeGameState(state);
  return redirect(`${import.meta.env.BASE_URL}/game?${params.toString()}&player=${playerId}`);
}
