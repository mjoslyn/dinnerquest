import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';
import { submitPick, validatePick } from '../../lib/gameLogic.js';

export async function POST({ request, url }) {
  const data = await request.json();
  const { mealId, bid, playerId } = data;

  const state = decodeGameState(url.searchParams);
  if (!state) {
    return new Response('Invalid game state', { status: 400 });
  }

  // Validate pick
  const validation = validatePick(state, playerId, mealId, bid);
  if (!validation.valid) {
    return new Response(validation.error, { status: 400 });
  }

  // Submit pick
  const newState = submitPick(state, playerId, mealId, bid);
  const newParams = encodeGameState(newState);

  const day = newState.week[newState.currentDay];
  const otherPlayerId = playerId === 'A' ? 'B' : 'A';
  const otherPlayer = newState.players[otherPlayerId];

  // Return HTML fragment based on phase
  if (day.phase === 'reveal') {
    // Both picked - show result
    const meal = day.pool.find(m => m.id === day.result.meal);
    const isHarmony = day.result.harmony;

    return new Response(
      `<div>
        <div class="${isHarmony ? 'result' : 'result conflict'}">
          <div class="result-title">${isHarmony ? 'HARMONY! Great minds dine alike.' : 'A clash of culinary visions!'}</div>
          <div class="meal-emoji">${meal.emoji}</div>
          <div class="result-meal">${meal.name}</div>
          ${!isHarmony && day.result.winner ? `<p>${newState.players[day.result.winner].name} wins the coin flip!</p>` : ''}
        </div>

        <button
          class="btn"
          hx-post="/api/advance-day?${newParams.toString()}"
          hx-target="body"
          hx-swap="outerHTML"
          hx-push-url="true"
        >
          ${newState.currentDay < 6 ? 'Continue to ' + newState.week[newState.currentDay + 1].day : 'View Results'}
        </button>
      </div>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } else {
    // Waiting for other player
    return new Response(
      `<div
        hx-get="/api/check-picks?${newParams.toString()}&player=${playerId}"
        hx-trigger="every 2s"
        hx-swap="outerHTML"
        hx-target="#game-content"
      >
        <div class="status status-waiting">
          <div class="status-icon">⏳</div>
          <p>Waiting for ${otherPlayer.name} to choose...</p>
        </div>
      </div>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}
