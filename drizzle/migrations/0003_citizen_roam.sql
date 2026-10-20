-- Batch 3b: cloud heat + gear for signed-in citizens
-- Run after 0001_citizens.sql (and ideally 0002_living_city.sql).

alter table public.citizens
  add column if not exists heat_points integer not null default 0
    check (heat_points >= 0 and heat_points <= 100);

alter table public.citizens
  add column if not exists gear jsonb not null default
    '{"equipped":"none","unlocked":["none","stun"],"ammo":{"sidearm":0,"carbine":0,"stun":12}}'::jsonb;

comment on column public.citizens.heat_points is 'Wanted heat 0–100; wanted level derived client-side';
comment on column public.citizens.gear is 'GearLoadout: equipped, unlocked[], ammo{}';
