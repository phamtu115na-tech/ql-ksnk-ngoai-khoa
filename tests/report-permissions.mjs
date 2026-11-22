import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const pg=new PGlite()
await pg.exec("create role anon;create role authenticated;create role service_role;create table cx_people(id uuid primary key,active boolean,admin boolean,unit text,team_department text,department text,staff_code text);create table ksnk_legacy_rows(sheet_name text,row_no integer,data jsonb,legacy_id text);create function cx_key(text) returns text language sql immutable as $$select lower(trim($1))$$;create function cx_source_unit(jsonb) returns text language sql immutable as $$select coalesce($1->>'unitId','surgery')$$;")
await pg.exec(fs.readFileSync('supabase/20261121_quyen_bao_cao.sql','utf8'))
const ids=[1,2,3].map(i=>'00000000-0000-0000-0000-00000000000'+i)
for(const [i,id] of ids.entries())await pg.query("insert into cx_people values ($1,true,$2,'surgery',null,'A',$3)",[id,i===0,'nv'+i])
for(const [i,dept,unit] of [[1,'A','surgery'],[2,'B','surgery'],[3,'A','general']]){
 for(const [sheet,data] of [['PHIEU_GIAMSAT',{'Mã NV':'nv'+i,'Bộ phận':dept}],['CT_PHIEU_GIAMSAT',{'Kết quả':'Đạt'}]])
 await pg.query('insert into ksnk_legacy_rows values($1,$2,$3,null)',[sheet,i,JSON.stringify({...data,'Mã phiếu':'f'+i,unitId:unit})])
}
const grant=(who,scope,exp,version=null)=>pg.query('select nk_report_grant($1,$2,$3,$4,$5) ok',[who,ids[1],scope,exp,version]).then(r=>r.rows[0].ok)
const marks=exp=>pg.query('select form_id from nk_matrix_marks($1,$2,0,100)',[ids[1],exp]).then(r=>r.rows.map(x=>x.form_id))
assert.equal(await grant(ids[2],'hospital',true),false)
assert.equal(await grant(ids[0],'team',false),true)
assert.deepEqual(await marks(false),['f1'])
assert.deepEqual(await marks(true),[])
assert.equal(await grant(ids[0],'hospital',true),false)
const version=async()=>(await pg.query('select version from nk_report_permissions')).rows[0].version
assert.equal(await grant(ids[0],'hospital',true,await version()),true)
assert.deepEqual(await marks(true),['f1','f2'])
assert.equal(await grant(ids[0],'none',false,await version()),true)
assert.deepEqual(await marks(false),[])
assert.equal((await pg.query('select * from nk_report_permission_history')).rows.length,3)
console.log('PASS SQL: scoped rows, hospital isolation, per-action export, stale write, audit and revocation')
await pg.close()
