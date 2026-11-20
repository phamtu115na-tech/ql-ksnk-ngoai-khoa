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
