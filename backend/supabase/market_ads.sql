-- This file is autogenerated from regen-schema.ts
create table if not exists
  market_ads (
    id text default extensions.uuid_generate_v4 () not null,
    user_id text not null,
    market_id text not null,
    funds numeric not null,
    cost_per_view numeric not null,
    created_at timestamp without time zone default now() not null,
    embedding vector (1536) not null
  );

-- Foreign Keys
alter table market_ads
add constraint market_ads_market_id_fkey foreign key (market_id) references contracts (id);

-- Row Level Security
alter table market_ads enable row level security;

-- Policies
drop policy if exists "admin write access" on market_ads;

create policy "admin write access" on market_ads for all to service_role;

drop policy if exists "public read" on market_ads;

create policy "public read" on market_ads for
select
  using (true);

-- Indexes
drop index if exists market_ads_pkey;

create unique index market_ads_pkey on public.market_ads using btree (id);

drop index if exists market_ad_cost;

create index market_ad_cost on public.market_ads using btree (cost_per_view desc);
