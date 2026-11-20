create extension if not exists pgcrypto;
create table if not exists ksnk_legacy_rows(
 id bigint generated always as identity primary key,
 sheet_name text not null,
 row_no integer not null,
 legacy_id text,
 data jsonb not null,
 imported_at timestamptz not null default now(),
 unique(sheet_name,row_no)
);
create index if not exists ksnk_legacy_rows_sheet_idx on ksnk_legacy_rows(sheet_name);
alter table ksnk_legacy_rows enable row level security;

create table if not exists ksnk_settings(
 id integer primary key default 1 check(id=1),
 hospital_name text not null default 'BỆNH VIỆN 115',
 password_hash text,
 updated_at timestamptz not null default now()
);
alter table ksnk_settings enable row level security;

create table if not exists ksnk_evidence(
 id uuid primary key default gen_random_uuid(),
 module text not null,
 legacy_id text not null,
 file_name text not null,
 storage_path text not null,
 mime_type text,
 created_at timestamptz not null default now()
);
alter table ksnk_evidence enable row level security;
-- Script-parity migration for the Vercel application.
-- It is additive: it never truncates, deletes, or rewrites legacy rows.

create extension if not exists pgcrypto;

create table if not exists public.ksnk_legacy_rows(
  id bigint generated always as identity primary key,
  sheet_name text not null,
  row_no integer not null,
  legacy_id text,
  data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique(sheet_name,row_no)
);

create table if not exists public.ksnk_settings(
  id integer primary key default 1 check(id=1),
  hospital_name text not null default 'BỆNH VIỆN 115',
  password_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ksnk_evidence(
  id uuid primary key default gen_random_uuid(),
  module text not null,
  legacy_id text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists ksnk_legacy_rows_sheet_row_idx on public.ksnk_legacy_rows(sheet_name,row_no);
create index if not exists ksnk_legacy_rows_legacy_id_idx on public.ksnk_legacy_rows(legacy_id);
create index if not exists ksnk_legacy_rows_data_gin_idx on public.ksnk_legacy_rows using gin(data);
create index if not exists ksnk_legacy_rows_data_search_idx on public.ksnk_legacy_rows using gin(to_tsvector('simple',data::text));
create index if not exists ksnk_evidence_lookup_idx on public.ksnk_evidence(module,legacy_id,created_at desc);

alter table public.ksnk_legacy_rows enable row level security;
alter table public.ksnk_settings enable row level security;
alter table public.ksnk_evidence enable row level security;

insert into public.ksnk_settings(id,hospital_name)
values(1,'BỆNH VIỆN 115')
on conflict (id) do nothing;

insert into storage.buckets(id,name,public)
values('documents','documents',false)
on conflict (id) do update set public=excluded.public;
-- Tăng tốc tìm kiếm toàn văn trên dữ liệu Apps Script đã nhập.
alter table public.ksnk_legacy_rows
  add column if not exists data_search tsvector
  generated always as (to_tsvector('simple'::regconfig, coalesce(data::text, ''))) stored;
create index if not exists ksnk_legacy_rows_search_idx
  on public.ksnk_legacy_rows using gin(data_search);
create index if not exists ksnk_evidence_lookup_idx
  on public.ksnk_evidence(module, legacy_id, created_at desc);

-- Bucket riêng tư: tệp chỉ được đọc bằng URL ký ngắn hạn từ API máy chủ.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('documents','documents',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set
 public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Persistent read state and event history for the Alerts module.
-- The migration is additive and does not change legacy application rows.

create extension if not exists pgcrypto;

create table if not exists public.ksnk_alert_states(
  alert_key text primary key,
  recipient_key text not null default 'ALL',
  target text not null default 'alerts',
  kind text not null default 'THÔNG BÁO',
  level text not null default '',
  alert_date text not null default '',
  title text not null default '',
  message text not null default '',
  instruction text not null default '',
  person text not null default '',
  person_id text not null default '',
  manager_name text not null default '',
  manager_id text not null default '',
  row_no integer,
  entity_id text not null default '',
  notification_audience text not null default '',
  notification_type text not null default '',
  approval_status text not null default '',
  payload jsonb not null default '{}'::jsonb,
  persistent boolean not null default false,
  read_at timestamptz,
  read_by text,
  dismissed_at timestamptz,
  dismissed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ksnk_alert_states_recipient_read_idx
  on public.ksnk_alert_states(recipient_key, read_at, updated_at desc);
create index if not exists ksnk_alert_states_persistent_idx
  on public.ksnk_alert_states(persistent, created_at desc);
create index if not exists ksnk_alert_states_entity_idx
  on public.ksnk_alert_states(target, entity_id, notification_type);

alter table public.ksnk_alert_states enable row level security;
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
grant all on public.ksnk_legacy_rows,public.ksnk_settings,public.ksnk_evidence,public.ksnk_alert_states to service_role;
grant usage,select on sequence public.ksnk_legacy_rows_id_seq to service_role;
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
 return query select 'Người thực hiện'::text,cx_key(coalesce(code,nullif(d->>'Người thực hiện',''),d->>'Người chịu trách nhiệm')),code is not null;
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
