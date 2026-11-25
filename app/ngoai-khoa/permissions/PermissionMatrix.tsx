'use client'
import {useEffect,useMemo,useState} from 'react'

type Scope='none'|'self'|'team'|'hospital'
type Action='view'|'create'|'edit'|'delete'|'approve'|'history'|'export'
type Grants=Record<string,Partial<Record<Action,Scope>>>
type Person={id:string;name:string;username:string;department:string;staff_code:string|null;team_department:string|null;team_lead:boolean;work_role_reviewed:boolean;legacy_operator:boolean;work_view:boolean;work_edit:boolean;can_approve_work?:boolean;version:string|null;overrides:Grants;effective:Grants;defaults:Grants}
type Payload={people:Person[];features:Record<string,Action[]>;featureLabels:Record<string,string>;actionLabels:Record<Action,string>;history:Array<{changed_at:string;changed_by:string}>}
const captions:Record<Scope,string>={none:'— Không',self:'Cá nhân',team:'Toàn tổ',hospital:'Toàn khoa'}
const rank:Record<Scope,number>={none:0,self:1,team:2,hospital:3}
const tidy=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim()

export default function PermissionMatrix(){
 const [data,setData]=useState<Payload|null>(null),[person,setPerson]=useState(''),[search,setSearch]=useState('')
 const [overrides,setOverrides]=useState<Grants>({}),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 const [history,setHistory]=useState<Payload['history']>([]),[resetting,setResetting]=useState(false),[dirty,setDirty]=useState(false)
 const selected=data?.people.find(p=>p.id===person)
 const ceiling:Scope='hospital' // Administrator may delegate a particular action beyond position defaults
 const filtered=useMemo(()=>data?.people.filter(p=>tidy([p.name,p.username,p.department,p.staff_code||''].join(' ')).includes(tidy(search)))||[],[data,search])
 async function refresh(target?:string){
  const response=await fetch('/api/settings/feature-permissions'+(target?'?person='+encodeURIComponent(target):''),{cache:'no-store'})
  const json=await response.json()
  if(!response.ok)throw Error(json.error||'Không tải được quyền.')
  setData(json);if(target)setHistory(json.history||[])
  const active=json.people.find((p:Person)=>p.id===(target||person))
  if(active){setPerson(active.id);setOverrides(structuredClone(active.overrides||{}));setResetting(false);setDirty(false)}
 }
 useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[])
 function choose(id:string){
  setPerson(id);setResetting(false);setDirty(false);const p=data?.people.find(x=>x.id===id);setOverrides(structuredClone(p?.overrides||{}))
  setMessage('');setHistory([])
  if(id)fetch('/api/settings/feature-permissions?person='+encodeURIComponent(id),{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(Error('Không tải được lịch sử')))
   .then(x=>setHistory(x.history||[])).catch(e=>setMessage(e.message))
 }
 function change(feature:string,action:Action,scope:Scope){
  if(!selected)return
  const next=structuredClone(overrides)
  next[feature]={...(next[feature]||{}),[action]:scope}
  const read=action==='view'?scope:next[feature].view||(resetting?selected.defaults:selected.effective)[feature]?.view||'none'
  if(action==='view')for(const [key,value] of Object.entries(next[feature])){
   if(key!=='view'&&rank[value as Scope]>rank[scope])next[feature][key as Action]=scope
  }
  else if(rank[scope]>rank[read]){
   next[feature].view=scope
  }
  setOverrides(next);setDirty(true)
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
 const groups=[
  {name:'Công việc và nhắc việc',features:['tasks','reminders','plans','issues']},
  {name:'Nghiệp vụ kiểm soát nhiễm khuẩn',features:['checklists','checklistTemplates','violations','alerts']},
  {name:'Nhân sự, báo cáo và đánh giá',features:['reports','staff','kpi']}
 ]
 const scopedOptions=(feature:string,action:Action)=>Object.keys(captions).filter(x=>
  rank[x as Scope]<=rank[ceiling] &&
  !(feature==='tasks'&&action==='approve'&&x!=='none'&&!(selected?.can_approve_work&&selected?.work_edit&&(selected.legacy_operator||selected.team_lead&&selected.work_role_reviewed)))
 ) as Scope[]
 const canEdit=(feature:string,action:Action)=>selected&&scopedOptions(feature,action).length>0
 const inherited=(feature:string,action:Action):Scope=>selected?.defaults?.[feature]?.[action]??'none'
 const chosen=(feature:string,action:Action):Scope=>{
   const original=(resetting?inherited(feature,action):selected?.effective?.[feature]?.[action]??'none') as Scope
   const raw=overrides[feature]?.[action]??original
   if(action==='view')return raw
   const view=overrides[feature]?.view??(resetting?inherited(feature,'view'):selected?.effective?.[feature]?.view??'none')
   return rank[raw]>rank[view]?view:raw
 }
 const source=(feature:string,action:Action)=>
   overrides[feature]?.[action]!==undefined?'Cấp riêng':resetting?'Mặc định chức vụ':'Kế thừa chức vụ'
 const delegateReadOnly=(feature:string,scope:Scope)=>{
   if(!selected||!data?.features[feature]?.includes('view'))return
   const next=structuredClone(overrides)
   const row={...(next[feature]||{})}
   row.view=scope
   // Deliberately preserve each pre-existing modify grant; read-only delegation
   // must never escalate edit/create/delete/export.
   for(const action of data.features[feature]){
     if(action==='view')continue
     if(row[action]===undefined)row[action]=
       (resetting?inherited(feature,action):selected.effective?.[feature]?.[action]??'none')
     if(rank[row[action]||'none']>rank[scope])row[action]=scope
   }
   next[feature]=row;setOverrides(next);setDirty(true)
 }
 const delegatedSummary=selected?Object.entries(data?.features||{}).flatMap(([feature,actions])=>
   actions.filter(action=>rank[chosen(feature,action)]>rank[inherited(feature,action)])
     .map(action=>({feature,action,scope:chosen(feature,action)}))):[]
 const activeCount=data?Object.entries(data.features).reduce((sum,[f,actions])=>sum+actions.filter(a=>chosen(f,a)!=='none').length,0):0
 return <section className="pmatrix">
  <div className="pmatrix-heading"><div><h2>MA TRẬN CẤP QUYỀN LINH ĐỘNG</h2>
   <p>Chọn quyền cho từng chức năng và phạm vi. <b>Không cho phép</b> thu hồi quyền, <b>Cho phép</b> chọn phạm vi Cá nhân, Toàn tổ hoặc Toàn khoa.</p>
  </div><span className="pmatrix-counter">{activeCount} quyền có hiệu lực · {delegatedSummary.length} quyền mở rộng</span></div>
  <div className="pmatrix-filters">
   <label>Tìm theo họ tên, mã nhân viên, tài khoản, bộ phận<input type="search" autoComplete="off" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập từ khóa tìm nhân viên…"/></label>
   <label>Chọn nhân viên<select value={person} onChange={e=>choose(e.target.value)}><option value="">— Chọn nhân viên để cấp quyền —</option>{filtered.map(p=><option key={p.id} value={p.id}>{p.name} · {p.username} · {p.department}</option>)}{selected&&!filtered.some(p=>p.id===selected.id)&&<option value={selected.id}>{selected.name} (đang chọn)</option>}</select></label>
  </div>
  {selected&&<>
   <div className="pmatrix-toolbar">
    <div><b>Ủy quyền nhanh: Chỉ xem Toàn khoa</b><p>Áp dụng riêng cho phân hệ chọn dưới đây; giữ nguyên quyền Thêm, Sửa, Xóa, Phê duyệt và Xuất báo cáo.</p></div>
    <div className="pmatrix-quick">
     <select id="pmatrixQuickFeature" aria-label="Phân hệ ủy quyền xem" defaultValue="reports">
      {Object.entries(data?.features||{}).filter(([,actions])=>actions.includes('view')).map(([key])=><option key={key} value={key}>{data?.featureLabels[key]||key}</option>)}
     </select>
     <button type="button" disabled={saving} onClick={()=>{
       const element=document.getElementById('pmatrixQuickFeature') as HTMLSelectElement|null
       if(element)delegateReadOnly(element.value,'hospital')
     }}>Cấp Xem Toàn khoa</button>
    </div>
   </div>
   {delegatedSummary.length>0&&<div className="pmatrix-impact"><b>Quyền mở rộng so với mặc định ({delegatedSummary.length}):</b> {delegatedSummary.map(item=>[data?.featureLabels[item.feature],data?.actionLabels[item.action],captions[item.scope]].join(' · ')).join(' | ')}</div>}
   <div className="pmatrix-profile"><span><b>{selected.name}</b> · {selected.department} {selected.team_lead&&'· Tổ '+(selected.team_department||selected.department)}</span><span>Ủy quyền linh động tối đa: <b>Toàn khoa</b> (riêng từng chức năng)</span></div>
   <p className="pmatrix-legend">Mỗi ô chọn <b>Không cho phép</b> hoặc <b>Cho phép trong phạm vi</b>. Các ô xám là chức năng chưa có nghiệp vụ tương ứng. Kể cả Nhân viên cũng có thể được quản trị viên ủy quyền Toàn tổ hoặc Toàn khoa theo từng quyền. Xem là quyền nền tảng của các quyền thao tác khác.</p>
   {groups.map(group=><details key={group.name} className="pmatrix-group" open>
    <summary>{group.name}<span>{group.features.length} phân hệ</span></summary>
    <div className="pmatrix-scroller"><table><thead><tr><th>Phân hệ / chức năng</th>{allActions.map(a=><th key={a}>{data?.actionLabels[a]||a}</th>)}</tr></thead>
     <tbody>{group.features.map(feature=><tr key={feature}><th scope="row">{data?.featureLabels[feature]||feature}</th>{allActions.map(action=>{
      const supported=data?.features[feature]?.includes(action)
      if(!supported)return <td key={action} className="pmatrix-na"><span title="Chức năng không áp dụng cho phân hệ này">Không áp dụng</span></td>
      const current=chosen(feature,action)
      const options=scopedOptions(feature,action)
      return <td key={action} className={current==='none'?'pmatrix-denied':'pmatrix-granted'}>
       <label className="pmatrix-cell-label" title={source(feature,action)}>{current==='none'?'Không cho phép':'Cho phép'} · {source(feature,action)}</label>
       <select aria-label={(data?.featureLabels[feature]||feature)+' · '+(data?.actionLabels[action]||action)} disabled={!canEdit(feature,action)} value={options.includes(current)?current:'none'} onChange={e=>change(feature,action,e.target.value as Scope)}>
        {options.map(scope=><option key={scope} value={scope}>{scope==='none'?'Không cho phép':'Cho phép · '+captions[scope]}</option>)}
       </select>
      </td>
     })}</tr>)}</tbody>
    </table></div>
   </details>)}
   <div className="pmatrix-actions">{dirty&&<span className="pmatrix-unsaved">Có thay đổi chưa lưu</span>}<button type="button" className="pmatrix-reset" disabled={saving} onClick={()=>{setOverrides({});setResetting(true);setDirty(true)}}>Khôi phục mặc định theo chức danh</button><button type="button" className="pmatrix-save" disabled={saving} onClick={save}>{saving?'Đang lưu…':'LƯU MA TRẬN QUYỀN'}</button></div>
   <details className="pmatrix-history"><summary>Lịch sử cấp quyền ({history.length} lần gần nhất)</summary>{history.length?<ul>{history.map((h,i)=><li key={i}>{new Date(h.changed_at).toLocaleString('vi-VN')} · Người thay đổi: {data?.people.find(p=>p.id===h.changed_by)?.name||'Quản trị viên'}</li>)}</ul>:<p>Chưa ghi nhận thay đổi.</p>}</details>
  </>}
  <p role="status" className="pmatrix-status">{message}</p>
  <style jsx>{`
   .pmatrix{padding:clamp(12px,2vw,22px);color:#19334d;font-family:Arial,sans-serif;max-width:100%;background:#f7fafc;min-height:100%}
   .pmatrix h2{font-size:20px;margin:0 0 7px;color:#16395d}.pmatrix p{line-height:1.5;color:#465b72;margin:6px 0 12px}
   .pmatrix-heading{display:flex;align-items:flex-start;gap:16px;justify-content:space-between}
   .pmatrix-counter{background:#e9f1fa;color:#16446c;padding:7px 10px;border-radius:8px;white-space:nowrap;font-size:12px;font-weight:700}
   .pmatrix-filters{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
   .pmatrix-filters label{display:grid;gap:6px;font-weight:600;font-size:13px}
   input,select{background:white;color:#18324e;border:1px solid #adc3da;border-radius:7px;padding:9px;width:100%;box-sizing:border-box;font-size:13px}
   .pmatrix-profile{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:#e8f3ff;padding:12px;border:1px solid #cadef3;border-radius:8px;margin-bottom:12px;font-size:13px}
   .pmatrix-legend{font-size:12px}
   .pmatrix-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 15px;border:1px solid #ccdfed;background:#fff;border-radius:10px;margin:12px 0}
   .pmatrix-toolbar b{color:#153d60}.pmatrix-toolbar p{margin:4px 0;font-size:12px}
   .pmatrix-quick{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
   .pmatrix-quick select{min-width:210px;max-width:300px}.pmatrix-quick button{background:#16558b;color:#fff;border-color:#16558b}
   .pmatrix-impact{padding:10px 12px;border:1px solid #d8e6ec;background:#f0f8fc;border-radius:8px;font-size:12px;line-height:1.65;overflow-wrap:anywhere;margin:10px 0}
   .pmatrix-unsaved{align-self:center;color:#a34c09;font-size:12px;font-weight:700}
   .pmatrix-actions{position:sticky;bottom:0;background:#fff;border:1px solid #e0e9f0;z-index:3;padding:10px;border-radius:9px}
   .pmatrix-group{background:white;border:1px solid #d9e4ee;border-radius:10px;overflow:hidden;margin:13px 0}
   .pmatrix-group>summary{display:flex;justify-content:space-between;gap:12px;cursor:pointer;padding:12px 15px;background:#eaf2fa;color:#16395d;font-weight:800;font-size:14px}
   .pmatrix-group>summary span{font-size:12px;font-weight:400}
   .pmatrix-scroller{overflow-x:auto;max-width:100%}
   .pmatrix table{width:100%;border-collapse:collapse;min-width:1040px;table-layout:fixed}
   .pmatrix th,.pmatrix td{border:1px solid #e0e7ee;padding:9px;vertical-align:middle}
   .pmatrix thead th{background:#244e78!important;color:#fff!important;font-size:12px;text-align:left;white-space:normal}
   .pmatrix th:first-child{width:200px}
   .pmatrix tbody th{background:#eef4f9!important;color:#183952!important;text-align:left;font-size:13px;font-weight:700}
   .pmatrix tbody td{background:white}
   .pmatrix tbody td select{min-width:95px;padding:7px 6px;font-size:12px}
   .pmatrix-cell-label{display:block;font-size:10px;color:#42627c;margin-bottom:4px;font-weight:700}
   .pmatrix-denied{background:#fffaf7!important}.pmatrix-granted{background:#f5fafc!important}
   .pmatrix-na{text-align:center!important;font-size:11px;color:#66798a!important;background:#f5f7f9!important;font-style:italic}
   .pmatrix-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin:17px 0}
   button{border:1px solid #afc4d9;border-radius:8px;padding:10px 15px;cursor:pointer;background:#fff;color:#15355d;font-weight:700}
   .pmatrix-save{background:#174e86;color:white;border-color:#174e86}
   button:disabled{opacity:.6;cursor:not-allowed}.pmatrix-history{background:white;padding:12px;border:1px solid #dae4ed;border-radius:9px}
   .pmatrix-status{font-weight:700;font-size:13px}
   @media(max-width:720px){.pmatrix-filters{grid-template-columns:1fr}.pmatrix-heading{display:block}.pmatrix-counter{display:inline-block}.pmatrix{padding:9px}}
  `}</style>
 </section>
}
