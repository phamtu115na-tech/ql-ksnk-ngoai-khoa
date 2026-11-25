import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const pg=new PGlite()
await pg.exec(`
create role anon;create role authenticated;create role service_role;
create table public.cx_people(id uuid primary key,active boolean,unit text);
create table public.cx_threads(id uuid primary key,source_row bigint,owner_id uuid,performers uuid[],
 kind text,units text[],status text,due date);
create table public.cx_messages(thread uuid,sender uuid,request_id uuid);
create table public.nk_legacy_rows(id bigint primary key,data jsonb);
create function public.nk_work_scope(a public.cx_people,t public.cx_threads)
returns boolean language sql stable as $f$
select a.active and a.unit='surgery' and (a.id=any(t.performers) or a.id=t.owner_id)
$f$;
create function public.cx_append(t uuid,who uuid,txt text,attachments jsonb,rid uuid,new_status text)
returns boolean language plpgsql as $f$
begin insert into public.cx_messages(thread,sender,request_id) values(t,who,rid);return true;end $f$;
`)
await pg.exec(fs.readFileSync('supabase/20261124_canh_bao_da_nhan_va_nhac_hang_ngay.sql','utf8'))
const staff='00000000-0000-0000-0000-000000000001'
const other='00000000-0000-0000-0000-000000000002'
const manager='00000000-0000-0000-0000-000000000003'
const outsider='00000000-0000-0000-0000-000000000004'
const task='00000000-0000-0000-0000-000000000011'
const reminder='00000000-0000-0000-0000-000000000012'
await pg.query("insert into cx_people values($1,true,'surgery'),($2,true,'surgery'),($3,true,'surgery'),($4,true,'surgery')",[staff,other,manager,outsider])
await pg.query("insert into nk_legacy_rows values(10,'{}'),(11,$1)",[JSON.stringify({'NHẮC HÀNG NGÀY':'có'})])
await pg.query("insert into cx_threads(id,source_row,owner_id,performers,kind,units,status) values($1,10,$3,array[$4,$5]::uuid[],'task',array['surgery'],'Mới'),($2,11,$3,array[$4]::uuid[],'reminder',array['surgery'],'Đang thực hiện')",[task,reminder,manager,staff,other])
const receive=async(who,id)=>(await pg.query('select nk_receive_work($1,$2) ok',[id,who])).rows[0].ok
const meta=async(who,ids)=>{
 const value=(await pg.query('select nk_warning_meta($1,$2::uuid[]) items',[who,ids])).rows[0].items
 return typeof value==='string'?JSON.parse(value):value
}
const taskBefore=(await meta(staff,[task]))[0]
assert.deepEqual(taskBefore.received_by,[])
assert.equal(taskBefore.daily,false)
assert.equal(await receive(manager,task),false,'manager cannot acknowledge for a performer')
assert.equal(await receive(staff,task),true)
assert.equal(await receive(staff,task),true,'receipt operation must be idempotent')
assert.equal((await pg.query('select count(*)::int n from cx_messages')).rows[0].n,1)
assert.deepEqual((await meta(staff,[task]))[0].received_by,[staff])
assert.deepEqual(await meta(outsider,[task]),[],'scope prevents exposing to unrelated viewer')
assert.equal((await meta(staff,[reminder]))[0].daily,true)
assert.equal((await meta(staff,[reminder]))[0].daily_done_today,false)
assert.equal((await meta(manager,[reminder]))[0].daily_done_all_today,false)
const daily=async(who,id)=>(await pg.query('select nk_daily_work_done($1,$2) ok',[who,id])).rows[0].ok
assert.equal(await daily(other,reminder),false,'other users cannot complete daily reminder')
assert.equal(await daily(staff,task),false,'non-daily task cannot be confirmed as recurring')
assert.equal(await daily(staff,reminder),true)
assert.equal(await daily(staff,reminder),true,'daily confirmation idempotent')
assert.equal((await pg.query('select count(*)::int n from nk_daily_work_confirmations')).rows[0].n,1)
assert.equal((await meta(staff,[reminder]))[0].daily_done_today,true)
assert.equal((await meta(manager,[reminder]))[0].daily_done_all_today,true)
await pg.query("update nk_daily_work_confirmations set day=day-interval '1 day'")
assert.equal((await meta(staff,[reminder]))[0].daily_done_today,false,'new day reactivates the reminder')
assert.equal(await daily(staff,reminder),true)
assert.equal((await pg.query('select count(*)::int n from nk_daily_work_confirmations')).rows[0].n,2)
await pg.query("update cx_threads set status='Hoàn thành' where id=$1",[reminder])
assert.equal(await daily(staff,reminder),false,'fully completed recurring reminder must not reappear')
await pg.close()
console.log('PASS persistent work receipts and daily log: idempotent, scoped, next-day reset and terminal state')
