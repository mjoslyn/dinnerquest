# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dinner Quest is a text-based RPG roguelike for couples to decide on dinner for the week. The game uses URL-based state management (no backend required) where all game state is saved in sharable links in url params.

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type checking
npm run typecheck

# Run tests
npm test
```

## Architecture

This app uses **React Router v7** with SPA mode (no SSR).

### State Management Pattern

The entire game operates without a backend through URL-based state encoding:

1. **Game state** is defined in `app/lib/gameState.ts` with TypeScript types
2. **URL codec** (`app/lib/urlCodec.ts`) encodes/decodes state to/from URL parameters
3. **All page navigation** passes state via individual URL params (e.g. `?id=abc&pAN=Alice&day=0&d0p=1,5,8,12,15&player=A`)
4. Each player receives unique links containing the full game state as readable URL parameters

### Core Architecture Files

- `app/lib/gameState.ts` - State structure, player management, TypeScript types
- `app/lib/gameLogic.ts` - Game mechanics: resolving picks, validation, stats calculation
- `app/lib/gameData.ts` - Static data (meals, upgrades), helper functions
- `app/lib/urlCodec.ts` - State compression/decompression and ID generation
- `app/data/*.json` - Static JSON data extracted from content collections

### Route Structure

- `app/routes/home.tsx` - Entry point. Themed game setup form
- `app/routes/waiting.tsx` - Player setup with diet preference and upgrades
- `app/routes/game.tsx` - Main gameplay: shows meal pool, selections, bidding
- `app/routes/complete.tsx` - End-of-week summary with stats and shopping list

### Key Technical Details

- **React 19 + React Router v7** - Modern React with file-based routing
- **TypeScript** - Full type safety
- **SPA Mode** - Client-side only, no server-side rendering
- **URL-based state** - Game state passed as individual URL parameters
- **Static deployment** - Can be deployed to any static host (Netlify, Vercel, GitHub Pages)

### Game Mechanics

- Follow the @RULESET.md

### Upgrade System

Upgrades are special abilities players draw at game start. There are three types:

1. **Theme upgrades** - Visual UI themes, can be used once per round (`usedThemeRound`, `usedThemeId`)
2. **Lock upgrades** - Lock a meal directly into harmonies, single-use across all rounds (`usedLockId`)
3. **Takeout upgrades** - Add a takeout meal as instant harmony, single-use across all rounds (`usedTakeoutId`)

Lock and takeout upgrades persist their "used" state across rounds via URL params (`pALI`, `pATO`, `pBLI`, `pBTO`). Once used and the draft is sealed, they cannot be used again in subsequent rounds.

### Data Management

Content data (meals, upgrades, ingredients) is stored in:
- `src/content/` - Source MDX/JSON files (for content editing)
- `app/data/` - Generated JSON files (used by the app)

To regenerate app data from content:
```bash
node scripts/extract-content.js
```

## Deployment

Static SPA deployment:
- Build with `npm run build`
- Deploy `build/client` directory to any static host
- All game state persists in shareable URL parameters (no database, no sessions)

For Netlify:
- Build command: `npm run build`
- Publish directory: `build/client`

## Legacy Version

`old-index.html` contains the original single-file version (pure HTML/CSS/JS, no frameworks). Can run with `python3 -m http.server 8000`. Kept for reference.
