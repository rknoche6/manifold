-- This file is autogenerated from regen-schema.ts
create table if not exists
  leagues (
    season integer not null,
    division integer not null,
    cohort text not null,
    user_id text not null,
    mana_earned numeric default 0.0 not null,
    created_time timestamp without time zone default now() not null,
    mana_earned_breakdown jsonb default '{}'::jsonb not null,
    rank_snapshot integer,
    id uuid default gen_random_uuid () not null
  );

-- Row Level Security
alter table leagues enable row level security;

-- Policies
drop policy if exists "public read" on leagues;

create policy "public read" on leagues for
select
  using (true);

-- Indexes
drop index if exists leagues_pkey;

create unique index leagues_pkey on public.leagues using btree (id);

drop index if exists unique_user_id_season;

create unique index unique_user_id_season on public.leagues using btree (user_id, season);
