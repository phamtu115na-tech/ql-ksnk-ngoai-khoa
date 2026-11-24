const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const moduleExports={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/work-warning-policy.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports:moduleExports,require,console})
const {workWarningReasons:reasons}=moduleExports
const today='2026-11-24',who='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002'
const make=(extra={},unread=0)=>({item:{id:'t',kind:'task',title:'Kiểm tra vệ sinh',status:'Mới',
 due:'2026-11-30',owner_id:other,performers:[who,other],received_by:[],...extra},unread})
assert.deepEqual(reasons(make(),who,false,today),['Mới giao'])
assert.deepEqual(reasons(make({received_by:[who]}),who,false,today),[])
assert.deepEqual(reasons(make({received_by:[who]}),other,true,today),['Mới giao'])
assert.deepEqual(reasons(make({received_by:[who,other]}),other,true,today),[])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:today}),who,false,today),['Đến hạn hôm nay'])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:'2026-11-20'}),who,false,today),['Quá hạn'])
assert.deepEqual(reasons(make({status:'Hoàn thành',due:'2026-11-20'}),who,false,today),[])
assert.deepEqual(reasons(make({status:'Hoàn thành',due:'2026-11-20'},1),who,false,today),['Tin chưa đọc'])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:'2026-11-20'},1),who,false,today),['Quá hạn','Tin chưa đọc'])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:null,daily:true,kind:'reminder',daily_done_today:false}),who,false,today),['Nhắc hằng ngày'])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:null,daily:true,kind:'reminder',daily_done_today:true}),who,false,today),[])
assert.deepEqual(reasons(make({status:'Hoàn thành',due:null,daily:true,kind:'reminder',daily_done_today:false}),who,false,today),[])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:'2026-11-25',daily:true,kind:'reminder'}),who,false,today),[])
assert.deepEqual(reasons(make({status:'Đang thực hiện',due:'2026-11-20',daily:true,kind:'reminder'}),who,false,today),['Nhắc hằng ngày'])
console.log('PASS independent work warnings: received, due, overdue, unread, recurring and completed')
