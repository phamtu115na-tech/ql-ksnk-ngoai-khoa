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
