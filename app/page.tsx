'use client';
import {useEffect,useMemo,useState} from 'react';

const modules=[
 ['NHÂN SỰ','DM_NHANVIEN'],
 ['GIAO VIỆC','GIAO VIỆC'],
 ['LỖI ĐỘT XUẤT / VI PHẠM','THEODOI_VIPHAM'],
 ['BẢNG KIỂM','PHIEU_GIAMSAT'],
 ['KẾ HOẠCH','KE_HOACH_TUAN'],
 ['BÁO CÁO TỔNG HỢP','BAO_CAO_BO_PHAN'],
 ['KPI 100 ĐIỂM','KPI_100_DIEM'],
 ['CẢNH BÁO & LỊCH CÔNG VIỆC','NHAC_VIEC_GHI_CHU'],
 ['CÀI ĐẶT','__SETTINGS__']
] as const;

type Row={row_no:number;legacy_id:string;data:Record<string,unknown>};

export default function Home(){
 const[active,setActive]=useState<number|null>(null);
 const[rows,setRows]=useState<Row[]>([]);
 const[loading,setLoading]=useState(false);
 const[q,setQ]=useState('');

 async function load(i:number){
  setLoading(true);
  try{
   const sheet=modules[i][1];
   if(sheet==='__SETTINGS__'){setRows([]);return;}
   const r=await fetch('/api/legacy/'+encodeURIComponent(sheet),{cache:'no-store'});
   const j=await r.json();
   if(!j.ok)throw new Error(j.error||'Không tải được dữ liệu');
   setRows(j.rows||[]);
  }catch(e){alert(e instanceof Error?e.message:String(e));}
  finally{setLoading(false);}
 }

 useEffect(()=>{if(active!==null)void load(active)},[active]);

 const shown=useMemo(()=>{
  const s=q.trim().toLocaleLowerCase('vi');
  return !s?rows:rows.filter(r=>JSON.stringify(r.data).toLocaleLowerCase('vi').includes(s));
 },[rows,q]);

 const cols=useMemo(()=>Array.from(new Set(shown.slice(0,50).flatMap(r=>Object.keys(r.data)))),[shown]);

 async function remove(r:Row){
  if(active===null||!confirm('Xóa bản ghi này?'))return;
  const res=await fetch('/api/legacy/'+encodeURIComponent(modules[active][1]),{
   method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({row_no:r.row_no})
  });
  const json=await res.json();
  if(!json.ok){alert(json.error||'Không xóa được dữ liệu');return;}
  await load(active);
 }

 return <div className="app-shell">
  <header className="app-header">
   <div className="hospital-brand"><div className="brand-logo">KSNK<br/>115</div><div><h1>HỆ THỐNG QUẢN LÝ KSNK</h1><p>Bệnh viện 115</p></div></div>
   <div className="header-title">QUẢN LÝ <span>KSNK</span></div>
  </header>
  {active===null?
   <main className="content-shell"><div className="menu-grid">{modules.map((m,i)=><button className="module-card" key={m[0]} onClick={()=>setActive(i)}><span className="module-number">{i+1}</span><h3>{m[0]}</h3></button>)}</div></main>
   :<main>
    <div className="module-toolbar"><button className="back-btn" onClick={()=>setActive(null)}>← TRANG CHỦ</button><h2>{modules[active][0]}</h2></div>
    <section className="content-shell">
     {modules[active][1]==='__SETTINGS__'?
      <div className="panel-card"><h3>CÀI ĐẶT HỆ THỐNG</h3><div className="settings-grid"><label>Tên bệnh viện<input defaultValue="BỆNH VIỆN 115"/></label><label>Mật khẩu quản trị<input type="password" placeholder="••••••••"/></label></div><p className="settings-note">Mật khẩu được lưu phía máy chủ; không ghi secret vào GitHub.</p></div>
      :<div className="panel-card">
       <div className="data-tools"><input placeholder="Tìm kiếm trong phân hệ..." value={q} onChange={e=>setQ(e.target.value)}/><button onClick={()=>void load(active)}>LÀM MỚI</button><b>{shown.length} bản ghi</b></div>
       {loading?<p>Đang tải dữ liệu...</p>:shown.length===0?<div className="empty">Chưa có dữ liệu Supabase cho phân hệ này.</div>:<div className="table-wrap"><table><thead><tr><th>#</th>{cols.map(c=><th key={c}>{c}</th>)}<th>THAO TÁC</th></tr></thead><tbody>{shown.map(r=><tr key={r.row_no}><td>{r.row_no}</td>{cols.map(c=><td key={c} title={String(r.data[c]??'')}>{String(r.data[c]??'')}</td>)}<td><button className="danger" onClick={()=>void remove(r)}>XÓA</button></td></tr>)}</tbody></table></div>}
      </div>}
    </section>
   </main>}
 </div>;
}
