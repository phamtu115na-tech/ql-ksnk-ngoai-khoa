'use client'
import dynamic from 'next/dynamic'
import {useEffect,useMemo,useRef,useState} from 'react'
import {columns,dimensions,ranked,colors,defaults,identify,levels,severity,type Dimension,type Mark,type Metric} from '../lib/matrix'
const Chart=dynamic(()=>import('./MatrixChart'),{ssr:false})
const charts={table:'Bảng chi tiết',stack:'Thanh chồng 100%',bar:'Cột nhóm',horizontal:'Thanh ngang',donut:'Donut tổng hợp',line:'Đường theo ngày',area:'Vùng theo ngày',heat:'Bản đồ nhiệt',pareto:'Pareto'}
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('vi-VN',{maximumFractionDigits:1})+'%'
export default function MatrixExplorer({marks,form,code,filters,canExport}:{marks:Mark[];form:string;code:string;filters:Record<string,string>;canExport:boolean}){
 const chartRef=useRef<HTMLDivElement>(null)
 const [scale,setScale]=useState(defaults),[dim,setDim]=useState<Dimension>('criterion'),[kind,setKind]=useState('stack'),[limit,setLimit]=useState(10),[mode,setMode]=useState<'count'|'rate'>('rate'),[selected,select]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;fetch('/api/settings/matrix').then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);if(active){setScale({...defaults,...v.scale});setDim(v.scale.mode)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 const dimension=kind==='line'||kind==='area'?'day':dim
 const rows=useMemo(()=>ranked(marks,dimension,kind,limit),[marks,dimension,kind,limit])
 const tag=(r:Metric)=>{const level=severity(r,mode,scale);return level<0?(r.total?'Chưa đủ lượt':'Chưa có dữ liệu'):scale.labels[level]}
 async function download(format:'xlsx'|'pptx'){
  setBusy(true);setError('')
  try{
   const canvas=chartRef.current?.querySelector('canvas')
   const needsImage=format==='xlsx'&&!['table','heat'].includes(kind)&&rows.length>0
   const chartImage=needsImage&&canvas&&canvas.width&&canvas.height?canvas.toDataURL('image/png'):undefined
   if(needsImage&&(!chartImage||!chartImage.startsWith('data:image/png;base64,')))
    throw Error('Biểu đồ chưa vẽ xong. Hãy thử xuất lại sau khi biểu đồ hiển thị.')
   const chartCaption=[dimensions[dimension],charts[kind as keyof typeof charts]||kind,limit?'Top '+limit:'Tất cả'].join(' · ')
   const response=await fetch('/api/report/matrix-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format,filters,code,dimension,kind,limit,mode,chartImage,chartCaption})})
   if(!response.ok)throw Error('Không xuất được báo cáo. Hãy kiểm tra quyền và kết nối.')
   const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=code+'-ma-tran.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 return <section><div className="toolbar-line"><label>Phân tích <select value={dim} onChange={e=>{setDim(e.target.value as Dimension);setKind('stack');select(null)}}>{Object.entries(dimensions).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Dạng biểu đồ <select value={kind} onChange={e=>{setKind(e.target.value);select(null)}}>{Object.entries(charts).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Hiển thị <select value={limit} onChange={e=>setLimit(+e.target.value)}><option value={5}>Top 5</option><option value={10}>Top 10</option><option value={0}>Tất cả</option></select></label>
 <label>Cảnh báo theo <select value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="rate">Tỷ lệ không đạt</option><option value="count">Số lỗi</option></select></label></div>
 {rows.length>0&&!['table','heat'].includes(kind)&&<div ref={chartRef} data-export-chart="matrix" data-chart-caption={[dimensions[dimension],charts[kind as keyof typeof charts]||kind,limit?'Top '+limit:'Tất cả',mode==='rate'?'Cảnh báo theo tỷ lệ không đạt':'Cảnh báo theo số lỗi'].join(' · ')}>
  <Chart rows={rows} kind={kind} percent={true}/>
 </div>}
 <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key}><td><button onClick={()=>select(selected===r.key?null:r.key)}>{r.label}</button></td><td>{r.key}</td><td>{r.forms}</td><td>{r.total}</td><td>{r.pass}</td><td>{r.fail}</td><td>{r.poor}</td><td>{r.errors}</td><td>{fmt(r.passRate)}</td><td>{fmt(r.errorRate)}</td><td style={{borderLeft:'8px solid '+(scale.colors[severity(r,mode,scale)]||'#aaa'),background:kind==='heat'?(scale.colors[severity(r,mode,scale)]||'#aaa')+'40':undefined}}>{tag(r)}</td></tr>)}</tbody></table></div>
 {!rows.length&&<p>Chưa có dữ liệu giám sát trong kỳ.</p>}
 {selected!==null&&<details open><summary>Lịch sử chấm</summary><ul>{marks.filter(m=>identify(m,dimension)[0]===selected).map(m=><li key={m.row_no}>{[m.date,m.formId,m.name,m.content,m.result||'Chưa đánh giá'].join(' · ')}</li>)}</ul></details>}
 {canExport&&rows.length>0&&<div><button disabled={busy} onClick={()=>download('xlsx')}>Xuất Excel</button> <button disabled={busy} onClick={()=>download('pptx')}>Xuất PowerPoint</button></div>}{error&&<p role="alert">{error}</p>}</section>
}
