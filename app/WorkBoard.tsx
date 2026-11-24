'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {workWarningReasons,type WorkWarningType} from '../lib/work-warning-policy';

type Kind='task'|'reminder';
type Item={id:string;source_row:number;kind:Kind;title:string;note?:string;status:string;due:string;latest_message:string;mentioned:boolean;message_time:string;message_sender:string;owner_id:string;performers:string[];observers:string[];received_by?:string[];daily?:boolean;daily_done_today?:boolean};
type Row={item:Item;unread:number};
export function useWorkFeed(){return useContext(Feed);}
const labels={task:'Giao việc',reminder:'Nhắc việc'};
const Feed=createContext<{selection:string;select:(id:string)=>void;team:boolean;canAssign:boolean;names:Record<string,string>;rows:Row[];open:(id:string)=>void;refresh:()=>void;error:string;ready:boolean}>({selection:'',select:()=>{},team:false,canAssign:false,names:{},rows:[],open:()=>{},refresh:()=>{},error:'',ready:false});
export function WorkProvider({children,team=false,legacy=false}:{legacy?:boolean;team?:boolean;children:React.ReactNode}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [canAssign,setCanAssign]=useState(false);
 const [names,setNames]=useState<Record<string,string>>({});
 useEffect(()=>{const controller=new AbortController();
  fetch('/api/connect',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'me'})})
  .then(r=>r.ok?r.json():null).then(data=>{setCanAssign(Boolean(data?.me?.team_lead&&data.me.work_role_reviewed&&data.me.work_edit&&data.me.work_view));if(data?.people)setNames(Object.fromEntries(data.people.map((p:{id:string;name:string;admin:boolean;username:string;staff_code?:string})=>[p.id,p.admin&&!p.staff_code?p.username:p.name])));}).catch(()=>{});
  return ()=>controller.abort();},[]);
 const [revision,reload]=useState(0),[selection,select]=useState('');
 function openWork(id:string){
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return;
  select('');
  window.dispatchEvent(new CustomEvent('ksnk-show-legacy-work',{detail:id}));
 }
 useEffect(()=>{
  let active=true,busy=false;
  async function refresh(){
   if(document.hidden||busy)return;
   busy=true;
   try{
    const result:Row[]=[];
    for(const kind of ['task','reminder']){
     for(let offset=0;;offset+=80){
      const res=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workRows',kind,offset})});
      if(!res.ok)throw Error('Chưa tải được tin nhắn công việc.');
      const page:Row[]=await res.json();
      if(!active)return;
      result.push(...page);if(page.length<80)break;
     }
    }
    if(active){setRows(result);setError('');setReady(true)}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Lỗi kết nối')}finally{busy=false}
  }
  void refresh();const timer=setInterval(refresh,16000);
  const trigger=()=>{void refresh()};
  const onRead=(event:MessageEvent)=>{if(event.origin===location.origin&&event.data?.type==='ksnk-work-read')reload(x=>x+1)};
  window.addEventListener('focus',trigger);window.addEventListener('ksnk-work-closed',trigger);window.addEventListener('message',onRead);
  return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',trigger);window.removeEventListener('ksnk-work-closed',trigger);window.removeEventListener('message',onRead)};
 },[revision]);
 useEffect(()=>{const onOpen=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(typeof id==='string')openWork(id)};window.addEventListener('ksnk-open-work-thread',onOpen);return()=>window.removeEventListener('ksnk-open-work-thread',onOpen)},[]);
 return <Feed.Provider value={{selection,select,team,canAssign,names,rows,open:openWork,refresh:()=>reload(x=>x+1),error,ready}}>{children}</Feed.Provider>;
}
export function WorkArea({kind,children}:{kind?:Kind;children:React.ReactNode}){
 const {selection,select,open,rows,ready}=useWorkFeed();
 useEffect(()=>{
  if(!kind||!selection)return;
  const found=rows.some(row=>row.item.id===selection&&row.item.kind===kind);
  if(found){open(selection);select('')}
 },[kind,selection,rows,open,select]);
 if(!kind)return <>{children}</>;
 return <div className="work-task-area" data-work-area={kind}>
  <div className="work-task-list">{children}</div>
  {selection&&ready&&!rows.some(row=>row.item.id===selection)&&<p role="status">Tác vụ không còn trong phạm vi tài khoản.</p>}
 </div>;
}
export function WorkMessage({source,kind,compact=false}:{source:unknown;kind:Kind;compact?:boolean}){
 const {rows,open}=useContext(Feed),row=rows.find(x=>x.item.kind===kind&&String(x.item.source_row)===String(source));
 if(!row)return null;
 const value=<><b className={row.unread?(row.item.mentioned?'nk-mention':'nk-unread'):''}>{Number(row.unread)>0?(row.item.mentioned?'@ Có tin nhắc đến bạn':'Có tin nhắn mới')+' ('+row.unread+')':'Trao đổi'}</b>{row.item.latest_message?' · '+row.item.latest_message:''}</>;
 if(compact){
  if(Number(row.unread)<=0)return null;
  const label=row.item.mentioned?'@ Có tin nhắn mới':'Có tin nhắn mới';
  const lastMessageAt=row.item.message_time?new Date(row.item.message_time):null;
  const when=lastMessageAt&&!Number.isNaN(lastMessageAt.getTime())?lastMessageAt.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  return <button type="button" className={'nk-row-message-compact'+(row.item.mentioned?' is-mentioned':'')}
    title={row.item.latest_message||label} aria-label={label+' ('+row.unread+' tin chưa đọc) — '+row.item.title}
    onClick={e=>{e.stopPropagation();open(row.item.id)}}><span aria-hidden="true">▤</span> <span className="nk-message-unread-label">{label}</span> <b>({row.unread})</b>{when&&<time className="nk-message-time" dateTime={row.item.message_time}>{when}</time>}</button>;
 }
 return <button type="button" className="nk-row-message" onClick={e=>{e.stopPropagation();open(row.item.id)}}>{value}</button>;
}
export function HomeWorkInbox(){
 const {rows,open,names,ready,error}=useWorkFeed();
 const [kind,setKind]=useState('all'),[limit,setLimit]=useState(8);
 useEffect(()=>{const query=new URLSearchParams(location.search).get('inbox');if(query==='task'||query==='reminder')setKind(query)},[]);
 const unread=rows.filter(r=>r.unread>0).sort((a,b)=>(b.item.message_time||'').localeCompare(a.item.message_time||''));
 const visible=unread.filter(r=>kind==='all'||r.item.kind===kind);
 return <section className="panel-card nk-new-messages home-work-inbox" aria-label="Trao đổi mới" id="tin-cong-viec"><h2>Trao đổi mới trong giao việc và nhắc việc</h2><nav aria-label="Lọc tin công việc">{(['all','reminder','task'] as const).map(k=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);setLimit(8)}}>{k==='all'?'Tất cả':labels[k]} ({unread.filter(r=>k==='all'||r.item.kind===k).length})</button>)}</nav>
 {error?<p role="alert">{error}</p>:!ready?<p>Đang tải tin mới…</p>:!visible.length?<p>Đã đọc hết tin trong phạm vi này.</p>:visible.slice(0,limit).map(({item,unread})=><button type="button" key={item.id} onClick={()=>open(item.id)}><strong>{item.title} {item.mentioned&&<small className="nk-mention">@ Nhắc đến bạn</small>}</strong><span>{names[item.message_sender]||'Hệ thống'} · {(item.latest_message||'Tệp đính kèm').slice(0,240)}</span><small>{labels[item.kind]} · {unread} tin chưa đọc · {item.message_time&&new Date(item.message_time).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small></button>)}{visible.length>limit&&<button onClick={()=>setLimit(n=>n+8)}>Xem thêm</button>}</section>
}
export default function WorkBoard({kind,home=false,manager=false,who=''}:{kind?:Kind;home?:boolean;manager?:boolean;who?:string}){
 const {rows,open,error,ready,team,names,refresh}=useContext(Feed);
 const [employee,setEmployee]=useState(''),[mine,setMine]=useState(false);
 const [filter,setFilter]=useState<WorkWarningType|''>('');
 const [saving,setSaving]=useState(''),[actionError,setActionError]=useState('');
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const visible=rows.filter(({item:t})=>(!kind||t.kind===kind)&&
  (!employee||t.performers.includes(employee)||t.owner_id===employee)&&
  (!mine||[t.owner_id,...t.performers,...t.observers].includes(who)));
 const decorated=visible.map(row=>({...row,reasons:workWarningReasons(row,who,manager||team,today)}));
 const types:WorkWarningType[]=['Mới giao','Đến hạn hôm nay','Quá hạn','Tin chưa đọc','Nhắc hằng ngày'];
 const items=decorated.filter(row=>filter?row.reasons.includes(filter):!home||row.reasons.length>0);
 async function acknowledge(id:string,action:'receive'|'dailyDone'){
  if(saving)return;
  setSaving(id);setActionError('');
  try{
   const res=await fetch('/api/connect',{method:'POST',cache:'no-store',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});
   const payload=await res.json();
   if(!res.ok||!payload.ok)throw Error(payload.error||'Không cập nhật được xác nhận.');
   refresh();
  }catch(err){setActionError(err instanceof Error?err.message:'Không cập nhật được xác nhận.')}
  finally{setSaving('')}
 }
 return <main className="content-shell"><section className="home-alerts home-alerts-first">
  <div className="home-alerts-heading"><div>
   <div className="section-title">⚠ CẢNH BÁO GIAO VIỆC &amp; NHẮC VIỆC</div>
   <p className="muted">Đã nhận việc, tin đã đọc và hoàn thành là ba trạng thái độc lập. Việc quá hạn chỉ hết cảnh báo khi được xử lý.</p>
  </div>
  {(manager||team)&&<label>Lọc theo nhân viên <select value={employee} onChange={e=>setEmployee(e.target.value)}>
   <option value="">Tất cả trong phạm vi</option>
   {[...new Set(rows.flatMap(r=>r.item.performers))].map(id=><option key={id} value={id}>{names[id]||'Thành viên'}</option>)}
  </select></label>}
  {manager&&<label>Phạm vi <select value={mine?'mine':'all'} onChange={e=>setMine(e.target.value==='mine')}>
   <option value="all">Toàn viện</option><option value="mine">Của tôi</option>
  </select></label>}</div>
  <div className="task-view-tabs">{types.map(type=><button key={type} type="button"
   className={filter===type?'active':''} aria-pressed={filter===type}
   onClick={()=>setFilter(filter===type?'':type)}>
   {type} ({decorated.filter(row=>row.reasons.includes(type)).length})
  </button>)}</div>
  {error&&<p role="alert">{error}</p>}
  {actionError&&<p role="alert" className="work-warning-error">{actionError}</p>}
  {!error&&!ready&&<p>Đang tải tác vụ…</p>}
  {ready&&!items.length&&<p>Không có tác vụ cần cảnh báo trong phạm vi này.</p>}
  <div className="alert-strip">{items.map(({item,unread,reasons})=>{
   const assigned=item.performers.includes(who);
   const unreceived=item.performers.filter(id=>!(item.received_by||[]).includes(id));
   const canReceive=assigned&&item.status==='Mới'&&unreceived.includes(who);
   const canConfirmDaily=assigned&&Boolean(item.daily)&&!item.daily_done_today&&reasons.includes('Nhắc hằng ngày');
   return <article key={item.id} className="home-alert-item">
    <button type="button" className="home-alert-card" onClick={()=>open(item.id)}>
     <b>{labels[item.kind]}</b><span>{item.title}</span>
     <small>{item.status}{item.due?' · '+item.due.split('-').reverse().join('/'):''}</small>
     <span className="work-warning-reasons">{reasons.join(' · ')}</span>
     {item.status==='Mới'&&unreceived.length>0&&<small>{unreceived.length} người chưa xác nhận nhận việc</small>}
     {Number(unread)>0&&<em>{unread} tin chưa đọc</em>}
     {item.latest_message&&<em className="home-alert-detail">{item.latest_message}</em>}
    </button>
    {(canReceive||canConfirmDaily)&&<div className="work-warning-actions">
     {canReceive&&<button type="button" disabled={saving===item.id}
      onClick={()=>void acknowledge(item.id,'receive')}>✓ Đã nhận việc</button>}
     {canConfirmDaily&&<button type="button" disabled={saving===item.id}
      onClick={()=>void acknowledge(item.id,'dailyDone')}>✓ Đã thực hiện hôm nay</button>}
    </div>}
   </article>
  })}</div>
 </section></main>;
}
