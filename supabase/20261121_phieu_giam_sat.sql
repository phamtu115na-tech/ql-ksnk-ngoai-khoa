begin;
create table if not exists nk_checklist_versions(
 id bigint generated always as identity primary key, form_id text not null,
 actor_id uuid not null references cx_people(id), request_id uuid not null,
 header jsonb not null,details jsonb not null,previous_header jsonb,previous_details jsonb,
 created_at timestamptz not null default now(),unique(actor_id,request_id)
);
alter table nk_checklist_versions enable row level security;
revoke all on nk_checklist_versions from public,anon,authenticated;
grant select,insert on nk_checklist_versions to service_role;
create index if not exists nk_checklist_versions_form on nk_checklist_versions(form_id,id desc);
create or replace function nk_save_checklist(who uuid,rid uuid,header jsonb,marks jsonb,existing_row int,expected_header jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare a cx_people; prev ksnk_legacy_rows; prevmarks jsonb; oldmark ksnk_legacy_rows;
 field jsonb; final_header jsonb; form_id text; next_no int; row_num int; result jsonb; known int[];
begin
 select * into a from cx_people where id=who and active and unit='surgery';
 if not found or not(a.admin or (a.legacy_operator or a.team_lead) and a.work_edit and a.work_view) then raise exception 'Thiếu quyền chấm phiếu';end if;
 if rid is null or jsonb_typeof(marks)<>'array' or jsonb_array_length(marks)=0 then raise exception 'Phiếu rỗng';end if;
 if not(a.admin or a.legacy_operator) then
  if nullif(trim(coalesce(nullif(a.team_department,''),a.department)),'') is null or cx_key(coalesce(nullif(a.team_department,''),a.department)) is distinct from cx_key(header->>'Bộ phận')
  or not exists(select from ksnk_legacy_rows where sheet_name='DM_NHANVIEN' and cx_source_unit(data)='surgery' and nullif(data->>'Mã NV','')=header->>'Mã NV' and cx_key(data->>'Bộ phận')=cx_key(header->>'Bộ phận')) then raise exception 'Ngoài phạm vi bộ phận';end if;
 end if;
 perform pg_advisory_xact_lock(115,211126);
 select jsonb_build_object('id',v.form_id,'row_no',(v.header->>'row_no')::int) into result from nk_checklist_versions v where v.actor_id=who and v.request_id=rid;
 if found then return result;end if;
 if coalesce(existing_row,0)>0 then
  select * into prev from ksnk_legacy_rows where sheet_name='PHIEU_GIAMSAT' and row_no=existing_row and cx_source_unit(data)='surgery' for update;
  if not found or prev.data is distinct from expected_header then raise exception 'Phiếu vừa thay đổi. Tải lại trước khi lưu';end if;
  if not(a.admin or a.legacy_operator) and cx_key(prev.data->>'Bộ phận') is distinct from cx_key(header->>'Bộ phận') then raise exception 'Ngoài phạm vi bộ phận';end if;
  form_id=coalesce(nullif(prev.data->>'Mã phiếu',''),prev.data->>'ID');row_num=prev.row_no;
  if nullif(form_id,'') is null then raise exception 'Thiếu mã phiếu gốc';end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.row_no),'[]'),array_agg(d.row_no order by d.row_no) into prevmarks,known
  from ksnk_legacy_rows d where d.sheet_name='CT_PHIEU_GIAMSAT' and cx_source_unit(d.data)='surgery' and coalesce(nullif(d.data->>'Mã phiếu',''),nullif(d.data->>'Mã phiếu giám sát',''),nullif(d.data->>'Form ID',''),d.legacy_id)=form_id;
  if coalesce(known,'{}'::int[]) is distinct from array(select (v->>'row_no')::int from jsonb_array_elements(marks) v order by (v->>'row_no')::int) then raise exception 'Danh sách lượt chấm đã thay đổi';end if;
 else
  form_id='PGS-'||rid::text;
  select coalesce(max(row_no),0)+1 into row_num from ksnk_legacy_rows where sheet_name='PHIEU_GIAMSAT';
 end if;
 final_header=coalesce(prev.data,'{}')||header||jsonb_build_object('Mã phiếu',form_id,'Thời gian lưu',now(),'Phiên bản phiếu',rid);
 if prev.id is null then insert into ksnk_legacy_rows(sheet_name,row_no,legacy_id,data) values('PHIEU_GIAMSAT',row_num,form_id,final_header);
 else update ksnk_legacy_rows set data=final_header where id=prev.id;end if;
 select coalesce(max(row_no),0)+1 into next_no from ksnk_legacy_rows where sheet_name='CT_PHIEU_GIAMSAT';
 for field in select * from jsonb_array_elements(marks) loop
  if (field->>'Kết quả') is null then raise exception 'Thiếu kết quả';end if;
  if prev.id is null then insert into ksnk_legacy_rows(sheet_name,row_no,legacy_id,data) values('CT_PHIEU_GIAMSAT',next_no,form_id,(field-'row_no')||jsonb_build_object('Mã phiếu',form_id));next_no=next_no+1;
  else update ksnk_legacy_rows set data=data||(field-'row_no')||jsonb_build_object('Mã phiếu',form_id) where sheet_name='CT_PHIEU_GIAMSAT' and row_no=(field->>'row_no')::int;end if;
 end loop;
 insert into nk_checklist_versions(form_id,actor_id,request_id,header,details,previous_header,previous_details) values(form_id,who,rid,jsonb_build_object('row_no',row_num,'data',final_header),marks,prev.data,prevmarks);
 return jsonb_build_object('id',form_id,'row_no',row_num);
end $$;
revoke all on function nk_save_checklist(uuid,uuid,jsonb,jsonb,int,jsonb) from public,anon,authenticated;
grant execute on function nk_save_checklist(uuid,uuid,jsonb,jsonb,int,jsonb) to service_role;
create or replace function nk_checklist_evidence_access(who uuid, ref text, editing boolean)
returns boolean language sql stable set search_path=public as $$
 select count(*)=1 and coalesce(bool_and(cx_source_unit(r.data)='surgery' and a.active and a.unit='surgery'
   and a.team_lead and a.work_view and (not editing or a.work_edit)
   and nullif(cx_key(coalesce(nullif(a.team_department,''),a.department)),'')=cx_key(r.data->>'Bộ phận')),false)
 from ksnk_legacy_rows r cross join cx_people a
 where a.id=who and r.sheet_name='PHIEU_GIAMSAT'
 and coalesce(nullif(r.data->>'Mã phiếu',''),r.data->>'ID')=split_part(ref,':',1)
$$;
revoke all on function nk_checklist_evidence_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function nk_checklist_evidence_access(uuid,text,boolean) to service_role;
commit;
