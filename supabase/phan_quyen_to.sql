alter table cx_people add column if not exists work_role_reviewed boolean not null default false,
 add column if not exists team_department text,
 add column if not exists team_lead boolean not null default false,
 add column if not exists work_view boolean not null default true,
 add column if not exists work_edit boolean not null default true;

create or replace function nk_work_scope(a cx_people,t cx_threads) returns boolean language sql stable as $$
 select a.active and a.unit='surgery' and t.units=array['surgery'] and
 case when t.kind='chat' then a.id=t.owner_id or a.id=any(t.performers||t.observers)
 else (a.admin or a.work_view) and (a.admin or a.legacy_operator or (not a.team_lead and (a.id=t.owner_id or a.id=any(t.performers||t.observers)))
 or (a.team_lead and nullif(trim(coalesce(nullif(a.team_department,''),a.department)),'') is not null and
 case when nullif(trim(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận')),'') is not null
 then cx_key(coalesce(nullif(a.team_department,''),a.department))=cx_key(coalesce(r.data->>'Bộ phận',r.data->>'Thuộc bộ phận'))
 else cardinality(t.performers)>0 and not exists(select from unnest(t.performers) u(id) left join cx_people p on p.id=u.id
 where cx_key(p.department) is distinct from cx_key(coalesce(nullif(a.team_department,''),a.department)) or p.unit is distinct from a.unit) end)) end
 from (select 1) dummy left join ksnk_legacy_rows r on r.id=t.source_row
$$;

create or replace function nk_check_work(who uuid,work_id uuid) returns boolean language sql stable as $$
 select coalesce((select nk_work_scope(a,t) from cx_people a,cx_threads t where a.id=who and t.id=work_id),false)
$$;

create table if not exists nk_personal_work_notes(
 thread uuid references cx_threads on delete cascade, person uuid references cx_people on delete cascade,
 note text not null, primary key(thread,person));
alter table nk_personal_work_notes enable row level security;
revoke all on nk_personal_work_notes from public,anon,authenticated;
grant select,insert,update,delete on nk_personal_work_notes to service_role;

create or replace function nk_save_detail(work_id uuid,who uuid,expected int,rid uuid,label text,details text,deadline date,personal text,opinion text) returns boolean language plpgsql as $$
declare t cx_threads; a cx_people; management boolean;
begin
 select * into t from cx_threads where id=work_id for update;
 select * into a from cx_people where id=who;
 if t.kind not in ('task','reminder') or not coalesce(nk_work_scope(a,t),false) or not (a.admin or a.work_edit) then return false;end if;
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
 perform cx_append(work_id,who,'Đã cập nhật chi tiết phiếu','[]',rid);
 return true;
end $$;
revoke all on function nk_work_scope(cx_people,cx_threads),nk_check_work(uuid,uuid),nk_save_detail(uuid,uuid,int,uuid,text,text,date,text,text) from public,anon,authenticated;
grant execute on function nk_work_scope(cx_people,cx_threads),nk_check_work(uuid,uuid),nk_save_detail(uuid,uuid,int,uuid,text,text,date,text,text) to service_role;

create or replace function cx_board(who uuid,scope text,screen text,skip_rows int default 0)
returns table(item jsonb,unread bigint) language sql stable as $$
 select to_jsonb(t)||jsonb_build_object('latest_message',case when m.sent is not null then left(coalesce(nullif(m.body,''),'Ảnh / tài liệu'),180) end,
 'message_sender',m.sender,'message_time',m.sent,'mentioned',exists(select from cx_messages mention where mention.thread=t.id and mention.sender<>who and mention.seq>coalesce(r.seq,0) and who=any(t.performers||t.observers||array[t.owner_id]) and exists(select from regexp_split_to_table(lower(mention.body),'@') with ordinality part(v,n) where n>1 and left(v,length(a.name))=lower(a.name) and substring(v from length(a.name)+1 for 1) !~ '[[:alnum:]_]'))),
 (select count(*) from cx_messages u where u.thread=t.id and u.seq>coalesce(r.seq,0) and u.sender is distinct from who and who=any(t.performers||t.observers||array[t.owner_id]))
 from cx_threads t join cx_people a on a.id=who and nk_work_scope(a,t)
 left join cx_reads r on r.thread=t.id and r.person=who
 left join lateral (select body,sender,sent from cx_messages x where x.thread=t.id and (a.admin or a.work_role_reviewed or who=t.owner_id or who=any(t.performers||t.observers)) order by (who=any(t.performers||t.observers||array[t.owner_id]) and x.seq>coalesce(r.seq,0) and x.sender is distinct from who) desc nulls last,x.seq desc limit 1) m on true
 where (scope='all' or scope=any(t.units))
 and (screen='all' or t.kind=screen)
 order by t.updated desc,t.id limit 80 offset greatest(skip_rows,0)
$$;
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
 and nk_work_scope(a,t)
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
create or replace function cx_notification(who uuid) returns jsonb language sql stable as $$
 select jsonb_build_object('id',t.id,'kind',t.kind,'title',t.title,'body',left(coalesce(nullif(m.body,''),'Ảnh / tài liệu'),180),'seq',m.seq)
 from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery'
 join cx_messages m on m.thread=t.id left join cx_reads r on r.thread=t.id and r.person=who
 where nk_work_scope(a,t) and t.units=array['surgery'] and (who=t.owner_id or who=any(t.performers||t.observers))
 and m.seq>coalesce(r.seq,0) and m.sender is distinct from who
 order by m.sent desc,t.id,m.seq desc limit 1
$$;
create or replace function cx_due(who uuid,scope text) returns table(kind text,quantity bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery' and t.units=array['surgery']
 where nk_work_scope(a,t) and (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and who=any(t.performers) and t.kind<>'chat' and t.status<>'Hoàn thành'
 and t.due<=(now() at time zone 'Asia/Ho_Chi_Minh')::date group by t.kind
$$;
create or replace function cx_badges(who uuid,scope text) returns table(kind text,unread bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery' and t.units=array['surgery']
 left join cx_reads r on r.person=who and r.thread=t.id
 join cx_messages m on m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender is distinct from who
 where nk_work_scope(a,t) and (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and (who=t.owner_id or who=any(t.performers||t.observers)) group by t.kind
$$;
create or replace function nk_team_records(who uuid,sheets text[],fields text[],start_at int) returns table(id bigint,sheet text,department text,fields_data jsonb)
language sql stable as $$
 select r.id,r.sheet_name,r.data->>'Bộ phận',coalesce((select jsonb_object_agg(k,v) from jsonb_each(r.data) as e(k,v) where k=any(fields)),'{}'::jsonb)
 from ksnk_legacy_rows r join cx_people a on a.id=who and a.active and a.unit='surgery' and a.work_view
 where r.sheet_name=any(sheets) and cx_source_unit(r.data)='surgery'
 and (a.legacy_operator or (a.team_lead and cx_key(coalesce(nullif(a.team_department,''),a.department))<>'' and cx_key(r.data->>'Bộ phận')=cx_key(coalesce(nullif(a.team_department,''),a.department))))
 order by r.id desc limit 50 offset greatest(start_at,0)
$$;
create or replace function nk_team_field(who uuid,row_id bigint,sheets text[],field_name text,previous text,new_value text) returns boolean language plpgsql as $$
begin
 update ksnk_legacy_rows r set data=r.data||jsonb_build_object(field_name,new_value)
 from cx_people a where a.id=who and a.active and a.unit='surgery' and a.work_view and a.work_edit
 and r.id=row_id and r.sheet_name=any(sheets) and cx_source_unit(r.data)='surgery' and (r.data->>field_name) is not distinct from previous
 and (a.legacy_operator or (a.team_lead and cx_key(coalesce(nullif(a.team_department,''),a.department))<>'' and cx_key(r.data->>'Bộ phận')=cx_key(coalesce(nullif(a.team_department,''),a.department))));
 return found;
end $$;
revoke all on function nk_team_records(uuid,text[],text[],int),nk_team_field(uuid,bigint,text[],text,text,text) from public,anon,authenticated;
grant execute on function nk_team_records(uuid,text[],text[],int),nk_team_field(uuid,bigint,text[],text,text,text) to service_role;
