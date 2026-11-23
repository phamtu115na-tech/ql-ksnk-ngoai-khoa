'use client'
import {useEffect,useMemo,useState} from 'react'

type Scope='none'|'self'|'team'|'hospital'
type Action='view'|'create'|'edit'|'delete'|'approve'|'history'|'export'
type Grants=Record<string,Partial<Record<Action,Scope>>>
type Person={id:string;name:string;username:string;department:string;staff_code:string|null;team_department:string|null;team_lead:boolean;legacy_operator:boolean;work_view:boolean;work_edit:boolean;version:string|null;overrides:Grants;effective:Grants}
type Payload={people:Person[];features:Record<string,Action[]>;featureLabels:Record<string,string>;actionLabels:Record<Action,string>;history:Array<{changed_at:string;changed_by:string}>}
const captions:Record<Scope,string>={none:'— Không',self:'Cá nhân',team:'Toàn tổ',hospital:'Toàn khoa'}
const rank:Record<Scope,number>={none:0,self:1,team:2,hospital:3}
const tidy=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim()

export default function PermissionMatrix(){
 const [data,setData]=useState<Payload|null>(null),[person,setPerson]=useState(''),[search,setSearch]=useState('')
 const [overrides,setOverrides]=useState<Grants>({}),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 const [history,setHistory]=useState<Payload['history']>([])
 const selected=data?.people.find(p=>p.id===person)
 const ceiling:Scope=selected?.legacy_operator&&selected.work_view?'hospital':selected?.team_lead&&selected.work_view?'team':'self'
 const filtered=useMemo(()=>data?.people.filter(p=>tidy([p.name,p.username,p.department,p.staff_code||''].join(' ')).includes(tidy(search)))||[],[data,search])
 async function refresh(target?:string){
  const response=await fetch('/api/settings/feature-permissions'+(target?'?person='+encodeURIComponent(target):''),{cache:'no-store'})
  const json=await response.json()
  if(!response.ok)throw Error(json.error||'Không tải được quyền.')
  setData(json);if(target)setHistory(json.history||[])
  const active=json.people.find((p:Person)=>p.id===(target||person))
  if(active){setPerson(active.id);setOverrides(structuredClone(active.overrides||{}))}
 }
 useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[])
 function choose(id:string){
  setPerson(id);const p=data?.people.find(x=>x.id===id);setOverrides(structuredClone(p?.overrides||{}))
  setMessage('');setHistory([])
  if(id)fetch('/api/settings/feature-permissions?person='+encodeURIComponent(id),{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(Error('Không tải được lịch sử')))
   .then(x=>setHistory(x.history||[])).catch(e=>setMessage(e.message))
 }
 function change(feature:string,action:Action,scope:Scope){
  if(!selected)return
  const next=structuredClone(overrides)
  next[feature]={...(next[feature]||{}),[action]:scope}
  const read=action==='view'?scope:next[feature].view||selected.effective[feature]?.view||'none'
  if(action==='view')for(const [key,value] of Object.entries(next[feature])){
   if(key!=='view'&&rank[value as Scope]>rank[scope])next[feature][key as Action]=scope
  }
  else if(rank[scope]>rank[read]){
   next[feature].view=scope
  }
  setOverrides(next)
 }
 async function save(){
  if(!selected)return
  setSaving(true);setMessage('')
  try{
   const r=await fetch('/api/settings/feature-permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:selected.id,version:selected.version,overrides})})
   const d=await r.json()
   if(!r.ok)throw Error(d.error||'Không lưu được quyền')
   await refresh(selected.id);setMessage('Đã lưu quyền và ghi nhận lịch sử thay đổi.')
  }catch(e){setMessage(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 const allActions:Action[]=['view','create','edit','delete','approve','history','export']
 const scopedOptions=(feature:string,action:Action)=>Object.keys(captions).filter(x=>rank[x as Scope]<=rank[ceiling]&&!(feature==='tasks'&&action==='approve'&&x!=='none')) as Scope[]
 return <section className="pmatrix">
  <h2>MA TRẬN CẤP QUYỀN LINH ĐỘNG</h2>
  <p>Cấp riêng từng quyền theo từng phân hệ. Tổ trưởng chỉ trong tổ phụ trách; trưởng khoa và điều dưỡng trưởng có thể được cấp toàn khoa. Các quyền không được cấp vẫn tuân theo quyền nghiệp vụ hiện hành.</p>
  <div className="pmatrix-filters">
   <label>Tìm tên, mã NV, tên đăng nhập hoặc bộ phận<input type="search" autoComplete="off" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ví dụ: tổ trưởng VSMT..."/></label>
   <label>Chọn tài khoản<select value={person} onChange={e=>choose(e.target.value)}><option value="">Chọn nhân viên</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.name} · {p.username} · {p.department}</option>)}{selected&&!filtered.some(p=>p.id===selected.id)&&<option value={selected.id}>{selected.name} (đang chọn)</option>}</select></label>
  </div>
  {selected&&<><p className="pmatrix-profile"><b>{selected.name}</b> · {selected.department} · Phạm vi tối đa: <b>{captions[ceiling]}</b> {selected.team_lead&&<span>· Tổ: {selected.team_department||selected.department}</span>}</p>
   <div className="pmatrix-scroller"><table><thead><tr><th>Phân hệ / chức năng</th>{allActions.map(a=><th key={a}>{data?.actionLabels[a]||a}</th>)}</tr></thead>
    <tbody>{Object.entries(data?.features||{}).map(([feature,actions])=><tr key={feature}><th scope="row">{data?.featureLabels[feature]||feature}</th>{allActions.map(action=>{
     if(!actions.includes(action))return <td key={action} className="pmatrix-na">—</td>
     const inherited=selected.effective[feature]?.[action]||'none'
     const current=overrides[feature]?.[action]??inherited
     return <td key={action}><select aria-label={(data?.featureLabels[feature]||feature)+' · '+(data?.actionLabels[action]||action)} value={current} onChange={e=>change(feature,action,e.target.value as Scope)}>{scopedOptions(feature,action).map(scope=><option key={scope} value={scope}>{captions[scope]}</option>)}</select></td>
    })}</tr>)}</tbody></table></div>
   <div className="pmatrix-actions"><button type="button" disabled={saving} onClick={()=>setOverrides({})}>Khôi phục quyền mặc định</button><button type="button" disabled={saving} onClick={save}>{saving?'Đang lưu…':'LƯU MA TRẬN QUYỀN'}</button></div>
   <details><summary>Lịch sử cấp quyền ({history.length} lần gần nhất)</summary>{history.length?<ul>{history.map((h,i)=><li key={i}>{new Date(h.changed_at).toLocaleString('vi-VN')} · Người thay đổi: {data?.people.find(p=>p.id===h.changed_by)?.name||'Quản trị viên'}</li>)}</ul>:<p>Chưa ghi nhận thay đổi.</p>}</details>
  </>}
  <p role="status">{message}</p>
  <style jsx>{`
   .pmatrix{padding:16px;color:#18324e;font-family:Arial,sans-serif;max-width:100%}
   .pmatrix h2{font-size:20px;margin:0 0 12px}.pmatrix p{line-height:1.5}
   .pmatrix-filters{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
   .pmatrix-filters label{display:grid;gap:5px;font-weight:600}
   input,select{background:white;color:#18324e;border:1px solid #b8c8d8;border-radius:6px;padding:9px;width:100%;box-sizing:border-box;font-size:13px}
   .pmatrix-profile{background:#eef4fb;padding:11px;border-radius:6px}
   .pmatrix-scroller{overflow:auto;max-width:100%}.pmatrix table{width:100%;border-collapse:collapse;min-width:900px}
   .pmatrix th,.pmatrix td{border:1px solid #d9e1ea;padding:8px;vertical-align:middle}
   .pmatrix th{background:#e9f0f8;text-align:left;font-size:12px}
   .pmatrix td select{min-width:94px;padding:7px;font-size:12px}
   .pmatrix-na{color:#8490a0;text-align:center}
   .pmatrix-actions{display:flex;gap:10px;justify-content:flex-end;margin:16px 0}
   button{border:1px solid #b8c8d8;border-radius:6px;padding:10px 15px;cursor:pointer;background:#fff;color:#15355d;font-weight:700}
   button:last-child{background:#17416f;color:#fff}
   button:disabled{opacity:.6;cursor:not-allowed}
   @media(max-width:700px){.pmatrix-filters{grid-template-columns:1fr}.pmatrix{padding:9px}}
  `}</style>
 </section>
}
