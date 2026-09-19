'use client';
import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';

const modules=[
 ['NHÂN SỰ','DM_NHANVIEN'],['GIAO VIỆC','GIAO VIỆC'],
 ['CÔNG VIỆC TRỌNG ĐIỂM & ĐỘT XUẤT','THEODOI_VIPHAM'],['BẢNG KIỂM','PHIEU_GIAMSAT'],
 ['KẾ HOẠCH','KE_HOACH_TUAN'],['BÁO CÁO TỔNG HỢP','BAO_CAO_BO_PHAN'],
 ['KPI 100 ĐIỂM','KPI_100_DIEM'],['CẢNH BÁO & LỊCH CÔNG VIỆC','NHAC_VIEC_GHI_CHU'],['CÀI ĐẶT','__SETTINGS__']
] as const;
type Row={row_no:number;legacy_id:string;data:Record<string,unknown>};
type Health={ok:boolean;supabaseServerConfigured?:boolean};
type ApiResult={ok:boolean;rows?:Row[];total?:number;error?:string};
const taskSheets=new Set(['GIAO VIỆC','THEODOI_VIPHAM']);
const taskFields=['Tiêu đề công việc','Nội dung / Mô tả','Người giao việc','Người thực hiện','Bộ phận','Mức ưu tiên','Trạng thái','Hạn hoàn thành'] as const;
const labels:Record<string,string[]>={
 'Tiêu đề công việc':['Tiêu đề công việc','Tiêu đề','Công việc'],
 'Nội dung / Mô tả':['Nội dung / Mô tả','Nội dung','Mô tả'],
 'Người giao việc':['Người giao việc','Người giao','Người phụ trách giao'],
 'Người thực hiện':['Người thực hiện','Người chịu trách nhiệm','Phụ trách'],
 'Bộ phận':['Bộ phận','Khoa/Phòng'],'Mức ưu tiên':['Mức ưu tiên','Ưu tiên'],
 'Trạng thái':['Trạng thái','Tình trạng'],'Hạn hoàn thành':['Hạn hoàn thành','Ngày hoàn thành','Đến ngày']
};
function valueOf(data:Record<string,unknown>,name:string){for(const key of labels[name]||[name])if(data[key]!=null)return String(data[key]);return ''}
function textValue(v:unknown){if(v==null)return '';if(['string','number','boolean'].includes(typeof v))return String(v);try{return JSON.stringify(v)}catch{return '[Dữ liệu]'}}

