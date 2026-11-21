'use client'
import {useEffect,useState} from 'react'
type Person={id:string;name:string;username:string;department:string}
type Grant={person:string;scope:string;can_export:boolean;version:string|null}
export default function ReportPermissions(){
 const [people,setPeople]=useState<Person[]>([]),[grants,setGrants]=useState<Grant[]>([]),[id,setId]=useState(''),[scope,setScope]=useState('none'),[exp,setExp]=useState(false),[msg,message]=useState(''),[busy,setBusy]=useState(false)
 async function load(){const r=await fetch('/api/settings/report-permissions');const d=await r.json();if(!r.ok)throw Error(d.error);setPeople(d.people);setGrants(d.grants)}
 useEffect(()=>{load().catch(e=>message(e.message))},[])
 function select(value:string){const g=grants.find(x=>x.person===value);setId(value);setScope(g?.scope||'none');setExp(!!g?.can_export)}
 async function save(){setBusy(true);try{const r=await fetch('/api/settings/report-permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:id,scope,can_export:exp,version:grants.find(g=>g.person===id)?.version})});if(!r.ok)throw Error((await r.json()).error);await load();message('Đã cập nhật và ghi lịch sử phân quyền.')}catch(e){message(String(e))}finally{setBusy(false)}}
 return <details><summary>Nhân sự và quyền truy cập ma trận</summary><fieldset disabled={busy}><label>Tài khoản <select value={id} onChange={e=>select(e.target.value)}><option value="">Chọn nhân viên</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.username} · {p.department}</option>)}</select></label><label>Phạm vi xem <select value={scope} onChange={e=>setScope(e.target.value)}><option value="none">Chưa cấp quyền bổ sung</option><option value="self">Cá nhân theo mã nhân viên</option><option value="team">Bộ phận phụ trách</option><option value="hospital">Bệnh viện Ngoại khoa</option></select></label><label><input type="checkbox" disabled={scope==='none'} checked={scope!=='none'&&exp} onChange={e=>setExp(e.target.checked)}/> Cho phép xuất Excel và PowerPoint trong phạm vi này</label><button disabled={!id} onClick={save}>Lưu quyền</button></fieldset><p role="status">{msg}</p></details>
}
