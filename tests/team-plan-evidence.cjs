const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const people=[
 {id:'h',name:'Trần Thị Hiếu',unit:'surgery',active:true,admin:false,team_lead:true,team_department:'BVNK115 | KSNK - Tổ Vệ sinh môi trường',department:'BVNK115 | KSNK - Tổ Vệ sinh môi trường'},
 {id:'t',name:'Nguyễn Thị Thu',unit:'surgery',active:true,admin:false,team_lead:true,team_department:'BVNK115 | KSNK - Tổ Giám sát',department:'BVNK115 | KSNK - Tổ Giám sát'},
 {id:'p',name:'Phạm Thị Hảo',unit:'surgery',active:true,admin:false,team_lead:true,team_department:'BVNK115 | KSNK - Tổ Dụng cụ',department:'BVNK115 | KSNK - Tổ Dụng cụ'}
]
const records=people.map((person,i)=>({
 row_no:i+1,legacy_id:'KHT-TEAM-'+(i+1),data:{'Bộ phận':person.department,'Người phụ trách':person.name,'Mã KH':'KHT-TEAM-'+(i+1)}
}))
const uploads=records.map(x=>({id:'img-'+x.row_no,legacy_id:x.legacy_id,module:'plans',storage_path:'plans/'+x.legacy_id+'/proof.jpg',file_name:'proof.jpg',mime_type:'image/jpeg'}))
let signedIn=people[0],viewScope='team'
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim()
const mocks={
 'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
 '../../../lib/auth':{actor:async()=>signedIn},
 '../../../lib/supabase':{effectiveSupabaseUrl:()=> 'https://storage.supabase.co',supabaseAdmin:()=>({
  from(table){
   if(table==='nk_legacy_rows')return {select(){return this},in:async()=>({data:records,error:null})}
   if(table==='ksnk_evidence')return {
    list:uploads,select(){return this},
    eq(key,value){this.list=this.list.filter(item=>String(item[key])===String(value));return this},
    async order(){return {data:this.list,error:null}},
    async limit(){return {data:this.list,error:null}}
   }
   throw Error('Unexpected table '+table)
  },
  storage:{from:()=>({download:async()=>({data:new Blob(['image-bytes']),error:null})})}
 })},
 '../../../lib/evidence-url':{evidenceStoragePath:()=>null},
 '../../../lib/feature-permissions':{
  featureScope:async(_user,feature,action)=>{
   assert.equal(feature,'plans');assert.equal(action,'view');return viewScope
  },
  inFeatureScope:(user,scope,department,staffId,owner)=>scope==='hospital'||
   scope==='team'&&normalize(user.team_department)===normalize(department)||
   scope==='self'&&normalize(user.name)===normalize(owner)
 }
}
const routeExports={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/evidence/route.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports:routeExports,require:name=>mocks[name]||require(name),URL,Response,Request,Blob,process,Buffer,console})
const {GET}=routeExports
;(async()=>{
 for(let i=0;i<people.length;i++){
  signedIn=people[i]
  for(let j=0;j<records.length;j++){
   const url='https://test.local/api/evidence?module=plans&legacy_id='+records[j].legacy_id
   const response=await GET(new Request(url))
   assert.equal(response.status,i===j?200:403,people[i].name+' may only view own-team plan evidence')
   if(i===j){
    const files=(await response.json()).files
    assert.equal(files.length,1)
    const opened=await GET(new Request('https://test.local'+files[0].url))
    assert.equal(opened.status,200,'same team may open real file')
   }
  }
 }
 signedIn=people[0];viewScope='none'
 const revoked=await GET(new Request('https://test.local/api/evidence?module=plans&legacy_id='+records[0].legacy_id))
 assert.equal(revoked.status,403,'matrix revocation must block plan evidence')
 console.log('PASS plan evidence: 3 team leaders, same-team visibility, cross-team denial, open and revocation')
})().catch(error=>{console.error(error);process.exitCode=1})
