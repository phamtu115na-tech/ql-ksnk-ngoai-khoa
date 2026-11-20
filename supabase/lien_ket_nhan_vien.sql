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
