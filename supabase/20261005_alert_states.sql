-- Persistent read state and event history for the Alerts module.
-- Run once in the Supabase SQL Editor for project qmhvdedsztmuplfmsrqz.
-- The migration is additive and does not change legacy application rows.

create extension if not exists pgcrypto;

create table if not exists public.ksnk_alert_states(
  alert_key text primary key,
  recipient_key text not null default 'ALL',
  target text not null default 'alerts',
  kind text not null default 'THÔNG BÁO',
  level text not null default '',
  alert_date text not null default '',
  title text not null default '',
  message text not null default '',
  instruction text not null default '',
  person text not null default '',
  person_id text not null default '',
  manager_name text not null default '',
  manager_id text not null default '',
  row_no integer,
  entity_id text not null default '',
  notification_audience text not null default '',
  notification_type text not null default '',
  approval_status text not null default '',
  payload jsonb not null default '{}'::jsonb,
  persistent boolean not null default false,
  read_at timestamptz,
  read_by text,
  dismissed_at timestamptz,
  dismissed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ksnk_alert_states_recipient_read_idx
  on public.ksnk_alert_states(recipient_key, read_at, updated_at desc);
create index if not exists ksnk_alert_states_persistent_idx
  on public.ksnk_alert_states(persistent, created_at desc);
create index if not exists ksnk_alert_states_entity_idx
  on public.ksnk_alert_states(target, entity_id, notification_type);

alter table public.ksnk_alert_states enable row level security;
