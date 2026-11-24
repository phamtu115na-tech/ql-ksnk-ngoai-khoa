const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const routeExports={}
const fakeWindow={location:{origin:'https://ksnk.example.org'}}
const permissionLink='/api/evidence?open=1&id=image-115'
const makeLink=(href,alt,hidden=false)=>({
 getClientRects:()=>hidden?[]:[{}],
 getAttribute:name=>name==='href'?href:null,
 querySelector:name=>name==='img'?{getAttribute:()=>alt}:null,
 closest:name=>name==='tr'?{
  querySelector:key=>key==='.report-row-title'?{textContent:'Kiểm tra khung cửa, kệ cửa'}:
  key==='.report-row-meta'?{textContent:'Tổ Vệ sinh môi trường'}:null
 }:null,textContent:''
})
const links=[makeLink(permissionLink,'Ảnh thực tế'),makeLink(permissionLink,'Ảnh trùng'),
 makeLink('https://outside.example/track?open=1','Bên ngoài'),
 makeLink('/api/evidence?open=1&id=hidden','Ảnh ẩn',true)]
const context={
 exports:routeExports,require,URL,console,
 window:fakeWindow,
 getComputedStyle:()=>({visibility:'visible'}),
 Blob
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/report-evidence-export.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,context)
const {reportPhotoCandidates,readReportPhoto}=routeExports
const photos=reportPhotoCandidates({querySelectorAll:()=>links,querySelector:()=>null})
assert.equal(photos.length,1,'one valid photo; deduplicated')
assert.equal(photos[0].url,permissionLink)
assert.equal(photos[0].title,'Kiểm tra khung cửa, kệ cửa')
assert.match(photos[0].context,/Vệ sinh môi trường/)
;(async()=>{
 await assert.rejects(readReportPhoto('https://outside.example/file.jpg'),/không thuộc API/)
 await assert.rejects(readReportPhoto('/api/evidence?open=1&id=outside'),/fetch is not defined/)
 class FakeImage{naturalWidth=1600;naturalHeight=900;set src(value){this.onload?.()}}
 context.fetch=async()=>({ok:true,blob:async()=>new Blob(['fake image'],{type:'image/jpeg'})})
 context.Image=FakeImage
 context.document={createElement:()=>({
  getContext:()=>({fillRect:()=>{},drawImage:()=>{},set fillStyle(value){} }),
  toDataURL:()=> 'data:image/jpeg;base64,'+'A'.repeat(110)
 })}
 const image=await readReportPhoto(permissionLink)
 assert.equal(image.ratio,16/9)
 assert.ok(image.data.startsWith('data:image/jpeg;base64,'))
 context.fetch=async()=>({ok:false,status:403})
 await assert.rejects(readReportPhoto(permissionLink),/Không có quyền/)
 console.log('PASS reporting photos: authenticated evidence URLs, grouping, duplicates, exported image and access denial')
})().catch(err=>{console.error(err);process.exitCode=1})
