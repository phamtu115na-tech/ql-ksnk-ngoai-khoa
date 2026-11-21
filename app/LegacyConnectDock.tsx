'use client';
import {useEffect,useRef,useState} from 'react';

type Update={id:string;kind:string;title:string;body:string;seq:number};
const labels:Record<string,string>={task:'Việc được giao',reminder:'Nhắc việc',chat:'Trao đổi'};
const link=(type:string,id?:string)=>'/connect/index.html'+(id?'?thread='+encodeURIComponent(id):'')+'#'+type;

export default function LegacyConnectDock(){
 const [counts,setCounts]=useState<Record<string,number>>({});
 const [latest,setLatest]=useState<Update|null>(null);
 const [sound,setSound]=useState(false);
 const audio=useRef<AudioContext|null>(null);
 const seen=useRef('');
 useEffect(()=>{
  let live=true,loading=false;
  async function sync(){
   if(document.hidden||loading)return;
   loading=true;
   try{
    const response=await fetch('/api/connect',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'counts'})});
    if(!response.ok)return;
    const data=await response.json();if(!live)return;
    setCounts(Object.fromEntries(data.badges.map((r:{kind:string;unread:number})=>[r.kind,Number(r.unread)])));
    const item:Update|null=data.latest;setLatest(item);
    const key=item?item.id+'/'+item.seq:'';
    const ctx=audio.current;
    if(key&&key!==seen.current&&ctx?.state==='running'){
     const tone=ctx.createOscillator(),gain=ctx.createGain();
     tone.connect(gain);gain.connect(ctx.destination);gain.gain.value=.06;
     tone.frequency.value=650;tone.start();tone.stop(ctx.currentTime+.24);
    }
    seen.current=key;
   }catch{}finally{loading=false}
  }
  void sync();const timer=setInterval(sync,12000);document.addEventListener('visibilitychange',sync);
  return ()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',sync);void audio.current?.close();audio.current=null;};
 },[]);
 async function toggle(){
  if(audio.current){await audio.current.close();audio.current=null;setSound(false);return;}
  const ctx=new AudioContext();await ctx.resume();audio.current=ctx;setSound(true);
 }
 return <aside className="nk-notifications" aria-label="Thông báo công việc">
 {latest&&<a role="status" className="nk-latest" href={link(latest.kind,latest.id)}><strong>{latest.kind==='chat'?'Tin nhắn mới':latest.title}</strong><span>{latest.body}</span></a>}
 <nav><button type="button" aria-pressed={sound} onClick={toggle}>{sound?'Tắt chuông':'Bật chuông'}</button>
 {Object.keys(labels).filter(k=>k!=='task'||counts.task>0).map(k=><a key={k} href={link(k)}>{labels[k]} {counts[k]>0&&<b>{counts[k]}</b>}</a>)}</nav></aside>;
}
