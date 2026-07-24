-- Live game state. The state column mirrors the engine's GameState object;
-- all mutations go through server routes (load -> reducer -> save with
-- optimistic concurrency on version).

create table games (
  id text primary key,
  state jsonb not null,
  status text not null generated always as (state ->> 'status') stored,
  theme text not null default 'plain',
  version int not null default 1,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table participants (
  game_id text not null references games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat text not null check (seat in ('A', 'B')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, user_id)
);

create index participants_user_idx on participants (user_id);
create index games_status_idx on games (status);
