/**
 * Encode game state to URL parameters
 * @param {import('./gameState.js').GameState} state
 * @returns {URLSearchParams}
 */
export function encodeGameState(state) {
  const params = new URLSearchParams();

  // Basic game info
  params.set('id', state.id);
  params.set('status', state.status);

  // Settings
  params.set('mc', state.settings.mealCount.toString());
  params.set('bc', state.settings.budgetCap);
  if (state.settings.allergies.length > 0) {
    params.set('al', state.settings.allergies.join(','));
  }

  // Player A
  if (state.players.A) {
    params.set('pAN', state.players.A.name);
    params.set('pAD', state.players.A.dietPreference.toString());
    if (state.players.A.upgrades.length > 0) {
      params.set('pAU', state.players.A.upgrades.map(u => u.id).join(','));
    }
    if (state.players.A.picks.length > 0) {
      params.set('pAP', state.players.A.picks.join(','));
    }
    if (Object.keys(state.players.A.tokens).length > 0) {
      // Encode as mealId:tokens pairs
      const tokenStr = Object.entries(state.players.A.tokens)
        .map(([id, count]) => `${id}:${count}`)
        .join(',');
      params.set('pAT', tokenStr);
    }
    if (state.players.A.locked) {
      params.set('pAL', '1');
    }
  }

  // Player B
  if (state.players.B) {
    params.set('pBN', state.players.B.name);
    params.set('pBD', state.players.B.dietPreference.toString());
    if (state.players.B.upgrades.length > 0) {
      params.set('pBU', state.players.B.upgrades.map(u => u.id).join(','));
    }
    if (state.players.B.picks.length > 0) {
      params.set('pBP', state.players.B.picks.join(','));
    }
    if (Object.keys(state.players.B.tokens).length > 0) {
      const tokenStr = Object.entries(state.players.B.tokens)
        .map(([id, count]) => `${id}:${count}`)
        .join(',');
      params.set('pBT', tokenStr);
    }
    if (state.players.B.locked) {
      params.set('pBL', '1');
    }
  }

  // Pool (just IDs)
  if (state.pool.length > 0) {
    params.set('pool', state.pool.map(m => m.id).join(','));
  }

  // Results
  if (state.results) {
    if (state.results.finalMenu.length > 0) {
      params.set('rFM', state.results.finalMenu.join(','));
    }
    if (state.results.harmonies.length > 0) {
      params.set('rH', state.results.harmonies.join(','));
    }
    if (state.results.conflicts.length > 0) {
      // Encode as mealId:winner:bidA:bidB
      const conflictStr = state.results.conflicts
        .map(c => `${c.meal}:${c.winner}:${c.playerABid}:${c.playerBBid}`)
        .join('|');
      params.set('rC', conflictStr);
    }
  }

  // Round tracking
  if (state.currentRound) {
    params.set('round', state.currentRound.toString());
  }
  if (state.harmoniesSoFar && state.harmoniesSoFar.length > 0) {
    params.set('harms', state.harmoniesSoFar.join(','));
  }
  if (state.usedMeals && state.usedMeals.length > 0) {
    params.set('used', state.usedMeals.join(','));
  }
  if (state.playerAAllPicks && state.playerAAllPicks.length > 0) {
    params.set('pAAP', state.playerAAllPicks.join(','));
  }
  if (state.playerBAllPicks && state.playerBAllPicks.length > 0) {
    params.set('pBAP', state.playerBAllPicks.join(','));
  }

  return params;
}

/**
 * Decode URL parameters back to game state
 * @param {URLSearchParams | string} params
 * @returns {import('./gameState.js').GameState | null}
 */
export function decodeGameState(params) {
  try {
    // Handle string input
    if (typeof params === 'string') {
      params = new URLSearchParams(params);
    }

    if (!params || !(params instanceof URLSearchParams)) return null;

    // Settings
    const settings = {
      mealCount: parseInt(params.get('mc') || '5'),
      budgetCap: params.get('bc') || 'moderate',
      allergies: params.get('al') ? params.get('al').split(',') : []
    };

    // Player A
    let playerA = null;
    if (params.has('pAN')) {
      const upgradesStr = params.get('pAU');
      const picksStr = params.get('pAP');
      const tokensStr = params.get('pAT');

      const tokens = {};
      if (tokensStr) {
        tokensStr.split(',').forEach(pair => {
          const [id, count] = pair.split(':');
          tokens[parseInt(id)] = parseInt(count);
        });
      }

      playerA = {
        name: params.get('pAN'),
        dietPreference: parseInt(params.get('pAD') || '3'),
        upgrades: upgradesStr ? upgradesStr.split(',').map(id => ({ id })) : [],
        picks: picksStr ? picksStr.split(',').map(Number) : [],
        tokens,
        locked: params.get('pAL') === '1'
      };
    }

    // Player B
    let playerB = null;
    if (params.has('pBN')) {
      const upgradesStr = params.get('pBU');
      const picksStr = params.get('pBP');
      const tokensStr = params.get('pBT');

      const tokens = {};
      if (tokensStr) {
        tokensStr.split(',').forEach(pair => {
          const [id, count] = pair.split(':');
          tokens[parseInt(id)] = parseInt(count);
        });
      }

      playerB = {
        name: params.get('pBN'),
        dietPreference: parseInt(params.get('pBD') || '3'),
        upgrades: upgradesStr ? upgradesStr.split(',').map(id => ({ id })) : [],
        picks: picksStr ? picksStr.split(',').map(Number) : [],
        tokens,
        locked: params.get('pBL') === '1'
      };
    }

    // Pool (minimal - just IDs, full data fetched later)
    const poolStr = params.get('pool');
    const pool = poolStr ? poolStr.split(',').map(id => ({ id: parseInt(id) })) : [];

    // Results
    let results = null;
    const finalMenuStr = params.get('rFM');
    if (finalMenuStr) {
      const harmoniesStr = params.get('rH');
      const conflictsStr = params.get('rC');

      const conflicts = [];
      if (conflictsStr) {
        conflictsStr.split('|').forEach(conflict => {
          const [meal, winner, bidA, bidB] = conflict.split(':');
          conflicts.push({
            meal: parseInt(meal),
            winner,
            playerABid: parseInt(bidA),
            playerBBid: parseInt(bidB)
          });
        });
      }

      results = {
        finalMenu: finalMenuStr.split(',').map(Number),
        harmonies: harmoniesStr ? harmoniesStr.split(',').map(Number) : [],
        conflicts
      };
    }

    const currentRound = parseInt(params.get('round') || '1');
    const harmoniesSoFar = params.get('harms') ? params.get('harms').split(',').map(Number) : [];
    const usedMeals = params.get('used') ? params.get('used').split(',').map(Number) : [];
    const playerAAllPicks = params.get('pAAP') ? params.get('pAAP').split(',').map(Number) : [];
    const playerBAllPicks = params.get('pBAP') ? params.get('pBAP').split(',').map(Number) : [];

    return {
      id: params.get('id') || generateId(),
      settings,
      players: {
        A: playerA,
        B: playerB
      },
      pool,
      results,
      status: params.get('status') || 'setup',
      currentRound,
      harmoniesSoFar,
      usedMeals,
      playerAAllPicks,
      playerBAllPicks
    };
  } catch (e) {
    console.error('Failed to decode game state:', e);
    return null;
  }
}

/**
 * Generate a short random ID
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}
