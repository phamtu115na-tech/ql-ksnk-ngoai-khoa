-- Script-parity migration for the Vercel application.
-- Run this once in Supabase SQL Editor for project qmhvdedsztmuplfmsrqz.
-- It is additive: it never truncates, deletes, or rewrites legacy rows.

create extension if not exists pgcrypto;

create table if not exists public.ksnk_legacy_rows(
  id bigint generated always as identity primary key,
  sheet_name text not null,
  row_no integer not null,
  legacy_id text,
  data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(sheet_name,row_no)
);

create table if not exists public.ksnk_settings(
  id integer primary key default 1 check(id=1),
  hospital_name text not null default 'BỆNH VIỆN 115',
  password_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ksnk_evidence(
  id uuid primary key default gen_random_uuid(),
  module text not null,
  legacy_id text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists ksnk_legacy_rows_sheet_row_idx on public.ksnk_legacy_rows(sheet_name,row_no);
create index if not exists ksnk_legacy_rows_legacy_id_idx on public.ksnk_legacy_rows(legacy_id);
create index if not exists ksnk_legacy_rows_data_gin_idx on public.ksnk_legacy_rows using gin(data);
create index if not exists ksnk_legacy_rows_data_search_idx on public.ksnk_legacy_rows using gin(to_tsvector('simple',data::text));
create index if not exists ksnk_evidence_lookup_idx on public.ksnk_evidence(module,legacy_id,created_at desc);

alter table public.ksnk_legacy_rows enable row level security;
alter table public.ksnk_settings enable row level security;
alter table public.ksnk_evidence enable row level security;

insert into public.ksnk_settings(id,hospital_name)
values(1,'BỆNH VIỆN 115')
on conflict (id) do nothing;

insert into storage.buckets(id,name,public)
values('documents','documents',false)
on conflict (id) do update set public=excluded.public;
