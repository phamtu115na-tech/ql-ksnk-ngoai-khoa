begin;
create or replace function nk_work_scope(a cx_people,t cx_threads) returns boolean language sql stable as $$
 select a.active and a.unit='surgery' and t.units=array['surgery'] and
 case when t.kind='chat' then a.id=t.owner_id or a.id=any(t.performers||t.observers)
 else coalesce(t.owner_id=a.id,false) or (a.admin or a.work_view) and (a.admin or a.legacy_operator or (not a.team_lead and (a.id=t.owner_id or a.id=any(t.performers||t.observers)))
 or (a.team_lead and nullif(trim(coalesce(nullif(a.team_department,''),a.department)),'') is not null and
 case when nullif(trim(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận')),'') is not null
 then cx_key(coalesce(nullif(a.team_department,''),a.department))=cx_key(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận'))
 else cardinality(t.performers)>0 and not exists(select from unnest(t.performers) u(id) left join cx_people p on p.id=u.id
 where cx_key(p.department) is distinct from cx_key(coalesce(nullif(a.team_department,''),a.department)) or p.unit is distinct from a.unit) end)) end
 from (select 1) dummy left join ksnk_legacy_rows r on r.id=t.source_row
$$;

create or replace function nk_save_detail(work_id uuid,who uuid,expected int,rid uuid,label text,details text,deadline date,personal text,opinion text) returns boolean language plpgsql as $$
declare t cx_threads; a cx_people; management boolean;
begin
 select * into t from cx_threads where id=work_id for update;
 select * into a from cx_people where id=who;
 if t.kind not in ('task','reminder') or not coalesce(nk_work_scope(a,t),false) or not (a.admin or a.work_edit or coalesce(t.owner_id=who,false)) then return false;end if;
 if exists(select from cx_messages m where m.thread=work_id and m.sender=who and m.request_id=rid) then return true;end if;
 if t.seq<>expected then return false;end if;
 management:=a.admin or a.legacy_operator or (a.team_lead and coalesce(nk_work_scope(jsonb_populate_record(a,jsonb_build_object('id',null)),t),false));
 if management or t.owner_id=who then
 update cx_threads set title=label,note=details,due=deadline where id=work_id;
 end if;
 if management and opinion is not null then
 update ksnk_legacy_rows set data=data||jsonb_build_object('Ý kiến quản lý',opinion) where id=t.source_row;
 end if;
 insert into nk_personal_work_notes values(work_id,who,personal) on conflict(thread,person) do update set note=excluded.note;
 perform cx_append(work_id,who,'Đã cập nhật tác vụ','[]',rid);
 return true;
end $$;
commit;
