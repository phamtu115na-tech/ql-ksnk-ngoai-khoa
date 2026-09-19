'use client';
import {FormEvent,useState} from 'react';
export default function PasswordSettings(){
 const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage('');
  const f=new FormData(form);
  try{
   const r=await fetch('/api/settings/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Không đổi được mật khẩu');
   form.reset();setDone(true);setMessage('Đã đổi mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực. Vui lòng đăng nhập bằng mật khẩu mới.');
  }catch(e){setMessage(e instanceof Error?e.message:'Không kết nối được máy chủ')}finally{setBusy(false)}
 }
 return <form onSubmit={submit}><h4>ĐỔI MẬT KHẨU QUẢN TRỊ</h4><p>Mật khẩu mới áp dụng ngay, không cần triển khai lại Vercel.</p><div className="settings-grid">
 <label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy||done}/></label>
 <label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required disabled={busy||done}/></label>
 <label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required disabled={busy||done}/></label>
 </div><p role="status">{message}</p>{done?<a href="/">ĐĂNG NHẬP LẠI</a>:<button className="back-btn" disabled={busy}>{busy?'ĐANG LƯU...':'LƯU MẬT KHẨU MỚI'}</button>}</form>
}
