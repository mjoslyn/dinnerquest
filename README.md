# 🍽️ DINNER QUEST

> A text-based RPG roguelike for couples to decide on dinner for the week

![Dinner Quest](https://img.shields.io/badge/players-2-blue)
![Status](https://img.shields.io/badge/status-live-green)
![License](https://img.shields.io/badge/license-MIT-green)

## The Premise

The week stretches before you like an endless dungeon. **Seven dinners** await. Two appetites. One kitchen.

Will you find **harmony**... or descend into takeout chaos?

## How It Works

1. **Start a Quest** — Enter your name, get a shareable link for your partner
2. **Pick & Bid** — Each player secretly chooses a meal from 5 options and bids enthusiasm tokens (0-3)
3. **Reveal** — Same pick? Harmony! Different picks? Weighted coin flip based on bids
4. **Repeat** — Battle through 7 days of dinner decisions
5. **Victory** — Get your weekly meal plan + stats

## Features

- 🎮 **Text-based RPG aesthetic** — Dramatic narrative, retro terminal vibes
- 🍕 **24 meal options** — From tacos to sushi, comfort food to healthy
- ⚔️ **Conflict resolution** — Bid tokens to influence outcomes
- 📊 **End-of-week stats** — Harmonies, conflicts, top cuisine, total cook time
- 📱 **Mobile-friendly** — Works on any device
- 🔗 **Async play** — Take turns whenever, state stored in URL

## Quick Start

### Running Locally

#### Option 1: npm (Recommended)
```bash
npm install
npm start
```
Opens automatically at http://localhost:4321

#### Option 2: Python HTTP Server (old version)
```bash
python3 -m http.server 8000
open old-index.html  # Original single-file version
```

### Deploy to GitHub Pages

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy Astro version"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Under "Build and deployment", select:
     - Source: `GitHub Actions`
   - The workflow will auto-deploy

3. **Access your game:**
   - Wait 1-2 minutes for deployment
   - Visit `https://mjoslyn.github.io/dinnerquest/`

**Automatic Deployment:** Every push to `main` auto-deploys via GitHub Actions

## Tech Stack

### New (Astro Version)
- **Astro** — Static site generation
- **HTMX** — Dynamic content swapping without heavy JS
- **Alpine.js** — Lightweight reactivity for UI interactions
- **LZ-String** — URL state compression
- Pure JavaScript (no TypeScript)

### Original (Single-File Version)
- Pure HTML/CSS/JS — no frameworks, no build tools
- LocalStorage for game state
- Retro terminal aesthetic with Google Fonts (VT323, Press Start 2P)

## Architecture

Game state is compressed and encoded in the URL using LZ-String, eliminating the need for a backend. Each player's link contains the entire game state, enabling true async play with no server persistence required.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
dinner-quest/
├── src/
│   ├── components/       # Reusable Astro components
│   ├── layouts/          # Page layouts
│   ├── pages/            # Routes (index, waiting, game, complete)
│   │   └── api/          # API endpoints for HTMX
│   ├── lib/              # Game logic, state management, URL codec
│   └── styles/           # Retro CSS theme
├── public/               # Static assets
└── old-index.html        # Original single-file version (backup)
```

## Roadmap

- [x] Convert to Astro + HTMX architecture
- [x] URL-based state management
- [ ] Push notifications
- [ ] Dietary restriction filters
- [ ] Unlockable meals from harmony streaks
- [ ] Grocery list generator
- [ ] Recipe links

## Contributing

Pull requests welcome! This is a fun side project — feel free to add meals, improve the narrative, or enhance the game mechanics.

## License

MIT — do whatever you want with it.

---

*Made with 🌮 and ⚔️*
