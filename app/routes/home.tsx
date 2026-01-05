import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { MetaFunction } from "react-router";
import GameLayout from "~/components/GameLayout";
import { createInitialState } from "~/lib/gameState";
import { encodeGameState } from "~/lib/urlCodec";
import { getThemedPlayerNames } from "~/lib/gameData";

export const meta: MetaFunction = () => {
  return [
    { title: "DINNER QUEST · A Meal Planning Roguelike" },
    { name: "description", content: "A text-based RPG roguelike for couples to decide on dinner for the week." },
    { property: "og:title", content: "Dinner Quest - A Roguelike for Couples" },
    { property: "og:description", content: "A text-based RPG roguelike for couples to decide on dinner for the week." },
    { property: "og:image", content: "/share-card.png" },
  ];
};

const MEAL_COUNT_OPTIONS = [3, 5, 7, 10] as const;
const BUDGET_OPTIONS = [
  { value: 'tight', label: 'Tight', desc: 'Mostly budget meals' },
  { value: 'moderate', label: 'Moderate', desc: 'Mix of options' },
  { value: 'fancy', label: 'Fancy', desc: 'Splurge worthy' },
  { value: 'none', label: 'No Limit', desc: "Sky's the limit" }
] as const;
const ALLERGEN_OPTIONS = ['dairy', 'gluten', 'nuts', 'shellfish', 'soy', 'eggs'] as const;

const THEMES = [
  'theme-fantasy',
  'theme-cyberpunk',
  'theme-western',
  'theme-noir',
  'theme-pirate',
  'theme-medieval',
  'theme-space',
  'theme-horror'
] as const;

const themeContent: Record<string, {
  title: string;
  subtitle: string;
  ogDescription: string;
  narrative: string[];
  buttonText: string;
}> = {
  'theme-fantasy': {
    title: 'DINNER QUEST',
    subtitle: 'A culinary adventure',
    ogDescription: 'Embark on an epic culinary quest! Two heroes, one legendary meal plan.',
    narrative: [
      'The realm calls to you, brave adventurer.',
      'Two heroes. One legendary quest. A week of feasts to secure.',
      'Will your choices forge <span class="highlight">harmony</span>... or summon the dragons of discord?'
    ],
    buttonText: 'Begin the Quest'
  },
  'theme-cyberpunk': {
    title: 'SUSTENANCE.EXE',
    subtitle: 'A meal planning simulation',
    ogDescription: 'Jack into the Grid. Two netrunners, one meal database.',
    narrative: [
      'Welcome to the Grid. Systems online.',
      'Two netrunners. One database. Seven days of sustenance protocols.',
      'Will you achieve <span class="highlight">sync</span>... or crash into takeout chaos?'
    ],
    buttonText: 'Initialize Protocol'
  },
  'theme-western': {
    title: 'GRUB SHOWDOWN',
    subtitle: 'A meal wrangling game',
    ogDescription: 'Head west, partner. Two gunslingers, one saloon.',
    narrative: [
      'The frontier stretches wide, partner.',
      'Two gunslingers. One saloon. A week of grub to wrangle.',
      'Will you ride together in <span class="highlight">harmony</span>... or face off at high noon?'
    ],
    buttonText: 'Draw Your Hand'
  },
  'theme-noir': {
    title: 'CASE: MISSING MEALS',
    subtitle: 'A culinary mystery',
    ogDescription: 'A dark mystery unfolds. Two detectives, seven missing meals.',
    narrative: [
      'It was a dark and stormy night. The case file lay open.',
      'Two detectives. One mystery. Seven meals missing from the week.',
      'Will you crack the case with <span class="highlight">harmony</span>... or let it go cold?'
    ],
    buttonText: 'Open the Case'
  },
  'theme-pirate': {
    title: 'HIGH SEAS FEAST',
    subtitle: 'A meal treasure hunt',
    ogDescription: 'Ahoy, matey! Two pirates, one ship, a week of plunder.',
    narrative: [
      "Ahoy there, ye scurvy dogs! The seas be callin'.",
      'Two pirates. One ship. A week of plunder to claim.',
      'Will ye sail as mates in <span class="highlight">harmony</span>... or make each other walk the plank?'
    ],
    buttonText: 'Set Sail'
  },
  'theme-medieval': {
    title: 'THE FEAST DECREE',
    subtitle: 'A royal banquet quest',
    ogDescription: 'Hear ye! The royal court assembles.',
    narrative: [
      'Hear ye, hear ye! The royal court assembles.',
      'Two nobles. One banquet hall. A week of feasts to decree.',
      'Will thy choices bring <span class="highlight">harmony</span>... or spark a courtly dispute?'
    ],
    buttonText: 'Herald the Banquet'
  },
  'theme-space': {
    title: 'MISSION: SUSTENANCE',
    subtitle: 'A deep space meal protocol',
    ogDescription: 'Mission Control to crew: systems go.',
    narrative: [
      'Mission Control to crew: systems are go.',
      'Two astronauts. One vessel. Seven days of rations to secure.',
      'Will your coordinates align in <span class="highlight">harmony</span>... or drift into the void?'
    ],
    buttonText: 'Launch Mission'
  },
  'theme-horror': {
    title: 'THE CURSED KITCHEN',
    subtitle: 'A haunted meal quest',
    ogDescription: 'The mansion groans. Something stirs.',
    narrative: [
      'The old mansion groans. Something stirs in the shadows.',
      'Two souls. One haunted week. Seven cursed meals await.',
      'Will you survive together in <span class="highlight">harmony</span>... or become the next ghosts?'
    ],
    buttonText: 'Enter the Manor'
  }
};

