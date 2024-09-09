-- This file is autogenerated from regen-schema.ts
create table if not exists
  chart_annotations (
    id bigint not null,
    created_time timestamp with time zone default now() not null,
    event_time bigint not null,
    contract_id text not null,
    creator_id text not null,
    creator_username text not null,
    creator_name text not null,
    creator_avatar_url text not null,
    up_votes integer default 0 not null,
    down_votes integer default 0 not null,
    comment_id text,
    thumbnail_url text,
    external_url text,
    text text,
    answer_id text,
    user_id text,
    prob_change numeric,
    constraint chart_annotations_prob_change_check check (
      (
        (prob_change >= ('-1'::integer)::numeric)
        and (prob_change <= (1)::numeric)
      )
    )
  );

-- Row Level Security
alter table chart_annotations enable row level security;

-- Policies
drop policy if exists "public read" on chart_annotations;

create policy "public read" on chart_annotations for all using (true);

-- Indexes
drop index if exists chart_annotations_pkey;

create unique index chart_annotations_pkey on public.chart_annotations using btree (id);

drop index if exists contract_annotations_event_time;

create index contract_annotations_event_time on public.chart_annotations using btree (contract_id, event_time);
