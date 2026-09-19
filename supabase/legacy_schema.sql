create extension if not exists pgcrypto;
create table if not exists ksnk_legacy_rows(
 id bigint generated always as identity primary key,
 sheet_name text not null,
 row_no integer not null,
 legacy_id text,
 data jsonb not null,
 imported_at timestamptz not null default now(),
 unique(sheet_name,row_no)
);
create index if not exists ksnk_legacy_rows_sheet_idx on ksnk_legacy_rows(sheet_name);
alter table ksnk_legacy_rows enable row level security;

create table if not exists ksnk_settings(
 id integer primary key default 1 check(id=1),
 hospital_name text not null default 'BỆNH VIỆN 115',
 password_hash text,
 updated_at timestamptz not null default now()
);
alter table ksnk_settings enable row level security;

create table if not exists ksnk_evidence(
 id uuid primary key default gen_random_uuid(),
 module text not null,
 legacy_id text not null,
 file_name text not null,
 storage_path text not null,
 mime_type text,
 created_at timestamptz not null default now()
);
alter table ksnk_evidence enable row level security;
