import { decodeGameState, encodeGameState } from '../../lib/urlCodec.js';

export async function GET({ url }) {
  const playerId = url.searchParams.get('player');
  const state = decodeGameState(url.searchParams);

  if (!state) {
    return new Response('Invalid game state', { status: 400 });
  }

  const day = state.week[state.currentDay];
  const otherPlayerId = playerId === 'A' ? 'B' : 'A';
  const otherPlayer = state.players[otherPlayerId];
  const params = encodeGameState(state);

  // Check if both picked and resolved
  if (day.phase === 'reveal') {
    const meal = day.pool.find(m => m.id === day.result.meal);
    const isHarmony = day.result.harmony;

    return new Response(
      `<div>
        <div class="${isHarmony ? 'result' : 'result conflict'}">
          <div class="result-title">${isHarmony ? 'HARMONY! Great minds dine alike.' : 'A clash of culinary visions!'}</div>
          <div class="meal-emoji">${meal.emoji}</div>
          <div class="result-meal">${meal.name}</div>
          ${!isHarmony && day.result.winner ? `<p>${state.players[day.result.winner].name} wins the coin flip!</p>` : ''}
        </div>

        <button
          class="btn"
          hx-post="/api/advance-day?${params.toString()}"
          hx-target="body"
          hx-swap="outerHTML"
          hx-push-url="true"
        >
          ${state.currentDay < 6 ? 'Continue to ' + state.week[state.currentDay + 1].day : 'View Results'}
        </button>
      </div>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  // Still waiting
  return new Response(
    `<div
      hx-get="/api/check-picks?${params.toString()}&player=${playerId}"
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
