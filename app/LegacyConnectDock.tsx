'use client'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
type Item={id:string;kind:string;title:string;status:string;sender:string;due:string;unread:number;preview:string}
type Approval={unread_total?:number;id:number;thread:string;kind:string;body:string;read_at:string|null;created_at:string;cx_threads:{title:string;kind:string};cx_people:{name:string}}
type Alerts={task:number;reminder:number;items:Item[]}
const labels:Record<string,string>={task:'Giao việc',reminder:'Nhắc việc',chat:'Tin nhắn riêng'}
const RING_CHOICE_KEY='ksnk.notification.ring.enabled.v1'
const RING_SEEN_KEY='ksnk.notification.ring.seen.v1'
const RING_VOLUME_KEY='ksnk.notification.ring.volume.v1'
const link=(kind:string,id='')=>'/ngoai-khoa?work='+kind+(id?'&thread='+encodeURIComponent(id):'')
async function load(body:object){
 const r=await fetch('/api/connect',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!r.ok)throw Error('Không tải được thông báo.')
 return r.json()
}
export default function Dock(){
 const [host,setHost]=useState<Element|null>(null),[open,setOpen]=useState(false),[offset,setOffset]=useState(0)
 const [events,setEvents]=useState<Approval[]>([])
 const [badges,setBadges]=useState<Record<string,number>>({}),[alerts,setAlerts]=useState<Alerts|null>(null),[error,setError]=useState(''),[sound,setSound]=useState(false),[volume,setVolume]=useState(80)
 const ctx=useRef<AudioContext|null>(null),bell=useRef<HTMLButtonElement>(null)
 const soundRef=useRef(false),volumeRef=useRef(.8),firstFetch=useRef(false),seenKeys=useRef<string[]>([]),playing=useRef<OscillatorNode[]>([])
 const stopRinging=()=>{const current=playing.current.splice(0);for(const node of current){try{node.stop()}catch{/* đã dừng */}}}
 // Chuông hai nhịp, kéo dài khoảng 5 giây, tăng âm lượng so với bản cũ và có tùy chọn điều chỉnh.
 const ringForFiveSeconds=()=>{
  if(!soundRef.current||document.hidden)return
  let audio=ctx.current
  try{if(!audio){audio=new AudioContext();ctx.current=audio}}catch{return}
  const schedule=()=>{
   if(!audio||!soundRef.current||audio.state!=='running')return
   stopRinging()
   const start=audio.currentTime+.03
   for(let cycle=0;cycle<10;cycle++)for(let pulse=0;pulse<2;pulse++){
    const time=start+cycle*.5+pulse*.22
    for(const [frequency,peak] of [[860,.11],[1160,.06]] as const){
     const oscillator=audio.createOscillator(),gain=audio.createGain()
     oscillator.type='sine';oscillator.frequency.value=frequency
     gain.gain.setValueAtTime(.0001,time)
     gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak*volumeRef.current),time+.018)
     gain.gain.exponentialRampToValueAtTime(.0001,time+.17)
     oscillator.connect(gain);gain.connect(audio.destination)
     oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();playing.current=playing.current.filter(item=>item!==oscillator)}
     oscillator.start(time);oscillator.stop(time+.175);playing.current.push(oscillator)
    }
   }
  }
  if(audio.state==='running')schedule()
  else void audio.resume().then(schedule).catch(()=>{/* Trình duyệt chưa cho phép âm thanh tự động */})
 }
 const toggleRinging=async()=>{
  const enabled=!soundRef.current
  soundRef.current=enabled;setSound(enabled)
  try{localStorage.setItem(RING_CHOICE_KEY,enabled?'1':'0')}catch{}
  if(!enabled){stopRinging();return}
  try{if(!ctx.current)ctx.current=new AudioContext();await ctx.current.resume()}catch{/* Trình duyệt cần người dùng cho phép phát âm */}
 }
 useEffect(()=>{
  try{
   const saved=localStorage.getItem(RING_CHOICE_KEY)==='1'
   soundRef.current=saved;setSound(saved)
   const storedVolume=Number(localStorage.getItem(RING_VOLUME_KEY)||80)
   const initialVolume=Number.isFinite(storedVolume)?Math.min(100,Math.max(20,storedVolume)):80
   volumeRef.current=initialVolume/100;setVolume(initialVolume)
   const prior=JSON.parse(localStorage.getItem(RING_SEEN_KEY)||'[]')
   if(Array.isArray(prior))seenKeys.current=prior.filter((item):item is string=>typeof item==='string').slice(-100)
  }catch{}
 },[])
 useEffect(()=>{const sync=()=>setHost(document.querySelector('.app-header')||document.querySelector('.nk-account-nav'));sync();const o=new MutationObserver(sync);o.observe(document.body,{childList:true,subtree:true});return()=>{o.disconnect();stopRinging();void ctx.current?.close()}},[])
 useEffect(()=>{
  let active=true,busy=false
  async function refresh(){
   if(document.hidden||busy)return
   busy=true
   try{const [counts,list,decisions]=await Promise.all([load({action:'counts'}),open?load({action:'workAlerts',kind:'all',offset}):null,load({action:'approvalEvents'})]);if(!active)return
    setBadges(Object.fromEntries(counts.badges.map((r:{kind:string;unread:number})=>[r.kind,Number(r.unread)])));if(list)setAlerts(list);setEvents(decisions);setError('')
    const key=counts.latest?String(counts.latest.id)+'/'+String(counts.latest.seq):''
    const first= !firstFetch.current
    firstFetch.current=true
    if(key){
     // Đã phát hoặc đã nhận thông báo này: không đổ chuông lần nữa sau poll, refresh hoặc mở tab mới.
     let prior=seenKeys.current
     try{
      const saved=JSON.parse(localStorage.getItem(RING_SEEN_KEY)||'[]')
      if(Array.isArray(saved))prior=saved.filter((item):item is string=>typeof item==='string').slice(-100)
     }catch{}
     const already=prior.includes(key)
     if(!already){
      seenKeys.current=[...prior,key].slice(-100)
      try{localStorage.setItem(RING_SEEN_KEY,JSON.stringify(seenKeys.current))}catch{}
      if(!first&&soundRef.current)ringForFiveSeconds()
     }else seenKeys.current=prior
    }
   }catch(e){if(active)setError(String(e))}finally{busy=false}
  }
  void refresh();const timer=setInterval(refresh,12000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh)}
 },[open,offset])
 async function ack(id:number,handled:boolean){try{await load({action:'ackEvent',eventId:id,handled});setEvents(old=>handled?old.filter(e=>e.id!==id):old.map(e=>e.id===id?{...e,read_at:new Date().toISOString()}:e))}catch(e){setError(String(e))}}
 const unread=Object.values(badges).reduce((a,b)=>a+b,0)+Number(events[0]?.unread_total??events.filter(e=>!e.read_at).length)
 if(!host)return null
 return createPortal(<><div className="ksnk-bell"><button type="button" ref={bell} aria-label={'Thông báo, '+unread+' tin chưa đọc'} aria-expanded={open} onClick={()=>setOpen(!open)}>Thông báo{unread>0?' ('+unread+')':''}</button>
 {open&&<section aria-label="Trung tâm thông báo" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);bell.current?.focus()}}}><header><b>Trung tâm thông báo</b><button onClick={()=>setOpen(false)}>Đóng</button></header><p><a href={link('chat')}>Tin nhắn riêng ({badges.chat||0})</a></p>
 <div className="ksnk-ring-controls"><p className="ksnk-ring-hint">Chuông: {sound?'Đang bật':'Đang tắt'} · khoảng 5 giây cho thông báo mới.</p>
 <label className="ksnk-ring-volume">Âm lượng <input type="range" min="20" max="100" step="10" value={volume} onChange={e=>{const next=Number(e.target.value);setVolume(next);volumeRef.current=next/100;try{localStorage.setItem(RING_VOLUME_KEY,String(next))}catch{}}} aria-label="Điều chỉnh âm lượng chuông"/><b>{volume}%</b></label>
 <button type="button" className="ksnk-ring-test" onClick={ringForFiveSeconds} disabled={!sound}>▶ Nghe thử chuông 5 giây</button></div>
 {events.map(e=><article key={e.id}><a className="ksnk-notice" href={link(e.cx_threads.kind,e.thread)} onClick={()=>{void ack(e.id,false)}}><strong>{e.cx_threads.title}</strong><small>{e.kind} · {e.cx_people?.name} · {new Date(e.created_at).toLocaleString('vi-VN')}</small><span>{e.body}</span></a><button onClick={()=>ack(e.id,true)}>Đã xử lý</button></article>)}
 {error?<p role="alert">{error}</p>:!alerts?<p>Đang tải…</p>:<><p>{alerts.task+alerts.reminder} tác vụ đến hạn hoặc có tin mới</p>{alerts.items.map(i=><a className="ksnk-notice" key={i.id} href={link(i.kind,i.id)}><strong>{i.title}</strong><small>{labels[i.kind]} · {i.sender} · {i.status} {i.due}</small>{i.unread>0&&<span>{i.unread} tin chưa đọc · {i.preview}</span>}</a>)}{offset>0&&<button onClick={()=>setOffset(offset-40)}>Trang trước</button>}{offset+40<alerts.task+alerts.reminder&&<button onClick={()=>setOffset(offset+40)}>Trang sau</button>}</>}</section>}</div><button type="button" className={'ksnk-sound-switch '+(sound?'is-on':'is-off')} aria-pressed={sound} aria-label={sound?'Tắt chuông thông báo':'Bật chuông thông báo'} title={sound?'Chuông đang bật · bấm để tắt':'Chuông đang tắt · bấm để bật'} onClick={()=>void toggleRinging()}><span aria-hidden="true">{sound?'🔔':'🔕'}</span><span>{sound?'Bật':'Tắt'}</span></button><button type="button" className="ksnk-signout" onClick={async()=>{try{const r=await fetch('/api/auth',{method:'DELETE'});if(!r.ok)throw Error('Không đăng xuất được.');location.replace('/')}catch(e){setOpen(true);setError(String(e))}}}>Đăng xuất</button><a className="ksnk-chat-launch" href={link('chat')}>✉ Trao đổi {badges.chat>0&&<b>{badges.chat}</b>}</a><style>{`
 .ksnk-sound-switch{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:33px;min-width:66px;padding:4px 9px;margin:0;border:1px solid #cbd5e1;border-radius:8px;background:#f1f5f9;color:#334155;font:700 12px system-ui;cursor:pointer;white-space:nowrap}
 .ksnk-sound-switch.is-on{background:#fff7dd;color:#8a5208;border-color:#edc36c}
 .ksnk-sound-switch:hover{filter:brightness(.97)}
 .ksnk-sound-switch:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
 .ksnk-sound-switch>span:first-child{font-size:17px;line-height:1}
 .ksnk-ring-hint{font-size:12px;color:#536477}
 .ksnk-ring-controls{display:grid;gap:8px;margin:8px 0;padding:10px;border:1px solid #dce5f0;border-radius:9px;background:#f8fafc}
 .ksnk-ring-controls p{margin:0}
 .ksnk-ring-volume{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:700;color:#294567}
 .ksnk-ring-volume input{flex:1;min-width:60px;accent-color:#1450a7}
 .ksnk-ring-volume b{min-width:33px;text-align:right}
 .ksnk-ring-test{align-self:start;border:1px solid #a8c4ed;border-radius:7px;padding:6px 9px;background:#eef6ff;color:#174a8c;font:700 12px system-ui;cursor:pointer}
 .ksnk-ring-test:disabled{opacity:.5;cursor:not-allowed}
 .app-header>.ksnk-sound-switch{order:5;flex:0 0 auto}
 @media(max-width:600px){.ksnk-sound-switch{height:30px;min-width:54px;padding:3px 6px;font-size:11px}}
`}</style></>,host)
}
