'use client'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
type Item={id:string;kind:string;title:string;status:string;sender:string;due:string;unread:number;preview:string}
type Alerts={task:number;reminder:number;items:Item[]}
const labels:Record<string,string>={task:'Giao việc',reminder:'Nhắc việc',chat:'Tin nhắn riêng'}
const link=(kind:string,id='')=>'/ngoai-khoa?work='+kind+(id?'&thread='+encodeURIComponent(id):'')
async function load(body:object){
 const r=await fetch('/api/connect',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!r.ok)throw Error('Không tải được thông báo.')
 return r.json()
}
export default function Dock(){
 const [host,setHost]=useState<Element|null>(null),[open,setOpen]=useState(false),[offset,setOffset]=useState(0)
 const [badges,setBadges]=useState<Record<string,number>>({}),[alerts,setAlerts]=useState<Alerts|null>(null),[error,setError]=useState(''),[sound,setSound]=useState(false)
 const ctx=useRef<AudioContext|null>(null),seen=useRef(''),bell=useRef<HTMLButtonElement>(null)
 useEffect(()=>{const sync=()=>setHost(document.querySelector('.app-header')||document.querySelector('.nk-account-nav'));sync();const o=new MutationObserver(sync);o.observe(document.body,{childList:true,subtree:true});return()=>{o.disconnect();void ctx.current?.close()}},[])
 useEffect(()=>{
  let active=true,busy=false
  async function refresh(){
   if(document.hidden||busy)return
   busy=true
   try{const [counts,list]=await Promise.all([load({action:'counts'}),open?load({action:'workAlerts',kind:'all',offset}):null]);if(!active)return
    setBadges(Object.fromEntries(counts.badges.map((r:{kind:string;unread:number})=>[r.kind,Number(r.unread)])));if(list)setAlerts(list);setError('')
    const key=counts.latest?counts.latest.id+'/'+counts.latest.seq:''
    if(key&&seen.current&&key!==seen.current&&ctx.current){const tone=ctx.current.createOscillator(),gain=ctx.current.createGain();gain.gain.value=.06;tone.connect(gain);gain.connect(ctx.current.destination);tone.start();tone.stop(ctx.current.currentTime+.2)}seen.current=key
   }catch(e){if(active)setError(String(e))}finally{busy=false}
  }
  void refresh();const timer=setInterval(refresh,12000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh)}
 },[open,offset])
 if(!host)return null
 return createPortal(<div className="ksnk-bell"><button type="button" ref={bell} aria-label={'Thông báo, '+Object.values(badges).reduce((a,b)=>a+b,0)+' tin chưa đọc'} aria-expanded={open} onClick={()=>setOpen(!open)}>🔔 {Object.values(badges).reduce((a,b)=>a+b,0)}</button>
 {open&&<section aria-label="Trung tâm thông báo" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);bell.current?.focus()}}}><header><b>Trung tâm thông báo</b><button onClick={()=>setOpen(false)}>Đóng</button></header><p><a href={link('chat')}>Tin nhắn riêng ({badges.chat||0})</a></p>
 <button aria-pressed={sound} onClick={async()=>{if(ctx.current){await ctx.current.close();ctx.current=null;setSound(false)}else{ctx.current=new AudioContext();await ctx.current.resume();setSound(true)}}}>{sound?'Tắt âm báo':'Bật âm báo'}</button>
 {error?<p role="alert">{error}</p>:!alerts?<p>Đang tải…</p>:<><p>{alerts.task+alerts.reminder} tác vụ đến hạn hoặc có tin mới</p>{alerts.items.map(i=><a className="ksnk-notice" key={i.id} href={link(i.kind,i.id)}><strong>{i.title}</strong><small>{labels[i.kind]} · {i.sender} · {i.status} {i.due}</small>{i.unread>0&&<span>{i.unread} tin chưa đọc · {i.preview}</span>}</a>)}{offset>0&&<button onClick={()=>setOffset(offset-40)}>Trang trước</button>}{offset+40<alerts.task+alerts.reminder&&<button onClick={()=>setOffset(offset+40)}>Trang sau</button>}</>}</section>}</div>,host)
}
