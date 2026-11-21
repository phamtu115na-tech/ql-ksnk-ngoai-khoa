BEGIN;
create table if not exists cx_people (
 id uuid primary key default gen_random_uuid(), username text unique not null, name text not null,
 unit text not null check(unit in ('company','general','surgery')), admin boolean not null default false,
 active boolean not null default true, credential text not null, version uuid not null default gen_random_uuid()
);
create table if not exists cx_sessions (
 token text primary key, person uuid not null references cx_people, version uuid not null, expires timestamptz not null
);
create table if not exists cx_attempts (bucket text primary key, hits int not null, expires timestamptz not null);
create or replace function cx_attempt(k text) returns int language plpgsql as $$
declare n int;
begin
 delete from cx_attempts where expires < now();
 insert into cx_attempts values(k,1,now()+interval '2 minutes')
 on conflict(bucket) do update set hits=cx_attempts.hits+1 returning hits into n;
 return n;
end $$;
create table if not exists cx_threads (
 id uuid primary key, kind text not null check(kind in ('task','reminder','chat')), title text not null,
 owner_id uuid not null references cx_people, performers uuid[] not null, observers uuid[] not null,
 units text[] not null, due date, note text not null default '', status text not null default 'Mới',
 seq integer not null default 0, updated timestamptz not null default now(), pair_key text unique
);
create table if not exists cx_messages (
 thread uuid not null references cx_threads, seq int not null, sender uuid not null references cx_people,
 body text not null, files jsonb not null default '[]', sent timestamptz not null default now(),
 request_id uuid not null, primary key(thread,seq), unique(thread,sender,request_id)
);
create table if not exists cx_reads (
 thread uuid not null references cx_threads, person uuid not null references cx_people, seq int not null,
 primary key(thread,person)
);
create or replace function cx_append(t uuid,who uuid,txt text,attachments jsonb,rid uuid,new_status text default null)
returns void language plpgsql as $$
declare n int;
begin
 perform 1 from cx_threads where id=t for update;
 if exists(select 1 from cx_messages where thread=t and sender=who and request_id=rid) then return; end if;
 update cx_threads set seq=seq+1,updated=now(),status=coalesce(new_status,status) where id=t returning seq into n;
 insert into cx_messages(thread,seq,sender,body,files,request_id) values(t,n,who,txt,attachments,rid);
end $$;
create or replace function cx_read(t uuid,who uuid,n int) returns void language sql as $$
 insert into cx_reads values(t,who,n) on conflict(thread,person) do update set seq=greatest(cx_reads.seq,excluded.seq)
$$;
create or replace function cx_create(t uuid,k text,label text,who uuid,p uuid[],o uuid[],u text[],d date,details text,pk text,attachments jsonb)
returns uuid language plpgsql as $$
declare created uuid;
begin
 insert into cx_threads(id,kind,title,owner_id,performers,observers,units,due,note,pair_key)
 values(t,k,label,who,p,o,u,d,details,pk) on conflict do nothing returning id into created;
 if created is null then
  select id into created from cx_threads where (id=t and owner_id=who) or (pk is not null and pair_key=pk);
  if created is null then raise exception 'Trùng mã'; end if;
  return created;
 end if;
 perform cx_append(t,who,case k when 'chat' then 'Mở cuộc trao đổi' when 'task' then 'Đã giao việc' else 'Đã tạo nhắc việc' end,attachments,t);
 return t;
