begin;
alter table cx_people add column if not exists can_approve_work boolean not null default false;
create table if not exists nk_work_events(
 id bigint generated always as identity primary key,thread uuid not null references cx_threads(id),
 sender uuid not null references cx_people(id),recipient uuid not null references cx_people(id),
 request_id uuid not null,kind text not null,body text not null default '',
 created_at timestamptz not null default now(),read_at timestamptz,handled_at timestamptz,
 unique(thread,request_id,recipient)
);
create index if not exists nk_work_event_recipient on nk_work_events(recipient,id desc);
alter table nk_work_events enable row level security;
revoke all on nk_work_events from public,anon,authenticated;
grant select,insert,update on nk_work_events to service_role;

create or replace function nk_work_decision(who uuid,work_id uuid,rid uuid,operation text,reviewer uuid,note text,expected text)
returns boolean language plpgsql set search_path=public as $$
declare t cx_threads;a cx_people;mgr cx_people;r ksnk_legacy_rows;d jsonb;history jsonb;
 state text;new_state text;target uuid;targets uuid[];event jsonb;assigned text;
begin
 select * into t from cx_threads where id=work_id and kind in ('task','reminder') for update;
 if not found then return false;end if;
 select * into a from cx_people where id=who and active and unit='surgery';
 if not found or not nk_work_scope(a,t) or not(a.admin or a.work_edit or (operation='request' and coalesce(t.owner_id=who,false))) then return false;end if;
 select * into r from ksnk_legacy_rows where id=t.source_row and sheet_name=case when t.kind='task' then 'GIAO VIỆC' else 'NHAC_VIEC_GHI_CHU' end for update;
 if not found then return false;end if;
 d=r.data;
 state=coalesce(nullif(d->>'Trạng thái phê duyệt',''),case when t.kind='task' then 'CHƯA XIN Ý KIẾN' else 'KHÔNG YÊU CẦU' end);
 if exists(select from nk_work_events where thread=t.id and sender=a.id and request_id=rid) then return true; end if;
 if state is distinct from expected or length(note)>2000 or rid is null then return false;end if;
 assigned=d->>'Tài khoản duyệt';
 if operation='request' then
  if not (coalesce(who=t.owner_id,false) or coalesce(who=any(t.performers),false)) or state in ('CHỜ PHÊ DUYỆT','ĐÃ PHÊ DUYỆT') or nullif(trim(note),'') is null then return false;end if;
  select * into mgr from cx_people where id=reviewer and active and unit='surgery' and id<>who and (admin or (can_approve_work and work_edit and (team_lead or legacy_operator))) and nk_work_scope(cx_people,t);
  if not found then return false;end if;
  new_state='CHỜ PHÊ DUYỆT';targets=array[mgr.id];
  d=d||jsonb_build_object('Người xin duyệt ID',who,'Tài khoản duyệt',mgr.id,'Người quản lý phê duyệt',mgr.name,'Mã người quản lý',mgr.staff_code,'Nội dung xin phê duyệt',note,'Thời gian xin phê duyệt',now());
 else
  if who=t.owner_id or who=any(t.performers) and who::text=d->>'Người xin duyệt ID' then return false;end if;
  if (a.admin or (a.can_approve_work and (a.legacy_operator or (a.work_role_reviewed and a.team_lead)) and (assigned=a.id::text or (assigned is null and nullif(a.staff_code,'')=d->>'Mã người quản lý')))) is not true then return false;end if;
  if operation='reopen' then
   if state<>'ĐÃ PHÊ DUYỆT' or nullif(trim(note),'') is null then return false;end if;
   new_state='YÊU CẦU BỔ SUNG';
  else
   if state<>'CHỜ PHÊ DUYỆT' or operation not in ('approve','supplement','reject') then return false;end if;
   if operation<>'approve' and nullif(trim(note),'') is null then return false;end if;
   new_state=case operation when 'approve' then 'ĐÃ PHÊ DUYỆT' when 'supplement' then 'YÊU CẦU BỔ SUNG' else 'TỪ CHỐI' end;
  end if;
  targets=array_append(t.performers,t.owner_id);
  d=d||jsonb_build_object('Phản hồi quản lý',note,'Ngày phê duyệt',now());
 end if;
 history=coalesce(nullif(d->>'Lịch sử phê duyệt',''),'[]')::jsonb;
 if jsonb_typeof(history)<>'array' then raise exception 'Lịch sử phê duyệt không hợp lệ';end if;
 event=jsonb_build_object('action',operation,'status',new_state,'at',now(),'actor',a.id,'managerName',a.name,'opinion',note,'requestId',rid);
 perform set_config('ksnk.reopening',case when operation='reopen' then t.id::text else '' end,true);
 update ksnk_legacy_rows set data=d||jsonb_build_object('Trạng thái phê duyệt',new_state,'Lịch sử phê duyệt',(history||jsonb_build_array(event))::text) where id=r.id;
 foreach target in array targets loop
  if target is not null then insert into nk_work_events(thread,sender,recipient,request_id,kind,body) values(t.id,a.id,target,rid,new_state,left(note,180)) on conflict do nothing;end if;
 end loop;
 update nk_work_events set handled_at=coalesce(handled_at,now()),read_at=coalesce(read_at,now()) where thread=t.id and recipient=a.id and request_id<>rid and handled_at is null;
 return true;
end $$;
create or replace function nk_lock_approved_work() returns trigger language plpgsql set search_path=public as $$
begin
 if old.sheet_name in ('GIAO VIỆC','NHAC_VIEC_GHI_CHU') and old.data->>'Trạng thái phê duyệt'='ĐÃ PHÊ DUYỆT' then
  if tg_op='DELETE' then raise exception 'Hãy mở lại tác vụ đã phê duyệt trước khi hủy'; end if;
  if new.data is distinct from old.data and not exists(select from cx_threads where source_row=old.id and id::text=current_setting('ksnk.reopening',true)) then raise exception 'Hãy mở lại tác vụ đã phê duyệt trước khi sửa';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists nk_approved_work_guard on ksnk_legacy_rows;
create trigger nk_approved_work_guard before update or delete on ksnk_legacy_rows for each row execute function nk_lock_approved_work();
revoke all on function nk_work_decision(uuid,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function nk_work_decision(uuid,uuid,uuid,text,uuid,text,text) to service_role;

create or replace function nk_my_work_events(who uuid)
returns table(id bigint,thread uuid,kind text,body text,created_at timestamptz,read_at timestamptz,handled_at timestamptz,cx_threads jsonb,cx_people jsonb,unread_total bigint)
language sql stable set search_path=public as $$
 select e.id,e.thread,e.kind,e.body,e.created_at,e.read_at,e.handled_at,
 jsonb_build_object('title',t.title,'kind',t.kind),jsonb_build_object('name',sender.name),
 count(*) filter(where e.read_at is null) over()
 from nk_work_events e join cx_threads t on t.id=e.thread join cx_people a on a.id=e.recipient
 join cx_people sender on sender.id=e.sender
 where e.recipient=who and a.active and nk_work_scope(a,t) and e.handled_at is null
 order by e.id desc limit 40
$$;
revoke all on function nk_my_work_events(uuid) from public,anon,authenticated;
grant execute on function nk_my_work_events(uuid) to service_role;
commit;
