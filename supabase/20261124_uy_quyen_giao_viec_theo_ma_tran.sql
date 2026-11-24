begin;
-- Synchronize work scope, detail edits and history with delegated individual/position grants.
create or replace function public.nk_work_feature_scope(a public.cx_people,feature text,action text)
returns text language sql stable set search_path=public as $$
with role_name as (
 select case when a.legacy_operator and a.work_view then 'chief'
             when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
             else 'staff' end r
), permissions as (
 select coalesce(case when a.admin then 'hospital' end,
   fp.grants #>> array[feature,action],
   rp.grants #>> array[feature,action],
   case when action='view' or action='history' or action='edit' then
    case when a.legacy_operator and a.work_view then 'hospital'
         when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
         when action='edit' then 'self' else 'self' end
   when action in ('create','delete') then
    case when a.legacy_operator and a.work_view and a.work_edit then 'hospital'
         when a.team_lead and a.work_role_reviewed and a.work_view and a.work_edit then 'team'
         else 'none' end else 'none' end) as requested,
 coalesce(case when a.admin then 'hospital' end,
   fp.grants #>> array[feature,'view'],
   rp.grants #>> array[feature,'view'],
   case when a.legacy_operator and a.work_view then 'hospital'
        when a.team_lead and a.work_role_reviewed and a.work_view then 'team'
        else 'self' end) as view_scope
 from role_name role
 left join public.nk_feature_permissions fp on fp.person=a.id
 left join public.nk_role_permission_defaults rp on rp.role=role.r
)
select case when requested not in ('none','self','team','hospital') then 'none'
            when requested='none' then 'none'
            when action='view' then requested
            when view_scope not in ('none','self','team','hospital') then 'none'
            when array_position(array['none','self','team','hospital'],requested)
              >array_position(array['none','self','team','hospital'],view_scope) then view_scope
            else requested end
