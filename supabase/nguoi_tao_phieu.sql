alter table cx_threads add column if not exists source_creator_id uuid references cx_people(id);
create or replace function nk_keep_work_creator() returns trigger language plpgsql as $$
begin
 if new.source_creator_id is not null and cardinality(new.units)>0 then new.owner_id:=new.source_creator_id;end if;
 return new;
end $$;
drop trigger if exists nk_keep_work_creator on cx_threads;
create trigger nk_keep_work_creator before update of owner_id,source_creator_id on cx_threads
 for each row execute function nk_keep_work_creator();

create or replace function nk_create_work(sheet text, fields jsonb, who uuid) returns integer language plpgsql as $$
declare creator text; author_key text; src bigint; n integer;
begin
 if sheet not in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') then raise exception 'Loại phiếu không hợp lệ';end if;
 select case when admin and staff_code is null then username else name end into strict creator
 from cx_people where id=who and active and unit='surgery' and (admin or legacy_operator);
 author_key:=case sheet when 'GIAO VIỆC' then 'Người giao việc' else 'NGƯỜI NHẮC' end;
 perform pg_advisory_xact_lock(hashtext(sheet));
 select coalesce(max(row_no),0)+1 into n from ksnk_legacy_rows where sheet_name=sheet;
 insert into nk_legacy_rows(sheet_name,row_no,legacy_id,data)
 values(sheet,n,coalesce(fields->>'ID',fields->>'MÃ NHẮC VIỆC',sheet||':'||n),fields||jsonb_build_object(author_key,creator))
 returning id into src;
 update cx_threads set source_creator_id=who where source_row=src;
 if not found then raise exception 'Không liên kết được người tạo với cuộc trao đổi';end if;
 return n;
end $$;
revoke all on function nk_keep_work_creator(),nk_create_work(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function nk_keep_work_creator(),nk_create_work(text,jsonb,uuid) to service_role;

create or replace function nk_work_alerts(who uuid, filter_kind text, skip_rows int) returns jsonb
language sql stable as $$
 with alerts as materialized (
 select t.id,t.kind,t.title,t.status,t.due,t.updated,t.performers,case when owner.admin and owner.staff_code is null then owner.username else owner.name end as sender,
 (now() at time zone 'Asia/Ho_Chi_Minh')::date as today,
 m.unread,m.preview,
 lower(coalesce(r.data->>'NHẮC HÀNG NGÀY',r.data->>'Nhắc hàng ngày','')) in ('có','true','1','x','yes') as daily
 from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery'
 left join cx_people owner on owner.id=t.owner_id
 left join ksnk_legacy_rows r on r.id=t.source_row and t.kind='reminder'
 left join cx_reads seen on seen.thread=t.id and seen.person=who
 cross join lateral (
 select count(*) as unread,(array_agg(left(coalesce(nullif(body,''),'Ảnh / tài liệu'),180) order by seq desc))[1] as preview
 from cx_messages where thread=t.id and seq>coalesce(seen.seq,0) and sender is distinct from who
 ) m
 where t.units=array['surgery'] and t.kind in ('task','reminder')
 and (t.owner_id=who or who=any(t.performers||t.observers))
 ), eligible as (
 select * from alerts where unread>0 or (status<>'Hoàn thành' and
 (due<=today or (daily and due is null)))
 ), selected as (
 select * from eligible where filter_kind='all' or kind=filter_kind
 order by (due=today) desc nulls last,(unread>0) desc,updated desc,id
 limit 40 offset greatest(skip_rows,0)
 )
 select jsonb_build_object(
 'task',(select count(*) from eligible where kind='task'),
 'reminder',(select count(*) from eligible where kind='reminder'),
 'items',coalesce((select jsonb_agg(jsonb_build_object(
 'id',s.id,'kind',s.kind,'title',s.title,'status',s.status,'due',s.due,'sender',s.sender,
 'performers',(select string_agg(p.name,', ' order by u.ord) from unnest(s.performers) with ordinality u(id,ord) join cx_people p on p.id=u.id),
 'unread',s.unread,'preview',s.preview,'today',s.today,'daily',s.daily)
 order by (s.due=s.today) desc nulls last,(s.unread>0) desc,s.updated desc,s.id) from selected s),'[]'::jsonb))
$$;
revoke all on function nk_work_alerts(uuid,text,int) from public,anon,authenticated;
grant execute on function nk_work_alerts(uuid,text,int) to service_role;
