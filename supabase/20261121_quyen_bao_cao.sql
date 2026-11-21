begin;
create table if not exists public.nk_report_permissions (
 person uuid primary key references public.cx_people(id),
 scope text not null check(scope in ('none','self','team','hospital')),
 can_export boolean not null default false,
 version uuid not null default gen_random_uuid(),
 changed_by uuid not null references public.cx_people(id),
 changed_at timestamptz not null default now(),
 check(scope <> 'none' or not can_export)
);
create table if not exists public.nk_report_permission_history (
 id bigint generated always as identity primary key,
 person uuid not null, previous_value jsonb, current_value jsonb not null,
 changed_at timestamptz not null default now()
);
alter table public.nk_report_permissions enable row level security;
alter table public.nk_report_permission_history enable row level security;
revoke all on public.nk_report_permissions,public.nk_report_permission_history from public,anon,authenticated;
grant select,insert,update on public.nk_report_permissions to service_role;
grant select,insert on public.nk_report_permission_history to service_role;
create or replace function public.nk_report_grant(who uuid,target_person uuid,new_scope text,allow_export boolean,previous_version uuid)
returns boolean language plpgsql set search_path=public as $$
declare prev nk_report_permissions; updated nk_report_permissions;
begin
 if not exists(select 1 from cx_people where id=who and active and admin and unit='surgery') then return false; end if;
 perform 1 from cx_people where id=target_person and active and not admin and unit='surgery' for update;
 if not found then return false; end if;
 select * into prev from nk_report_permissions where person=target_person;
 if prev.version is distinct from previous_version then return false; end if;
 insert into nk_report_permissions(person,scope,can_export,changed_by)
 values(target_person,new_scope,allow_export,who)
 on conflict(person) do update set scope=excluded.scope,can_export=excluded.can_export,changed_by=who,changed_at=now(),version=gen_random_uuid()
 returning * into updated;
 insert into nk_report_permission_history(person,previous_value,current_value) values(target_person,case when prev.person is null then null else to_jsonb(prev) end,to_jsonb(updated));
 return true;
end $$;
revoke all on function public.nk_report_grant(uuid,uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.nk_report_grant(uuid,uuid,text,boolean,uuid) to service_role;

create or replace function public.nk_matrix_marks(who uuid,for_export boolean,after_row integer,page_size integer)
returns table(row_no integer,form_id text,header jsonb,mark jsonb) language sql stable set search_path=public as $$
 with eligible as (
 select h.data,coalesce(nullif(h.data->>'Mã phiếu',''),h.data->>'ID') as id
 from cx_people a join nk_report_permissions p on p.person=a.id
 join ksnk_legacy_rows h on h.sheet_name='PHIEU_GIAMSAT' and cx_source_unit(h.data)='surgery'
 where a.id=who and a.active and a.unit='surgery' and (not for_export or p.can_export)
 and (p.scope='hospital' or (p.scope='team' and nullif(cx_key(coalesce(nullif(a.team_department,''),a.department)),'')=cx_key(h.data->>'Bộ phận'))
 or (p.scope='self' and nullif(a.staff_code,'')=h.data->>'Mã NV'))
 ), headers as (select id from eligible where nullif(id,'') is not null group by id having count(*)=1)
 select m.row_no,h.id,
 jsonb_build_object('date',coalesce(h.data->>'Ngày giám sát',h.data->>'Ngày'),'staffId',h.data->>'Mã NV','name',coalesce(h.data->>'Họ tên',h.data->>'Họ và tên'),'department',h.data->>'Bộ phận','area',h.data->>'Khu vực','formCode',coalesce(h.data->>'Mã mẫu phiếu',h.id),'formName',h.data->>'Tên phiếu'),
 jsonb_build_object('criterionId',coalesce(m.data->>'Mã tiêu chí',m.data->>'ID'),'group',coalesce(m.data->>'Nhóm tiêu chí',m.data->>'Nhóm'),'content',coalesce(m.data->>'Nội dung tiêu chí',m.data->>'Nội dung'),'result',coalesce(m.data->>'Kết quả',m.data->>'Kết quả chấm'))
 from ksnk_legacy_rows m join headers ids on ids.id=coalesce(nullif(m.data->>'Mã phiếu',''),nullif(m.data->>'Mã phiếu giám sát',''),nullif(m.data->>'Form ID',''),m.legacy_id)
 join eligible h on h.id=ids.id
 where m.sheet_name='CT_PHIEU_GIAMSAT' and cx_source_unit(m.data)='surgery' and m.row_no>after_row
 and not exists (select from ksnk_legacy_rows other where other.sheet_name='PHIEU_GIAMSAT' and cx_source_unit(other.data)='surgery' and coalesce(nullif(other.data->>'Mã phiếu',''),other.data->>'ID')=h.id and other.data is distinct from h.data)
 order by m.row_no limit least(1000,greatest(page_size,1))
$$;
revoke all on function public.nk_matrix_marks(uuid,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.nk_matrix_marks(uuid,boolean,integer,integer) to service_role;
create index if not exists nk_check_form_id on public.ksnk_legacy_rows ((coalesce(nullif(data->>'Mã phiếu',''),data->>'ID'))) where sheet_name='PHIEU_GIAMSAT';
commit;
