'use client';

import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

function normalized(value:string|null|undefined){
 return (value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
}

export default function HeaderQuickActions(){
 const[host,setHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  const sync=()=>setHost(document.querySelector<HTMLElement>('.app-header'));
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 if(!host)return null;

 const goHome=()=>{
  const back=document.querySelector<HTMLButtonElement>('.module-toolbar .back-btn');
  if(back){back.click();window.scrollTo({top:0,behavior:'smooth'});return;}
  window.scrollTo({top:0,behavior:'smooth'});
 };

 const openReminders=()=>{
  const taskButton=Array.from(document.querySelectorAll<HTMLButtonElement>('.side-menu nav button')).find(button=>{
   const label=normalized(button.textContent);
   return label.includes('giao viec')&&label.includes('nhac viec');
  });
  if(taskButton)taskButton.click();
  let attempts=0;
  const openTab=()=>{
   const reminderTab=Array.from(document.querySelectorAll<HTMLButtonElement>('.task-view-tabs button')).find(button=>{
    const label=normalized(button.textContent);
    return label.includes('nhac viec')&&label.includes('ghi chu');
   });
   if(reminderTab){reminderTab.click();window.scrollTo({top:0,behavior:'smooth'});return true;}
   return false;
  };
  if(openTab())return;
  const timer=window.setInterval(()=>{
   attempts+=1;
   if(openTab()||attempts>=25)window.clearInterval(timer);
  },120);
 };

 return createPortal(<>
  <nav className="header-quick-actions" aria-label="Truy cập nhanh">
   <button type="button" className="header-quick-action header-home-action" onClick={goHome} title="Về trang chủ"><span aria-hidden="true">⌂</span><b>TRANG CHỦ</b></button>
   <button type="button" className="header-quick-action header-reminder-action" onClick={openReminders} title="Mở Nhắc việc & Ghi chú"><span aria-hidden="true">📝</span><b>NHẮC VIỆC &amp; GHI CHÚ</b></button>
  </nav>
  <style>{`
   .app-header{justify-content:flex-start!important}
   .app-header>.menu-toggle{order:0}
   .header-quick-actions{order:1;display:flex;align-items:center;gap:8px;min-width:0;margin-right:auto}
   .app-header>.hospital-brand{order:2;margin-left:auto}
   .header-quick-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:42px;padding:0 14px;border-radius:8px;font:inherit;font-size:14px;font-weight:900;white-space:nowrap;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
   .header-quick-action:hover{transform:translateY(-1px);box-shadow:0 5px 12px rgba(15,44,96,.18)}
   .header-quick-action:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
   .header-home-action{border:2px solid #174ea6;background:#174ea6;color:#fff}
   .header-home-action:hover{background:#123b8f}
   .header-reminder-action{border:2px solid #16834b;background:#f0fff6;color:#14532d}
   .header-reminder-action:hover{background:#dcfce7}
   .header-quick-action>span{font-size:18px;line-height:1}
   @media(max-width:900px){
    .app-header{flex-wrap:wrap!important}
    .header-quick-actions{order:3;width:100%;margin:0;gap:6px}
    .header-quick-action{flex:1 1 auto;min-width:0;height:40px;padding:0 10px;font-size:12px}
    .header-reminder-action{flex:2 1 190px}
    .app-header>.hospital-brand{order:2;min-width:0}
   }
   @media(max-width:520px){
    .header-quick-action{font-size:11px;padding:0 8px}
    .header-quick-action>span{font-size:15px}
   }
  `}</style>
 </>,host);
}
