'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';

type Kind='task'|'reminder';
type Item={id:string;source_row:number;kind:Kind;title:string;note?:string;status:string;due:string;latest_message:string;mentioned:boolean;message_time:string;message_sender:string;owner_id:string;performers:string[];observers:string[]};
type Row={item:Item;unread:number};
export function useWorkFeed(){return useContext(Feed);}
const labels={task:'Giao việc',reminder:'Nhắc việc'};
const Feed=createContext<{selection:string;select:(id:string)=>void;team:boolean;canAssign:boolean;names:Record<string,string>;rows:Row[];open:(id:string)=>void;error:string;ready:boolean}>({selection:'',select:()=>{},team:false,canAssign:false,names:{},rows:[],open:()=>{},error:'',ready:false});
export function WorkProvider({children,team=false,legacy=false}:{legacy?:boolean;team?:boolean;children:React.ReactNode}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [canAssign,setCanAssign]=useState(false);
 const [names,setNames]=useState<Record<string,string>>({});
 useEffect(()=>{const controller=new AbortController();
  fetch('/api/connect',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'me'})})
  .then(r=>r.ok?r.json():null).then(data=>{setCanAssign(Boolean(data?.me?.team_lead&&data.me.work_role_reviewed&&data.me.work_edit&&data.me.work_view));if(data?.people)setNames(Object.fromEntries(data.people.map((p:{id:string;name:string;admin:boolean;username:string;staff_code?:string})=>[p.id,p.admin&&!p.staff_code?p.username:p.name])));}).catch(()=>{});
  return ()=>controller.abort();},[]);
 const [thread,setThread]=useState(''),[revision,reload]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null);
 const [selection,select]=useState('');
 useEffect(()=>{const q=new URLSearchParams(location.search);const id=q.get('thread')||'';
  if(id)setThread(id); // Mọi đường mở đều dùng một khung chi tiết + trò chuyện.
 },[]);
 function openWork(id:string){
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return;
  select('');setThread(id); // Không phụ thuộc bộ lọc, tab hay danh sách được tải.
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
    if(active){setRows(result);setError('');setReady(true);}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Lỗi kết nối');}finally{busy=false;}
  }
  void refresh();const timer=setInterval(refresh,16000);window.addEventListener('focus',refresh);
  return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[revision]);
 useEffect(()=>{const onOpen=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(typeof id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))openWork(id)};window.addEventListener('ksnk-open-work-thread',onOpen);return()=>window.removeEventListener('ksnk-open-work-thread',onOpen)},[]);
 function close(){setThread('');reload(n=>n+1);const u=new URL(location.href);u.searchParams.delete('thread');history.replaceState(null,'',u);}
 useEffect(()=>{if(!thread)return;dialog.current?.showModal();
  function message(e:MessageEvent){if(e.origin===location.origin&&e.source===frame.current?.contentWindow&&e.data==='ksnk-close-thread')close();}
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[thread]);
 return <Feed.Provider value={{selection,select,team,canAssign,names,rows,open:openWork,error,ready}}>{children}{thread&&<dialog ref={dialog} className="nk-thread-dialog" aria-label="Chi tiết và trò chuyện" onCancel={close}><button onClick={close}>Đóng trao đổi ×</button><iframe ref={frame} title="Chi tiết và trò chuyện" src={'/connect/index.html?detail=1&inline=1&thread='+encodeURIComponent(thread)}/></dialog>}</Feed.Provider>;
}
export function WorkArea({kind,children}:{kind?:Kind;children:React.ReactNode}){
 const {selection,select,rows,ready,canAssign}=useWorkFeed();
 const [creating,setCreating]=useState(false);
 const job=rows.find(row=>row.item.id===selection&&row.item.kind===kind)?.item;
 const panel=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if((job||creating)&&panel.current&&!panel.current.open)panel.current.showModal()},[job?.id,creating]);
 if(!kind)return <>{children}</>;
 return <div className="work-task-area" data-work-area={kind}>
  <div className="work-task-list">{children}</div>
  {(job||creating)&&<dialog ref={panel} className="work-conversation" aria-label={labels[kind]+' và trao đổi'} onCancel={()=>{select('');setCreating(false)}}>
   <header><h3>{job?.title||labels[kind]}</h3><button type="button" onClick={()=>{select('');setCreating(false)}}>✕ Đóng</button></header>
   <iframe key={job?.id||kind} title={labels[kind]+' · Chi tiết và trò chuyện'} src={'/connect/index.html?inline=1&'+(job?'thread='+encodeURIComponent(job.id):'compose='+kind)}/>
  </dialog>}
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
  return <button type="button" className={'nk-row-message-compact'+(row.item.mentioned?' is-mentioned':'')}
    title={row.item.latest_message||label} aria-label={label+' ('+row.unread+' tin chưa đọc) — '+row.item.title}
    onClick={e=>{e.stopPropagation();open(row.item.id)}}><span aria-hidden="true">▤</span> {label} <b>({row.unread})</b></button>;
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
 const {rows,open,error,ready,team,names}=useContext(Feed),[employee,setEmployee]=useState(''),[mine,setMine]=useState(false),[filter,setFilter]=useState('');
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const visible=rows.filter(({item:t})=>(!kind||t.kind===kind)&&(!employee||t.performers.includes(employee)||t.owner_id===employee)&&(!mine||[t.owner_id,...t.performers,...t.observers].includes(who)));
 function matches(r:Row,k:string){const t=r.item;if(k==='Tin chưa đọc')return Number(r.unread)>0;if(k==='Mới giao')return t.status==='Mới';return t.status!=='Hoàn thành'&&!!t.due&&(k==='Quá hạn'?t.due<today:t.due===today);}
 const items=visible.filter(r=>filter?matches(r,filter):!home||['Tin chưa đọc','Quá hạn','Đến hạn hôm nay','Mới giao'].some(k=>matches(r,k)));
 return <main className="content-shell"><section className="home-alerts home-alerts-first"><div className="home-alerts-heading"><div className="section-title">⚠ CẢNH BÁO GIAO VIỆC &amp; NHẮC VIỆC</div>
 {(manager||team)&&<label>Lọc cảnh báo theo nhân viên <select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">Tất cả trong phạm vi</option>{[...new Set(rows.flatMap(r=>r.item.performers))].map(id=><option key={id} value={id}>{names[id]||'Thành viên'}</option>)}</select></label>}{manager&&<label>Phạm vi <select value={mine?'mine':'all'} onChange={e=>setMine(e.target.value==='mine')}><option value="all">Toàn viện</option><option value="mine">Của tôi</option></select></label>}</div>
 <div className="task-view-tabs">{['Mới giao','Đến hạn hôm nay','Quá hạn','Tin chưa đọc'].map(k=><button key={k} type="button" className={filter===k?'active':''} aria-pressed={filter===k} onClick={()=>setFilter(filter===k?'':k)}>{k} ({visible.filter(r=>matches(r,k)).length})</button>)}</div>
 {error&&<p role="alert">{error}</p>}{!error&&!ready&&<p>Đang tải tác vụ…</p>}{ready&&!items.length&&<p>Không có tác vụ trong phạm vi này.</p>}
 <div className="alert-strip">{items.map(({item,unread})=><article key={item.id} className="home-alert-item"><button className="home-alert-card" onClick={()=>open(item.id)}><b>{labels[item.kind]}</b><span>{item.title}</span><small>{item.status}{item.due?' · '+item.due.split('-').reverse().join('/'):''}</small>{Number(unread)>0&&<em>{unread} tin chưa đọc</em>}{item.latest_message&&<em className="home-alert-detail">{item.latest_message}</em>}</button></article>)}</div></section></main>;
}
