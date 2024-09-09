-- This file is autogenerated from regen-schema.ts
create table if not exists
  love_stars (
    creator_id text not null,
    target_id text not null,
    star_id text default random_alphanumeric (12) not null,
    created_time timestamp with time zone default now() not null
  );

-- Row Level Security
alter table love_stars enable row level security;

-- Policies
drop policy if exists "public read" on love_stars;

create policy "public read" on love_stars for
select
  using (true);

-- Indexes
drop index if exists love_stars_pkey;

create unique index love_stars_pkey on public.love_stars using btree (creator_id, star_id);
