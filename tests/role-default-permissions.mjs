import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
const pg=new PGlite()
await pg.exec(`
create role anon;create role authenticated;create role service_role;
create table public.cx_people(id uuid primary key,admin boolean,active boolean,unit text);
`)
await pg.exec(fs.readFileSync('supabase/20261124_quy_tac_quyen_theo_chuc_vu.sql','utf8'))
const admin='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002'
await pg.query('insert into cx_people values($1,true,true,\'surgery\'),($2,false,true,\'surgery\')',[admin,member])
const save=async(actor,role,grants,version=null)=>(
 await pg.query('select nk_set_role_permission_defaults($1,$2,$3,$4) ok',[actor,role,JSON.stringify(grants),version])
).rows[0].ok
const grant={reports:{view:'hospital',export:'team'},checklists:{view:'team',create:'team',edit:'team'}}
assert.equal(await save(member,'staff',grant),false,'non-admin cannot edit defaults')
assert.equal(await save(admin,'unknown',grant),false,'unknown job role is rejected')
assert.equal(await save(admin,'staff',grant),true,'admin can set staff role defaults')
const first=(await pg.query("select grants,version from nk_role_permission_defaults where role='staff'")).rows[0]
assert.deepEqual(first.grants,grant)
assert.equal(await save(admin,'staff',{},null),false,'optimistic locking prevents concurrent overwrite')
assert.equal(await save(admin,'staff',{reports:{view:'self',export:'none'}},first.version),true)
assert.equal((await pg.query("select count(*)::int n from nk_role_permission_history where role='staff'")).rows[0].n,2)
assert.equal(await save(admin,'chief',{}),true,'other role defaults can be configured independently')
await pg.close()
console.log('PASS job role permission policies: admin authorization, role selection, concurrency and audit')