from permissions
$$;
revoke all on function public.nk_work_feature_scope(public.cx_people,text,text) from public,anon,authenticated;
grant execute on function public.nk_work_feature_scope(public.cx_people,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.nk_work_scope(a cx_people, t cx_threads)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
select coalesce(a.active,false) and a.unit='surgery' and t.units=array['surgery'] and
(t.kind='chat' or public.nk_work_feature_scope(a,case when t.kind='task' then 'tasks' else 'reminders' end,'view')<>'none') and
case when t.kind='chat'
then a.id=t.owner_id or a.id=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]))
else
 a.id=t.owner_id
 or a.id=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]))
 or public.nk_work_feature_scope(a,case when t.kind='task' then 'tasks' else 'reminders' end,'view')='hospital'
 or (
   public.nk_work_feature_scope(a,case when t.kind='task' then 'tasks' else 'reminders' end,'view')='team'
   and nullif(trim(coalesce(nullif(a.team_department,''),a.department)), '') is not null
   and (
     case when nullif(trim(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận')), '') is not null
       then cx_key(coalesce(nullif(a.team_department,''),a.department)) =
         cx_key(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận'))
       else cardinality(coalesce(t.performers,'{}'::uuid[]))>0
        and not exists(
          select 1 from unnest(coalesce(t.performers,'{}'::uuid[])) u(id)
          left join cx_people p on p.id=u.id
          where p.id is null or p.unit is distinct from a.unit or
          cx_key(p.department) is distinct from
          cx_key(coalesce(nullif(a.team_department,''),a.department))
        )
     end
   )
 )
end
from (select 1) dummy left join public.ksnk_legacy_rows r on r.id=t.source_row
$function$;

CREATE OR REPLACE FUNCTION public.nk_save_detail(work_id uuid, who uuid, expected integer, rid uuid, label text, details text, deadline date, personal text, opinion text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare t public.cx_threads; a public.cx_people; management boolean; participant boolean;
begin
 select * into t from public.cx_threads where id=work_id for update;
 select * into a from public.cx_people where id=who;
 if t.id is null or a.id is null or t.kind not in ('task','reminder')
   or not coalesce(nk_work_scope(a,t),false) or rid is null then return false; end if;
 participant:=coalesce(t.owner_id=who,false)
   or who=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]));
 management:=public.nk_work_feature_scope(a,case when t.kind='task' then 'tasks' else 'reminders' end,'edit') in ('team','hospital')
   and coalesce(public.nk_work_scope(a,t),false);
 if public.nk_work_feature_scope(a,case when t.kind='task' then 'tasks' else 'reminders' end,'edit')='none' then return false; end if;
 if not (participant or management) then return false; end if;
 if exists(select 1 from public.cx_messages m where m.thread=work_id and m.sender=who and m.request_id=rid)
 then return true; end if;
 if t.seq<>expected or nullif(trim(coalesce(label,'')),'') is null then return false; end if;
 update public.cx_threads set title=label,note=details,due=deadline where id=work_id;
 if management and opinion is not null and t.source_row is not null then
   update public.ksnk_legacy_rows set data=data||jsonb_build_object('Ý kiến quản lý',opinion)
   where id=t.source_row;
 end if;
 insert into public.nk_personal_work_notes(thread,person,note)
 values(work_id,who,coalesce(personal,'')) on conflict(thread,person)
 do update set note=excluded.note;
 perform public.cx_append(work_id,who,'Đã cập nhật tác vụ','[]'::jsonb,rid);
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.nk_create_work(sheet text, fields jsonb, who uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare creator text; author_key text; src bigint; n integer;
begin
 if sheet not in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') then raise exception 'Loại phiếu không hợp lệ';end if;
 select case when admin and staff_code is null then username else name end into strict creator
 from cx_people where id=who and active and unit='surgery'
 and public.nk_work_feature_scope(cx_people,case when sheet='GIAO VIỆC' then 'tasks' else 'reminders' end,'create') in ('team','hospital');
 author_key:=case sheet when 'GIAO VIỆC' then 'Người giao việc' else 'NGƯỜI NHẮC' end;
 perform pg_advisory_xact_lock(hashtext(sheet));
 select coalesce(max(row_no),0)+1 into n from ksnk_legacy_rows where sheet_name=sheet;
 insert into nk_legacy_rows(sheet_name,row_no,legacy_id,data)
 values(sheet,n,coalesce(fields->>'ID',fields->>'MÃ NHẮC VIỆC',sheet||':'||n),fields||jsonb_build_object(author_key,creator))
 returning id into src;
 update cx_threads set source_creator_id=who where source_row=src;
 if not found then raise exception 'Không liên kết được người tạo với cuộc trao đổi';end if;
 return n;
end $function$;

CREATE OR REPLACE FUNCTION public.cx_history(who uuid, k text, scope text, skip_rows integer)
 RETURNS TABLE(title text, ref text, day text, status text, details text, roles text)
 LANGUAGE sql
 STABLE
AS $function$
 select coalesce(r.data->>'Tiêu đề công việc',r.data->>'Tiêu đề',r.data->>'TIÊU ĐỀ NHẮC VIỆC',r.data->>'Tiêu đề nhắc việc',''),
 coalesce(r.data->>'ID',r.data->>'MÃ NHẮC VIỆC',r.legacy_id),coalesce(r.data->>'Ngày kết thúc',r.data->>'NGÀY NHẮC',r.data->>'Ngày nhắc',''),
 coalesce(r.data->>'Trạng thái NV',r.data->>'TRẠNG THÁI',r.data->>'Trạng thái',''),
 coalesce(r.data->>'Nội dung / Mô tả',r.data->>'NỘI DUNG / GHI CHÚ',r.data->>'Nội dung',''),
 (select string_agg(w.role||' · '||coalesce(s.name,w.token),'; ' order by w.role,w.token) from cx_work_people w
 left join cx_staff_catalog s on s.unit=w.unit and s.code=w.staff_code and s.copies=1 where w.source_id=r.id)
 from ksnk_legacy_rows r join cx_people p on p.id=who and p.active
 where r.sheet_name=case k when 'task' then 'GIAO VIỆC' when 'reminder' then 'NHAC_VIEC_GHI_CHU' end
 and (scope='all' or scope=cx_source_unit(r.data))
 and public.nk_work_feature_scope(p,case when k='task' then 'tasks' else 'reminders' end,'history')<>'none'
 and (p.admin or exists(select 1 from public.cx_threads t where t.source_row=r.id and public.nk_work_scope(p,t))
  or exists(select from cx_work_people w join cx_staff_catalog s on s.unit=w.unit and s.code=w.staff_code and s.copies=1
 where w.source_id=r.id and w.unit=p.unit and w.staff_code=p.staff_code))
 order by r.row_no desc limit 80 offset greatest(skip_rows,0)
$function$;
commit;