end $$;
create index if not exists cx_threads_units on cx_threads using gin(units);
create index if not exists cx_sessions_exp on cx_sessions(expires);
do $$ declare tbl text; fn regprocedure;
begin
 foreach tbl in array array['cx_people','cx_sessions','cx_attempts','cx_threads','cx_messages','cx_reads'] loop
 execute format('alter table %I enable row level security',tbl);
 execute format('revoke all on %I from public,anon,authenticated',tbl);
 execute format('grant all on %I to service_role',tbl);
 end loop;
 for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('cx_attempt','cx_read','cx_create','cx_append') loop
 execute format('revoke all on function %s from public,anon,authenticated',fn);
 execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('connect-files','connect-files',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
create or replace function cx_board(who uuid,scope text,screen text,skip_rows int default 0)
returns table(item jsonb,unread bigint) language sql stable as $$
 select to_jsonb(t),case when who=t.owner_id or who=any(t.performers||t.observers) then
 (select count(*) from cx_messages m where m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender<>who) else 0 end
 from cx_threads t join cx_people a on a.id=who and a.active
 left join cx_reads r on r.thread=t.id and r.person=who
 where (a.unit='company' or a.unit=any(t.units))
 and (scope='all' or scope=any(t.units))
 and ((a.admin and t.kind<>'chat') or who=t.owner_id or who=any(t.performers||t.observers))
 and (screen='all' or t.kind=screen)
 order by t.updated desc,t.id limit 80 offset greatest(skip_rows,0)
$$;
create or replace function cx_badges(who uuid,scope text) returns table(kind text,unread bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active
 left join cx_reads r on r.person=who and r.thread=t.id
 join cx_messages m on m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender<>who
 where (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and (who=t.owner_id or who=any(t.performers||t.observers)) group by t.kind
$$;
revoke all on function cx_board(uuid,text,text,int),cx_badges(uuid,text) from public,anon,authenticated;
grant execute on function cx_board(uuid,text,text,int),cx_badges(uuid,text) to service_role;
alter table cx_people add column if not exists legacy_operator boolean not null default false;
create or replace function cx_due(who uuid,scope text) returns table(kind text,quantity bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active
 where (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and who=any(t.performers) and t.kind<>'chat' and t.status<>'Hoàn thành'
 and t.due<=(now() at time zone 'Asia/Ho_Chi_Minh')::date group by t.kind
$$;
create or replace function cx_edit(t uuid,who uuid,label text,details text,d date,expected int,rid uuid)
returns boolean language plpgsql as $$
declare n int;
begin
 select seq into n from cx_threads where id=t and owner_id=who and kind<>'chat' for update;
 if n is null then return false; end if;
 if exists(select 1 from cx_messages where thread=t and sender=who and request_id=rid) then return true; end if;
 if n<>expected then return false; end if;
 update cx_threads set title=label,note=details,due=d where id=t;
 perform cx_append(t,who,'Đã cập nhật nội dung công việc','[]',rid);
 return true;
end $$;
revoke all on function cx_due(uuid,text),cx_edit(uuid,uuid,text,text,date,int,uuid) from public,anon,authenticated;
grant execute on function cx_due(uuid,text),cx_edit(uuid,uuid,text,text,date,int,uuid) to service_role;
-- Run inside the CONNECT schema. The original workbook belongs to Ngoai khoa.
create or replace function cx_key(v text) returns text language sql immutable as $$
 select lower(regexp_replace(trim(coalesce(v,'')),'[[:space:]]+',' ','g'))
$$;
create or replace function cx_source_unit(d jsonb) returns text language sql immutable as $$
 select case cx_key(coalesce(nullif(d->>'unitId',''),nullif(d->>'Đơn vị',''),d->>'Bệnh viện'))
 when '' then 'surgery' when 'surgery' then 'surgery' when 'ngoại khoa' then 'surgery'
 when 'bệnh viện ngoại khoa 115 nghệ an' then 'surgery' when 'general' then 'general'
 when 'đa khoa' then 'general' when 'bệnh viện đa khoa 115 nghệ an' then 'general'
 when 'company' then 'company' when 'tổng công ty' then 'company'
 when 'công ty cổ phần bệnh viện 115 nghệ an' then 'company' end
$$;
create or replace view cx_staff_catalog as
 select id as source_id,row_no,cx_source_unit(data) as unit,cx_key(data->>'Mã NV') as code,
 trim(coalesce(nullif(data->>'Họ và tên',''),data->>'Họ tên','')) as name,
 coalesce(data->>'Bộ phận','') as department,
 count(*) over(partition by cx_source_unit(data),cx_key(data->>'Mã NV')) as copies
 from ksnk_legacy_rows where sheet_name='DM_NHANVIEN';
alter table cx_people add column if not exists staff_code text;
alter table cx_people add column if not exists department text not null default '';
create unique index if not exists cx_person_staff_key on cx_people(unit,staff_code) where staff_code is not null;

create table if not exists cx_work_people (
 source_id bigint references ksnk_legacy_rows(id) on delete cascade,
 unit text not null, role text not null, token text not null, match_code boolean not null,
 staff_code text, primary key(source_id,role,token,match_code)
);
create index if not exists cx_work_by_staff on cx_work_people(unit,staff_code);
alter table cx_work_people enable row level security;
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
create or replace function cx_index_work(r ksnk_legacy_rows) returns void language plpgsql as $$
declare u text:=coalesce(cx_source_unit(r.data),'unknown');
begin
 delete from cx_work_people w where w.source_id=r.id and (w.unit<>u or not exists
 (select from cx_roles(r.sheet_name,r.data) x where (x.role,x.token,x.match_code)=(w.role,w.token,w.match_code)));
 insert into cx_work_people(source_id,unit,role,token,match_code,staff_code)
 select r.id,u,x.role,x.token,x.match_code,
 (select case when count(*)=1 and min(s.copies)=1 then nullif(min(s.code),'') end from cx_staff_catalog s
 where s.unit=u and (case when x.match_code then s.code else cx_key(s.name) end)=x.token)
 from cx_roles(r.sheet_name,r.data) x where x.token<>''
 on conflict(source_id,role,token,match_code) do update set staff_code=excluded.staff_code where cx_work_people.staff_code is null;
end $$;
create or replace function cx_refresh_links() returns void language plpgsql as $$
begin
 -- Source names and departments are authoritative for explicitly linked accounts.
 update cx_people p set name=s.name,department=s.department from cx_staff_catalog s
 where p.unit=s.unit and p.staff_code=s.code and s.copies=1 and s.name<>'' and (p.name,p.department) is distinct from (s.name,s.department);
 -- Require uniqueness on both sides, including directory rows with missing codes.
 with candidates as (
 select p.id,s.code,s.department,s.name from cx_people p join cx_staff_catalog s
 on s.unit=p.unit and cx_key(s.name)=cx_key(p.name)
 where p.staff_code is null and not p.admin and s.copies=1 and s.code<>'' and s.name<>''
 and (select count(*) from cx_staff_catalog t where t.unit=s.unit and cx_key(t.name)=cx_key(s.name))=1
 and (select count(*) from cx_people q where q.unit=p.unit and cx_key(q.name)=cx_key(p.name))=1
 and not exists(select from cx_people q where q.unit=s.unit and q.staff_code=s.code))
 update cx_people p set staff_code=c.code,department=c.department,name=c.name from candidates c where p.id=c.id and p.staff_code is null;
 update cx_work_people w set staff_code=(
 select case when count(*)=1 and min(s.copies)=1 then nullif(min(s.code),'') end from cx_staff_catalog s
 where s.unit=w.unit and (case when w.match_code then s.code else cx_key(s.name) end)=w.token)
 where w.staff_code is null;
end $$;
create or replace function cx_work_changed() returns trigger language plpgsql as $$
begin perform cx_index_work(new);return new;end $$;
drop trigger if exists cx_work_changed on ksnk_legacy_rows;
create trigger cx_work_changed after insert or update on ksnk_legacy_rows for each row
 when(new.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU')) execute function cx_work_changed();
create or replace function cx_catalog_changed() returns trigger language plpgsql as $$
begin
 -- Import batches may temporarily contain just one of several homonyms.
 -- Resolve name-only candidates using the administrator's completed directory.
 update cx_people p set name=s.name,department=s.department from cx_staff_catalog s
 where s.source_id=new.id and s.copies=1 and s.name<>'' and p.unit=s.unit and p.staff_code=s.code and (p.name,p.department) is distinct from (s.name,s.department);
 return new;
end $$;
drop trigger if exists cx_catalog_changed on ksnk_legacy_rows;
create trigger cx_catalog_changed after insert or update on ksnk_legacy_rows for each row when(new.sheet_name='DM_NHANVIEN') execute function cx_catalog_changed();
create or replace function cx_check_link() returns trigger language plpgsql as $$
declare s record;
begin
 if new.staff_code is null then return new;end if;
 if tg_op='UPDATE' and old.staff_code is not null and (old.unit,old.staff_code) is distinct from (new.unit,new.staff_code) then raise exception 'Liên kết nhân viên đã được thiết lập';end if;
 select * into s from cx_staff_catalog where unit=new.unit and code=new.staff_code and copies=1 and name<>'';
 if not found then raise exception 'Mã nhân viên thiếu hoặc bị trùng';end if;
 new.name:=s.name;new.department:=s.department;return new;
end $$;
drop trigger if exists cx_check_link on cx_people;
create trigger cx_check_link before insert or update of staff_code,name,unit on cx_people for each row execute function cx_check_link();
select cx_index_work(r) from ksnk_legacy_rows r where r.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU');
select cx_refresh_links();
create or replace function cx_history(who uuid,k text,scope text,skip_rows int) returns table(title text,ref text,day text,status text,details text,roles text) language sql stable as $$
 select coalesce(r.data->>'Tiêu đề công việc',r.data->>'Tiêu đề',r.data->>'TIÊU ĐỀ NHẮC VIỆC',r.data->>'Tiêu đề nhắc việc',''),
 coalesce(r.data->>'ID',r.data->>'MÃ NHẮC VIỆC',r.legacy_id),coalesce(r.data->>'Ngày kết thúc',r.data->>'NGÀY NHẮC',r.data->>'Ngày nhắc',''),
 coalesce(r.data->>'Trạng thái NV',r.data->>'TRẠNG THÁI',r.data->>'Trạng thái',''),
 coalesce(r.data->>'Nội dung / Mô tả',r.data->>'NỘI DUNG / GHI CHÚ',r.data->>'Nội dung',''),
 (select string_agg(w.role||' · '||coalesce(s.name,w.token),'; ' order by w.role,w.token) from cx_work_people w
 left join cx_staff_catalog s on s.unit=w.unit and s.code=w.staff_code and s.copies=1 where w.source_id=r.id)
 from ksnk_legacy_rows r join cx_people p on p.id=who and p.active
 where r.sheet_name=case k when 'task' then 'GIAO VIỆC' when 'reminder' then 'NHAC_VIEC_GHI_CHU' end
 and (scope='all' or scope=cx_source_unit(r.data))
 and (p.admin or exists(select from cx_work_people w join cx_staff_catalog s on s.unit=w.unit and s.code=w.staff_code and s.copies=1
 where w.source_id=r.id and w.unit=p.unit and w.staff_code=p.staff_code))
 order by r.row_no desc limit 80 offset greatest(skip_rows,0)
$$;
revoke all on cx_work_people,cx_staff_catalog from public,anon,authenticated;
grant select on cx_staff_catalog to service_role;
grant all on cx_work_people to service_role;
do $$ declare f regprocedure;
begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('cx_key','cx_source_unit','cx_roles','cx_index_work','cx_refresh_links','cx_work_changed','cx_catalog_changed','cx_check_link','cx_history')
loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end $$;
alter table cx_work_people add column if not exists confirmed boolean not null default false;
create or replace function cx_confirm_role(src bigint,role_name text,raw_token text,by_code boolean,employee bigint)
returns boolean language plpgsql as $$
begin
 update cx_work_people w set staff_code=s.code,confirmed=true from cx_staff_catalog s
 where w.source_id=src and w.role=role_name and w.token=raw_token and w.match_code=by_code
 and w.staff_code is null and s.source_id=employee and w.unit=s.unit and s.code<>'' and s.copies=1;
 return found;
end $$;
revoke all on function cx_confirm_role(bigint,text,text,boolean,bigint) from public,anon,authenticated;
grant execute on function cx_confirm_role(bigint,text,text,boolean,bigint) to service_role;
-- Bảng công việc chung cho sổ Ngoại khoa và CONNECT.
alter table cx_people add column if not exists pending_login boolean not null default false;
alter table cx_threads add column if not exists source_row bigint;
alter table cx_threads add column if not exists legacy_id_is_connect boolean not null default false;
create unique index if not exists cx_threads_source_row on cx_threads(source_row);
alter table cx_threads alter column owner_id drop not null;

create or replace function cx_prepare_staff() returns void language sql as $$
 insert into cx_people(name,unit,username,staff_code,department,active,credential,pending_login)
 select s.name,s.unit,'~'||gen_random_uuid(),s.code,s.department,false,'!',true
 from cx_staff_catalog s where s.unit is not null and s.copies=1 and s.code<>'' and s.name<>''
 on conflict(unit,staff_code) where staff_code is not null do nothing
$$;
select cx_prepare_staff();

create or replace function cx_work_date(v text) returns date language plpgsql immutable as $$
begin
 if v ~ '^\d{4}-\d{2}-\d{2}' then return left(v,10)::date;end if;
 if v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then return to_date(v,'DD/MM/YYYY');end if;
 return null;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

create or replace function cx_import_work(r ksnk_legacy_rows) returns void language plpgsql as $$
declare
 task boolean:=r.sheet_name='GIAO VIỆC';
 unit_name text:=cx_source_unit(r.data);
 sender uuid; recipients uuid[]; raw_status text;
begin
 if r.sheet_name not in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') then return;end if;
 select (array_agg(p.id) filter(where w.role='Người giao'))[1],
 coalesce(array_agg(distinct p.id) filter(where w.role<>'Người giao'),'{}'::uuid[])
 into sender,recipients from cx_work_people w join cx_staff_catalog s
 on s.unit=w.unit and s.code=w.staff_code and s.copies=1
 join cx_people p on p.unit=s.unit and p.staff_code=s.code where w.source_id=r.id;
 raw_status:=upper(trim(coalesce(r.data->>'Trạng thái NV',r.data->>'TRẠNG THÁI',r.data->>'Trạng thái','')));
 insert into cx_threads(id,source_row,kind,title,owner_id,performers,observers,units,due,note,status,updated)
 values(gen_random_uuid(),r.id,case when task then 'task' else 'reminder' end,
 coalesce(r.data->>'Tiêu đề công việc',r.data->>'TIÊU ĐỀ NHẮC VIỆC',r.data->>'Tiêu đề',r.legacy_id,''),
 sender,recipients,'{}',array_remove(array[unit_name],null),
 cx_work_date(coalesce(r.data->>'Ngày kết thúc',r.data->>'NGÀY NHẮC',r.data->>'Ngày nhắc')),
 coalesce(r.data->>'Nội dung / Mô tả',r.data->>'NỘI DUNG / GHI CHÚ',r.data->>'Nội dung',''),
 case when raw_status in ('HOÀN THÀNH','ĐÃ HOÀN THÀNH','ĐÃ XONG','HOÀN TẤT') then 'Hoàn thành'
 when raw_status in ('ĐANG LÀM','ĐANG THỰC HIỆN') then 'Đang thực hiện'
 when raw_status='ĐÃ NHẬN' then 'Đã nhận' else 'Mới' end,r.imported_at)
 on conflict(source_row) do update set title=excluded.title,owner_id=excluded.owner_id,performers=excluded.performers,
 units=excluded.units,due=excluded.due,note=excluded.note,status=excluded.status;
end $$;

create or replace function cx_export_work() returns trigger language plpgsql as $$
declare sheet text; ref text:='CX-'||new.id; payload jsonb; employee_names text; creator text; src bigint;
begin
 if new.kind='chat' or new.source_row is not null or not ('surgery'=any(new.units)) then return null;end if;
 sheet:=case new.kind when 'task' then 'GIAO VIỆC' else 'NHAC_VIEC_GHI_CHU' end;
 perform pg_advisory_xact_lock(hashtext(sheet));
 select name into creator from cx_people where id=new.owner_id;
 select string_agg(p.name,', ' order by u.n) into employee_names
 from unnest(new.performers) with ordinality u(id,n) join cx_people p on p.id=u.id;
 if new.kind='task' then
 payload:=jsonb_build_object('ID',ref,'Tiêu đề công việc',new.title,'Người giao việc',creator,'Người thực hiện',employee_names,
 'Ngày bắt đầu',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'Ngày kết thúc',new.due,'Nội dung / Mô tả',new.note,'Trạng thái NV','CHƯA BẮT ĐẦU');
 else
 payload:=jsonb_build_object('MÃ NHẮC VIỆC',ref,'TIÊU ĐỀ NHẮC VIỆC',new.title,'NGƯỜI LIÊN QUAN',employee_names,
 'NGÀY TẠO',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'NGÀY NHẮC',new.due,'NỘI DUNG / GHI CHÚ',new.note,'TRẠNG THÁI','CHƯA THỰC HIỆN');
 end if;
 insert into ksnk_legacy_rows(sheet_name,row_no,legacy_id,data)
 select sheet,coalesce(max(row_no),0)+1,ref,payload from ksnk_legacy_rows where sheet_name=sheet returning id into src;
 update cx_threads set source_row=src,legacy_id_is_connect=true where id=new.id;
 return null;
end $$;
create or replace function cx_refresh_native(r ksnk_legacy_rows, prior ksnk_legacy_rows) returns void language plpgsql as $$
declare before_row cx_threads; changed_people boolean; changed_sender boolean; recipients uuid[];
begin
 select * into before_row from cx_threads where source_row=r.id;
 changed_people:=coalesce(r.data->>'Người thực hiện',r.data->>'NGƯỜI LIÊN QUAN','') is distinct from coalesce(prior.data->>'Người thực hiện',prior.data->>'NGƯỜI LIÊN QUAN','');
 changed_sender:=r.data->>'Người giao việc' is distinct from prior.data->>'Người giao việc';
 perform cx_import_work(r);
 if changed_people then
 select coalesce(array_agg(distinct p.id),'{}') into recipients from regexp_split_to_table(coalesce(r.data->>'Người thực hiện',r.data->>'NGƯỜI LIÊN QUAN',''),'[,;|]+') token
 join cx_staff_catalog s on s.unit=cx_source_unit(r.data) and cx_key(s.name)=cx_key(token) and s.copies=1
 join cx_people p on p.unit=s.unit and p.staff_code=s.code where (select count(*) from cx_staff_catalog z where z.unit=s.unit and cx_key(z.name)=cx_key(token))=1;
 end if;
 update cx_threads set units=before_row.units,owner_id=case when changed_sender then owner_id else before_row.owner_id end,
 performers=case when changed_people then recipients else before_row.performers end where id=before_row.id;
end $$;
drop trigger if exists cx_export_work on cx_threads;
create trigger cx_export_work after insert on cx_threads for each row execute function cx_export_work();
revoke all on function cx_export_work(),cx_refresh_native(ksnk_legacy_rows,ksnk_legacy_rows) from public,anon,authenticated;
grant execute on function cx_export_work(),cx_refresh_native(ksnk_legacy_rows,ksnk_legacy_rows) to service_role;

alter table cx_messages alter column sender drop not null;
create or replace function cx_source_changed() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then
 -- Keep message history inaccessible after the source is removed.
 update cx_threads set owner_id=null,performers='{}',observers='{}',units='{}' where source_row=old.id;
 elsif new.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') and pg_trigger_depth()>1 then
 -- A CONNECT transaction has already written the same fields to both sides.
 return null;
 elsif new.sheet_name='DM_NHANVIEN' then
 perform cx_prepare_staff();
 elsif new.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') then
 if tg_op='UPDATE' and exists(select from cx_threads where source_row=new.id and legacy_id_is_connect) then
 perform cx_refresh_native(new,old);
 else perform cx_import_work(new);end if;
 if tg_op='INSERT' or new.data is distinct from old.data then
 perform cx_append(t.id,null,case when tg_op='UPDATE' then 'Phiếu đã được cập nhật trong hệ thống Ngoại khoa.'
 when t.kind='task' then 'Có giao việc mới từ hệ thống Ngoại khoa.' else 'Có nhắc việc mới từ hệ thống Ngoại khoa.' end,
 '[]',gen_random_uuid()) from cx_threads t where t.source_row=new.id;
 end if;
 end if;
 return null;
end $$;
-- Runs after cx_work_changed has indexed source roles.
drop trigger if exists zz_cx_source on ksnk_legacy_rows;
create trigger zz_cx_source after insert or update or delete on ksnk_legacy_rows for each row execute function cx_source_changed();
select cx_import_work(r) from ksnk_legacy_rows r where not exists(select from cx_threads x where x.source_row=r.id and x.legacy_id_is_connect) and r.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU');
create or replace function cx_write_source() returns trigger language plpgsql as $$
declare t boolean:=new.kind='task'; patch jsonb:='{}'; evaluation text;
begin
 if pg_trigger_depth()>1 or new.source_row is null then return null;end if;
 if old.title is distinct from new.title then patch:=patch||jsonb_build_object(case when t then 'Tiêu đề công việc' else 'TIÊU ĐỀ NHẮC VIỆC' end,new.title);end if;
 if old.note is distinct from new.note then patch:=patch||jsonb_build_object(case when t then 'Nội dung / Mô tả' else 'NỘI DUNG / GHI CHÚ' end,new.note);end if;
 if old.due is distinct from new.due then patch:=patch||jsonb_build_object(case when t then 'Ngày kết thúc' else 'NGÀY NHẮC' end,new.due);end if;
 if old.status is distinct from new.status then
 if t and new.status='Hoàn thành' then
 select upper(trim(coalesce(nullif(data->>'Đánh giá quản lý hiện tại',''),data->>'Đánh giá quản lý',''))) into evaluation from ksnk_legacy_rows where id=new.source_row;
 if evaluation not in ('XUẤT SẮC','TỐT','KHÁ','TRUNG BÌNH','CHƯA ĐẠT','CHƯA ĐẠT_LÀM LẠI','CHƯA ĐẠT – LÀM LẠI','KÉM') then raise exception 'Cần đánh giá của quản lý trước khi hoàn thành';end if;
 end if;
 patch:=patch||jsonb_build_object(case when t then 'Trạng thái NV' else 'TRẠNG THÁI' end,
 case new.status when 'Hoàn thành' then case when t then 'ĐÃ HOÀN THÀNH' else 'ĐÃ XONG' end when 'Mới' then case when t then 'CHƯA BẮT ĐẦU' else 'CHƯA THỰC HIỆN' end else upper(new.status) end);
 end if;
 if patch<>'{}'::jsonb then update ksnk_legacy_rows set data=data||patch where id=new.source_row;end if;
 return null;
end $$;
drop trigger if exists cx_write_source on cx_threads;
create trigger cx_write_source after update of title,note,due,status on cx_threads for each row execute function cx_write_source();
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('cx_source_changed','cx_import_work','cx_work_date','cx_prepare_staff','cx_write_source')
loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;end $$;

create or replace function cx_board(who uuid,scope text,screen text,skip_rows int default 0)
returns table(item jsonb,unread bigint) language sql stable as $$
 select to_jsonb(t),case when who=t.owner_id or who=any(t.performers||t.observers) then
 (select count(*) from cx_messages m where m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender is distinct from who) else 0 end
 from cx_threads t join cx_people a on a.id=who and a.active
 left join cx_reads r on r.thread=t.id and r.person=who
 where cardinality(t.units)>0 and (a.unit='company' or a.unit=any(t.units))
 and (scope='all' or scope=any(t.units))
 and ((a.admin and t.kind<>'chat') or who=t.owner_id or who=any(t.performers||t.observers))
 and (screen='all' or t.kind=screen)
 order by t.updated desc,t.id limit 80 offset greatest(skip_rows,0)
$$;

-- A manual role confirmation must take effect in the same conversation.
create or replace function cx_role_resolved() returns trigger language plpgsql as $$
declare r ksnk_legacy_rows;
begin
 if pg_trigger_depth()=1 and not exists(select from cx_threads where source_row=new.source_id and legacy_id_is_connect) then
 select * into r from ksnk_legacy_rows where id=new.source_id;
 if found then perform cx_import_work(r);end if;
 end if;
 return null;
end $$;
drop trigger if exists cx_role_resolved on cx_work_people;
create trigger cx_role_resolved after update of staff_code on cx_work_people for each row when(old.staff_code is distinct from new.staff_code) execute function cx_role_resolved();
revoke all on function cx_role_resolved() from public,anon,authenticated;
grant execute on function cx_role_resolved() to service_role;

create or replace function cx_badges(who uuid,scope text) returns table(kind text,unread bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active
 left join cx_reads r on r.person=who and r.thread=t.id
 join cx_messages m on m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender is distinct from who
 where (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and (who=t.owner_id or who=any(t.performers||t.observers)) group by t.kind
$$;

-- Announce outstanding records once on installation, preserving prior reads.
select cx_append(t.id,null,'Đã đồng bộ phiếu đang theo dõi từ hệ thống Ngoại khoa.','[]',t.id)
from cx_threads t where t.source_row is not null and not t.legacy_id_is_connect and t.status<>'Hoàn thành'
and cardinality(t.units)>0 and t.seq=0;

-- Nâng cấp từ bản đã có cong_viec_chung.sql.
update cx_people set unit='surgery',name=case when name='Quản trị Tổng công ty' then 'Quản trị Bệnh viện Ngoại khoa' else name end,version=gen_random_uuid()
where username='admin' and admin and unit='company' and staff_code is null;

create or replace view nk_legacy_rows with (security_invoker=true) as
 select * from ksnk_legacy_rows where sheet_name not in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU','DM_NHANVIEN') or cx_source_unit(data)='surgery'
 with local check option;
revoke all on nk_legacy_rows from public,anon,authenticated;
grant all on nk_legacy_rows to service_role;

create or replace function cx_notification(who uuid) returns jsonb language sql stable as $$
 select jsonb_build_object('id',t.id,'kind',t.kind,'title',t.title,'body',left(coalesce(nullif(m.body,''),'Ảnh / tài liệu'),180),'seq',m.seq)
 from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery'
 join cx_messages m on m.thread=t.id left join cx_reads r on r.thread=t.id and r.person=who
 where t.units=array['surgery'] and (who=t.owner_id or who=any(t.performers||t.observers))
 and m.seq>coalesce(r.seq,0) and m.sender is distinct from who
 order by m.sent desc,t.id,m.seq desc limit 1
$$;
revoke all on function cx_notification(uuid) from public,anon,authenticated;
grant execute on function cx_notification(uuid) to service_role;

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

create or replace function cx_badges(who uuid,scope text) returns table(kind text,unread bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery' and t.units=array['surgery']
 left join cx_reads r on r.person=who and r.thread=t.id
 join cx_messages m on m.thread=t.id and m.seq>coalesce(r.seq,0) and m.sender is distinct from who
 where (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and (who=t.owner_id or who=any(t.performers||t.observers)) group by t.kind
$$;

create or replace function cx_due(who uuid,scope text) returns table(kind text,quantity bigint)
language sql stable as $$
 select t.kind,count(*) from cx_threads t join cx_people a on a.id=who and a.active and a.unit='surgery' and t.units=array['surgery']
 where (a.unit='company' or a.unit=any(t.units)) and (scope='all' or scope=any(t.units))
 and who=any(t.performers) and t.kind<>'chat' and t.status<>'Hoàn thành'
 and t.due<=(now() at time zone 'Asia/Ho_Chi_Minh')::date group by t.kind
$$;


-- Protect an existing other-unit row against an import that reuses its row number.
create or replace function nk_keep_source_unit() returns trigger language plpgsql as $$
begin
 if old.sheet_name in ('DM_NHANVIEN','GIAO VIỆC','NHAC_VIEC_GHI_CHU') and
 cx_source_unit(old.data) is distinct from 'surgery' and cx_source_unit(new.data)='surgery' then
 raise exception 'Số dòng đã thuộc hồ sơ đơn vị khác';
 end if;
 return new;
end $$;
drop trigger if exists nk_keep_source_unit on ksnk_legacy_rows;
create trigger nk_keep_source_unit before update on ksnk_legacy_rows for each row execute function nk_keep_source_unit();
revoke all on function nk_keep_source_unit() from public,anon,authenticated;
grant execute on function nk_keep_source_unit() to service_role;

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

COMMIT;

create or replace function nk_receive_work(t uuid,who uuid) returns boolean language plpgsql as $$
begin
 perform 1 from cx_threads where id=t and kind in ('task','reminder') and units=array['surgery'] and who=any(performers) for update;
 if not found then return false; end if;
 perform cx_append(t,who,'Đã xác nhận nhận việc.','[]'::jsonb,who,null);
 return true;
end $$;
revoke all on function nk_receive_work(uuid,uuid) from public,anon,authenticated;
grant execute on function nk_receive_work(uuid,uuid) to service_role;

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
