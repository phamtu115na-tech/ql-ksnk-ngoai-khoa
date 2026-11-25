'use client'
import {useEffect,useMemo,useState} from 'react'

type Person={id:string;name:string;username:string;department:string}
type Grant={person:string;scope:string;can_export:boolean;version:string|null}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLocaleLowerCase('vi').trim()

export default function ReportPermissions(){
 const [people,setPeople]=useState<Person[]>([]),[grants,setGrants]=useState<Grant[]>([])
 const [id,setId]=useState(''),[scope,setScope]=useState('none'),[exp,setExp]=useState(false)
 const [search,setSearch]=useState(''),[msg,message]=useState(''),[busy,setBusy]=useState(false)
 const matches=useMemo(()=>{
  const words=normalize(search).split(/\s+/).filter(Boolean)
  return people.filter(p=>{
   const haystack=normalize([p.name,p.username,p.department].join(' '))
   return words.every(word=>haystack.includes(word))
  })
 },[people,search])
 async function load(){
  const r=await fetch('/api/settings/report-permissions',{cache:'no-store'});const d=await r.json()
  if(!r.ok)throw Error(d.error)
  setPeople(d.people||[]);setGrants(d.grants||[])
 }
 useEffect(()=>{load().catch(e=>message(e.message))},[])
 function select(value:string){
  const g=grants.find(x=>x.person===value)
  setId(value);setScope(g?.scope||'none');setExp(!!g?.can_export)
 }
 async function save(){
  setBusy(true);message('')
  try{
   const r=await fetch('/api/settings/report-permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:id,scope,can_export:exp,version:grants.find(g=>g.person===id)?.version})})
   if(!r.ok)throw Error((await r.json()).error)
   await load();message('Đã cập nhật và ghi lịch sử phân quyền.')
  }catch(e){message(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <details><summary>Nhân sự và quyền truy cập ma trận</summary>
  <fieldset disabled={busy}>
   <label>Tìm nhanh nhân viên
    <input type="search" autoComplete="off" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập họ tên, tên đăng nhập hoặc bộ phận..." aria-controls="nk-report-person-select"/>
   </label>
   <small role="status">{search.trim()?`Tìm thấy ${matches.length} / ${people.length} nhân viên`:`Có ${people.length} nhân viên`}</small>
   <label>Tài khoản
    <select id="nk-report-person-select" value={id} onChange={e=>select(e.target.value)}>
     <option value="">Chọn nhân viên</option>
     {matches.map(p=><option key={p.id} value={p.id}>{p.name} · {p.username} · {p.department}</option>)}
     {id&&!matches.some(p=>p.id===id)&&people.some(p=>p.id===id)&&<option value={id}>{people.find(p=>p.id===id)?.name} (đã chọn, ngoài kết quả lọc)</option>}
    </select>
   </label>
   {search.trim()&&!matches.length&&<p role="status">Không tìm thấy nhân viên phù hợp. Hãy thử tên khác.</p>}
   <label>Phạm vi xem
    <select value={scope} onChange={e=>setScope(e.target.value)}>
     <option value="none">Chưa cấp quyền bổ sung</option>
     <option value="self">Cá nhân theo mã nhân viên</option>
     <option value="team">Bộ phận phụ trách</option>
     <option value="hospital">Bệnh viện Ngoại khoa</option>
    </select>
   </label>
   <label><input type="checkbox" disabled={scope==='none'} checked={scope!=='none'&&exp} onChange={e=>setExp(e.target.checked)}/> Cho phép xuất Excel và PowerPoint trong phạm vi này</label>
   <button type="button" disabled={!id} onClick={save}>Lưu quyền</button>
  </fieldset><p role="status">{msg}</p>
 </details>
}
