create table if not exists badminton_clubs (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists badminton_players (
  club_id text not null references badminton_clubs(id) on delete cascade,
  id text not null,
  name text not null,
  gender text not null default '男',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id)
);

create table if not exists badminton_matches (
  club_id text not null references badminton_clubs(id) on delete cascade,
  id text not null,
  match_date date not null,
  location text not null default '',
  note text not null default '',
  team_a_player_1_id text not null,
  team_a_player_2_id text not null,
  team_b_player_1_id text not null,
  team_b_player_2_id text not null,
  score_a integer not null,
  score_b integer not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, id),
  foreign key (club_id, team_a_player_1_id) references badminton_players(club_id, id),
  foreign key (club_id, team_a_player_2_id) references badminton_players(club_id, id),
  foreign key (club_id, team_b_player_1_id) references badminton_players(club_id, id),
  foreign key (club_id, team_b_player_2_id) references badminton_players(club_id, id),
  constraint badminton_matches_different_score check (score_a <> score_b),
  constraint badminton_matches_four_players check (
    team_a_player_1_id <> team_a_player_2_id and
    team_a_player_1_id <> team_b_player_1_id and
    team_a_player_1_id <> team_b_player_2_id and
    team_a_player_2_id <> team_b_player_1_id and
    team_a_player_2_id <> team_b_player_2_id and
    team_b_player_1_id <> team_b_player_2_id
  )
);

create index if not exists badminton_players_club_active_idx
  on badminton_players (club_id, is_active);

create index if not exists badminton_matches_club_active_idx
  on badminton_matches (club_id, deleted_at, match_date);

alter table badminton_clubs enable row level security;
alter table badminton_players enable row level security;
alter table badminton_matches enable row level security;

insert into badminton_clubs (id, name)
values ('default', 'Badminton Club')
on conflict (id) do update
set updated_at = now();

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
