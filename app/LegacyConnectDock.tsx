'use client';
import {useEffect,useState} from 'react';

export default function LegacyConnectDock(){
 const [counts,setCounts]=useState<Record<string,number>>({});
 useEffect(()=>{
  let live=true;
  async function sync(){
   if(document.hidden)return;
   try{
    const response=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'counts'})});
    if(!response.ok)return;
    const data=await response.json();
    if(live)setCounts(Object.fromEntries(data.badges.map((r:{kind:string;unread:number})=>[r.kind,Number(r.unread)])));
   }catch{}
  }
  void sync();const timer=setInterval(sync,12000);
  return ()=>{live=false;clearInterval(timer)};
 },[]);
 return <nav aria-label="Trao đổi công việc" style={{position:'fixed',zIndex:50,bottom:12,left:12,right:12,display:'flex',justifyContent:'space-between',pointerEvents:'none'}}>
 {(['reminder','chat'] as const).map(k=><a key={k} style={{pointerEvents:'auto',borderRadius:24,padding:'8px 16px',background:'#225b9d',color:'white'}} href={'/connect/index.html#'+k}>{k==='chat'?'✉ Trao đổi':'☷ Nhắc việc'} {counts[k]?('('+counts[k]+')'):''}</a>)}
 </nav>;
}
