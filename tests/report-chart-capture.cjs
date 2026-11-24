const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const exportsOfModule={}
const source=ts.transpileModule(fs.readFileSync('lib/report-chart-capture.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText
vm.runInNewContext(source,{exports:exportsOfModule,require,console,
 getComputedStyle:element=>({visibility:element.visibility||'visible'})})
const {captureVisibleReportCharts,fitChartImage}=exportsOfModule
const png='data:image/png;base64,'+'A'.repeat(160)
const label='8.1 — VSMT-P02 — GIÁM SÁT NHANH VỆ SINH MÔI TRƯỜNG'
const values=[
 ['Số phiếu','75'],['Lượt tiêu chí hợp lệ','367'],
 ['Đạt','367'],['Không đạt/Kém','0'],['Tỷ lệ đạt','100%']
]
const metricEls=values.map(([name,value])=>({querySelector:q=>q==='small'?{textContent:name}:q==='b'?{textContent:value}:null}))
const panel={
 querySelector:q=>q==='.report-matrix-head'?{textContent:label}:null,
 querySelectorAll:q=>q==='.report-matrix-metrics > div'?metricEls:[]
}
let dataURL=()=>png
const canvas={width:1800,height:570,getClientRects:()=>[{}],toDataURL:()=>dataURL()}
const figure={
 getClientRects:()=>[{}],dataset:{chartCaption:'Theo tiêu chí · Thanh chồng 100% · Top 10'},
 querySelector:q=>q==='canvas'?canvas:null,
 closest:q=>q==='.report-matrix-card'?panel:null
}
const root={querySelectorAll:q=>q==='[data-export-chart]'?[figure]:[]}
let charts=captureVisibleReportCharts(root,'Báo cáo giám sát')
assert.equal(charts.length,1)
assert.equal(charts[0].title,label)
assert.equal(charts[0].caption,'Theo tiêu chí · Thanh chồng 100% · Top 10')
assert.equal(charts[0].metrics.length,5)
assert.equal(charts[0].metrics[0].value,'75')
assert.equal(charts[0].metrics[4].value,'100%')
assert.equal(charts[0].png,png)
const fit=fitChartImage(charts[0].ratio,11.9,3.1)
assert.ok(fit.w<=11.9&&fit.h<=3.1)
assert.ok(Math.abs(fit.w/fit.h-charts[0].ratio)<1e-9)
figure.visibility='hidden'
assert.equal(captureVisibleReportCharts(root,'Báo cáo').length,0,'hidden chart must not export')
figure.visibility='visible'
dataURL=()=> 'data:,'
assert.throws(()=>captureVisibleReportCharts(root,'Báo cáo'),/chưa được vẽ xong/)
assert.throws(()=>fitChartImage(0,10,3),/không hợp lệ/)
console.log('PASS report chart: chosen VSMT-P02 bar, five metrics, chart image sizing, visibility and render errors')
