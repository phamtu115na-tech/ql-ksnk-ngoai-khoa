begin;
create table if not exists public.nk_role_permission_defaults(
 role text primary key check(role in ('staff','team','chief')),
 grants jsonb not null default '{}'::jsonb check(jsonb_typeof(grants)='object'),
 version uuid not null default gen_random_uuid(),
 changed_by uuid not null references public.cx_people(id),
 changed_at timestamptz not null default now()
);
create table if not exists public.nk_role_permission_history(
 id bigint generated always as identity primary key,
 role text not null check(role in ('staff','team','chief')),
 changed_by uuid not null references public.cx_people(id),
 previous_grants jsonb,
 current_grants jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists nk_role_permission_history_role on public.nk_role_permission_history(role,changed_at desc);
alter table public.nk_role_permission_defaults enable row level security;
alter table public.nk_role_permission_history enable row level security;
revoke all on public.nk_role_permission_defaults,public.nk_role_permission_history from public,anon,authenticated;
grant select,insert,update on public.nk_role_permission_defaults to service_role;
grant select,insert on public.nk_role_permission_history to service_role;
create or replace function public.nk_set_role_permission_defaults(
 who uuid,chosen_role text,new_grants jsonb,previous_version uuid
) returns boolean language plpgsql set search_path=public as $$
declare old public.nk_role_permission_defaults; saved public.nk_role_permission_defaults;
begin
 if not exists(select 1 from public.cx_people where id=who and active and admin and unit='surgery') then return false;end if;
 if chosen_role not in ('staff','team','chief') or new_grants is null or jsonb_typeof(new_grants)<>'object' then return false;end if;
 select * into old from public.nk_role_permission_defaults where role=chosen_role for update;
 if old.version is distinct from previous_version then return false;end if;
 insert into public.nk_role_permission_defaults(role,grants,changed_by)
 values(chosen_role,new_grants,who)
 on conflict(role) do update set grants=excluded.grants,version=gen_random_uuid(),changed_by=who,changed_at=now()
 returning * into saved;
 insert into public.nk_role_permission_history(role,changed_by,previous_grants,current_grants)
 values(chosen_role,who,case when old.role is null then null else old.grants end,saved.grants);
 return true;
end $$;
revoke all on function public.nk_set_role_permission_defaults(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.nk_set_role_permission_defaults(uuid,text,jsonb,uuid) to service_role;
commit;
