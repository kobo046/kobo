-- Optional reset for the simple passcode version.
-- Run this only if you previously applied the Supabase Auth/RLS admin-role setup.
--
-- This keeps public read/write policies on the app tables so the static website can
-- save through the publishable key after the front-end passcode is unlocked.
-- The passcode is a convenience lock, not strong database-level security.

alter table badminton_clubs enable row level security;
alter table badminton_players enable row level security;
alter table badminton_matches enable row level security;

drop policy if exists "public read clubs" on badminton_clubs;
drop policy if exists "public write clubs" on badminton_clubs;
drop policy if exists "editor insert clubs" on badminton_clubs;
drop policy if exists "editor update clubs" on badminton_clubs;
drop policy if exists "public read players" on badminton_players;
drop policy if exists "public write players" on badminton_players;
drop policy if exists "editor write players" on badminton_players;
drop policy if exists "public read matches" on badminton_matches;
drop policy if exists "public write matches" on badminton_matches;
drop policy if exists "editor write matches" on badminton_matches;

create policy "public read clubs"
  on badminton_clubs for select
  using (true);

create policy "public write clubs"
  on badminton_clubs for all
  using (true)
  with check (true);

create policy "public read players"
  on badminton_players for select
  using (true);

create policy "public write players"
  on badminton_players for all
  using (true)
  with check (true);

create policy "public read matches"
  on badminton_matches for select
  using (true);

create policy "public write matches"
  on badminton_matches for all
  using (true)
  with check (true);
