'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';

type Kind='task'|'reminder';
type Item={id:string;source_row:number;kind:Kind;title:string;status:string;due:string;latest_message:string;owner_id:string;performers:string[];observers:string[]};
type Row={item:Item;unread:number};
const labels={task:'Giao việc',reminder:'Nhắc việc'};
const Feed=createContext<{rows:Row[];open:(id:string)=>void;error:string;ready:boolean}>({rows:[],open:()=>{},error:'',ready:false});
export function WorkProvider({children}:{children:React.ReactNode}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false);
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
 return <Feed.Provider value={{rows,open:setThread,error,ready}}>{children}{thread&&<dialog ref={dialog} className="nk-thread-dialog" aria-label="Chi tiết và trò chuyện" onCancel={close}><button onClick={close}>Đóng phiếu ×</button><iframe ref={frame} title="Chi tiết và trò chuyện" src={'/connect/index.html?detail=1&thread='+encodeURIComponent(thread)}/></dialog>}</Feed.Provider>;
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
 return <section className="panel-card nk-native"><h2>{home?'Công việc cần xử lý':kind==='task'?'Giao việc':'Nhắc việc & Ghi chú'}</h2>
 {manager&&<label>Phạm vi <select value={mine?'mine':'all'} onChange={e=>setMine(e.target.value==='mine')}><option value="all">Toàn viện</option><option value="mine">Của tôi</option></select></label>}
 <nav>{['Mới giao','Đến hạn hôm nay','Quá hạn','Tin chưa đọc'].map(k=><button key={k} aria-pressed={filter===k} onClick={()=>setFilter(filter===k?'':k)}>{k} ({visible.filter(r=>matches(r,k)).length})</button>)}</nav>
 {error&&<p role="alert">{error}</p>}{!error&&!ready&&<p>Đang tải phiếu…</p>}{ready&&!items.length&&<p>Không có phiếu trong phạm vi này.</p>}
 <div className="nk-native-list">{items.map(({item,unread})=><button key={item.id} onClick={()=>open(item.id)}><strong>{item.title}</strong><small>{labels[item.kind]} · {item.status}{item.due?' · '+item.due.split('-').reverse().join('/'):''}</small>{Number(unread)>0&&<b>{unread} tin chưa đọc</b>}{item.latest_message&&<span>{item.latest_message}</span>}</button>)}</div></section>;
}
