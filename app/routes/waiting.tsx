import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { MetaFunction } from "react-router";
import GameLayout from "~/components/GameLayout";
import { decodeGameState, encodeGameState } from "~/lib/urlCodec";
import {
  setDietPreference,
  setPlayerUpgrades,
  generateMealPool,
  addPlayerB
} from "~/lib/gameState";
import { getRandomUpgrades, getRandomMeals, type Meal } from "~/lib/gameData";
import type { Upgrade } from "~/lib/gameState";

export const meta: MetaFunction = () => {
  return [
    { title: "DINNER QUEST · Choose Your Path" },
    { name: "description", content: "Configure your preferences for the quest." },
  ];
};

export default function Waiting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dietPreference, setDietPref] = useState(3);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const state = decodeGameState(searchParams);
  const currentPlayer = (searchParams.get('player') || 'A') as 'A' | 'B';

  // Redirect if no valid state
  useEffect(() => {
    if (!state || !state.id) {
      navigate('/');
      return;
    }
    setIsLoading(false);
  }, [state, navigate]);

  // Apply theme
  useEffect(() => {
    if (state?.theme) {
      document.body.className = state.theme;
    }
  }, [state?.theme]);

  // Load initial upgrades
  useEffect(() => {
    if (state) {
      const theme = state.theme || 'theme-fantasy';
      const initialUpgrades = getRandomUpgrades(2, theme);
      setUpgrades(initialUpgrades);
    }
  }, [state?.theme]);

  if (isLoading || !state) {
    return (
      <GameLayout>
        <div className="panel">
          <div className="loading-placeholder">Loading...</div>
        </div>
      </GameLayout>
    );
  }

  const player = state.players[currentPlayer];
  const playerName = player?.name || state.playerBName || currentPlayer;

  const handleRedraw = () => {
    const theme = state.theme || 'theme-fantasy';
    const newUpgrades = getRandomUpgrades(2, theme);
    setUpgrades(newUpgrades);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let updatedState = state;

    // If Player B is joining for the first time, add them to state
    if (currentPlayer === 'B' && !state.players.B) {
      updatedState = addPlayerB(updatedState);
    }

    // Update state with preferences
    updatedState = setDietPreference(updatedState, currentPlayer, dietPreference);
    updatedState = setPlayerUpgrades(updatedState, currentPlayer, upgrades);

    // Mark player as ready
    updatedState = {
      ...updatedState,
      players: {
        ...updatedState.players,
        [currentPlayer]: {
          ...updatedState.players[currentPlayer]!,
          locked: true
        }
      }
    };

    // Generate meal pool and go to draft
    const avgDiet = updatedState.players.B
      ? (updatedState.players.A!.dietPreference + updatedState.players.B.dietPreference) / 2
      : updatedState.players.A!.dietPreference;
    const poolSize = updatedState.settings.mealCount * 5;
    const meals = getRandomMeals(poolSize, updatedState.settings.allergies, avgDiet);
    updatedState = generateMealPool(updatedState, meals);

    // Navigate to game/draft page
    const encoded = encodeGameState(updatedState);
    navigate(`/game?${encoded.toString()}&player=${currentPlayer}`);
  };

  return (
    <GameLayout theme={state.theme}>
      <div className="panel">
        <div className="panel-title">{playerName} - CHOOSE YOUR PATH</div>

        <form className="player-setup" onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label">Diet Preference</label>
            <div className="diet-slider-container">
              <span className="diet-label">🥬 Veggie</span>
              <input
                type="range"
                min="1"
                max="5"
                value={dietPreference}
                onChange={(e) => setDietPref(Number(e.target.value))}
                className="diet-slider"
              />
              <span className="diet-label">Meaty 🥩</span>
            </div>
            <div className="diet-value">{dietPreference}</div>
          </div>

          <div className="form-section">
            <div className="upgrades-header">
              <label className="form-label">Your Upgrades (2 random)</label>
              <button
                type="button"
                className="btn-icon"
                onClick={handleRedraw}
                title="Redraw Upgrades"
              >
                🔄
              </button>
            </div>
            <div className="upgrades-grid">
              {upgrades.map(upgrade => (
                <div key={upgrade.id} className="upgrade-card">
                  {upgrade.type === 'theme' && <div className="theme-badge">THEME</div>}
                  {upgrade.type === 'takeout' && <div className="takeout-badge">TAKEOUT</div>}
                  {upgrade.type === 'lock' && <div className="lock-badge">LOCK AN ITEM</div>}
                  {upgrade.type === 'redraw' && <div className="redraw-badge">REDRAW</div>}
                  <div className="upgrade-emoji">{upgrade.emoji}</div>
                  <div className="upgrade-name">{upgrade.name}</div>
                  <div className="upgrade-effect">{upgrade.effect}</div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            Ready Your Provisions
          </button>
        </form>
      </div>

      <div className="narrative">
        <p>Configure your preferences. The meal pool will be tailored to both players' tastes.</p>
      </div>
    </GameLayout>
  );
}