export default function Home(){
 const[active,setActive]=useState<number|null>(null),[rows,setRows]=useState<Row[]>([]);
 const[loading,setLoading]=useState(false),[q,setQ]=useState(''),[appliedQ,setAppliedQ]=useState('');
 const[health,setHealth]=useState<Health|null>(null),[err,setErr]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const[authenticated,setAuthenticated]=useState<boolean|null>(null),[loginError,setLoginError]=useState('');
 const[editing,setEditing]=useState<Row|null|undefined>(undefined),[saving,setSaving]=useState(false);
 const sheet=active===null?'':modules[active][1],isTask=taskSheets.has(sheet);
 useEffect(()=>{fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(setHealth).catch(()=>setHealth({ok:false}))},[]);
 useEffect(()=>{fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()).then(j=>setAuthenticated(Boolean(j.authenticated))).catch(()=>setAuthenticated(false))},[]);
 const load=useCallback(async()=>{
  if(!authenticated||!sheet||sheet==='__SETTINGS__')return;setLoading(true);setErr('');
  try{const r=await fetch(`/api/legacy/${encodeURIComponent(sheet)}?page=${page}&q=${encodeURIComponent(appliedQ)}`);const j:ApiResult=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Không tải được dữ liệu');setRows(j.rows||[]);setTotal(j.total||0)}
  catch(e){setErr(e instanceof Error?e.message:String(e));setRows([])}finally{setLoading(false)}
 },[authenticated,sheet,page,appliedQ]);
 useEffect(()=>{void load()},[load]);
 const cols=useMemo(()=>Array.from(new Set(rows.flatMap(r=>Object.keys(r.data)))),[rows]);
 function selectModule(i:number){setActive(i);setPage(1);setQ('');setAppliedQ('');setEditing(undefined)}
 async function saveTask(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setSaving(true);setErr('');
  try{
   const form=e.currentTarget,fd=new FormData(form),data:Record<string,unknown>={...(editing?.data||{})};
   taskFields.forEach(k=>data[k]=String(fd.get(k)||''));if(!editing)data['Mã công việc']=crypto.randomUUID();
   const r=await fetch('/api/legacy/'+encodeURIComponent(sheet),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({row_no:editing?.row_no,data})});
   const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Không lưu được công việc');
   const legacyId=String(data['Mã công việc']||editing?.legacy_id);
   for(const inputName of ['Hình ảnh minh chứng','File dữ liệu minh chứng']){
    const file=fd.get(inputName);if(file instanceof File&&file.size){const upload=new FormData();upload.set('file',file);upload.set('module',sheet);upload.set('legacy_id',legacyId);const ur=await fetch('/api/evidence',{method:'POST',body:upload});const uj=await ur.json();if(!ur.ok)throw new Error(uj.error||'Không tải được minh chứng')}
   }
   setEditing(undefined);await load();
  }catch(e){setErr(e instanceof Error?e.message:String(e))}finally{setSaving(false)}
 }
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoginError('');const fd=new FormData(e.currentTarget);const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:fd.get('password')})});const j=await r.json();if(r.ok)setAuthenticated(true);else setLoginError(j.error||'Không đăng nhập được')}
 if(authenticated===null)return <div className="login-screen"><div className="login-card"><b>Đang kiểm tra phiên đăng nhập...</b></div></div>;
 if(!authenticated)return <div className="login-screen"><form className="login-card" onSubmit={login}><div className="brand-logo">KSNK<br/>115</div><h1>HỆ THỐNG QUẢN LÝ KSNK</h1><p>Nhập mật khẩu quản trị để tiếp tục</p><input type="password" name="password" placeholder="Mật khẩu" required autoFocus/>{loginError&&<div className="error-box">{loginError}</div>}<button>ĐĂNG NHẬP</button></form></div>;
 return <div className="app-shell">
  <header className="app-header"><div className="hospital-brand"><div className="brand-logo">KSNK<br/>115</div><div><h1>HỆ THỐNG QUẢN LÝ KSNK</h1><p>Bệnh viện 115</p></div></div><div className="header-title">QUẢN LÝ <span>KSNK</span></div></header>
  <div className={`connection ${health?.ok&&health?.supabaseServerConfigured?'connected':''}`}>{health===null?'Đang kiểm tra kết nối...':health.ok&&health.supabaseServerConfigured?'Vercel + Supabase: ĐÃ KẾT NỐI':'Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY trên Vercel'}</div>
  {active===null?<main className="content-shell"><div className="menu-grid">{modules.map((m,i)=><button className="module-card" key={m[0]} onClick={()=>selectModule(i)}><span className="module-number">{i+1}</span><h3>{m[0]}</h3></button>)}</div></main>:
   <main><div className="module-toolbar"><button className="back-btn" onClick={()=>setActive(null)}>← TRANG CHỦ</button><h2>{modules[active][0]}</h2></div><section className="content-shell">
    {sheet==='__SETTINGS__'?<div className="panel-card"><h3>CÀI ĐẶT HỆ THỐNG</h3><div className="settings-grid"><label>Tên bệnh viện<input defaultValue="BỆNH VIỆN 115"/></label><label>Mật khẩu quản trị<input type="password" placeholder="••••••••"/></label></div></div>:
    <div className="panel-card">
     <form className="data-tools" onSubmit={e=>{e.preventDefault();setPage(1);setAppliedQ(q)}}><input aria-label="Tìm kiếm" placeholder="Tìm tiêu đề, người giao việc, người thực hiện..." value={q} onChange={e=>setQ(e.target.value)}/><button type="submit">TÌM</button><button type="button" onClick={()=>void load()}>LÀM MỚI</button>{isTask&&<button type="button" className="add-btn" onClick={()=>setEditing(null)}>+ THÊM CÔNG VIỆC</button>}<b>{total} bản ghi</b></form>
     {err&&<div className="error-box">{err}</div>}
     {loading?<p>Đang tải dữ liệu...</p>:rows.length===0?<div className="empty">Chưa có dữ liệu trong Supabase. Có thể thêm công việc mới ngay tại đây.</div>:isTask?
      <div className="task-list">{rows.map(r=><article className="task-card" key={r.row_no}><div className="task-head"><div><span className="eyebrow">{valueOf(r.data,'Bộ phận')||'CÔNG VIỆC'}</span><h3>{valueOf(r.data,'Tiêu đề công việc')||'Chưa có tiêu đề'}</h3></div><span className={`status ${valueOf(r.data,'Trạng thái').toLowerCase().includes('hoàn')?'done':''}`}>{valueOf(r.data,'Trạng thái')||'Chưa cập nhật'}</span></div><div className="task-description"><b>Nội dung / Mô tả:</b><p>{valueOf(r.data,'Nội dung / Mô tả')||'Chưa có nội dung'}</p></div><div className="task-meta"><span><b>Người giao việc</b>{valueOf(r.data,'Người giao việc')||'—'}</span><span><b>Người thực hiện</b>{valueOf(r.data,'Người thực hiện')||'—'}</span><span><b>Ưu tiên</b>{valueOf(r.data,'Mức ưu tiên')||'—'}</span><span><b>Hạn hoàn thành</b>{valueOf(r.data,'Hạn hoàn thành')||'—'}</span></div><button className="edit-btn" onClick={()=>setEditing(r)}>SỬA / BỔ SUNG MINH CHỨNG</button></article>)}</div>:
      <div className="table-wrap"><table><thead><tr><th>#</th>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.row_no}><td>{r.row_no}</td>{cols.map(c=><td key={c} title={textValue(r.data[c])}>{textValue(r.data[c])}</td>)}</tr>)}</tbody></table></div>}
     {total>50&&<div className="pager"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Trước</button><span>Trang {page} / {Math.ceil(total/50)}</span><button disabled={page*50>=total} onClick={()=>setPage(p=>p+1)}>Sau →</button></div>}
    </div>}
   </section></main>}
  {editing!==undefined&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(undefined)}}><form className="task-form" onSubmit={saveTask}><div className="form-title"><h3>{editing?'CẬP NHẬT':'THÊM'} CÔNG VIỆC</h3><button type="button" onClick={()=>setEditing(undefined)}>×</button></div><div className="form-grid">
   <label className="wide">Tiêu đề công việc<input name="Tiêu đề công việc" required defaultValue={editing?valueOf(editing.data,'Tiêu đề công việc'):''}/></label>
   <label className="wide">Nội dung / Mô tả<textarea name="Nội dung / Mô tả" rows={5} required defaultValue={editing?valueOf(editing.data,'Nội dung / Mô tả'):''}/></label>
   <label>Người giao việc<input name="Người giao việc" required defaultValue={editing?valueOf(editing.data,'Người giao việc'):''}/></label>
   <label>Người thực hiện<input name="Người thực hiện" defaultValue={editing?valueOf(editing.data,'Người thực hiện'):''}/></label>
   <label>Bộ phận<input name="Bộ phận" defaultValue={editing?valueOf(editing.data,'Bộ phận'):''}/></label>
   <label>Mức ưu tiên<select name="Mức ưu tiên" defaultValue={editing?valueOf(editing.data,'Mức ưu tiên'):'Bình thường'}><option>Bình thường</option><option>Cao</option><option>Khẩn cấp</option></select></label>
   <label>Trạng thái<select name="Trạng thái" defaultValue={editing?valueOf(editing.data,'Trạng thái'):'Chưa thực hiện'}><option>Chưa thực hiện</option><option>Đang thực hiện</option><option>Chờ duyệt</option><option>Hoàn thành</option></select></label>
   <label>Hạn hoàn thành<input type="date" name="Hạn hoàn thành" defaultValue={editing?valueOf(editing.data,'Hạn hoàn thành'):''}/></label>
   <label className="wide evidence-label">Hình ảnh minh chứng<input type="file" name="Hình ảnh minh chứng" accept="image/jpeg,image/png,image/webp"/></label>
   <label className="wide evidence-label">File dữ liệu minh chứng <small>(PDF hoặc hình ảnh, tối đa 8 MB)</small><input type="file" name="File dữ liệu minh chứng" accept="application/pdf,image/jpeg,image/png,image/webp"/></label>
  </div><div className="form-actions"><button type="button" onClick={()=>setEditing(undefined)}>HỦY</button><button disabled={saving} className="save-btn">{saving?'ĐANG LƯU...':'LƯU CÔNG VIỆC'}</button></div></form></div>}
 </div>
}
