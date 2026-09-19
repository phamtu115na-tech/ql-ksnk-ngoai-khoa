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
type Health={ok:boolean;supabaseServerConfigured?:boolean};

function textValue(v:unknown){
 if(v===null||v===undefined)return '';
 if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return String(v);
 try{return JSON.stringify(v);}catch{return '[Dữ liệu]';}
}

export default function Home(){
 const[active,setActive]=useState<number|null>(null);
 const[rows,setRows]=useState<Row[]>([]);
 const[loading,setLoading]=useState(false);
 const[q,setQ]=useState('');
 const[health,setHealth]=useState<Health|null>(null);
 const[err,setErr]=useState('');

 useEffect(()=>{fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(setHealth).catch(()=>setHealth({ok:false}))},[]);

 async function load(i:number){
  setLoading(true);setErr('');
  try{
   const sheet=modules[i][1];
   if(sheet==='__SETTINGS__'){setRows([]);return;}
   const r=await fetch('/api/legacy/'+encodeURIComponent(sheet),{cache:'no-store'});
   const j=await r.json();
   if(!r.ok||!j.ok)throw new Error(j.error||'Không tải được dữ liệu');
   setRows(Array.isArray(j.rows)?j.rows:[]);
  }catch(e){setErr(e instanceof Error?e.message:String(e));setRows([]);}
  finally{setLoading(false);}
 }

 useEffect(()=>{if(active!==null)void load(active)},[active]);

 const shown=useMemo(()=>{const s=q.trim().toLocaleLowerCase('vi');return !s?rows:rows.filter(r=>JSON.stringify(r.data).toLocaleLowerCase('vi').includes(s))},[rows,q]);
 const cols=useMemo(()=>Array.from(new Set(shown.slice(0,50).flatMap(r=>Object.keys(r.data)))),[shown]);

 return <div className="app-shell">
  <header className="app-header">
   <div className="hospital-brand"><div className="brand-logo">KSNK<br/>115</div><div><h1>HỆ THỐNG QUẢN LÝ KSNK</h1><p>Bệnh viện 115</p></div></div>
   <div className="header-title">QUẢN LÝ <span>KSNK</span></div>
  </header>
  <div style={{maxWidth:1450,margin:'10px auto 0',padding:'0 22px'}}>
   <div style={{padding:'8px 12px',borderRadius:8,background:health?.ok&&health?.supabaseServerConfigured?'#e8f7ee':'#fff4e5',color:health?.ok&&health?.supabaseServerConfigured?'#146c43':'#8a4b08',fontWeight:700,fontSize:13}}>
    {health===null?'Đang kiểm tra kết nối hệ thống...':health.ok&&health.supabaseServerConfigured?'Hệ thống Vercel + Supabase: ĐÃ KẾT NỐI':'Vercel đang chạy nhưng Supabase server chưa sẵn sàng. Kiểm tra SUPABASE_SERVICE_ROLE_KEY.'}
   </div>
  </div>
  {active===null?
   <main className="content-shell"><div className="menu-grid">{modules.map((m,i)=><button className="module-card" key={m[0]} onClick={()=>setActive(i)}><span className="module-number">{i+1}</span><h3>{m[0]}</h3></button>)}</div></main>
   :<main>
    <div className="module-toolbar"><button className="back-btn" onClick={()=>setActive(null)}>← TRANG CHỦ</button><h2>{modules[active][0]}</h2></div>
    <section className="content-shell">
     {modules[active][1]==='__SETTINGS__'?
      <div className="panel-card"><h3>CÀI ĐẶT HỆ THỐNG</h3><div className="settings-grid"><label>Tên bệnh viện<input defaultValue="BỆNH VIỆN 115"/></label><label>Mật khẩu quản trị<input type="password" placeholder="••••••••"/></label></div></div>
      :<div className="panel-card">
       <div className="data-tools"><input placeholder="Tìm kiếm trong phân hệ..." value={q} onChange={e=>setQ(e.target.value)}/><button onClick={()=>void load(active)}>LÀM MỚI</button><b>{shown.length} bản ghi</b></div>
       {err?<div className="empty" style={{color:'#b42318',borderColor:'#fda29b'}}>Lỗi tải dữ liệu: {err}</div>:loading?<p>Đang tải dữ liệu...</p>:shown.length===0?<div className="empty">Phân hệ đã hoạt động nhưng chưa có dữ liệu được nhập vào Supabase.</div>:<div className="table-wrap"><table><thead><tr><th>#</th>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{shown.map(r=><tr key={r.row_no}><td>{r.row_no}</td>{cols.map(c=>{const t=textValue(r.data[c]);return <td key={c} title={t}>{t}</td>})}</tr>)}</tbody></table></div>}
      </div>}
    </section>
   </main>}
 </div>;
}
