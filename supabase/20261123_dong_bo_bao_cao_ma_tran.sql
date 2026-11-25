begin;
-- The report matrix must use the same grant matrix as report export/UI. Legacy grants
-- remain readable for backwards compatibility; new per-feature overrides win.
create or replace function public.nk_matrix_marks(
 who uuid,for_export boolean,after_row integer,page_size integer
) returns table(row_no integer,form_id text,header jsonb,mark jsonb)
language sql stable set search_path=public as $$
with raw_scope as (
 select a.id,a.staff_code,coalesce(nullif(a.team_department,''),a.department) team_department,
  case when a.admin or (a.legacy_operator and a.work_view) then 'hospital'
       when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
       else 'self' end ceiling,
  case when a.admin then 'hospital'
       else coalesce(fp.grants #>> '{reports,view}',
       case when rp.scope in ('self','team','hospital') then rp.scope end,
       case when a.legacy_operator and a.work_view then 'hospital'
            when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
            else 'self' end) end requested_view,
  case when a.admin then 'hospital'
       else coalesce(fp.grants #>> '{reports,export}',
       case when rp.can_export and rp.scope in ('self','team','hospital') then rp.scope end,
       case when a.legacy_operator and a.work_view then 'hospital'
            when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
            else 'none' end) end requested_export
 from public.cx_people a
 left join public.nk_feature_permissions fp on fp.person=a.id
 left join public.nk_report_permissions rp on rp.person=a.id
 where a.id=who and a.active and a.unit='surgery'
),
bounded as (
 select x.*,
  (array['none','self','team','hospital']::text[])[least(
    coalesce(array_position(array['none','self','team','hospital']::text[],x.requested_view),1),
    array_position(array['none','self','team','hospital']::text[],x.ceiling)
  )] view_scope,
  (array['none','self','team','hospital']::text[])[least(
    coalesce(array_position(array['none','self','team','hospital']::text[],x.requested_export),1),
    array_position(array['none','self','team','hospital']::text[],x.ceiling)
  )] export_scope
 from raw_scope x
),
access as (
 select b.*,
  case when for_export then (array['none','self','team','hospital']::text[])[least(
     array_position(array['none','self','team','hospital']::text[],b.export_scope),
     array_position(array['none','self','team','hospital']::text[],b.view_scope)
    )] else b.view_scope end permission_scope
 from bounded b
),
eligible as (
 select h.data,coalesce(nullif(h.data->>'Mã phiếu',''),h.data->>'ID') as id
 from access a
 join public.ksnk_legacy_rows h on h.sheet_name='PHIEU_GIAMSAT'
  and public.cx_source_unit(h.data)='surgery'
 where a.permission_scope<>'none'
 and (a.permission_scope='hospital'
  or (a.permission_scope='team' and nullif(public.cx_key(a.team_department),'')=
      public.cx_key(h.data->>'Bộ phận'))
  or (a.permission_scope='self' and nullif(a.staff_code,'')=h.data->>'Mã NV'))
),
headers as (
 select id from eligible where nullif(id,'') is not null group by id having count(*)=1
)
select m.row_no,h.id,
 jsonb_build_object('date',coalesce(h.data->>'Ngày giám sát',h.data->>'Ngày'),
 'staffId',h.data->>'Mã NV','name',coalesce(h.data->>'Họ tên',h.data->>'Họ và tên'),
 'department',h.data->>'Bộ phận','area',h.data->>'Khu vực',
 'formCode',coalesce(h.data->>'Mã mẫu phiếu',h.id),
 'formName',h.data->>'Tên phiếu'),
 jsonb_build_object('criterionId',coalesce(m.data->>'Mã tiêu chí',m.data->>'ID'),
 'group',coalesce(m.data->>'Nhóm tiêu chí',m.data->>'Nhóm'),
 'content',coalesce(m.data->>'Nội dung tiêu chí',m.data->>'Nội dung'),
 'result',coalesce(m.data->>'Kết quả',m.data->>'Kết quả chấm'))
from public.ksnk_legacy_rows m
join headers ids on ids.id=coalesce(nullif(m.data->>'Mã phiếu',''),
 nullif(m.data->>'Mã phiếu giám sát',''),nullif(m.data->>'Form ID',''),m.legacy_id)
join eligible h on h.id=ids.id
where m.sheet_name='CT_PHIEU_GIAMSAT' and public.cx_source_unit(m.data)='surgery'
 and m.row_no>after_row
order by m.row_no
limit least(1000,greatest(page_size,1))
$$;
revoke all on function public.nk_matrix_marks(uuid,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.nk_matrix_marks(uuid,boolean,integer,integer) to service_role;
commit;
