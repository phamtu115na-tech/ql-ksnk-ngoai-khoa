'use client';

import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';

function norm(value:string|null|undefined){return (value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim()}

export default function ReminderDetailActions(){
 const[host,setHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  const sync=()=>setHost(document.querySelector<HTMLElement>('.reminder-detail-panel > .toolbar-line'));
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 if(!host)return null;

 const currentRow=()=>{
  const panel=host.closest<HTMLElement>('.reminder-detail-panel');
  const grid=panel?.querySelector<HTMLElement>('.reminder-detail-grid');
  if(!panel||!grid)return null;
  const values=Array.from(grid.querySelectorAll<HTMLElement>(':scope > div')).map(item=>({label:norm(item.querySelector('small')?.textContent),value:norm(item.querySelector('b')?.textContent||item.querySelector('p')?.textContent)}));
  const title=values.find(x=>x.label==='tieu de')?.value||'';
  const person=values.find(x=>x.label==='nguoi lien quan')?.value||'';
  const date=values.find(x=>x.label==='ngay nhac')?.value||'';
  const container=panel.parentElement?.closest<HTMLElement>('.panel-card')||panel.parentElement;
  return Array.from(container?.querySelectorAll<HTMLTableRowElement>('tbody tr')||[]).find(row=>{const text=norm(row.textContent);return(!title||text.includes(title))&&(!person||text.includes(person))&&(!date||text.includes(date))})||null;
 };
 const clickAction=(kind:'sua'|'xoa')=>{
  const row=currentRow();
  const button=row&&Array.from(row.querySelectorAll<HTMLButtonElement>('button')).find(btn=>{
   const label=norm(btn.textContent);
   return kind==='xoa'?(label==='xoa'||label.startsWith('xoa ')):(label==='sua'||label.startsWith('sua '));
  });
  button?.click();
 };
 return createPortal(<>
  <div className="reminder-detail-inline-actions">
   <button type="button" className="edit-btn" onClick={()=>clickAction('sua')}>✎ SỬA</button>
   <button type="button" className="danger" onClick={()=>clickAction('xoa')}>🗑 XÓA</button>
  </div>
  <style>{`.reminder-detail-inline-actions{display:flex;align-items:center;gap:8px;margin-left:auto}.reminder-detail-inline-actions button{min-height:40px;padding:9px 14px;font-weight:900}@media(max-width:680px){.reminder-detail-inline-actions{width:100%;margin-left:0}.reminder-detail-inline-actions button{flex:1}}`}</style>
 </>,host);
}
