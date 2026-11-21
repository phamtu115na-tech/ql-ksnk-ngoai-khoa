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

