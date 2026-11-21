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
 from cx_messages where (t.owner_id=who or who=any(t.performers||t.observers)) and thread=t.id and seq>coalesce(seen.seq,0) and sender is distinct from who
 ) m
 where t.units=array['surgery'] and t.kind in ('task','reminder')
 and (a.admin or a.legacy_operator or t.owner_id=who or who=any(t.performers||t.observers))
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

create or replace function cx_board(who uuid,scope text,screen text,skip_rows int default 0)
returns table(item jsonb,unread bigint) language sql stable as $$
 select to_jsonb(t)||jsonb_build_object('latest_message',case when who=t.owner_id or who=any(t.performers||t.observers) then
 (select left(coalesce(nullif(m.body,''),'Ảnh / tài liệu'),180) from cx_messages m where m.thread=t.id order by m.seq desc limit 1) end),case when who=t.owner_id or who=any(t.performers||t.observers) then
 (select count(*) from cx_messages m where m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender is distinct from who) else 0 end
 from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery' and t.units=array['surgery']
 left join cx_reads r on r.thread=t.id and r.person=who
 where cardinality(t.units)>0 and (a.unit='company' or a.unit=any(t.units))
 and (scope='all' or scope=any(t.units))
 and (((a.admin or a.legacy_operator) and t.kind<>'chat') or who=t.owner_id or who=any(t.performers||t.observers))
 and (screen='all' or t.kind=screen)
 order by t.updated desc,t.id limit 80 offset greatest(skip_rows,0)
$$;

create or replace function cx_roles(sheet text,d jsonb)
returns table(role text,token text,match_code boolean) language plpgsql immutable as $$
declare code text;
begin
 if sheet='GIAO VIỆC' then
 code:=coalesce(nullif(d->>'Mã NV',''),nullif(d->>'Mã nhân viên',''),nullif(d->>'Mã người thực hiện',''),nullif(d->>'Mã người chịu trách nhiệm',''),nullif(d->>'staffId',''));
 if code is not null then
 return query select 'Người thực hiện'::text,cx_key(code),true;
 else
 return query select distinct 'Người thực hiện'::text,cx_key(v),false from regexp_split_to_table(coalesce(nullif(d->>'Người thực hiện',''),d->>'Người chịu trách nhiệm',''),'[,;|]+') v;
 end if;
 return query select 'Người giao'::text,cx_key(coalesce(nullif(d->>'Người giao việc',''),nullif(d->>'Người giao',''),d->>'Người tạo')),false;
 elsif sheet='NHAC_VIEC_GHI_CHU' then
 return query select distinct 'Người liên quan'::text,cx_key(v),false from regexp_split_to_table(coalesce(d->>'NGƯỜI LIÊN QUAN',d->>'Người liên quan',''),'[,;|\n]+') v;
 end if;
end $$;

create or replace function nk_receive_work(t uuid,who uuid) returns boolean language plpgsql as $$
begin
 perform 1 from cx_threads where id=t and kind in ('task','reminder') and units=array['surgery'] and who=any(performers) for update;
 if not found then return false; end if;
 perform cx_append(t,who,'Đã xác nhận nhận việc.','[]'::jsonb,who,null);
 return true;
end $$;
revoke all on function nk_receive_work(uuid,uuid) from public,anon,authenticated;
grant execute on function nk_receive_work(uuid,uuid) to service_role;
