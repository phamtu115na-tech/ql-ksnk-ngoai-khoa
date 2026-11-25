'use client'
import {useState} from 'react'
import PermissionMatrix from './PermissionMatrix'
import RoleRules from './RoleRules'
export default function PermissionSettings(){
 const [tab,setTab]=useState<'person'|'role'>('person')
 return <main className="permissions-page"><nav className="permissions-tabs" aria-label="Chọn cách cấp quyền">
  <button aria-pressed={tab==='person'} onClick={()=>setTab('person')} type="button">Cấp quyền từng nhân viên</button>
  <button aria-pressed={tab==='role'} onClick={()=>setTab('role')} type="button">Quy tắc quyền theo chức vụ</button>
 </nav>{tab==='person'?<PermissionMatrix/>:<RoleRules/>}
 <style jsx>{`
 .permissions-page{max-width:100%;min-height:100vh;background:#f8fbfe}
 .permissions-tabs{display:flex;gap:10px;align-items:center;padding:14px 16px;border-bottom:1px solid #d9e5f0;background:#fff;flex-wrap:wrap}
 .permissions-tabs button{border:1px solid #b3c8dc;border-radius:8px;padding:11px 16px;background:#f7fbff;color:#204566;cursor:pointer;font-weight:700}
 .permissions-tabs button[aria-pressed=true]{background:#174a78;border-color:#174a78;color:#fff}
 `}</style></main>
}
