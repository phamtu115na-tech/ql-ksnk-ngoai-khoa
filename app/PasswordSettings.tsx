'use client';

import {FormEvent,useEffect,useState} from 'react';

type DepartmentRow={row_no:number;name:string;status:string;referenceCount:number;previousName?:string};
type GeneralSettings={unitName:string;softwareName:string};

function SettingsMessage({message,error=false}:{message:string;error?:boolean}){return message?<p className={error?'settings-message error':'settings-message'} role="status">{message}</p>:null;}

function GeneralSettings(){
 const[form,setForm]=useState<GeneralSettings>({unitName:'BỆNH VIỆN 115',softwareName:'HỆ THỐNG QUẢN LÝ KSNK'});
 const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const[error,setError]=useState(false);
 useEffect(()=>{fetch('/api/settings/general',{cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Không đọc được cài đặt');setForm({unitName:result.unitName,softwareName:result.softwareName});}).catch(reason=>{setError(true);setMessage(reason instanceof Error?reason.message:'Không đọc được tên hiển thị hệ thống');});},[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');setError(false);
  try{const response=await fetch('/api/settings/general',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Không lưu được tên hiển thị');setForm({unitName:result.unitName,softwareName:result.softwareName});window.dispatchEvent(new Event('ksnk-general-settings-updated'));setMessage('Đã lưu tên đơn vị và tên hệ thống phần mềm.');}
  catch(reason){setError(true);setMessage(reason instanceof Error?reason.message:'Không kết nối được máy chủ');}finally{setBusy(false);}
 }
 return <section className="settings-section"><div className="settings-section-heading"><div><h4>TÊN ĐƠN VỊ VÀ TÊN HỆ THỐNG PHẦN MỀM</h4><p className="settings-note">Hai tên này được dùng ở thanh đầu trang và được lưu riêng, không làm thay đổi dữ liệu nghiệp vụ.</p></div></div><form onSubmit={submit}><div className="settings-grid"><label>Tên đơn vị<input value={form.unitName} onChange={event=>setForm(previous=>({...previous,unitName:event.target.value}))} maxLength={160} required/></label><label>Tên hệ thống phần mềm<input value={form.softwareName} onChange={event=>setForm(previous=>({...previous,softwareName:event.target.value}))} maxLength={160} required/></label></div><SettingsMessage message={message} error={error}/><button className="back-btn" disabled={busy}>{busy?'ĐANG LƯU...':'LƯU TÊN HIỂN THỊ'}</button></form></section>;
}

function DepartmentSettings(){
 const[rows,setRows]=useState<DepartmentRow[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[name,setName]=useState('');const[editing,setEditing]=useState<number|null>(null);const[editName,setEditName]=useState('');const[message,setMessage]=useState('');const[error,setError]=useState(false);
 async function load(){
  setLoading(true);
  try{const response=await fetch('/api/settings/departments',{cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Không đọc được danh sách bộ phận');const catalog=(result.catalog?.length?result.catalog:(result.departments||[]).map((department:string,index:number)=>({row_no:-(index+1),name:department,status:'Hoạt động',referenceCount:result.referenceCounts?.[department]||0})));setRows(catalog);setError(false);}
  catch(reason){setError(true);setMessage(reason instanceof Error?reason.message:'Không đọc được danh sách bộ phận');}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function mutate(action:string,body:Record<string,unknown>){
  setBusy(true);setMessage('');setError(false);
  try{const response=await fetch('/api/settings/departments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Không lưu được bộ phận');setMessage(result.message||'Đã cập nhật danh mục bộ phận.');setEditing(null);setName('');setEditName('');await load();}
  catch(reason){setError(true);setMessage(reason instanceof Error?reason.message:'Không kết nối được máy chủ');}finally{setBusy(false);}
 }
 async function add(event:FormEvent<HTMLFormElement>){event.preventDefault();if(name.trim())await mutate('add',{name:name.trim()});}
 function beginEdit(row:DepartmentRow){setEditing(row.row_no);setEditName(row.name);setMessage('');setError(false);}
 return <section className="settings-section department-settings"><div className="settings-section-heading"><div><h4>CÀI ĐẶT TÊN BỘ PHẬN</h4><p className="settings-note">Thêm, sửa tên và xóa khỏi danh sách lựa chọn. Xóa sẽ bị chặn nếu bộ phận còn được nhân sự, công việc hoặc hồ sơ khác tham chiếu.</p></div></div><form className="department-add-form" onSubmit={add}><label>Thêm bộ phận mới<input value={name} onChange={event=>setName(event.target.value)} placeholder="Nhập tên bộ phận..." maxLength={120} required/></label><button className="add-btn" disabled={busy}>+ THÊM BỘ PHẬN</button></form><SettingsMessage message={message} error={error}/>{loading?<p>Đang tải danh mục bộ phận...</p>:<div className="table-wrap department-settings-table"><table><thead><tr><th>Tên bộ phận</th><th>Trạng thái</th><th>Đang tham chiếu</th><th>Thao tác</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.row_no}><td>{editing===row.row_no?<input className="department-edit-input" value={editName} onChange={event=>setEditName(event.target.value)} maxLength={120}/>:<b>{row.name}</b>}{row.previousName&&<small className="department-previous-name">Tên trước: {row.previousName}</small>}</td><td><span className={row.status==='Hoạt động'?'department-active':'department-inactive'}>{row.status}</span></td><td>{row.referenceCount||0}</td><td className="actions-cell">{row.status==='Hoạt động'&&editing===row.row_no?<><button type="button" className="edit-btn" disabled={busy} onClick={()=>mutate('edit',{oldName:row.name,newName:editName.trim()})}>LƯU TÊN</button><button type="button" className="filter-reset" onClick={()=>setEditing(null)}>HỦY</button></>:row.status==='Hoạt động'?<><button type="button" className="edit-btn" disabled={busy} onClick={()=>beginEdit(row)}>SỬA TÊN</button><button type="button" className="danger" disabled={busy} onClick={()=>{if(window.confirm(`Xóa bộ phận "${row.name}" khỏi danh sách lựa chọn?`))void mutate('delete',{name:row.name});}}>XÓA</button></>:<span className="muted">Đã lưu lịch sử</span>}</td></tr>):<tr><td colSpan={4} className="empty-cell">Chưa có danh mục bộ phận.</td></tr>}</tbody></table></div>}</section>;
}

export default function PasswordSettings(){
 const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget;setBusy(true);setMessage('');
  const fields=new FormData(form);
  try{const response=await fetch('/api/settings/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fields))});const result=await response.json();if(!response.ok)throw new Error(result.error||'Không đổi được mật khẩu');form.reset();setDone(true);setMessage('Đã đổi mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực. Vui lòng đăng nhập bằng mật khẩu mới.');}
  catch(reason){setMessage(reason instanceof Error?reason.message:'Không kết nối được máy chủ');}finally{setBusy(false);}
 }
 return <div className="settings-stack"><section className="settings-section"><h4>ĐỔI MẬT KHẨU QUẢN TRỊ</h4><p className="settings-note">Mật khẩu mới áp dụng ngay, không cần triển khai lại Vercel.</p><form onSubmit={submit}><div className="settings-grid"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy||done}/></label><label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required disabled={busy||done}/></label><label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required disabled={busy||done}/></label></div><p role="status">{message}</p>{done?<a href="/">ĐĂNG NHẬP LẠI</a>:<button className="back-btn" disabled={busy}>{busy?'ĐANG LƯU...':'LƯU MẬT KHẨU MỚI'}</button>}</form></section><GeneralSettings/><DepartmentSettings/></div>;
}
