-- Batch 3: living city — feed, presence, events, votes
-- Run after 0001_citizens.sql in Lovable Cloud / Supabase SQL editor.

-- Town Square posts (realtime feed)
create table if not exists public.town_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) > 0 and char_length(body) <= 280),
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists town_posts_created_at_idx on public.town_posts (created_at desc);

alter table public.town_posts enable row level security;

create policy "Anyone can read town posts"
  on public.town_posts for select
  using (true);

create policy "Authenticated users can insert own posts"
  on public.town_posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Authors can update own posts"
  on public.town_posts for update
  to authenticated
  using (auth.uid() = author_id);

-- Presence heartbeats (who is in the city right now)
create table if not exists public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  district_id text,
  last_seen timestamptz not null default now()
);

create index if not exists presence_last_seen_idx on public.presence (last_seen desc);

alter table public.presence enable row level security;

create policy "Anyone can read presence"
  on public.presence for select
  using (true);

create policy "Users upsert own presence"
  on public.presence for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own presence"
  on public.presence for update
  to authenticated
  using (auth.uid() = user_id);

-- Scheduled city events
create table if not exists public.city_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  event_type text not null default 'notice'
    check (event_type in ('notice', 'weather', 'civic', 'market', 'celebration')),
  starts_on_day integer not null check (starts_on_day >= 1),
  ends_on_day integer not null check (ends_on_day >= starts_on_day),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists city_events_day_idx on public.city_events (starts_on_day, ends_on_day);

alter table public.city_events enable row level security;

create policy "Anyone can read city events"
  on public.city_events for select
  using (true);

-- Seed a few events for Season 01
insert into public.city_events (title, body, event_type, starts_on_day, ends_on_day)
select * from (values
  ('Market night extended', 'Town Market stalls stay open an extra hour while the dry spell holds.', 'market', 1, 5),
  ('Creek Road vote closes', 'Community Vote 003 tallies at sundown on Day 7. Cast your vote before then.', 'civic', 1, 7),
  ('Harmattan advisory', 'Dust haze may lower visibility at the Port. Carry a scarf if you work the channel.', 'weather', 3, 12),
  ('Ferry crew call', 'Extra weekend crossings if enough deck hands sign on at Creekside.', 'notice', 2, 10)
) as v(title, body, event_type, starts_on_day, ends_on_day)
where not exists (select 1 from public.city_events limit 1);

-- Civic proposals + tallies + outcomes
create table if not exists public.vote_proposals (
  id text primary key,
  season text not null default '003',
  title text not null,
  blurb text not null,
  vote_count integer not null default 0 check (vote_count >= 0),
  status text not null default 'open'
    check (status in ('open', 'closed', 'passed', 'rejected')),
  closes_on_day integer not null default 7,
  outcome_note text,
  created_at timestamptz not null default now()
);

alter table public.vote_proposals enable row level security;

create policy "Anyone can read proposals"
  on public.vote_proposals for select
  using (true);

insert into public.vote_proposals (id, title, blurb, vote_count, status, closes_on_day)
values
  ('p1', 'Solar lamps along Creek Road',
   'Forty standing lamps between the jetty and the market gate, lit by sundown.',
   612, 'open', 7),
  ('p2', 'Hourly weekend ferries',
   'Run the Creekside crossing every hour on Saturdays and Sundays.',
   488, 'open', 7)
on conflict (id) do nothing;

-- Individual votes (one per citizen per season proposal set)
create table if not exists public.citizen_votes (
  citizen_id uuid not null references auth.users (id) on delete cascade,
  proposal_id text not null references public.vote_proposals (id) on delete cascade,
  season text not null default '003',
  created_at timestamptz not null default now(),
  primary key (citizen_id, season)
);

alter table public.citizen_votes enable row level security;

create policy "Citizens read own votes"
  on public.citizen_votes for select
  to authenticated
  using (auth.uid() = citizen_id);

create policy "Citizens insert own vote"
  on public.citizen_votes for insert
  to authenticated
  with check (auth.uid() = citizen_id);

-- Increment tally when a vote is cast
create or replace function public.cast_civic_vote(p_proposal_id text, p_season text default '003')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.citizen_votes (citizen_id, proposal_id, season)
  values (auth.uid(), p_proposal_id, p_season);

  update public.vote_proposals
  set vote_count = vote_count + 1
  where id = p_proposal_id and status = 'open';
end;
$$;

grant execute on function public.cast_civic_vote(text, text) to authenticated;

-- Close open votes past closes_on_day and pick a winner
create or replace function public.resolve_votes_for_day(p_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  winner_id text;
  winner_title text;
  winner_count integer;
begin
  select id, title, vote_count into winner_id, winner_title, winner_count
  from public.vote_proposals
  where status = 'open' and closes_on_day <= p_day
  order by vote_count desc, id asc
  limit 1;

  if winner_id is null then
    return;
  end if;

  update public.vote_proposals
  set
    status = case when id = winner_id then 'passed' else 'rejected' end,
    outcome_note = case
      when id = winner_id then format('Passed with %s voices. Work begins next season.', winner_count)
      else format('Did not pass. "%s" carried the season.', winner_title)
    end
  where status = 'open' and closes_on_day <= p_day;
end;
$$;

grant execute on function public.resolve_votes_for_day(integer) to authenticated;
grant execute on function public.resolve_votes_for_day(integer) to anon;

-- ============================================================
-- Realtime: enable replication for live feed + presence
-- These lines make town_posts and presence broadcast changes
-- to connected clients (useCityLive subscriptions).
-- Safe to re-run; IF NOT EXISTS is not available on publications
-- so we ignore errors if already added.
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.town_posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.presence;
exception when duplicate_object then null;
end $$;
