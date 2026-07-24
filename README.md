# DINNER QUEST

> A text-based RPG roguelike for couples to decide on dinner for the week

![Dinner Quest](https://img.shields.io/badge/players-2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## The Premise

The week stretches before you like an endless dungeon. A week of dinners awaits. Two appetites. One kitchen.

Will you find **harmony**... or descend into takeout chaos?

## How It Works

1. **Start a Quest** — Pick meal count, budget, allergies, and a theme; share the join link with your partner
2. **Draft** — Each round, Player A drafts meals and locks in; Player B drafts seeing A's picks as partial harmonies
3. **Harmony** — Meals you both pick lock into the menu; partial harmonies carry into the next round
4. **Repeat** — The pool prunes and refills each round until the menu is complete
5. **Victory** — Weekly meal plan, stats, and a shopping list grouped by grocery section

## Features

- Text-based RPG aesthetic with 9 selectable themes (plain + 8 flavors), switchable mid-game
- ~190 meals with ingredients, allergens, and diet scores
- Upgrades: lock, takeout, custom meal, pool redraw
- Point-based budget system with cumulative enforcement
- Live two-player sync (Supabase Realtime) — no refresh, no link-passing mid-game
- Anonymous play by default; link an email to keep your quest history

## Stack

- [HonoX](https://github.com/honojs/honox) (file-based routing, JSX SSR, islands) on Cloudflare Workers
- [Supabase](https://supabase.com) — Postgres (game state + content), anonymous auth, Realtime broadcast
- Game content authored as MDX/JSON in `content/`, seeded into Postgres

## Development

```bash
npm install
npx supabase start        # local Supabase stack (Docker)
npm run db:seed           # seed meals/upgrades/content
npm run dev               # vite dev server on :5173
```

Copy the local keys from `npx supabase status` into `.env` and `.dev.vars` (see CLAUDE.md).

```bash
npm test                  # vitest engine tests
npm run test:e2e          # playwright (needs supabase + seed)
npm run build             # client + worker bundles into dist/
npm run preview           # wrangler dev against the built worker
npm run deploy            # wrangler deploy
```

## Rules

See [RULESET.md](RULESET.md).

## License

MIT
