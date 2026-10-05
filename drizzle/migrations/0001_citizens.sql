-- Batch 2: persistent citizen state
-- Run this in Lovable Cloud SQL editor (or Supabase SQL) once.

create table if not exists public.citizens (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Citizen',
  avatar_initials text not null default 'CI',
  balance integer not null default 2450 check (balance >= 0),
  reputation integer not null default 24 check (reputation >= 0 and reputation <= 99),
  city_day integer not null default 1 check (city_day >= 1),
  completed_jobs jsonb not null default '[]'::jsonb,
  purchased_goods jsonb not null default '[]'::jsonb,
  voted_for text,
  done_courses jsonb not null default '[]'::jsonb,
  liked_posts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists citizens_updated_at_idx on public.citizens (updated_at desc);

alter table public.citizens enable row level security;

create policy "Citizens can read own row"
  on public.citizens
  for select
  using (auth.uid() = id);

create policy "Citizens can insert own row"
  on public.citizens
  for insert
  with check (auth.uid() = id);

create policy "Citizens can update own row"
  on public.citizens
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a citizen row when a new user signs up
create or replace function public.handle_new_citizen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.citizens (id, display_name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Citizen'),
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'CI'), 2))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_citizen on auth.users;
create trigger on_auth_user_created_citizen
  after insert on auth.users
  for each row
  execute function public.handle_new_citizen();
