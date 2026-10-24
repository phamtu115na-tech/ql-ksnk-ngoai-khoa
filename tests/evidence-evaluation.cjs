const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(path,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>mocks[name]||require(name),URL,Response,Request,process,Buffer,console});return exports;}
const rules=load('lib/task-evaluation.ts');
for(const evaluation of ['', 'CHƯA BẮT ĐẦU', 'QUÁ HẠN'])assert.throws(()=>rules.requireManagerEvaluation('ĐANG LÀM','ĐÃ HOÀN THÀNH',evaluation));
for(const evaluation of ['XUẤT SẮC','TỐT','KHÁ','CHƯA ĐẠT','KÉM'])rules.requireManagerEvaluation('ĐANG LÀM','ĐÃ HOÀN THÀNH',evaluation);
rules.requireManagerEvaluation('ĐANG LÀM','ĐANG LÀM','');
rules.requireManagerEvaluation('ĐÃ HOÀN THÀNH','ĐÃ HOÀN THÀNH','');
const urls=load('lib/evidence-url.ts');
const origin='https://example.supabase.co';
const expired=origin+'/storage/v1/object/sign/documents/tasks/1/image.png?token=expired';
assert.equal(urls.evidenceStoragePath(expired,origin,'documents'),'tasks/1/image.png');
assert.equal(urls.evidenceStoragePath(expired,'https://other.supabase.co','documents'),null);
assert.equal(urls.evidenceStoragePath(expired,origin,'private'),null);
let authenticated=true,downloads=0;
const record={id:'test',storage_path:'tasks/1/image.png',file_name:'ảnh.png',mime_type:'image/png'};
const query={select(){return this},eq(){return this},limit:async()=>({data:[record]}),order:async()=>({data:[record]})};
const db={from:()=>query,storage:{from:()=>({download:async path=>{assert.equal(path,record.storage_path);downloads++;return {data:new Blob(['image-bytes'])}}})}};
const route=load('app/api/evidence/route.ts',{'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'../../../lib/auth':{hasSession:async()=>authenticated},'../../../lib/supabase':{supabaseAdmin:()=>db,effectiveSupabaseUrl:()=>origin},'../../../lib/evidence-url':urls});
(async()=>{
 let result=await route.GET(new Request('https://app.test/api/evidence?module=tasks&legacy_id=1'));
 const list=await result.json();assert.equal(list.files[0].url,'/api/evidence?open=1&id=test');assert.equal(list.files[0].storage_path,undefined);
 result=await route.GET(new Request('https://app.test/api/evidence?open=1&reference='+encodeURIComponent(expired)));
 assert.equal(result.status,200);assert.equal(await result.text(),'image-bytes');assert.match(result.headers.get('cache-control'),/no-store/);assert.equal(downloads,1);
 authenticated=false;result=await route.GET(new Request('https://app.test/api/evidence?open=1&id=test'));assert.equal(result.status,401);assert.equal(downloads,1);
 console.log('PASS: completion guards, expired references, trusted storage, stable file URLs, download and authentication');
})().catch(e=>{console.error(e);process.exitCode=1});
