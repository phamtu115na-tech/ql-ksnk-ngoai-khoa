const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
require.extensions['.ts']=(m,p)=>m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,p)
const {aggregate,severity,defaults,ranked,validScale}=require('../lib/matrix.ts')
const mark=(result,i)=>({row_no:i,formId:'f'+i,criterionId:i===0?'B':'A',group:'Nhóm',content:'Vệ sinh tay',name:'A',staffId:i%2?'nv01':'nv02',date:'2026-11-21',result})
const marks=[...Array(85).fill('Đạt'),...Array(10).fill('Không đạt'),...Array(5).fill('Kém'),'Không áp dụng',''].map(mark)
const [total]=aggregate(marks,'form')
assert.deepEqual([total.passRate,total.errorRate,total.total,total.na,total.missing],[85,15,100,1,1])
assert.equal(aggregate(marks,'group')[0].errorRate,15)
assert.equal(aggregate(marks,'staff').length,2)
assert.equal(ranked(marks,'criterion','pareto',5)[0].key,'A')
assert.equal(severity(total,'rate',defaults),3)
assert.equal(severity(total,'count',defaults),4)
const [empty]=aggregate([mark('N/A',1)],'staff')
assert.equal(empty.passRate,null)
assert.equal(severity(empty,'rate',defaults),-1)
assert.equal(validScale({...defaults,count:[0,2,2,7]}),false)
const {briefingGraphs}=require('../lib/briefing-charts.ts')
const vsmRows=[
 ['VSMT-P02','Trang phục và phương tiện phòng hộ cá nhân',80,80,0,0,100,0,''],
 ['VSMT-P02','Xe vệ sinh, hóa chất',76,76,0,0,100,0,''],
 ['VSMT-P02','Nhà vệ sinh và chất thải',73,73,0,0,100,0,''],
 ['VSMT-P02','Thùng chất thải hành lang',70,70,0,0,100,0,''],
 ['VSMT-P02','Rác tại khu vực',68,68,0,0,100,0,''],
 ['KHAC','Tiêu chí khác',0,0,0,0,null,null,'']
]
const [graph]=briefingGraphs(vsmRows)
assert.equal(graph.formCode,'VSMT-P02')
assert.equal(graph.labels.length,5)
assert.equal(graph.total,367)
assert.deepEqual(graph.pass,[100,100,100,100,100])
assert.deepEqual(graph.fail,[0,0,0,0,0])
const {excel,powerpoint}=require('../lib/export-matrix.ts')
;(async()=>{
 const data={title:'Kiểm thử',department:'Tổ A',period:'Tháng 11',columns:['Tiêu chí','Tỷ lệ'],rows:Array.from({length:140},(_,i)=>['Tiêu chí '+i,85])}
 const bytes=await excel(data),book=new (require('exceljs').Workbook)()
 await book.xlsx.load(bytes)
 assert.equal(book.worksheets[0].getCell('B143').value,85)
 const examplePng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YKXH1IAAAAASUVORK5CYII='
 const withChart=new (require('exceljs').Workbook)()
 await withChart.xlsx.load(await excel({...data,chartImage:examplePng,chartCaption:'Theo tiêu chí · Thanh chồng 100% · Top 10'}))
 assert.equal(withChart.worksheets[0].name,'Biểu đồ')
 assert.equal(withChart.worksheets[1].name,'Ma trận')
 assert.equal(withChart.worksheets[0].getImages().length,1,'Excel contains the currently selected chart')
 assert.match(withChart.worksheets[0].getCell('A5').value,/Thanh chồng 100%/)
 const combo=await powerpoint({...data,kind:"pareto",chart:{labels:["A","B"],pass:[75,0],fail:[25,100],errors:[2,1],passed:[6,0]}})
 const chartZip=await require("jszip").loadAsync(combo);assert.ok(chartZip.file("ppt/charts/chart1.xml"))
 const zip=await require('jszip').loadAsync(await powerpoint(data))
 const slides=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p))
 assert.ok(slides.length>2)
 const xml=(await Promise.all(slides.map(k=>zip.file(k).async('string')))).join('')
 assert.ok(xml.replace(/<[^>]*>/g,'').includes('Tiêu chí 139'))
 console.log('PASS: tỷ lệ có trọng số, N/A, dữ liệu rỗng, phạm vi tổng hợp, ngưỡng, XLSX và phân trang PPTX')
})().catch(e=>{console.error(e);process.exitCode=1})
