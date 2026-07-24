# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dinner Quest is a text-based RPG roguelike for couples to decide on dinner for the week. Two players draft meals in rounds; meals both players pick lock in as "harmonies" until the weekly menu is complete. Built on HonoX (Hono meta-framework) deployed to Cloudflare Workers, backed by Supabase (Postgres + anonymous auth + Realtime).

## Development Commands

```bash
npm install
npx supabase start        # local Supabase stack (Docker required)
npm run db:seed           # seed content tables from /content
npm run dev               # vite dev server on http://localhost:5173

npm test                  # vitest unit tests (game engine)
npm run test:e2e          # playwright end-to-end tests
npm run build             # rm -rf dist, client build, then worker (SSR) build
npm run preview           # wrangler dev serving the built worker on :8788
npm run deploy            # build + wrangler deploy
```

Local env: `.env` (seed script) and `.dev.vars` (worker) both need `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status -o env`. Both files are gitignored.

## Architecture

### Layout

- `app/routes/` — HonoX file-based routes. Pages: `index.tsx` (create form), `join/[id].tsx`, `game/[id].tsx` (single phase-switched game page), `account.tsx`. API: `app/routes/api/games/**` (create/join/picks/lock/upgrade/theme/shopping-list + seat-scoped GET view), `api/account/link-email.ts`.
- `app/islands/` — client-hydrated components (hono/jsx): `create-game-form`, `join-form`, `game-board` (the main app: waiting/drafting/complete phases + realtime sync), `link-account`.
- `app/lib/engine/` — **pure, dependency-free game engine** (ported from the original client code): `gameState.ts` (reducers), `gameLogic.ts` (validateDraft, partialHarmonyIds, stats), `rounds.ts` (lockDraft: harmony formation, round advance, pool prune/refill, upgrade replacement), `upgrades.ts` (lock/takeout/custom/redraw reducers), `rules.ts` (costs, budgets, pool balancing, themed names), `types.ts`. Unit-tested in `engine.test.ts`.
- `app/lib/db/` — `supabase.ts` (per-request clients + cookie-based anonymous sessions), `games.ts` (load/save with optimistic concurrency, redaction, realtime broadcast), `content.ts` (meals/upgrades/narrative queries, shopping list builder).
- `content/` — game content as MDX/JSON (source of truth), seeded into Postgres by `scripts/seed/seed.ts` (idempotent upserts; parser in `parse-content.ts`).
- `supabase/migrations/` — schema: content tables, `games` (JSONB `state` + `version`), `participants` (user/game/seat), RLS.

### Server-authoritative state

All game mutations go through API routes: load `games` row -> run engine reducer -> `UPDATE ... WHERE version = expected` (0 rows = 409, client refetches) -> broadcast `{version,status,round}` on Realtime channel `game:{id}` via the HTTP broadcast endpoint (never the WS client inside a Worker). The `game-board` island subscribes over WebSocket and refetches the seat-scoped view on message, with a 15s poll fallback.

**Redaction rule:** a player's in-progress picks are hidden from the opponent until that player locks (then they surface as partial harmonies). Always compute client-visible data (including `partialHarmonyIds`) from `redactState(state, seat)`, never the raw state.

**Turn order:** A drafts and locks first each round; B's lock is rejected until A locks. When B locks the round resolves (see `rounds.ts`).

### Auth

Anonymous by default: `ensureUser` creates a Supabase anonymous session on first mutating request and stores access/refresh tokens in httpOnly cookies (`dq-access`/`dq-refresh`) — plain supabase-js, no @supabase/ssr (its CJS `cookie` dep breaks vite's workerd module runner). Email linking (`/api/account/link-email`) PUTs to GoTrue with the user's token; the user id survives linking so game history carries over.

### Themes

Game-level theme stored in `games.theme` and `state.theme`: `plain` (no body class, default cream palette) or 8 flavors mapped to `body.theme-*` classes in `app/style.css`. Selectable at create time and switchable mid-game (POST `/api/games/:id/theme`, broadcast restyles the partner live). Theme flavors upgrade draws, narrative text, and suggested player names. There are NO theme upgrade cards (removed in the HonoX migration).

### Game rules

Follow @RULESET.md (v6). Key invariants: pool = meals-still-needed x 5; budget points cumulative across rounds (harmonies count, synthetic takeout/custom meals do not); lock/takeout/custom upgrades are single-use and replaced with fresh draws on round advance; redraw is once per round.

## Conventions

- No TypeScript build step gymnastics: plain TS, `jsxImportSource: hono/jsx`.
- No decorative emojis in UI chrome (meal/upgrade emoji from content data are fine).
- Workers runtime: env via `c.env` (typed in `app/global.d.ts`), no Node APIs in `app/`; Node-only code lives in `scripts/`.
- honox is pinned exactly (pre-1.0); vite is pinned to 7.x (honox islands break under some optimizer configs — `dist/index.js?v=` file reads).

## Deployment

Cloudflare Workers via `wrangler.jsonc` (assets binding serves `dist/` static files; `nodejs_compat` flag required for hono's async_hooks usage). Secrets in prod via `wrangler secret put SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY`. Hosted Supabase: `npx supabase link` + `db push`, then run the seed with prod env vars. Enable anonymous sign-ins in the Supabase dashboard.

## Legacy

`old-index.html` at the repo root (if present) and git history contain the original URL-state Astro version. The Astro app (`src/`) was removed in the HonoX migration; content collections moved to `/content`.
