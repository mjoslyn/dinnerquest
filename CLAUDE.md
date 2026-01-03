# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dinner Quest is a text-based RPG roguelike for couples to decide on dinner for the week. The game uses URL-based state management (no backend required) where all game state is saved in sharable links in url params.

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (also: npm run dev)
npm start

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### State Management Pattern

The entire game operates without a backend through URL-based state encoding:

1. **Game state** is defined in `src/lib/gameState.js` with comprehensive JSDoc types
2. **URL codec** (`src/lib/urlCodec.js`) encodes/decodes state to/from URL parameters
3. **All page navigation** passes state via individual URL params (e.g. `?id=abc&pAN=Alice&day=0&d0p=1,5,8,12,15&player=A`)
4. Each player receives unique links containing the full game state as readable URL parameters

### Core Architecture Files

- `src/lib/gameState.js` - State structure, player management, day initialization
- `src/lib/gameLogic.js` - Game mechanics: resolving picks, validation, stats calculation
- `src/lib/gameData.js` - Static data (24 meals, narrative text, flavor messages)
- `src/lib/urlCodec.js` - State compression/decompression and ID generation

### Page Flow

1. **index.astro** - Entry point. Detects if URL contains existing game (join flow) or starts new game
2. **waiting.astro** - Player A waits for Player B to join (displays shareable link)
3. **game.astro** - Main gameplay: shows current day, meal choices, bidding interface
4. **complete.astro** - End-of-week summary with stats and full meal plan

### API Routes Pattern

The `src/pages/api/` endpoints are NOT traditional REST APIs - they're HTMX response handlers that:
- Decode state from URL params
- Run game logic functions
- Return HTML fragments (not JSON)
- Astro components can be imported and rendered to HTML strings in these endpoints

Example: `src/pages/api/submit-pick.js` validates picks, updates state, redirects with new encoded state

### Key Technical Details

- **No TypeScript** - Uses JSDoc for type hints in pure JavaScript
- **HTMX** - Handles dynamic content updates without page reloads
- **Alpine.js** - Lightweight reactivity for UI interactions (sliders, form validation)
- **Hybrid rendering** - Static pre-rendering for landing pages, on-demand rendering for game pages (`prerender = false`)
- **URL-based state** - Game state passed as individual URL parameters, no JSON encoding needed
- **Netlify deployment** - Uses @astrojs/netlify adapter for serverless functions and on-demand rendering

### Game Mechanics

- Follow the @RULESET.md

### Upgrade System

Upgrades are special abilities players draw at game start. There are three types:

1. **Theme upgrades** - Visual UI themes, can be used once per round (`usedThemeRound`, `usedThemeId`)
2. **Lock upgrades** - Lock a meal directly into harmonies, single-use across all rounds (`usedLockId`)
3. **Takeout upgrades** - Add a takeout meal as instant harmony, single-use across all rounds (`usedTakeoutId`)

Lock and takeout upgrades persist their "used" state across rounds via URL params (`pALI`, `pATO`, `pBLI`, `pBTO`). Once used and the draft is sealed, they cannot be used again in subsequent rounds.

## Deployment

Deployed to Netlify with on-demand rendering:
- Builds with `npm run build` using @astrojs/netlify adapter
- Index and waiting pages are pre-rendered (static)
- Game and complete pages use on-demand server rendering (`prerender = false`)
- API routes are server-rendered for state handling
- All game state persists in shareable URL parameters (no database, no sessions)
- Configure Netlify build settings: Build command `npm run build`, Publish directory `dist`

## Legacy Version

`old-index.html` contains the original single-file version (pure HTML/CSS/JS, no frameworks). Can run with `python3 -m http.server 8000`. Kept for reference.
