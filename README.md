# DINNER QUEST

> A text-based RPG roguelike for couples to decide on dinner for the week

**Play it live: [dinnerquest.robotofthefuture.com](https://dinnerquest.robotofthefuture.com)**

![Dinner Quest](https://img.shields.io/badge/players-2-blue)
![Status](https://img.shields.io/badge/status-live-green)
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

- Text-based RPG aesthetic with 9 selectable themes (plain + 8 flavors), switchable mid-game and synced live to your partner
- ~190 meals with ingredients, allergens, and diet scores
- Upgrades: lock, takeout, custom meal, pool redraw
- Point-based budget system with cumulative enforcement
- Live two-player sync — no refresh, no link-passing mid-game
- Anonymous play by default; link an email to keep your quest history

## Stack

| Layer | Tech |
|---|---|
| Framework | [HonoX](https://github.com/honojs/honox) — file-based routing, JSX SSR, islands (`hono/jsx`) |
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com) with a custom domain; static assets served via the Workers assets binding |
| Database | [Supabase](https://supabase.com) Postgres — game state as JSONB with optimistic-concurrency versioning; content in normalized tables behind RLS |
| Auth | Supabase anonymous sign-ins with httpOnly cookie sessions (plain `supabase-js`, no `@supabase/ssr`); email linking upgrades a guest to a permanent account |
| Realtime | Supabase Realtime — server broadcasts over the HTTP endpoint after each mutation; the browser subscribes via WebSocket with a 15s poll fallback |
| Build | Vite 7 (two-pass: client islands + worker SSR bundle), deployed with Wrangler |
| Content | Meals/ingredients/upgrades/narrative authored as MDX + JSON in `content/`, seeded into Postgres with `tsx` scripts |
| Engine | Pure TypeScript reducers in `app/lib/engine/` — server-authoritative validation, harmony resolution, round advance |
| Tests | Vitest (engine unit tests) + Playwright (two-context end-to-end games) |

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
npm run deploy            # build + wrangler deploy
```

## Deployment

Production runs on Cloudflare Workers (`wrangler.jsonc` routes `dinnerquest.robotofthefuture.com`) against a hosted Supabase project. Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are set with `wrangler secret put`; schema ships via `supabase db push` and content via `npm run db:seed`. Anonymous sign-ins must be enabled in the Supabase dashboard.

## Rules

See [RULESET.md](RULESET.md).

## License

MIT
