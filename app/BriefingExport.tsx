'use client'
import {useState} from 'react'
import {sectionTitles,type SectionKey} from '../lib/briefing-sections'
export default function BriefingExport({filters,options}:{filters:Record<string,string>;options:string[]}){
 const [selected,setSelected]=useState<string[]>(filters.department?[filters.department]:[]),[order,setOrder]=useState(Object.keys(sectionTitles) as SectionKey[]),[hidden,hide]=useState<SectionKey[]>([]),[msg,message]=useState(''),[busy,setBusy]=useState(false)
 const keys=order.filter(k=>!hidden.includes(k))
 async function download(format:string){
  setBusy(true);message('')
  try{const r=await fetch('/api/report/briefing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format,keys,departments:selected,filters})});if(!r.ok)throw Error('Không xuất được báo cáo. Kiểm tra lựa chọn và quyền xuất.')
   const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='Giao-ban-KSNK.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)
  }catch(e){message(String(e))}finally{setBusy(false)}
 }
 return <details className="panel-card"><summary>Xuất báo cáo giao ban</summary><fieldset disabled={busy}><legend>Bộ phận và nội dung xuất</legend><p>Kỳ báo cáo {filters.from||'…'} – {filters.to||'…'}</p><label><input type="checkbox" checked={!selected.length} onChange={()=>setSelected([])}/>Toàn khoa</label>{options.map(d=><label key={d}><input type="checkbox" checked={selected.includes(d)} onChange={()=>setSelected(selected.includes(d)?selected.filter(v=>v!==d):[...selected,d])}/>{d}</label>)}
 {order.map((k,i)=><div key={k}><label><input type="checkbox" checked={!hidden.includes(k)} onChange={()=>hide(hidden.includes(k)?hidden.filter(v=>v!==k):[...hidden,k])}/>{sectionTitles[k]}</label><button disabled={!i} onClick={()=>{const list=[...order];[list[i],list[i-1]]=[list[i-1],list[i]];setOrder(list)}}>Đưa lên</button></div>)}
 <details><summary>Xem trước bố cục</summary><p>{selected.join(', ')||'Toàn khoa KSNK'}</p><ol><li>Trang bìa</li>{keys.map(k=><li key={k}>{sectionTitles[k]}</li>)}</ol></details>
 <button disabled={!keys.length} onClick={()=>download('xlsx')}>Xuất báo cáo Excel</button> <button disabled={!keys.length} onClick={()=>download('pptx')}>Xuất báo cáo PowerPoint</button></fieldset><p role="status">{msg}</p></details>
}
