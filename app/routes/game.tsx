import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { MetaFunction } from "react-router";
import GameLayout from "~/components/GameLayout";
import { decodeGameState, encodeGameState } from "~/lib/urlCodec";
import { updatePlayerPicks, lockPlayerDraft, bothPlayersLocked } from "~/lib/gameState";
import { validateDraft, resolveDraft } from "~/lib/gameLogic";
import {
  getAllMeals,
  getAllUpgrades,
  getCostPoints,
  getBudgetPoints,
  hydrateUpgrades,
  type Meal
} from "~/lib/gameData";
import type { GameState, Upgrade, TakeoutMeal } from "~/lib/gameState";

export const meta: MetaFunction = () => {
  return [
    { title: "DINNER QUEST · Draft Phase" },
  ];
};

const themeButtonText: Record<string, { inProgress: string; complete: string }> = {
  'theme-fantasy': { inProgress: 'Seal & Dispatch', complete: 'Return Triumphant' },
  'theme-cyberpunk': { inProgress: 'Upload & Transmit', complete: 'Mission Complete' },
  'theme-western': { inProgress: 'Saddle Up & Ride', complete: 'Ride Into Sunset' },
  'theme-noir': { inProgress: 'File the Case', complete: 'Case Closed' },
  'theme-pirate': { inProgress: 'Chart the Course', complete: 'Claim the Treasure' },
  'theme-medieval': { inProgress: 'Send the Herald', complete: 'Feast Declared' },
  'theme-space': { inProgress: 'Transmit Coordinates', complete: 'Mission Accomplished' },
  'theme-horror': { inProgress: 'Seal the Pact', complete: 'Survive the Week' }
};

