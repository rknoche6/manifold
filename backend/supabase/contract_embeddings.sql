-- This file is autogenerated from regen-schema.ts
create table if not exists
  contract_embeddings (
    contract_id text not null,
    created_at timestamp with time zone default now() not null,
    embedding vector (1536) not null
  );

-- Row Level Security
alter table contract_embeddings enable row level security;

-- Policies
drop policy if exists "admin write access" on contract_embeddings;

create policy "admin write access" on contract_embeddings for all to service_role;

drop policy if exists "public read" on contract_embeddings;

create policy "public read" on contract_embeddings for
select
  using (true);

-- Indexes
drop index if exists contract_embeddings_pkey;

create unique index contract_embeddings_pkey on public.contract_embeddings using btree (contract_id);

drop index if exists contract_embeddings_embedding_aug_2024;

create index contract_embeddings_embedding_aug_2024 on public.contract_embeddings using hnsw (embedding vector_cosine_ops);
