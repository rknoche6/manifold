-- This file is autogenerated from regen-schema.ts
create table if not exists
  mana_supply_stats (
    id bigint not null,
    created_time timestamp with time zone default now() not null,
    start_time timestamp with time zone not null,
    end_time timestamp with time zone not null,
    total_value numeric not null,
    balance numeric not null,
    spice_balance numeric not null,
    investment_value numeric not null,
    loan_total numeric not null,
    amm_liquidity numeric not null,
    total_cash_value numeric default 0 not null,
    cash_balance numeric default 0 not null,
    cash_investment_value numeric default 0 not null,
    amm_cash_liquidity numeric default 0 not null
  );

-- Row Level Security
alter table mana_supply_stats enable row level security;

-- Policies
drop policy if exists "public read" on mana_supply_stats;

create policy "public read" on mana_supply_stats for
select
  using (true);

-- Indexes
drop index if exists mana_supply_stats_pkey;

create unique index mana_supply_stats_pkey on public.mana_supply_stats using btree (id);
