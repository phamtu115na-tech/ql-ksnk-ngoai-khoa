'use client'
import {useEffect,useState} from 'react'
import {defaults,levels,validScale,type Scale} from '../lib/matrix'
export default function MatrixSettings(){
 const [scale,setScale]=useState<Scale>(defaults),[version,setVersion]=useState<string|null>(null),[editable,setEditable]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{fetch('/api/settings/matrix').then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);setScale({...defaults,...v.scale});setVersion(v.version);setEditable(v.editable)}).catch(e=>setMessage(e.message))},[])
 async function save(){
  if(!validScale(scale)){setMessage('Ngưỡng phải tăng dần từ 0. Tỷ lệ nhỏ hơn 100% và số lượt tối thiểu từ 1.');return}
  setBusy(true)
  try{const r=await fetch('/api/settings/matrix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scale,version})});const v=await r.json();if(!r.ok)throw Error(v.error);setVersion(v.version);setMessage('Đã lưu cấu hình ma trận.')}catch(e){setMessage(String(e))}finally{setBusy(false)}
 }
 return <section><h3>Ma trận giám sát và thang cảnh báo</h3>{editable&&<><label>Phân tích mặc định <select value={scale.mode} onChange={e=>setScale({...scale,mode:e.target.value as Scale['mode']})}><option value="criterion">Theo nội dung giám sát</option><option value="staff">Theo nhân viên</option></select></label>
 <div className="table-wrap"><table><thead><tr><th>Mức</th><th>Màu</th><th>Số lỗi tối đa</th><th>Tỷ lệ tối đa (%)</th></tr></thead><tbody>{scale.count.map((_,i)=><tr key={i}><th><input aria-label="Tên mức" value={scale.labels[i]} onChange={e=>setScale({...scale,labels:scale.labels.map((v,j)=>i===j?e.target.value:v)})}/></th><td><input aria-label="Màu cảnh báo" type="color" value={scale.colors[i]} onChange={e=>setScale({...scale,colors:scale.colors.map((v,j)=>i===j?e.target.value:v)})}/></td>{(['count','rate'] as const).map(k=><td key={k}><input aria-label={levels[i]+' '+k} type="number" min="0" disabled={!i} value={scale[k][i]} onChange={e=>setScale({...scale,[k]:scale[k].map((v,j)=>j===i?Number(e.target.value):v)})}/></td>)}</tr>)}<tr><th><input aria-label="Tên mức cao nhất" value={scale.labels[4]} onChange={e=>setScale({...scale,labels:[...scale.labels.slice(0,4),e.target.value]})}/></th><td><input aria-label="Màu mức cao nhất" type="color" value={scale.colors[4]} onChange={e=>setScale({...scale,colors:[...scale.colors.slice(0,4),e.target.value]})}/></td><td>Trên {scale.count[3]}</td><td>Trên {scale.rate[3]}%</td></tr></tbody></table></div>
 <label>Lượt hợp lệ tối thiểu để cảnh báo theo tỷ lệ <input type="number" min="1" value={scale.minimum} onChange={e=>setScale({...scale,minimum:Number(e.target.value)})}/></label><button type="button" disabled={busy} onClick={save}>Lưu cấu hình ma trận</button></>}<p role="status">{message}</p></section>
}
