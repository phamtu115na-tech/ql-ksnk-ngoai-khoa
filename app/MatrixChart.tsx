'use client'
import {useEffect,useRef} from 'react'
import Chart from 'chart.js/auto'
import type {Metric} from '../lib/matrix'
export default function MatrixChart({rows,kind,percent}:{rows:Metric[];kind:string;percent:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  if(!canvas.current)return
  const labels=rows.map(r=>r.label),pass=rows.map(r=>percent?r.passRate:r.pass),fail=rows.map(r=>percent?r.errorRate:r.errors)
  const donut=kind==='donut',pareto=kind==='pareto',stack=kind==='stack',line=kind==='line'||kind==='area'
  const sum=rows.reduce((s,r)=>s+r.errors,0)
  let running=0
  const chart=new Chart(canvas.current,{type:donut?'doughnut':line?'line':'bar',data:{labels:donut?['Đạt','Không đạt và Kém']:labels,datasets:donut?[{data:[rows.reduce((s,r)=>s+r.pass,0),sum],backgroundColor:['#197446','#c64235']}]:pareto?[{type:'bar',label:'Số lỗi',data:rows.map(r=>r.errors),backgroundColor:'#cc5835'},{type:'line',label:'Tích lũy (%)',data:rows.map(r=>sum?(running+=r.errors)*100/sum:null),yAxisID:'right',borderColor:'#233f70'}]:[{label:'Đạt',data:pass,backgroundColor:'#197446',borderColor:'#197446',fill:kind==='area'},{label:'Không đạt và Kém',data:fail,backgroundColor:'#c64235',borderColor:'#c64235',fill:kind==='area'}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:kind==='horizontal'||stack?'y':'x',scales:donut?{}:pareto?{right:{position:'right',min:0,max:100}}:{x:{stacked:stack},y:{stacked:stack}},animation:false}})
  return ()=>chart.destroy()
 },[rows,kind,percent])
 return <div style={{height:Math.min(650,Math.max(260,rows.length*22)),position:'relative'}}><canvas ref={canvas} role="img" aria-label="Kết quả giám sát, số liệu chi tiết trong bảng"/></div>
}
