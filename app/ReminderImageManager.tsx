'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

const MAX_IMAGE_SIZE=8*1024*1024;
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);

function norm(value:string|null|undefined){
 return (value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
}

function findReminderForm(){
 return Array.from(document.querySelectorAll<HTMLFormElement>('form.task-form')).find(form=>{
  const title=norm(form.querySelector('.form-title h3')?.textContent);
  return title==='nhac viec';
 })||null;
}

function sameFile(a:File,b:File){
 return a.name===b.name&&a.size===b.size&&a.lastModified===b.lastModified&&a.type===b.type;
}

export default function ReminderImageManager(){
 const[input,setInput]=useState<HTMLInputElement|null>(null);
 const[host,setHost]=useState<HTMLElement|null>(null);
 const[files,setFiles]=useState<File[]>([]);
 const filesRef=useRef<File[]>([]);
 const originalFetchRef=useRef<typeof window.fetch|null>(null);

 useEffect(()=>{filesRef.current=files},[files]);

 useEffect(()=>{
  const sync=()=>{
   const form=findReminderForm();
   const nextInput=form?.querySelector<HTMLInputElement>('input[name="evidenceImageFile"]')||null;
   if(nextInput){
    nextInput.multiple=true;
    nextInput.setAttribute('multiple','');
    nextInput.setAttribute('data-reminder-multi-image','true');
    const label=nextInput.closest<HTMLElement>('.evidence-label');
    setHost(label);
   }else{
    setHost(null);
    setFiles([]);
    filesRef.current=[];
   }
   setInput(nextInput);

   // Existing saved images in CHI TIẾT NHẮC VIỆC already support opening and deletion.
   // Make those actions explicit and easy to recognize.
   document.querySelectorAll<HTMLElement>('.reminder-detail-evidence .evidence-item').forEach(item=>{
    const link=item.querySelector<HTMLAnchorElement>('a');
    const remove=item.querySelector<HTMLButtonElement>('.evidence-delete');
    if(link&&!link.dataset.reminderViewLabel){
     const old=(link.textContent||'').replace(/^📎\s*/,'').trim();
     link.dataset.reminderViewLabel='1';
     link.dataset.fileName=old;
     link.textContent=`👁 XEM ẢNH${old?` · ${old}`:''}`;
     link.classList.add('reminder-evidence-view');
    }
    if(remove&&!remove.dataset.reminderDeleteLabel){
     remove.dataset.reminderDeleteLabel='1';
     if(norm(remove.textContent)==='xoa')remove.textContent='🗑 XÓA ẢNH';
     remove.classList.add('reminder-evidence-remove');
    }
   });
  };
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);

 useEffect(()=>{
  if(!input)return;
  const onChange=()=>{
   let next=Array.from(input.files||[]);
   const invalid=next.filter(file=>!IMAGE_TYPES.has(file.type)||file.size>MAX_IMAGE_SIZE);
   if(invalid.length){
    next=next.filter(file=>IMAGE_TYPES.has(file.type)&&file.size<=MAX_IMAGE_SIZE);
    const transfer=new DataTransfer();
    next.forEach(file=>transfer.items.add(file));
    input.files=transfer.files;
    window.alert(`Đã bỏ ${invalid.length} ảnh không hợp lệ. Chỉ nhận JPG, PNG, WEBP và tối đa 8 MB cho mỗi ảnh.`);
   }
   setFiles(next);
   filesRef.current=next;
  };
  input.addEventListener('change',onChange);
  onChange();
  return()=>input.removeEventListener('change',onChange);
 },[input]);

 useEffect(()=>{
  const original=window.fetch.bind(window);
  originalFetchRef.current=original;
  window.fetch=async(inputArg:RequestInfo|URL,init?:RequestInit)=>{
   const response=await original(inputArg,init);
   try{
    const url=typeof inputArg==='string'?inputArg:inputArg instanceof URL?inputArg.toString():inputArg.url;
    if(!url.includes('/api/evidence')||String(init?.method||'GET').toUpperCase()!=='POST'||!(init?.body instanceof FormData))return response;
    const formData=init.body;
    if(String(formData.get('module')||'')!=='reminders')return response;
    const uploaded=formData.get('file');
    if(!(uploaded instanceof File)||!uploaded.type.startsWith('image/')||!response.ok)return response;
    const legacyId=String(formData.get('legacy_id')||'');
    if(!legacyId)return response;
    const extras=filesRef.current.filter(file=>!sameFile(file,uploaded));
    if(!extras.length){filesRef.current=[];setFiles([]);return response;}
    for(const file of extras){
     const extra=new FormData();
     extra.append('file',file);
     extra.append('module','reminders');
     extra.append('legacy_id',legacyId);
     const upload=await original('/api/evidence',{method:'POST',body:extra});
     const result=await upload.json().catch(()=>({ok:false,error:'Không đọc được phản hồi tải ảnh'}));
     if(!upload.ok||!result.ok)throw new Error(result.error||`Không tải được ảnh ${file.name}`);
    }
    filesRef.current=[];
    setFiles([]);
   }catch(error){
    window.alert(error instanceof Error?`Phiếu đã được lưu nhưng có ảnh bổ sung chưa tải được: ${error.message}`:'Phiếu đã được lưu nhưng có ảnh bổ sung chưa tải được.');
   }
   return response;
  };
  return()=>{
   if(originalFetchRef.current)window.fetch=originalFetchRef.current;
   originalFetchRef.current=null;
  };
 },[]);

 const removeSelected=(index:number)=>{
  if(!input)return;
  const next=files.filter((_,position)=>position!==index);
  const transfer=new DataTransfer();
  next.forEach(file=>transfer.items.add(file));
  input.files=transfer.files;
  setFiles(next);
  filesRef.current=next;
 };

 const viewSelected=(file:File)=>{
  const url=URL.createObjectURL(file);
  window.open(url,'_blank','noopener,noreferrer');
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
 };

 if(!host)return null;
 return createPortal(<>
  <div className="reminder-multi-image-manager">
   <div className="reminder-multi-image-heading">
    <b>ẢNH ĐÃ CHỌN ({files.length})</b>
    <small>Có thể chọn nhiều ảnh cùng lúc. Mỗi ảnh tối đa 8 MB.</small>
   </div>
   {files.length?<div className="reminder-selected-image-list">{files.map((file,index)=>{
    const preview=URL.createObjectURL(file);
    return <div className="reminder-selected-image" key={`${file.name}-${file.lastModified}-${index}`}>
     <img src={preview} alt={file.name} onLoad={()=>URL.revokeObjectURL(preview)}/>
     <div className="reminder-selected-image-info"><b>{file.name}</b><small>{(file.size/1024/1024).toFixed(2)} MB</small></div>
     <div className="reminder-selected-image-actions">
      <button type="button" className="edit-btn" onClick={()=>viewSelected(file)}>👁 XEM ẢNH</button>
      <button type="button" className="danger" onClick={()=>removeSelected(index)}>🗑 XÓA ẢNH</button>
     </div>
    </div>;
   })}</div>:<div className="reminder-selected-image-empty">Chưa chọn ảnh. Bấm “Choose File / Chọn tệp” để chọn một hoặc nhiều ảnh.</div>}
  </div>
  <style>{`
   input[data-reminder-multi-image="true"]{cursor:pointer}
   .reminder-multi-image-manager{display:grid;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #dbe3ee}
   .reminder-multi-image-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#17335f}
   .reminder-multi-image-heading small{color:#64748b;font-weight:600}
   .reminder-selected-image-list{display:grid;gap:8px}
   .reminder-selected-image{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px;border:1px solid #dbe3ee;border-radius:8px;background:#fff}
   .reminder-selected-image img{width:72px;height:58px;object-fit:cover;border-radius:6px;border:1px solid #dbe3ee;background:#f8fafc}
   .reminder-selected-image-info{min-width:0}.reminder-selected-image-info b,.reminder-selected-image-info small{display:block}.reminder-selected-image-info b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17335f}.reminder-selected-image-info small{margin-top:3px;color:#64748b}
   .reminder-selected-image-actions{display:flex;gap:6px;flex-wrap:wrap}.reminder-selected-image-actions button{margin:0!important;white-space:nowrap;font-weight:900}
   .reminder-selected-image-empty{padding:9px;border:1px dashed #b8c7dc;border-radius:7px;background:#f8fafc;color:#64748b;font-size:13px}
   .reminder-detail-evidence .evidence-item{display:flex!important;align-items:center;gap:7px;flex-wrap:wrap;margin:4px 0}
   .reminder-detail-evidence .reminder-evidence-view{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid #174ea6;border-radius:6px;background:#eef5ff;color:#174ea6!important;font-weight:900;text-decoration:none!important}
   .reminder-detail-evidence .reminder-evidence-remove{padding:7px 10px!important;border-radius:6px!important;background:#dc2626!important;color:#fff!important;font-weight:900!important}
   @media(max-width:680px){.reminder-selected-image{grid-template-columns:58px minmax(0,1fr)}.reminder-selected-image img{width:58px;height:52px}.reminder-selected-image-actions{grid-column:1/-1}.reminder-selected-image-actions button{flex:1}}
  `}</style>
 </>,host);
}
