begin;
-- Quyền vào tác vụ: cá nhân thấy việc mình giao/được giao/được liên quan.
-- Trưởng khoa, điều dưỡng trưởng có quyền toàn khoa. Tổ trưởng chỉ phạm vi tổ.
create or replace function public.nk_work_scope(a public.cx_people,t public.cx_threads)
returns boolean language sql stable set search_path=public as $$
select coalesce(a.active,false) and a.unit='surgery' and t.units=array['surgery'] and
case when t.kind='chat'
then a.id=t.owner_id or a.id=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]))
else
 a.id=t.owner_id
 or a.id=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]))
 or (coalesce(a.admin,false) or (coalesce(a.legacy_operator,false) and coalesce(a.work_view,false)))
 or (
   coalesce(a.team_lead,false) and coalesce(a.work_view,false)
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
$$;

create or replace function public.nk_save_detail(
 work_id uuid,who uuid,expected integer,rid uuid,label text,details text,deadline date,personal text,opinion text
) returns boolean language plpgsql set search_path=public as $$
declare t public.cx_threads; a public.cx_people; management boolean; participant boolean;
begin
 select * into t from public.cx_threads where id=work_id for update;
 select * into a from public.cx_people where id=who;
 if t.id is null or a.id is null or t.kind not in ('task','reminder')
   or not coalesce(nk_work_scope(a,t),false) or rid is null then return false; end if;
 participant:=coalesce(t.owner_id=who,false)
   or who=any(coalesce(t.performers,'{}'::uuid[])||coalesce(t.observers,'{}'::uuid[]));
 management:=coalesce(a.admin,false)
   or (coalesce(a.legacy_operator,false) and coalesce(a.work_edit,false))
   or (coalesce(a.team_lead,false) and coalesce(a.work_edit,false) and
       coalesce(nk_work_scope(a,t),false));
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
end $$;

revoke all on function public.nk_work_scope(public.cx_people,public.cx_threads),
 public.nk_save_detail(uuid,uuid,integer,uuid,text,text,date,text,text)
 from public,anon,authenticated;
grant execute on function public.nk_work_scope(public.cx_people,public.cx_threads),
 public.nk_save_detail(uuid,uuid,integer,uuid,text,text,date,text,text)
 to service_role;
commit;