export default function Home() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<string>('theme-fantasy');
  const [mealCount, setMealCount] = useState<3 | 5 | 7 | 10>(5);
  const [budgetCap, setBudgetCap] = useState<string>('moderate');
  const [allergies, setAllergies] = useState<string[]>([]);

  // Randomly select theme on mount
  useEffect(() => {
    const randomTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    setTheme(randomTheme);
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const content = themeContent[theme] || themeContent['theme-fantasy'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const settings = {
      mealCount,
      budgetCap: budgetCap as 'tight' | 'moderate' | 'fancy' | 'none',
      allergies
    };

    const themedNames = getThemedPlayerNames(theme);
    const state = createInitialState(themedNames.A, settings, theme, themedNames.B);

    const encoded = encodeGameState(state);
    navigate(`/waiting?${encoded.toString()}&player=A`);
  };

  const handleAllergyToggle = (allergen: string) => {
    setAllergies(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
  };

  return (
    <GameLayout theme={theme}>
      <div className="panel">
        <div className="panel-title">{content.title}</div>

        <form className="setup-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <label className="form-label">How many meals for the week?</label>
            <div className="option-grid">
              {MEAL_COUNT_OPTIONS.map(count => (
                <label key={count} className="option-card">
                  <input
                    type="radio"
                    name="mealCount"
                    value={count}
                    checked={mealCount === count}
                    onChange={() => setMealCount(count)}
                  />
                  <span className="option-content">
                    <span className="option-number">{count}</span>
                    <span className="option-text">meals</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Budget for the week?</label>
            <div className="option-grid">
              {BUDGET_OPTIONS.map(budget => (
                <label key={budget.value} className="option-card">
                  <input
                    type="radio"
                    name="budgetCap"
                    value={budget.value}
                    checked={budgetCap === budget.value}
                    onChange={() => setBudgetCap(budget.value)}
                  />
                  <span className="option-content">
                    <span className="option-title">{budget.label}</span>
                    <span className="option-desc">{budget.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Any allergies or restrictions?</label>
            <div className="allergen-grid">
              {ALLERGEN_OPTIONS.map(allergen => (
                <label key={allergen} className="allergen-checkbox">
                  <input
                    type="checkbox"
                    checked={allergies.includes(allergen)}
                    onChange={() => handleAllergyToggle(allergen)}
                  />
                  <span>{allergen}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            {content.buttonText}
          </button>
        </form>
      </div>

      <div className="narrative">
        <p dangerouslySetInnerHTML={{ __html: content.narrative[0] }} />
        <p dangerouslySetInnerHTML={{ __html: content.narrative[1] }} />
        <p dangerouslySetInnerHTML={{ __html: content.narrative[2] }} />
      </div>
    </GameLayout>
  );
}
