-- Additive. Work acknowledgement reuses existing signed/actor-checked receipt messages.
-- Daily completion is a separate dated log; no original task row is overwritten.
create table if not exists public.nk_daily_work_confirmations(
 thread uuid not null references public.cx_threads(id) on delete cascade,
 person uuid not null references public.cx_people(id) on delete cascade,
 day date not null,
 confirmed_at timestamptz not null default now(),
 primary key(thread,person,day)
);
create index if not exists nk_daily_work_confirmations_person_day_idx
 on public.nk_daily_work_confirmations(person,day desc);
alter table public.nk_daily_work_confirmations enable row level security;
revoke all on public.nk_daily_work_confirmations from public,anon,authenticated;
grant select,insert on public.nk_daily_work_confirmations to service_role;

create or replace function public.nk_warning_meta(who uuid,work_ids uuid[])
returns jsonb language sql stable set search_path=public as $function$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,
  'received_by',coalesce((select jsonb_agg(distinct m.sender)
    from public.cx_messages m where m.thread=t.id and m.request_id=m.sender
      and m.sender=any(t.performers)),'[]'::jsonb),
  'daily',coalesce(lower(coalesce(r.data->>'NHẮC HÀNG NGÀY',
     r.data->>'Nhắc hàng ngày',r.data->>'daily','')) in ('có','true','1','x','yes'),false),
  'daily_done_today',exists(select 1 from public.nk_daily_work_confirmations d
    where d.thread=t.id and d.person=who
      and d.day=(now() at time zone 'Asia/Ho_Chi_Minh')::date)
  )),'[]'::jsonb)
 from public.cx_threads t
 join public.cx_people a on a.id=who and a.active and a.unit='surgery'
 left join public.nk_legacy_rows r on r.id=t.source_row and t.kind='reminder'
 where t.id=any(work_ids) and t.kind in ('task','reminder') and t.units=array['surgery']
   and public.nk_work_scope(a,t)
$function$;
revoke all on function public.nk_warning_meta(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.nk_warning_meta(uuid,uuid[]) to service_role;

create or replace function public.nk_daily_work_done(who uuid,work_id uuid)
returns boolean language plpgsql set search_path=public as $function$
declare valid boolean;
begin
 select true into valid
 from public.cx_threads t
 join public.cx_people a on a.id=who and a.active and a.unit='surgery'
 join public.nk_legacy_rows r on r.id=t.source_row
 where t.id=work_id and t.kind='reminder' and t.units=array['surgery']
   and who=any(t.performers) and t.status not in ('Hoàn thành','Hủy')
   and public.nk_work_scope(a,t)
   and lower(coalesce(r.data->>'NHẮC HÀNG NGÀY',
     r.data->>'Nhắc hàng ngày',r.data->>'daily','')) in ('có','true','1','x','yes')
   and (t.due is null or t.due <= (now() at time zone 'Asia/Ho_Chi_Minh')::date);
 if not coalesce(valid,false) then return false; end if;
 insert into public.nk_daily_work_confirmations(thread,person,day)
 values(work_id,who,(now() at time zone 'Asia/Ho_Chi_Minh')::date)
 on conflict (thread,person,day) do nothing;
 return true;
end $function$;
revoke all on function public.nk_daily_work_done(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nk_daily_work_done(uuid,uuid) to service_role;

create or replace function public.nk_receive_work(t uuid,who uuid)
returns boolean language plpgsql set search_path=public as $function$
begin
 perform 1 from public.cx_threads th
  where th.id=t and th.kind in ('task','reminder')
   and th.units=array['surgery'] and who=any(th.performers) for update;
 if not found then return false; end if;
 -- A per-person receipt must not generate another notification when repeated.
 perform 1 from public.cx_messages m where m.thread=t
  and m.sender=who and m.request_id=who limit 1;
 if found then return true; end if;
 perform public.cx_append(t,who,'Đã xác nhận nhận việc.','[]'::jsonb,who,null);
 return true;
end $function$;
revoke all on function public.nk_receive_work(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nk_receive_work(uuid,uuid) to service_role;
