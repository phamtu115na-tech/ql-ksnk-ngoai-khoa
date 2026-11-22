import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const pg=new PGlite()
const [owner,lead,chief,other,thread]=Array.from({length:5},()=>crypto.randomUUID())
await pg.exec(`
create role anon; create role authenticated; create role service_role;
create table cx_people(id uuid primary key,active boolean default true,unit text default 'surgery',admin boolean default false,legacy_operator boolean default false,team_lead boolean default false,work_view boolean default true,work_edit boolean default true,team_department text,department text);
create table cx_threads(id uuid primary key,source_row bigint,kind text,units text[],owner_id uuid,performers uuid[],observers uuid[],title text,note text,due date,seq int default 0);
create table cx_messages(thread uuid,sender uuid,request_id uuid);
create table nk_personal_work_notes(thread uuid,person uuid,note text,primary key(thread,person));
create table ksnk_legacy_rows(id bigint generated always as identity primary key,row_no int,sheet_name text,data jsonb,legacy_id text);
create function cx_key(text) returns text language sql immutable as $$select lower(trim(coalesce($1,'')))$$;
create function cx_source_unit(jsonb) returns text language sql immutable as $$select coalesce($1->>'unitId','surgery')$$;
create function cx_append(uuid,uuid,text,jsonb,uuid) returns void language sql as $$insert into cx_messages values($1,$2,$5)$$;
`)
for(const migration of ['20261122_quyen_nguoi_lap','20261122_mo_day_du_tac_vu_ca_nhan','20261121_phieu_giam_sat'])await pg.exec(fs.readFileSync('supabase/'+migration+'.sql','utf8'))
await pg.query("insert into cx_people(id,department,team_lead,legacy_operator) values($1,'A',false,false),($2,'A',true,false),($3,'B',false,true),($4,'B',true,false)",[owner,lead,chief,other])
await pg.query("update cx_people set work_view=false,work_edit=false where id=$1",[owner])
await pg.query("insert into cx_threads(id,kind,units,owner_id,performers,observers) values($1,'task',array['surgery'],$2,array[$2]::uuid[],'{}')",[thread,owner])
const allowed=async who=>(await pg.query('select nk_work_scope(a,t) ok from cx_people a,cx_threads t where a.id=$1 and t.id=$2',[who,thread])).rows[0].ok
const edit=async who=>(await pg.query("select nk_save_detail($1,$2,0,$3,'Đã sửa','Nội dung',null,'',null) ok",[thread,who,crypto.randomUUID()])).rows[0].ok
for(const who of [owner,lead,chief]){assert.equal(await allowed(who),true);assert.equal(await edit(who),true)}
// Nhân viên bị tắt quyền quản lý chung vẫn mở được và sửa toàn bộ chi tiết việc có tên mình.
assert.equal((await pg.query('select title from cx_threads where id=$1',[thread])).rows[0].title,'Đã sửa')
// Người khác bộ phận không được phép xem hoặc sửa.

assert.equal(await allowed(other),false);assert.equal(await edit(other),false)
await pg.query("insert into ksnk_legacy_rows(row_no,sheet_name,data) values(1,'DM_NHANVIEN',$1),(2,'DM_NHANVIEN',$2)",[{'Mã NV':'NV1','Bộ phận':'A'},{'Mã NV':'NV2','Bộ phận':'B'}])
const save=async(who,department,staff,row=0,expected=null)=>pg.query('select nk_save_checklist($1,$2,$3,$4,$5,$6) result',[who,crypto.randomUUID(),JSON.stringify({'Mã NV':staff,'Bộ phận':department}),JSON.stringify([{'Kết quả':'Đạt',...(row?{row_no:1}:{})}]),row,expected?JSON.stringify(expected):null])
await save(chief,'A','NV1')
const header=(await pg.query("select data from ksnk_legacy_rows where sheet_name='PHIEU_GIAMSAT'")).rows[0].data
await save(lead,'A','NV1',1,header)
await assert.rejects(save(lead,'B','NV2'))
await assert.rejects(save(other,'B','NV2',1,header))
await assert.rejects(save(lead,'A','NV1',1,header))
await pg.close()
console.log('PASS tác vụ cá nhân, tổ trưởng đúng tổ, toàn khoa, sửa phiếu người khác lập và chặn sai tổ')
