'use client';
import {useState} from 'react';
const modules=[
['NHÂN SỰ','Danh mục nhân sự chung'],
['GIAO VIỆC','Giao việc, nhắc việc, đánh giá và minh chứng'],
['LỖI ĐỘT XUẤT / VI PHẠM','Ghi nhận vi phạm và danh mục lỗi'],
['BẢNG KIỂM','Phiếu giám sát và tiêu chí kiểm tra'],
['KẾ HOẠCH','Kế hoạch tuần / tháng'],
['BÁO CÁO TỔNG HỢP','Tổng hợp và cập nhật trực tiếp'],
['KPI 100 ĐIỂM','Theo dõi và quy đổi KPI'],
['CẢNH BÁO & LỊCH CÔNG VIỆC','Quá hạn, hôm nay và công việc sắp tới'],
['CÀI ĐẶT','Tên bệnh viện và mật khẩu quản trị']
];
export default function Home(){
 const [active,setActive]=useState<number|null>(null);
 return <div className="app-shell">
  <header className="app-header"><div className="hospital-brand"><div className="brand-logo">KSNK<br/>115</div><div><h1>HỆ THỐNG QUẢN LÝ KSNK</h1><p>Quản lý nghiệp vụ khoa Kiểm soát nhiễm khuẩn</p></div></div><div className="header-title">QUẢN LÝ <span>KSNK</span></div></header>
  {active===null?<main className="content-shell"><div className="menu-grid">{modules.map((m,i)=><button className="module-card" key={m[0]} onClick={()=>setActive(i)}><span className="module-number">{i+1}</span><h3>{m[0]}</h3><p>{m[1]}</p></button>)}</div><div className="author-line">Hệ thống Vercel + Supabase</div></main>:
  <main><div className="module-toolbar"><button className="back-btn" onClick={()=>setActive(null)}>← TRANG CHỦ</button><h2>{modules[active][0]}</h2></div><section className="content-shell"><div className="panel-card"><h3>{modules[active][0]}</h3><p>{modules[active][1]}</p><p className="migration-note">Phân hệ đang được chuyển nguyên logic từ Apps Script sang Supabase. Dữ liệu cũ được bảo toàn theo cấu trúc workbook.</p></div></section></main>}
 </div>
}