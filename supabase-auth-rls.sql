-- Supabase Auth + RLS upgrade for the badminton rating app.
-- Public visitors can read leaderboard data.
-- Only users listed in badminton_club_members as admin/editor can write data.

insert into badminton_clubs (id, name)
values ('default', 'Badminton Club')
on conflict (id) do update
set updated_at = now();

create table if not exists badminton_club_members (
  club_id text not null references badminton_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists badminton_club_members_user_idx
  on badminton_club_members (user_id);

alter table badminton_club_members enable row level security;
alter table badminton_clubs enable row level security;
alter table badminton_players enable row level security;
alter table badminton_matches enable row level security;

create or replace function public.badminton_member_role(p_club_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select member.role
      from badminton_club_members member
      where member.club_id = p_club_id
        and member.user_id = auth.uid()
      limit 1
    ),
    'viewer'
  );
$$;

create or replace function public.can_edit_badminton(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.badminton_member_role(p_club_id) in ('admin', 'editor');
$$;

create or replace function public.can_admin_badminton(p_club_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.badminton_member_role(p_club_id) = 'admin';
$$;

grant execute on function public.badminton_member_role(text) to anon, authenticated;
grant execute on function public.can_edit_badminton(text) to anon, authenticated;
grant execute on function public.can_admin_badminton(text) to anon, authenticated;

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
drop policy if exists "members read own or admin" on badminton_club_members;
drop policy if exists "members admin write" on badminton_club_members;

create policy "public read clubs"
  on badminton_clubs for select
  using (true);

create policy "editor insert clubs"
  on badminton_clubs for insert
  with check (public.can_edit_badminton(id));

create policy "editor update clubs"
  on badminton_clubs for update
  using (public.can_edit_badminton(id))
  with check (public.can_edit_badminton(id));

create policy "public read players"
  on badminton_players for select
  using (true);

create policy "editor write players"
  on badminton_players for all
  using (public.can_edit_badminton(club_id))
  with check (public.can_edit_badminton(club_id));

create policy "public read matches"
  on badminton_matches for select
  using (true);

create policy "editor write matches"
  on badminton_matches for all
  using (public.can_edit_badminton(club_id))
  with check (public.can_edit_badminton(club_id));

create policy "members read own or admin"
  on badminton_club_members for select
  using (
    user_id = auth.uid()
    or public.can_admin_badminton(club_id)
  );

create policy "members admin write"
  on badminton_club_members for all
  using (public.can_admin_badminton(club_id))
  with check (public.can_admin_badminton(club_id));

-- Step 1: deploy the website changes and open the site.
-- Step 2: send yourself a login link and click it once.
-- Step 3: replace the email below with your admin email and run this block.
--
-- insert into badminton_club_members (club_id, user_id, role)
-- select 'default', id, 'admin'
-- from auth.users
-- where email = 'your-email@example.com'
-- on conflict (club_id, user_id) do update
-- set role = 'admin',
--     updated_at = now();
--
-- Add another editor later:
--
-- insert into badminton_club_members (club_id, user_id, role)
-- select 'default', id, 'editor'
-- from auth.users
-- where email = 'friend@example.com'
-- on conflict (club_id, user_id) do update
-- set role = 'editor',
--     updated_at = now();
