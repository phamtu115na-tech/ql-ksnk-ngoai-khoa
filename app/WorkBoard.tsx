'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';

type Kind='task'|'reminder';
type Item={id:string;source_row:number;kind:Kind;title:string;note?:string;status:string;due:string;latest_message:string;owner_id:string;performers:string[];observers:string[]};
type Row={item:Item;unread:number};
export function useWorkFeed(){return useContext(Feed);}
const labels={task:'Giao việc',reminder:'Nhắc việc'};
const Feed=createContext<{names:Record<string,string>;rows:Row[];open:(id:string)=>void;error:string;ready:boolean}>({names:{},rows:[],open:()=>{},error:'',ready:false});
export function WorkProvider({children}:{children:React.ReactNode}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [names,setNames]=useState<Record<string,string>>({});
 useEffect(()=>{const controller=new AbortController();
  fetch('/api/connect',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'me'})})
  .then(r=>r.ok?r.json():null).then(data=>{if(data?.people)setNames(Object.fromEntries(data.people.map((p:{id:string;name:string;admin:boolean;username:string;staff_code?:string})=>[p.id,p.admin&&!p.staff_code?p.username:p.name])));}).catch(()=>{});
  return ()=>controller.abort();},[]);
 const [thread,setThread]=useState(''),[revision,reload]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{setThread(new URLSearchParams(location.search).get('thread')||'');},[]);
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
 function close(){setThread('');reload(n=>n+1);const u=new URL(location.href);u.searchParams.delete('thread');history.replaceState(null,'',u);}
 useEffect(()=>{if(!thread)return;dialog.current?.showModal();
  function message(e:MessageEvent){if(e.origin===location.origin&&e.source===frame.current?.contentWindow&&e.data==='ksnk-close-thread')close();}
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[thread]);
 return <Feed.Provider value={{names,rows,open:setThread,error,ready}}>{children}{thread&&<dialog ref={dialog} className="nk-thread-dialog" aria-label="Chi tiết và trò chuyện" onCancel={close}><button onClick={close}>Đóng phiếu ×</button><iframe ref={frame} title="Chi tiết và trò chuyện" src={'/connect/index.html?detail=1&thread='+encodeURIComponent(thread)}/></dialog>}</Feed.Provider>;
}
export function WorkMessage({source,compact=false}:{source:unknown;compact?:boolean}){
 const {rows,open}=useContext(Feed),row=rows.find(x=>String(x.item.source_row)===String(source));
 if(!row||(!row.item.latest_message&&!Number(row.unread)))return null;
 const value=<><b>{Number(row.unread)>0?row.unread+' tin chưa đọc':'Trao đổi'}</b> · {row.item.latest_message}</>;
 return compact?<span className="nk-row-message">{value}</span>:<button type="button" className="nk-row-message" onClick={()=>open(row.item.id)}>{value}</button>;
}
export default function WorkBoard({kind,home=false,manager=false,who=''}:{kind?:Kind;home?:boolean;manager?:boolean;who?:string}){
 const {rows,open,error,ready}=useContext(Feed),[mine,setMine]=useState(false),[filter,setFilter]=useState('');
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const visible=rows.filter(({item:t})=>(!kind||t.kind===kind)&&(!mine||[t.owner_id,...t.performers,...t.observers].includes(who)));
 function matches(r:Row,k:string){const t=r.item;if(k==='Tin chưa đọc')return Number(r.unread)>0;if(k==='Mới giao')return t.status==='Mới';return t.status!=='Hoàn thành'&&!!t.due&&(k==='Quá hạn'?t.due<today:t.due===today);}
 const items=visible.filter(r=>filter?matches(r,filter):!home||['Tin chưa đọc','Quá hạn','Đến hạn hôm nay','Mới giao'].some(k=>matches(r,k)));
 return <main className="content-shell"><section className="home-alerts home-alerts-first"><div className="home-alerts-heading"><div className="section-title">⚠ CẢNH BÁO GIAO VIỆC &amp; NHẮC VIỆC</div>
 {manager&&<label>Phạm vi <select value={mine?'mine':'all'} onChange={e=>setMine(e.target.value==='mine')}><option value="all">Toàn viện</option><option value="mine">Của tôi</option></select></label>}</div>
 <div className="task-view-tabs">{['Mới giao','Đến hạn hôm nay','Quá hạn','Tin chưa đọc'].map(k=><button key={k} type="button" className={filter===k?'active':''} aria-pressed={filter===k} onClick={()=>setFilter(filter===k?'':k)}>{k} ({visible.filter(r=>matches(r,k)).length})</button>)}</div>
 {error&&<p role="alert">{error}</p>}{!error&&!ready&&<p>Đang tải phiếu…</p>}{ready&&!items.length&&<p>Không có phiếu trong phạm vi này.</p>}
 <div className="alert-strip">{items.map(({item,unread})=><article key={item.id} className="home-alert-item"><button className="home-alert-card" onClick={()=>open(item.id)}><b>{labels[item.kind]}</b><span>{item.title}</span><small>{item.status}{item.due?' · '+item.due.split('-').reverse().join('/'):''}</small>{Number(unread)>0&&<em>{unread} tin chưa đọc</em>}{item.latest_message&&<em className="home-alert-detail">{item.latest_message}</em>}</button></article>)}</div></section></main>;
}
