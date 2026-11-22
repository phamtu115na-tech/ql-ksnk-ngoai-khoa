'use client';

import {useEffect,useState} from 'react';
import {useWorkFeed} from './WorkBoard';
import {createPortal} from 'react-dom';

function normalized(value:string|null|undefined){
 return (value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
}

export default function HeaderQuickActions(){
 const {rows}=useWorkFeed();
 const unreadThreads=new Set(rows.filter(row=>Number(row.unread)>0).map(row=>row.item.id)).size;
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
  const home=document.querySelector<HTMLButtonElement>('[data-module="home"]');
  if(home){home.click();window.scrollTo({top:0,behavior:'smooth'});return;}
  window.location.assign('/ngoai-khoa');
 };
 const openReminders=()=>{
  window.dispatchEvent(new CustomEvent('ksnk-open-module',{detail:'reminders'}));
 };

 return createPortal(<>
  <nav className="header-quick-actions" aria-label="Truy cập nhanh">
   <button type="button" className="header-quick-action header-home-action" onClick={goHome} title="Về trang chủ" aria-label="Trang chủ"><span aria-hidden="true">⌂</span><b className="header-action-label">TRANG CHỦ</b></button>
   <button type="button" className="header-quick-action header-reminder-action" onClick={openReminders} title="Mở Nhắc việc & Ghi chú" aria-label="Nhắc việc và ghi chú"><span aria-hidden="true">📝</span><b className="header-action-label">NHẮC VIỆC <span className="header-extra-label">&amp; GHI CHÚ</span></b></button>
   <a className="header-work-inbox header-inbox-combined" href="/ngoai-khoa?inbox=all#tin-cong-viec" title="Xem tin mới trong Giao việc và Nhắc việc" aria-label={'Tin nhắn Giao việc và Nhắc việc, '+unreadThreads+' cuộc trao đổi chưa đọc'}><span aria-hidden="true">💬</span><span className="header-action-label">Tin nhắn</span><b aria-label="số cuộc trao đổi chưa đọc">{unreadThreads}</b></a>
  </nav>
  <style>{`
   .app-header{display:flex!important;align-items:center!important;justify-content:flex-start!important;flex-wrap:nowrap!important;min-height:52px!important;padding:5px 10px!important;gap:8px!important}
   .app-header>.menu-toggle{order:0!important;display:inline-grid!important;place-items:center!important;flex:0 0 36px!important;min-width:36px!important;width:36px!important;height:36px!important;padding:0!important;border:0!important;border-radius:8px!important;font-size:19px!important}
   .app-header>.menu-toggle .menu-action-label{display:none!important}
   .app-header>.menu-toggle .menu-action-icon{line-height:1}
   .header-quick-actions{order:1!important;display:flex;align-items:center;flex:0 0 auto;gap:6px;min-width:0;margin:0!important;flex-wrap:nowrap!important}
   .header-quick-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;height:34px;padding:0 10px;border-radius:8px;font:inherit;font-size:12px;font-weight:800;line-height:1.1;white-space:nowrap;cursor:pointer;transition:background .15s ease}
   .header-quick-action:hover{filter:brightness(.96)}
   .header-quick-action:focus-visible,.header-work-inbox:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
   .header-home-action{border:1px solid #174ea6;background:#174ea6;color:#fff}
   .header-reminder-action{border:1px solid #16834b;background:#f0fff6;color:#14532d}
   .header-quick-action>span{font-size:17px;line-height:1}
   .header-inbox-combined{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 10px!important;font-size:12px!important;font-weight:750;border-radius:8px}
   .header-inbox-combined>span:first-child{font-size:15px}
   .header-inbox-combined>b{min-width:18px;text-align:center;font-size:11px}
   .app-header>.hospital-brand{order:2!important;display:flex;align-items:center;gap:8px;flex:0 1 auto;margin-left:auto!important;min-width:0;max-width:320px}
   .app-header>.hospital-brand>div{min-width:0}
   .app-header>.hospital-brand h1{margin:0!important;font-size:15px!important;line-height:1.18!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-transform:uppercase}
   .app-header>.hospital-brand p{margin:1px 0 0!important;font-size:10px!important;line-height:1.2!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .app-header>.hospital-brand .brand-image,.app-header>.hospital-brand .brand-image-placeholder{width:34px!important;height:34px!important;flex:0 0 34px}
   .app-header>.ksnk-bell{order:3!important;flex:0 0 auto;margin:0}
   .app-header>.ksnk-bell>button{height:33px;padding:0 9px;background:#f7faff;border:1px solid #d0dceb;border-radius:7px;color:#193e69;font:700 12px system-ui;cursor:pointer;white-space:nowrap}
   .app-header>.ksnk-sound-switch{order:4!important;flex:0 0 auto!important;height:33px!important}
   .app-header>.ksnk-signout{order:5!important;flex:0 0 auto!important;min-height:33px!important;padding:5px 10px!important;font-size:12px!important}
   @media(max-width:1350px){.app-header>.hospital-brand{max-width:240px}.header-extra-label{display:none}}
   @media(max-width:1100px){.app-header{gap:6px!important}.app-header>.hospital-brand{max-width:190px}.app-header>.hospital-brand p{display:none}.header-quick-action{padding:0 7px}}
   @media(max-width:900px){.app-header{gap:5px!important;padding:5px 7px!important}.app-header>.hospital-brand{max-width:148px}.app-header>.hospital-brand h1{font-size:12px!important}.header-quick-actions{gap:4px}.header-action-label{display:none}.header-quick-action{min-width:34px;width:34px;padding:0 6px}.header-inbox-combined{padding:0 6px!important}.app-header>.ksnk-bell>button{padding:0 6px}}
   @media(max-width:650px){.app-header>.hospital-brand{display:none}.app-header>.ksnk-bell>button{font-size:0}.app-header>.ksnk-bell>button::before{content:'📣';font-size:16px}.app-header>.ksnk-signout{font-size:11px!important;padding:4px 6px!important}}
   @media(max-width:390px){.app-header{gap:3px!important;padding:4px 5px!important}.header-inbox-combined>span:first-child{display:none}.app-header>.ksnk-signout{padding:4px!important;font-size:10px!important}}
`}</style>
 </>,host);
}