export default function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedMeals, setSelectedMeals] = useState<Set<number>>(new Set());
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const allMeals = useMemo(() => getAllMeals(), []);
  const allUpgrades = useMemo(() => getAllUpgrades(), []);

  const rawState = decodeGameState(searchParams);
  const currentPlayer = (searchParams.get('player') || 'A') as 'A' | 'B';

  // Hydrate upgrades with full data
  const state = useMemo(() => {
    if (!rawState) return null;

    const hydratedState = { ...rawState };
    if (hydratedState.players.A?.upgrades) {
      hydratedState.players.A = {
        ...hydratedState.players.A,
        upgrades: hydrateUpgrades(hydratedState.players.A.upgrades)
      };
    }
    if (hydratedState.players.B?.upgrades) {
      hydratedState.players.B = {
        ...hydratedState.players.B,
        upgrades: hydrateUpgrades(hydratedState.players.B.upgrades)
      };
    }

    // Hydrate pool with full meal data
    if (hydratedState.pool.length > 0) {
      hydratedState.pool = hydratedState.pool
        .map(m => allMeals.find(full => full.id === m.id) || m)
        .filter((m): m is Meal => 'name' in m);
    }

    return hydratedState;
  }, [rawState, allMeals]);

  // Apply theme
  useEffect(() => {
    if (state?.theme) {
      document.body.className = state.theme;
    } else {
      document.body.className = 'theme-fantasy';
    }
  }, [state?.theme]);

  // Redirect if no valid state or wrong status
  useEffect(() => {
    if (!state || state.status !== 'drafting') {
      navigate('/');
    }
  }, [state, navigate]);

  if (!state) {
    return (
      <GameLayout>
        <div className="panel">
          <div className="loading-placeholder">Loading...</div>
        </div>
      </GameLayout>
    );
  }

  const player = state.players[currentPlayer];
  const mealCount = state.settings.mealCount;
  const budgetLimit = getBudgetPoints(state.settings.budgetCap, mealCount);
  const currentTheme = state.theme || 'theme-fantasy';

  // Build takeout meals map
  const takeoutMeals = new Map<string, TakeoutMeal>();
  if (state.takeoutMeals && state.takeoutMeals.length > 0) {
    state.takeoutMeals.forEach(meal => {
      takeoutMeals.set(meal.id, meal);
    });
  }

  // Calculate costs
  const harmoniesCost = (state.harmoniesSoFar || []).reduce((sum, mealId) => {
    if (typeof mealId === 'string') {
      const takeout = takeoutMeals.get(mealId);
      return sum + (takeout ? getCostPoints(takeout.cost) : 0);
    }
    const meal = allMeals.find(m => m.id === mealId);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  const harmoniesUsdTotal = (state.harmoniesSoFar || []).reduce((sum, mealId) => {
    if (typeof mealId === 'string') {
      const takeout = takeoutMeals.get(mealId);
      return sum + (takeout?.estimatedPrice || 0);
    }
    const meal = allMeals.find(m => m.id === mealId);
    return sum + (meal?.estimatedPrice || 0);
  }, 0);

  // Render harmonies
  const harmonyMeals = (state.harmoniesSoFar || [])
    .map(id => {
      if (typeof id === 'string' && id.startsWith('takeout-')) {
        return takeoutMeals.get(id);
      }
      return allMeals.find(m => m.id === id);
    })
    .filter((meal): meal is Meal | TakeoutMeal => meal !== undefined);

  // Calculate pool with partial harmonies
  const otherPlayerAllPicks = state.currentRound > 1
    ? (currentPlayer === 'A' ? (state.playerBAllPicks || []) : (state.playerAAllPicks || []))
    : [];
  const partialHarmonyIds = otherPlayerAllPicks.filter(
    id => !(state.harmoniesSoFar || []).includes(id)
  );
  const otherPlayerPicksSet = new Set(partialHarmonyIds);

  const poolMealIds = state.pool.map(m => m.id);
  const combinedPoolIds = [...new Set([...poolMealIds, ...partialHarmonyIds])];
  const availablePoolIds = combinedPoolIds.filter(
    id => !(state.harmoniesSoFar || []).includes(id)
  );
  let poolMeals = availablePoolIds
    .map(id => allMeals.find(m => m.id === id))
    .filter((m): m is Meal => m !== undefined);

  // Filter by diet preference if veggie
  if (player?.dietPreference === 1) {
    poolMeals = poolMeals.filter(meal =>
      meal.dietScore <= 2 || otherPlayerPicksSet.has(meal.id)
    );
  }

  // Calculate current picks cost
  const currentPicksCost = Array.from(selectedMeals).reduce((sum, id) => {
    const meal = allMeals.find(m => m.id === id);
    return sum + (meal ? getCostPoints(meal.cost) : 0);
  }, 0);

  const currentPicksUsd = Array.from(selectedMeals).reduce((sum, id) => {
    const meal = allMeals.find(m => m.id === id);
    return sum + (meal?.estimatedPrice || 0);
  }, 0);

  const cumulativeCost = harmoniesCost + currentPicksCost;
  const cumulativeUsd = harmoniesUsdTotal + currentPicksUsd;

  // Calculate meals display
  const currentPicksCount = selectedMeals.size;
  const mealsStillNeeded = Math.max(0, mealCount - (state.harmoniesSoFar?.length || 0));
  const allMealIds = new Set([...(state.harmoniesSoFar || []), ...Array.from(selectedMeals)]);
  const totalMealsSecured = allMealIds.size;

  // Validate draft
  const updatedState = updatePlayerPicks(state, currentPlayer, Array.from(selectedMeals));
  const validation = validateDraft(updatedState, currentPlayer, allMeals);

  // Check if quest will be completed
  let questComplete = false;
  if (currentPlayer === 'A') {
    const playerBAllPicks = state.playerBAllPicks || [];
    const newHarmonies = Array.from(selectedMeals).filter(mealId =>
      playerBAllPicks.includes(mealId)
    );
    const allHarmonies = [...new Set([...(state.harmoniesSoFar || []), ...newHarmonies])];
    questComplete = allHarmonies.length >= mealCount;
  } else if (currentPlayer === 'B') {
    const playerAPicks = state.players.A?.picks || [];
    const harmonies = Array.from(selectedMeals).filter(mealId =>
      playerAPicks.includes(mealId)
    );
    const allHarmonies = [...new Set([...(state.harmoniesSoFar || []), ...harmonies])];
    questComplete = allHarmonies.length >= mealCount;
  }

  const buttonTexts = themeButtonText[currentTheme] || themeButtonText['theme-fantasy'];
  const buttonText = questComplete ? buttonTexts.complete : buttonTexts.inProgress;

  const handleMealToggle = (mealId: number) => {
    setSelectedMeals(prev => {
      const next = new Set(prev);
      if (next.has(mealId)) {
        next.delete(mealId);
      } else {
        next.add(mealId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!validation.valid) return;

    let finalState = updatePlayerPicks(state, currentPlayer, Array.from(selectedMeals));
    finalState = lockPlayerDraft(finalState, currentPlayer);

    // Update all picks tracking
    if (currentPlayer === 'A') {
      finalState = {
        ...finalState,
        playerAAllPicks: [...(finalState.playerAAllPicks || []), ...Array.from(selectedMeals)]
      };
    } else {
      finalState = {
        ...finalState,
        playerBAllPicks: [...(finalState.playerBAllPicks || []), ...Array.from(selectedMeals)]
      };
    }

    // Check if both players are locked
    if (bothPlayersLocked(finalState)) {
      // Resolve draft
      const results = resolveDraft(finalState);
      finalState = {
        ...finalState,
        results,
        harmoniesSoFar: [...(finalState.harmoniesSoFar || []), ...results.harmonies],
        status: results.harmonies.length >= mealCount ? 'complete' : 'drafting'
      };

      if (finalState.status === 'complete') {
        const encoded = encodeGameState(finalState);
        navigate(`/complete?${encoded.toString()}&player=${currentPlayer}`);
        return;
      }
    }

    const encoded = encodeGameState(finalState);
    navigate(`/game?${encoded.toString()}&player=${currentPlayer}`);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage('Link copied!');
      setTimeout(() => setShareMessage(null), 3000);
    } catch (err) {
      setShareMessage('Failed to copy');
    }
  };

  const handleOpenLink = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <GameLayout theme={currentTheme}>
      <div className="panel">
        <div className="panel-title">
          {player?.name || `Player ${currentPlayer}`} - ROUND {state.currentRound}
        </div>

        {harmonyMeals.length > 0 && (
          <div className="harmonies-section">
            <h3>Harmonies (Locked In)</h3>
            <div className="harmony-grid">
              {harmonyMeals.map(meal => (
                <div key={meal.id} className="harmony-card locked">
                  <span className="meal-emoji">{meal.emoji}</span>
                  <div className="meal-name">{meal.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="draft-info">
          <div className="info-row">
            <div className="info-item">
              <span className="info-label">Meals to Pick:</span>
              <span
                className="info-value"
                style={{
                  color: totalMealsSecured >= mealCount ? 'var(--success)' : 'var(--danger)'
                }}
              >
                {totalMealsSecured >= mealCount
                  ? 'Complete!'
                  : `${currentPicksCount} / ${mealsStillNeeded}`}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Budget:</span>
              <span
                className="info-value"
                style={{
                  color: budgetLimit && cumulativeCost > budgetLimit
                    ? 'var(--danger)'
                    : 'var(--accent)'
                }}
              >
                {cumulativeCost} / {budgetLimit || 'No limit'}
                <span className="usd-total"> (${cumulativeUsd})</span>
              </span>
            </div>
          </div>
        </div>

        {player?.upgrades && player.upgrades.length > 0 && (
          <div className="upgrades-section">
            <h3>Your Themes</h3>
            <div className="upgrades-grid">
              {player.upgrades.map(upgrade => (
                <div key={upgrade.id} className="upgrade-card">
                  {upgrade.type === 'theme' && <div className="theme-badge">THEME</div>}
                  {upgrade.type === 'takeout' && <div className="takeout-badge">TAKEOUT</div>}
                  {upgrade.type === 'lock' && <div className="lock-badge">LOCK AN ITEM</div>}
                  {upgrade.type === 'redraw' && <div className="redraw-badge">REDRAW</div>}
                  <div className="upgrade-emoji">{upgrade.emoji}</div>
                  <div className="upgrade-name">{upgrade.name}</div>
                  <div className="upgrade-effect">{upgrade.effect}</div>
                  <button
                    className="btn-use-upgrade"
                    disabled
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="meal-pool">
          {poolMeals.map(meal => (
            <div
              key={meal.id}
              className={`meal-card ${selectedMeals.has(meal.id) ? 'selected' : ''}`}
              onClick={() => handleMealToggle(meal.id)}
              data-partial={otherPlayerPicksSet.has(meal.id) ? 'true' : 'false'}
            >
              {otherPlayerPicksSet.has(meal.id) && (
                <span className="partner-pick-star">✨</span>
              )}
              <span className="meal-emoji">{meal.emoji}</span>
              <div className="meal-title-row">
                <span className="meal-name">{meal.name}</span>
                <span className="meal-cost">({meal.cost})</span>
              </div>
              <div className="meal-meta">
                <span>{meal.time}min</span>
                <span>{meal.cuisine}</span>
              </div>
              {otherPlayerPicksSet.has(meal.id) && (
                <div className="partial-harmony-badge">Partial Harmony</div>
              )}
            </div>
          ))}
        </div>

        <div className={`draft-actions ${validation.valid ? 'visible' : ''}`}>
          <button
            className="btn btn-primary"
            disabled={!validation.valid}
            onClick={handleSubmit}
          >
            {buttonText}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!validation.valid}
            onClick={handleOpenLink}
            title="Open link"
          >
            →
          </button>
          <button
            className="btn btn-secondary"
            disabled={!validation.valid}
            onClick={handleCopyLink}
            title="Copy link"
          >
            🔗
          </button>
        </div>

        {shareMessage && (
          <div className="share-message">{shareMessage}</div>
        )}
      </div>

      <div className="narrative">
        <p>Pick <strong>at least {mealCount} meals</strong>.</p>
      </div>
    </GameLayout>
  );
}
