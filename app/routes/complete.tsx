import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import type { MetaFunction } from "react-router";
import GameLayout from "~/components/GameLayout";
import { decodeGameState, encodeGameState } from "~/lib/urlCodec";
import { getAllMeals, generateShoppingList, type Meal } from "~/lib/gameData";
import type { TakeoutMeal } from "~/lib/gameState";

export const meta: MetaFunction = () => {
  return [
    { title: "DINNER QUEST · Quest Complete!" },
  ];
};

export default function Complete() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const state = decodeGameState(searchParams);
  const allMeals = useMemo(() => getAllMeals(), []);

  // Apply theme
  useEffect(() => {
    if (state?.theme) {
      document.body.className = state.theme;
    }
  }, [state?.theme]);

  // Redirect if no valid state
  useEffect(() => {
    if (!state || state.status !== 'complete') {
      navigate('/');
    }
  }, [state, navigate]);

  if (!state || !state.results) {
    return (
      <GameLayout>
        <div className="panel">
          <div className="loading-placeholder">Loading...</div>
        </div>
      </GameLayout>
    );
  }

  // Build takeout meals map
  const takeoutMeals = new Map<string, TakeoutMeal>();
  if (state.takeoutMeals && state.takeoutMeals.length > 0) {
    state.takeoutMeals.forEach(meal => {
      takeoutMeals.set(meal.id, meal);
    });
  }

  // Get final menu meals
  const finalMenuIds = state.results.finalMenu || [];
  const finalMeals = finalMenuIds
    .map(id => {
      if (typeof id === 'string' && id.startsWith('takeout-')) {
        return takeoutMeals.get(id);
      }
      return allMeals.find(m => m.id === id);
    })
    .filter((meal): meal is Meal | TakeoutMeal => meal !== undefined);

  // Calculate total cost
  const totalUSD = finalMeals.reduce((sum, meal) => {
    return sum + (meal.estimatedPrice || 30);
  }, 0);

  // Generate shopping list
  const numericMealIds = finalMenuIds.filter((id): id is number => typeof id === 'number');
  const shoppingList = generateShoppingList(numericMealIds);

  // Get checked items from URL
  const checkedParam = searchParams.get('checked') || '';
  const checkedItems = new Set(checkedParam ? checkedParam.split(',').filter(Boolean) : []);

  const toggleItem = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }

    // Update URL
    const newParams = new URLSearchParams(searchParams);
    if (newChecked.size > 0) {
      newParams.set('checked', Array.from(newChecked).join(','));
    } else {
      newParams.delete('checked');
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage('Link copied to clipboard!');
      setTimeout(() => setShareMessage(null), 3000);
    } catch (err) {
      setShareMessage('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const message = `Check out our Dinner Quest meal plan and shopping list: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Dinner Quest - Meal Plan',
          text: message
        });
        setShareMessage('Shared successfully!');
        setTimeout(() => setShareMessage(null), 3000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setShareMessage('Share failed. Copy link with 🔗 button.');
        }
      }
    } else {
      // Fallback to SMS
      const smsUrl = `sms:?&body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
    }
  };

  return (
    <GameLayout theme={state.theme}>
      <div className="panel">
        <div className="panel-title">QUEST COMPLETE!</div>

        <div className="final-menu">
          <h2>Your Final Menu</h2>
          <div className="menu-grid">
            {finalMeals.map(meal => (
              <div key={meal.id} className="menu-item">
                <span className="menu-emoji">{meal.emoji || '?'}</span>
                <div className="menu-details">
                  <div className="menu-name">{meal.name || 'Unknown'}</div>
                  <div className="meal-meta">
                    <span>{meal.time}min</span>
                    <span>{meal.cost}</span>
                    <span>{meal.cuisine}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="total-cost">
            <div className="cost-breakdown">
              <strong>${totalUSD.toFixed(2)}</strong> for 2 people
            </div>
          </div>
        </div>

        <div className="shopping-list-section">
          <h3>Shopping List</h3>

          <div className="share-actions">
            <button className="btn btn-primary" onClick={handleShare}>
              Conjure & Share
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCopyLink}
              title="Copy link"
            >
              🔗
            </button>
          </div>

          {shareMessage && (
            <div className="share-message">{shareMessage}</div>
          )}

          <div id="shopping-sections">
            {Object.entries(shoppingList.bySection).length > 0 ? (
              Object.entries(shoppingList.bySection).map(([sectionName, items]) => (
                <div key={sectionName} className="grocery-section">
                  <div className="section-header">
                    <span className="section-name">{sectionName}</span>
                  </div>
                  <ul className="ingredient-list">
                    {items.map(item => {
                      const itemId = item.ingredient.toLowerCase().replace(/[^a-z0-9]/g, '-');
                      const isChecked = checkedItems.has(itemId);
                      return (
                        <li key={itemId}>
                          <label className="ingredient-item">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(itemId)}
                            />
                            <span className={isChecked ? 'line-through opacity-50' : ''}>
                              {item.ingredient}
                            </span>
                            <span className="meal-usage">
                              ({item.meals.join(', ')})
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            ) : (
              <p>No shopping list needed.</p>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <Link to="/" className="btn btn-primary">
            New Quest
          </Link>
        </div>
      </div>

      <div className="narrative">
        <p>The week is planned. The kitchen awaits. Your culinary adventure begins now!</p>
      </div>
    </GameLayout>
  );
}
