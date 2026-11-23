import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const pg=new PGlite()
await pg.exec(`
create role anon; create role authenticated; create role service_role;
create table public.cx_people(id uuid primary key,unit text,active boolean,admin boolean);
`)
await pg.exec(fs.readFileSync('supabase/20261123_ma_tran_cap_quyen_dong.sql','utf8'))
const [admin,staff,other]=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003']
await pg.query("insert into cx_people values($1,'surgery',true,true),($2,'surgery',true,false),($3,'surgery',true,false)",[admin,staff,other])
const fn=async(who,version,grants)=>pg.query('select nk_set_feature_permissions($1,$2,$3,$4) ok',[who,staff,JSON.stringify(grants),version]).then(x=>x.rows[0].ok)
const grant={checklists:{view:'team',create:'team',edit:'team',delete:'team'},reports:{view:'team',export:'team'}}
assert.equal(await fn(other,null,grant),false,'ordinary staff cannot grant')
assert.equal(await fn(admin,null,grant),true,'admin can grant')
let state=(await pg.query('select grants,version from nk_feature_permissions where person=$1',[staff])).rows[0]
assert.deepEqual(state.grants,grant,'stored matrix should match')
assert.equal(await fn(admin,null,{}),false,'stale version cannot overwrite')
assert.equal(await fn(admin,state.version,{checklists:{view:'team',delete:'none'}}),true,'admin can revoke')
state=(await pg.query('select grants from nk_feature_permissions where person=$1',[staff])).rows[0]
assert.equal(state.grants.checklists.delete,'none')
assert.equal((await pg.query('select count(*)::int n from nk_feature_permission_history where person=$1',[staff])).rows[0].n,2)
await pg.close()
console.log('PASS dynamic permission grants: admin check, optimistic locking, audit, revocation')
