import { createInitialState, addPlayerB } from '../lib/gameState.js';
import { encodeGameState, decodeGameState } from '../lib/urlCodec.js';

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('start-form');
  const baseUrl = window.__DINNER_QUEST_BASE__ || '';

  if (!form) {
    console.error('Start form not found');
    return;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const playerName = form.playerName.value.trim();
    if (!playerName) return;

    const action = e.submitter?.dataset?.action || 'create';
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('s');

    if (action === 'join' && encodedState) {
      const state = decodeGameState(encodedState);
      if (state) {
        const newState = addPlayerB(state, playerName);
        const newEncodedState = encodeGameState(newState);
        window.location.href = `${baseUrl}/game?s=${newEncodedState}&player=B`;
      }
    } else {
      const state = createInitialState(playerName);
      const encodedState = encodeGameState(state);
      window.location.href = `${baseUrl}/waiting?s=${encodedState}&player=A`;
    }
  });
});
