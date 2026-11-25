import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const pg=new PGlite()
await pg.exec(`
create role anon;create role authenticated;create role service_role;
create table public.cx_people(id uuid primary key,username text,name text,active boolean,unit text,admin boolean default false,
 legacy_operator boolean default false,team_lead boolean default false,work_role_reviewed boolean default false,
 work_view boolean default true,work_edit boolean default false,team_department text,department text,staff_code text);
create table public.ksnk_legacy_rows(id bigint generated always as identity primary key,
 sheet_name text,row_no integer,legacy_id text,data jsonb default '{}'::jsonb);
create table public.nk_legacy_rows(id bigint generated always as identity primary key,
 sheet_name text,row_no integer,legacy_id text,data jsonb default '{}'::jsonb);
create table public.cx_threads(id uuid primary key,kind text,title text,note text,due date,owner_id uuid,performers uuid[],observers uuid[],units text[],source_row bigint,seq integer default 0,source_creator_id uuid);
create table public.cx_work_people(source_id bigint,role text,token text,unit text,staff_code text);
create table public.cx_staff_catalog(unit text,code text,copies integer,name text);
create table public.cx_messages(thread uuid,sender uuid,request_id uuid);
create table public.nk_personal_work_notes(thread uuid,person uuid,note text,primary key(thread,person));
create function public.cx_key(text) returns text language sql immutable as $$select lower(trim(coalesce($1,'')))$$;
create function public.cx_source_unit(jsonb) returns text language sql immutable as $$select coalesce($1->>'unitId','surgery')$$;
create function public.cx_append(uuid,uuid,text,jsonb,uuid) returns boolean language sql as $$select true$$;
`)
for(const name of ['20261123_ma_tran_cap_quyen_dong','20261124_quy_tac_quyen_theo_chuc_vu','20261124_uy_quyen_giao_viec_theo_ma_tran'])
 await pg.exec(fs.readFileSync('supabase/'+name+'.sql','utf8'))
const admin='00000000-0000-0000-0000-000000000001'
const employee='00000000-0000-0000-0000-000000000002'
const other='00000000-0000-0000-0000-000000000003'
const teamWork='00000000-0000-0000-0000-000000000010'
const outsideWork='00000000-0000-0000-0000-000000000011'
await pg.query("insert into cx_people(id,name,username,active,unit,admin,department,staff_code) values($1,'Admin','admin',true,'surgery',true,'A','AD'),($2,'Worker','worker',true,'surgery',false,'A','WA'),($3,'Other','other',true,'surgery',false,'B','WB')",[admin,employee,other])
await pg.query("insert into nk_role_permission_defaults(role,grants,changed_by) values('staff',$1,$2)",[JSON.stringify({tasks:{view:'team',edit:'team'}}),admin])
await pg.query("insert into ksnk_legacy_rows(sheet_name,row_no,legacy_id,data) values('GIAO VIỆC',1,'T1',$1),('GIAO VIỆC',2,'T2',$2)",[JSON.stringify({'Bộ phận':'A'}),JSON.stringify({'Bộ phận':'B'})])
await pg.query("insert into cx_threads(id,kind,title,owner_id,performers,observers,units,source_row) values($1,'task','A',$3,'{}','{}',array['surgery'],1),($2,'task','B',$3,'{}','{}',array['surgery'],2)",[teamWork,outsideWork,other])
const check=async(id)=> (await pg.query('select nk_check_work($1,$2) ok',[employee,id])).rows[0].ok
// nk_check_work may already exist in the real schema; test scope directly here.
const scope=async(id)=>(await pg.query('select nk_work_scope(a,t) ok from cx_people a,cx_threads t where a.id=$1 and t.id=$2',[employee,id])).rows[0].ok
assert.equal(await scope(teamWork),true,'role-wide team view sees only staff department')
assert.equal(await scope(outsideWork),false,'role-wide team view does not see other department')
await pg.query('insert into nk_feature_permissions(person,grants,changed_by) values($1,$2,$3)',[employee,JSON.stringify({tasks:{view:'hospital',edit:'hospital'}}),admin])
assert.equal(await scope(outsideWork),true,'explicit staff hospital delegation applies')
await pg.query('update nk_feature_permissions set grants=$2 where person=$1',[employee,JSON.stringify({tasks:{view:'none',edit:'none'}})])
assert.equal(await scope(teamWork),false,'individual revoke overrides role defaults')
await pg.close()
console.log('PASS SQL work scope delegation and revocation')
