export const menuLabels={home:'TRANG CHỦ',tasks:'GIAO VIỆC',reminders:'NHẮC VIỆC & GHI CHÚ',violations:'LỖI ĐỘT XUẤT / VI PHẠM',plans:'KẾ HOẠCH TUẦN / THÁNG',checklists:'BẢNG KIỂM GIÁM SÁT',reports:'BÁO CÁO TỔNG HỢP MỚI',staff:'NHÂN SỰ & HỢP ĐỒNG',alerts:'CẢNH BÁO & LỊCH CÔNG VIỆC',kpi:'KPI 100 ĐIỂM',settings:'CÀI ĐẶT'} as const
export type MenuKey=keyof typeof menuLabels
export type MenuItem={key:MenuKey;label:string}
export const defaultMenu=Object.entries(menuLabels).map(([key,label])=>({key:key as MenuKey,label}))
// Đồng bộ cấu hình menu cũ 10 mục thành 11 mục mà không thay dữ liệu/ghi đè thứ tự đã lưu.
export function normalizeMenu(value:unknown):MenuItem[]{
 const saved=Array.isArray(value)?value:[];
 const old=saved.filter((v):v is MenuItem=>Boolean(v&&typeof v==='object'&&Object.hasOwn(menuLabels,v.key)&&typeof v.label==='string'&&v.label.trim()&&v.label.length<=90));
 const seen=new Set<MenuKey>();
 const result:MenuItem[]=[];
 const hasReminders=old.some(item=>item.key==='reminders');
 for(const item of old){
  if(seen.has(item.key))continue;
  seen.add(item.key);
  // Danh mục cũ từng gộp Giao việc với Nhắc việc.
  const label=item.key==='tasks'&&item.label.trim()==='GIAO VIỆC & NHẮC VIỆC'?'GIAO VIỆC':item.label;
  result.push({key:item.key,label});
  if(item.key==='tasks'&&!hasReminders){seen.add('reminders');result.push({key:'reminders',label:menuLabels.reminders});}
 }
 for(const item of defaultMenu)if(!seen.has(item.key)){seen.add(item.key);result.push(item);}
 return result;
}
export function validMenu(data:MenuItem[]){
 return Array.isArray(data)&&data.length===defaultMenu.length&&new Set(data.map(x=>x?.key)).size===data.length&&data.every(x=>x&&Object.hasOwn(menuLabels,x.key)&&typeof x.label==='string'&&x.label.trim()&&x.label.length<=90)
}
