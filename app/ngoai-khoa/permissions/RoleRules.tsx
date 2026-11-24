'use client'
import {useEffect,useMemo,useState} from 'react'
type Scope='none'|'self'|'team'|'hospital'
type Action='view'|'create'|'edit'|'delete'|'approve'|'history'|'export'
type Matrix=Record<string,Partial<Record<Action,Scope>>>
type Role='staff'|'team'|'chief'
type RoleEntry={role:Role;grants:Matrix;version:string|null;baseline:Matrix}
const roles:{id:Role;label:string;description:string}[]=[
 {id:'staff',label:'Nhân viên',description:'Mặc định cá nhân; quản trị viên có thể ủy quyền theo từng nghiệp vụ'},
 {id:'team',label:'Tổ trưởng',description:'Mặc định trong bộ phận phụ trách'},
 {id:'chief',label:'Trưởng khoa / Điều dưỡng trưởng',description:'Mặc định toàn khoa'}
]
const actions:Action[]=['view','create','edit','delete','approve','history','export']
const labels:Record<Action,string>={view:'Xem',create:'Thêm mới',edit:'Sửa',delete:'Xóa',approve:'Phê duyệt',history:'Lịch sử',export:'Xuất Excel/PPT'}
const groups=[
 {name:'Công việc và nhắc việc',items:['tasks','reminders','plans','issues']},
 {name:'Giám sát và nghiệp vụ KSNK',items:['checklists','checklistTemplates','violations','alerts']},
 {name:'Nhân sự, báo cáo và KPI',items:['reports','staff','kpi']}
]
const order:Scope[]=['none','self','team','hospital']
const scopeText:Record<Scope,string>={none:'Không cho phép',self:'Cá nhân',team:'Toàn tổ',hospital:'Toàn khoa'}
export default function RoleRules(){
 const [role,setRole]=useState<Role>('staff')
 const [entries,setEntries]=useState<RoleEntry[]>([])
 const [grants,setGrants]=useState<Matrix>({})
 const [features,setFeatures]=useState<Record<string,Action[]>>({})
 const [featureNames,setFeatureNames]=useState<Record<string,string>>({})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
 const entry=entries.find(x=>x.role===role)
 const baseline=(feature:string,action:Action):Scope=>entry?.baseline?.[feature]?.[action]??'none'
 const effective=(feature:string,action:Action)=>grants[feature]?.[action]??baseline(feature,action)
 const count=useMemo(()=>Object.keys(grants).reduce((sum,feature)=>sum+Object.keys(grants[feature]||{}).length,0),[grants])
 async function load(selected:Role=role){
  const [rulesRes,matrixRes]=await Promise.all([fetch('/api/settings/role-permissions',{cache:'no-store'}),fetch('/api/settings/feature-permissions',{cache:'no-store'})])
  const [rules,matrix]=await Promise.all([rulesRes.json(),matrixRes.json()])
  if(!rulesRes.ok||!matrixRes.ok)throw Error(rules.error||matrix.error||'Không tải được quy tắc cấp quyền')
  setEntries(rules.roles||[]);setFeatures(matrix.features||{});setFeatureNames(matrix.featureLabels||{})
  setGrants(structuredClone(rules.roles?.find((x:RoleEntry)=>x.role===selected)?.grants||{}));setLoaded(true)
 }
 useEffect(()=>{load('staff').catch(e=>setError(e.message))},[])
 function choose(r:Role){setRole(r);setGrants(structuredClone(entries.find(x=>x.role===r)?.grants||{}));setError('')}
 function change(feature:string,action:Action,value:string){
  const next=structuredClone(grants)
  next[feature]={...(next[feature]||{})}
  if(value==='inherit')delete next[feature][action]
  else next[feature][action]=value as Scope
  if(action==='view'){
   const read=value==='inherit'?baseline(feature,'view'):value as Scope
   for(const other of features[feature]||[]){
    if(other==='view')continue
    const current=next[feature][other]??baseline(feature,other)
    if(order.indexOf(current)>order.indexOf(read))next[feature][other]=read
   }
  }else if(value!=='inherit'&&value!=='none'){
   const read=next[feature].view??baseline(feature,'view')
   if(order.indexOf(value as Scope)>order.indexOf(read))next[feature].view=value as Scope
  }
  if(!Object.keys(next[feature]).length)delete next[feature]
  setGrants(next)
 }
 async function save(){
  const broad=Object.entries(grants).flatMap(([feature,row])=>Object.entries(row||{})
   .filter(([action,scope])=>scope==='hospital'&&action!=='view').map(([action])=>feature+' · '+labels[action as Action]))
  if(role==='staff'&&broad.length&&!window.confirm(
   'Quy tắc này cấp quyền toàn khoa cho TẤT CẢ nhân viên, gồm quyền thay đổi dữ liệu ở: '+broad.join(', ')+
   '. Nếu chỉ cần một vài nhân viên, hãy cấp tại tab "Cấp quyền từng nhân viên". Vẫn lưu cho toàn bộ chức vụ?'
  ))return
  setBusy(true);setError('')
  try{
   const r=await fetch('/api/settings/role-permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,grants,version:entry?.version||null})})
   const d=await r.json()
   if(!r.ok)throw Error(d.error||'Không lưu được quy tắc')
   await load(role);setError('Đã lưu quy tắc mặc định và ghi lịch sử thay đổi.')
  }catch(e){setError(e instanceof Error?e.message:'Lỗi lưu quyền')}
  finally{setBusy(false)}
 }
 return <section className="rules">
  <h2>QUY TẮC CẤP QUYỀN THEO CHỨC VỤ</h2>
  <p>Quy tắc áp dụng cho tất cả tài khoản theo chức vụ. Khi tài khoản có quyền cấp riêng, quyền riêng được ưu tiên hơn. Chỉ quản trị viên có thể thay đổi.</p>
  <div className="roles">{roles.map(r=><button type="button" key={r.id} aria-pressed={role===r.id} onClick={()=>choose(r.id)}>{r.label}</button>)}</div>
  <p className="role-desc">{roles.find(x=>x.id===role)?.description} · {count} quyền đã tùy chỉnh</p>
  {!loaded?<p>Đang tải quy tắc…</p>:groups.map(g=><details className="section" open key={g.name}>
   <summary>{g.name}</summary><div className="scroll"><table><thead><tr><th>Phân hệ</th>{actions.map(a=><th key={a}>{labels[a]}</th>)}</tr></thead>
    <tbody>{g.items.map(f=><tr key={f}><th>{featureNames[f]||f}</th>{actions.map(a=>{
      if(!features[f]?.includes(a))return <td key={a} className="na">Không áp dụng</td>
      if(a==='approve')return <td key={a} className="na">Cấp theo cá nhân</td>
      const override=grants[f]?.[a]
      return <td key={a}><label className="state">{effective(f,a)==='none'?'Không cho phép':'Cho phép'}</label>
       <select aria-label={(featureNames[f]||f)+' '+labels[a]} value={override??'inherit'} onChange={e=>change(f,a,e.target.value)}>
        <option value="inherit">Mặc định · {scopeText[baseline(f,a)]}</option>
        {order.map(scope=><option value={scope} key={scope}>{scope==='none'?'Không cho phép':'Cho phép · '+scopeText[scope]}</option>)}
       </select></td>
    })}</tr>)}</tbody></table></div></details>)}
  <div className="commands"><button type="button" disabled={busy||!loaded} onClick={()=>setGrants({})}>Trở về quy tắc gốc</button><button type="button" disabled={busy||!loaded} onClick={save}>{busy?'Đang lưu…':'LƯU QUY TẮC CHỨC VỤ'}</button></div>
  <p role="status">{error}</p>
  <p className="note">Quyền Phê duyệt không được mở cho toàn bộ một chức vụ. Chỉ người đủ điều kiện và được chỉ định trong từng tác vụ mới có thể phê duyệt.</p>
  <style jsx>{`
  .rules{padding:16px;max-width:100%;color:#203750;background:#f8fbfe;min-height:100%}
  h2{font-size:20px;margin:0 0 10px;color:#153d65}p{line-height:1.5;font-size:13px}
  .roles{display:flex;gap:8px;flex-wrap:wrap}.roles button{border:1px solid #aac4dd;border-radius:8px;background:white;color:#17416a;padding:10px 14px;cursor:pointer}
  .roles button[aria-pressed=true]{background:#17416a;color:white}.role-desc{background:#eaf3fb;border-radius:8px;padding:10px}
  .section{border:1px solid #d8e4ee;border-radius:8px;margin:12px 0;background:white}
  summary{padding:12px 15px;background:#e9f2fa;font-weight:bold;cursor:pointer}.scroll{max-width:100%;overflow-x:auto}
  table{border-collapse:collapse;min-width:1050px;width:100%;table-layout:fixed}
  th,td{border:1px solid #e1e8f0;padding:8px;text-align:left;vertical-align:middle}
  thead th{background:#204b74;color:white;font-size:12px}
  tbody th{background:#ecf2f7;color:#1e3c5a;font-size:12px;width:185px}
  select{width:100%;padding:8px 4px;border:1px solid #b7cde1;border-radius:6px;background:white;color:#173a59;font-size:12px}
  .na{text-align:center;background:#f5f7f9;color:#657688;font-style:italic;font-size:11px}
  .state{display:block;font-size:10px;color:#486683;font-weight:700;padding-bottom:4px}
  .commands{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin:18px 0}
  .commands button{border-radius:8px;border:1px solid #9cb8d2;background:white;color:#14395f;padding:11px 16px;font-weight:700;cursor:pointer}
  .commands button:last-child{background:#174d80;color:white}.commands button:disabled{opacity:.6}
  .note{color:#566b7e}
  `}</style>
 </section>
}
