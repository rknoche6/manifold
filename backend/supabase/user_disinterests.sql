-- This file is autogenerated from regen-schema.ts
create table if not exists
  user_disinterests (
    id bigint not null,
    user_id text not null,
    creator_id text not null,
    contract_id text not null,
    comment_id text,
    created_time timestamp with time zone default now() not null,
    feed_id bigint
  );

-- Row Level Security
alter table user_disinterests enable row level security;

-- Policies
drop policy if exists "public read" on user_disinterests;

create policy "public read" on user_disinterests for
select
  using (true);

-- Indexes
drop index if exists user_disinterests_pkey;

create unique index user_disinterests_pkey on public.user_disinterests using btree (id);

drop index if exists user_disinterests_user_id;

create index user_disinterests_user_id on public.user_disinterests using btree (user_id);

drop index if exists user_disinterests_user_id_contract_id;

create index user_disinterests_user_id_contract_id on public.user_disinterests using btree (user_id, contract_id);
