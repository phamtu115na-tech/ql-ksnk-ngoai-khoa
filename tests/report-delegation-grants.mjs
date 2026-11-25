import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const pg=new PGlite()
await pg.exec(`
create role anon;create role authenticated;create role service_role;
create table cx_people(
 id uuid primary key, active boolean default true,unit text default 'surgery',
 admin boolean default false,legacy_operator boolean default false,
 team_lead boolean default false,work_role_reviewed boolean default false,
 work_view boolean default true,department text,team_department text,staff_code text
);
create table ksnk_legacy_rows(
 id bigint generated always as identity primary key,
 sheet_name text not null,row_no integer,legacy_id text,data jsonb not null
);
create function cx_key(text) returns text language sql immutable as $$select lower(trim(coalesce($1,'')))$$;
create function cx_source_unit(jsonb) returns text language sql immutable as $$select coalesce($1->>'unitId','surgery')$$;
`)
for(const file of ['20261121_quyen_bao_cao','20261123_ma_tran_cap_quyen_dong','20261123_dong_bo_bao_cao_ma_tran','20261124_quy_tac_quyen_theo_chuc_vu','20261124_bao_cao_quyen_uy_quyen'])
 await pg.exec(fs.readFileSync('supabase/'+file+'.sql','utf8'))
const [admin,chief,leader,staff,outsider]=[1,2,3,4,5].map(n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0'))
await pg.query(`insert into cx_people(id,admin,legacy_operator,team_lead,work_role_reviewed,department,team_department,staff_code) values
($1,true,false,false,false,'A',null,'A1'),
($2,false,true,false,false,'A',null,'A2'),
($3,false,false,true,true,'A','A','A3'),
($4,false,false,false,false,'A',null,'A4'),
($5,false,false,true,true,'B','B','B5')`,[admin,chief,leader,staff,outsider])
await pg.exec(`
insert into ksnk_legacy_rows(sheet_name,row_no,legacy_id,data) values
('PHIEU_GIAMSAT',1,'PG1','{"Mã phiếu":"PG1","Bộ phận":"A","Mã NV":"A4"}'),
('PHIEU_GIAMSAT',2,'PG2','{"Mã phiếu":"PG2","Bộ phận":"B","Mã NV":"B5"}'),
('CT_PHIEU_GIAMSAT',3,'PG1','{"Mã phiếu":"PG1","Kết quả":"Đạt"}'),
('CT_PHIEU_GIAMSAT',4,'PG2','{"Mã phiếu":"PG2","Kết quả":"Không đạt"}');
`)
const marks=async(who,exporting=false)=>(await pg.query('select * from nk_matrix_marks($1,$2,0,500)',[who,exporting])).rows.map(x=>x.form_id)
assert.deepEqual(await marks(admin),['PG1','PG2'])
assert.deepEqual(await marks(chief,true),['PG1','PG2'])
assert.deepEqual(await marks(leader,true),['PG1'])
assert.deepEqual(await marks(outsider,true),['PG2'])
assert.deepEqual(await marks(staff,true),[],'staff cannot export by default')
await pg.query('insert into nk_feature_permissions(person,grants,changed_by) values($1,$2,$3)',[leader,JSON.stringify({reports:{view:'team',export:'none'}}),admin])
assert.deepEqual(await marks(leader,true),[],'revoked export scope blocks reads')
await pg.query('update nk_feature_permissions set grants=$2 where person=$1',[leader,JSON.stringify({reports:{view:'none',export:'team'}})])
assert.deepEqual(await marks(leader),[],'view none must block access')
assert.deepEqual(await marks(leader,true),[],'export cannot exceed view')
await pg.query('update nk_feature_permissions set grants=$2 where person=$1',[leader,JSON.stringify({reports:{view:'hospital',export:'hospital'}})])
assert.deepEqual(await marks(leader,true),['PG1','PG2'],'an explicitly delegated team leader can view all hospital reports')
await pg.query("insert into nk_role_permission_defaults(role,grants,changed_by) values('staff',$1,$2)",[JSON.stringify({reports:{view:'hospital',export:'hospital'}}),admin])
assert.deepEqual(await marks(staff,true),['PG1','PG2'],'staff inherits role-wide delegated view/export')
await pg.query('insert into nk_feature_permissions(person,grants,changed_by) values($1,$2,$3)',[staff,JSON.stringify({reports:{view:'self',export:'none'}}),admin])
assert.deepEqual(await marks(staff,true),[],'specific staff grant overrides general job-role permissions')
await pg.close()
console.log('PASS delegated report SQL: explicit staff grants, role policies, data access and revocation')
