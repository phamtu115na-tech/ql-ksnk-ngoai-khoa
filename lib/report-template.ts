import {normalized} from './matrix'
export function reportHero(department:string){const d=normalized(department);if(d==='dung cu')return {key:'cssd',department:'TỔ XỬ LÝ DỤNG CỤ',title:'BÁO CÁO GIAO BAN',subtitle:'CHUẨN XÁC – AN TOÀN – VÔ KHUẨN',slogan:'Xử lý đúng quy trình – Đảm bảo vô khuẩn',icon:'⚙',accent:'#148447'};if(d==='do vai')return {key:'linen',department:'TỔ ĐỒ VẢI',title:'BÁO CÁO GIAO BAN',subtitle:'ĐÚNG ĐỦ – SẠCH SẼ – KỊP THỜI',slogan:'Đồ vải sạch – Đủ – Kịp thời phục vụ chăm sóc',icon:'▤',accent:'#ef6c00'};if(d==='giam sat')return {key:'monitor',department:'TỔ GIÁM SÁT',title:'BÁO CÁO GIAO BAN',subtitle:'GIÁM SÁT – TUÂN THỦ – CẢI TIẾN',slogan:'Tuân thủ quy định – Cải tiến liên tục',icon:'⌕',accent:'#7b2cbf'};if(d==='ve sinh moi truong')return {key:'vsmt',department:'TỔ VỆ SINH MÔI TRƯỜNG',title:'BÁO CÁO GIAO BAN',subtitle:'SẠCH SẼ – AN TOÀN – THÂN THIỆN',slogan:'Môi trường sạch – An toàn người bệnh',icon:'✦',accent:'#1f5fbf'};return null;}
export const heroFocus:Record<string,string[]>={
  vsmt:['Vệ sinh buồng bệnh, khu vực chung','Vệ sinh hành lang, cầu thang, thang máy','Thu gom, phân loại, vận chuyển chất thải','Kiểm tra dụng cụ và phương tiện vệ sinh','Đảm bảo môi trường xanh – sạch – đẹp'],
  cssd:['Tiếp nhận, phân loại dụng cụ','Làm sạch, khử khuẩn, tiệt khuẩn','Kiểm tra chất lượng sau tiệt khuẩn','Lưu trữ, bảo quản dụng cụ vô khuẩn','Cấp phát dụng cụ an toàn, đúng quy trình'],
  linen:['Tiếp nhận, phân loại đồ vải','Giặt, sấy, là, gấp theo quy trình','Kiểm tra chất lượng đồ vải sạch','Lưu trữ, bảo quản đồ vải','Cấp phát đồ vải đầy đủ, kịp thời'],
  monitor:['Giám sát tuân thủ quy trình KSNK','Giám sát vệ sinh tay, PPE','Giám sát môi trường, dụng cụ, đồ vải','Theo dõi và báo cáo chỉ số KSNK','Đào tạo, truyền thông và cải tiến']
 };

export type Template={title:string;department:string;subtitle:string;slogan:string;accent:string;focus:string[]}
export function validTemplate(v:Template){
 return v&&[v.title,v.department,v.subtitle,v.slogan].every(t=>typeof t==='string'&&t.length<=200)&&v.title.trim()&&v.department.trim()&&/^#[0-9a-f]{6}$/i.test(v.accent)&&Array.isArray(v.focus)&&v.focus.length<=20&&v.focus.every(t=>typeof t==='string'&&t.trim()&&t.length<=240)
}
