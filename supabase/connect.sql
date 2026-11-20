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
