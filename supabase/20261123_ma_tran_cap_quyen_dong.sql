begin;
create table if not exists public.nk_feature_permissions (
 person uuid primary key references public.cx_people(id),
 grants jsonb not null default '{}'::jsonb,
 version uuid not null default gen_random_uuid(),
 changed_by uuid not null references public.cx_people(id),
 changed_at timestamptz not null default now(),
 constraint nk_feature_grants_object check(jsonb_typeof(grants)='object')
);
create table if not exists public.nk_feature_permission_history (
 id bigint generated always as identity primary key,
 person uuid not null references public.cx_people(id),
 changed_by uuid not null references public.cx_people(id),
 previous_grants jsonb,
 current_grants jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists nk_feature_permission_history_person
 on public.nk_feature_permission_history(person,changed_at desc);
alter table public.nk_feature_permissions enable row level security;
alter table public.nk_feature_permission_history enable row level security;
revoke all on public.nk_feature_permissions,public.nk_feature_permission_history from public,anon,authenticated;
grant select,insert,update on public.nk_feature_permissions to service_role;
grant select,insert on public.nk_feature_permission_history to service_role;

create or replace function public.nk_set_feature_permissions(
 who uuid,target_person uuid,new_grants jsonb,previous_version uuid
) returns boolean language plpgsql set search_path=public as $$
declare previous public.nk_feature_permissions; updated public.nk_feature_permissions;
begin
 if not exists(select 1 from public.cx_people where id=who and unit='surgery' and active and admin)
 then return false; end if;
 perform 1 from public.cx_people where id=target_person and unit='surgery' and active and not admin for update;
 if not found or new_grants is null or jsonb_typeof(new_grants)<>'object' then return false; end if;
 select * into previous from public.nk_feature_permissions where person=target_person for update;
 if previous.version is distinct from previous_version then return false; end if;
 insert into public.nk_feature_permissions(person,grants,changed_by)
 values(target_person,new_grants,who)
 on conflict(person) do update set grants=excluded.grants,version=gen_random_uuid(),
 changed_by=who,changed_at=now() returning * into updated;
 insert into public.nk_feature_permission_history(person,changed_by,previous_grants,current_grants)
 values(target_person,who,case when previous.person is null then null else previous.grants end,updated.grants);
 return true;
end $$;
revoke all on function public.nk_set_feature_permissions(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.nk_set_feature_permissions(uuid,uuid,jsonb,uuid) to service_role;
commit;
