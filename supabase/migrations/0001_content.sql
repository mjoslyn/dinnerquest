-- Static game content, seeded from /content via scripts/seed

create table grocery_sections (
  id text primary key,
  name text not null,
  sort_order int not null,
  emoji text
);

create table ingredients (
  id text primary key,
  name text not null,
  section text not null references grocery_sections (id),
  common_names text[] not null default '{}'
);

create table meals (
  id int primary key,
  name text not null,
  emoji text not null,
  time_minutes int not null,
  cost text not null check (cost in ('$', '$$', '$$$')),
  estimated_price numeric,
  cuisine text not null,
  tags text[] not null default '{}',
  allergens text[] not null default '{}',
  diet_score int not null check (diet_score between 1 and 5),
  -- ingredient slugs; intentionally no FK — content has slugs without
  -- ingredient rows and the shopping list tolerates misses
  ingredients text[] not null default '{}',
  description text not null default ''
);

create table upgrades (
  id text primary key,
  name text not null,
  emoji text not null,
  type text not null check (type in ('lock', 'takeout', 'redraw', 'custom')),
  effect text not null,
  theme text,
  rejection_text text,
  undo_text text,
  meal_name text,
  meal_cost text,
  description text not null default ''
);

create table narrative_messages (
  id bigint generated always as identity primary key,
  type text not null check (type in ('conflict', 'harmony', 'intro')),
  theme text,
  message text not null
);
