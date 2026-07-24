-- RLS: mutations run server-side with the service role, so policies only
-- govern direct client reads. Content is world-readable; game rows are
-- visible only to their participants.

grant usage on schema public to anon, authenticated, service_role;
grant select on grocery_sections, ingredients, meals, upgrades, narrative_messages to anon, authenticated;
grant select on games, participants to authenticated;
grant all on grocery_sections, ingredients, meals, upgrades, narrative_messages, games, participants to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table grocery_sections enable row level security;
alter table ingredients enable row level security;
alter table meals enable row level security;
alter table upgrades enable row level security;
alter table narrative_messages enable row level security;

create policy "content readable" on grocery_sections for select to anon, authenticated using (true);
create policy "content readable" on ingredients for select to anon, authenticated using (true);
create policy "content readable" on meals for select to anon, authenticated using (true);
create policy "content readable" on upgrades for select to anon, authenticated using (true);
create policy "content readable" on narrative_messages for select to anon, authenticated using (true);

alter table games enable row level security;
alter table participants enable row level security;

create policy "participants read own games" on games for select to authenticated
  using (
    exists (
      select 1 from participants p
      where p.game_id = games.id and p.user_id = (select auth.uid())
    )
  );

create policy "read own participation" on participants for select to authenticated
  using (user_id = (select auth.uid()));
