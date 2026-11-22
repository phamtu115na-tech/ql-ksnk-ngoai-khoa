import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const pg=new PGlite()
await pg.exec("create role anon;create role authenticated;create role service_role;create table cx_people(id uuid primary key,name text,active boolean,admin boolean,unit text,work_edit boolean,team_lead boolean,work_role_reviewed boolean,legacy_operator boolean,staff_code text);create table cx_threads(id uuid primary key,source_row int,kind text,owner_id uuid,performers uuid[],title text);create table ksnk_legacy_rows(id int primary key,sheet_name text,data jsonb);create function nk_work_scope(cx_people,cx_threads) returns boolean language sql stable as $$select $1.active and $1.unit='surgery'$$;")
await pg.exec(fs.readFileSync('supabase/20261121_phe_duyet_tac_vu.sql','utf8'))
const ids=[1,2,3,4].map(i=>'00000000-0000-0000-0000-00000000000'+i)
for(let i=0;i<3;i++)await pg.query("insert into cx_people values($1,$2,true,false,'surgery',true,$3,true,false,$2,$3)",[ids[i],'NV'+i,i>0])
await pg.query("insert into cx_threads values($1,10,'task',$2,array[$2]::uuid[])",[ids[3],ids[0]])
await pg.query("insert into ksnk_legacy_rows values(10,'GIAO VIỆC','{}')")
const act=async(who,op,state,rev=null,rid=crypto.randomUUID())=>(await pg.query('select nk_work_decision($1,$2,$3,$4,$5,$6,$7) ok',[who,ids[3],rid,op,rev,'Nội dung thử',state])).rows[0].ok
await pg.query('update cx_people set work_edit=false where id=$1',[ids[0]])
const rid=crypto.randomUUID()
assert.equal(await act(ids[0],'request','CHƯA XIN Ý KIẾN',ids[1],rid),true)
assert.equal(await act(ids[0],'request','CHƯA XIN Ý KIẾN',ids[1],rid),true)
assert.equal(await act(ids[2],'approve','CHỜ PHÊ DUYỆT'),false)
assert.equal(await act(ids[1],'approve','CHỜ PHÊ DUYỆT'),true)
await assert.rejects(pg.query("update ksnk_legacy_rows set data='{}' where id=10"))
assert.equal(await act(ids[1],'reopen','ĐÃ PHÊ DUYỆT'),true)
assert.equal((await pg.query('select * from nk_work_events')).rows.length,3)
console.log('PASS SQL: assigned approval, retry, scope, lock, reopen, recipients')
await pg.close()
