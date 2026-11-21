'use client'
import {useEffect,useState} from 'react'
import type {Template} from '../lib/report-template'
type Entry={key:string;version:string|null;template:Template}
export default function ReportTemplates(){
 const [rows,setRows]=useState<Entry[]>([]),[index,setIndex]=useState(0),[msg,message]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{fetch('/api/settings/templates').then(async r=>{if(r.ok)setRows(await r.json());else if(r.status!==403)message('Không đọc được mẫu báo cáo.')}).catch(()=>message('Lỗi kết nối mẫu báo cáo.'))},[])
 const current=rows[index]
 function field(key:keyof Template,value:string|string[]){setRows(rows.map((r,i)=>i===index?{...r,template:{...r.template,[key]:value}}:r))}
 async function save(){setBusy(true);try{const r=await fetch('/api/settings/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(rows.map((r,i)=>i===index?{...r,version:d.version}:r));message('Đã lưu mẫu báo cáo.')}catch(e){message(String(e))}finally{setBusy(false)}}
 if(!current)return <p role="status">{msg}</p>
 return <details><summary>Mẫu báo cáo giao ban</summary><fieldset disabled={busy}><label>Bộ phận <select value={index} onChange={e=>setIndex(+e.target.value)}>{rows.map((r,i)=><option key={r.key} value={i}>{r.template.department}</option>)}</select></label>
 {([['title','Tên báo cáo'],['department','Tên hiển thị bộ phận'],['subtitle','Tiêu đề phụ'],['slogan','Khẩu hiệu'],['accent','Màu chủ đạo']] as const).map(([k,label])=><label className="form-field" key={k}>{label}<input type={k==='accent'?'color':'text'} value={current.template[k]} onChange={e=>field(k,e.target.value)}/></label>)}
 <label className="form-field">Nội dung trọng tâm, mỗi dòng một mục<textarea rows={5} value={current.template.focus.join('\n')} onChange={e=>field('focus',e.target.value.split('\n'))}/></label><details><summary>Xem trước</summary><h3 style={{color:current.template.accent}}>{current.template.title}</h3><b>{current.template.department}</b><p>{current.template.subtitle}</p><ul>{current.template.focus.map((f,i)=><li key={i}>{f}</li>)}</ul><p>{current.template.slogan}</p></details>
 <button onClick={save}>Lưu mẫu bộ phận</button></fieldset><p role="status">{msg}</p></details>
}
