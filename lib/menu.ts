export const menuLabels={home:'TRANG CHỦ',tasks:'GIAO VIỆC & NHẮC VIỆC',violations:'LỖI ĐỘT XUẤT / VI PHẠM',plans:'KẾ HOẠCH TUẦN / THÁNG',checklists:'BẢNG KIỂM GIÁM SÁT',reports:'BÁO CÁO TỔNG HỢP MỚI',staff:'NHÂN SỰ & HỢP ĐỒNG',alerts:'CẢNH BÁO & LỊCH CÔNG VIỆC',kpi:'KPI 100 ĐIỂM',settings:'CÀI ĐẶT'}
export type MenuKey=keyof typeof menuLabels
export type MenuItem={key:MenuKey;label:string}
export const defaultMenu=Object.entries(menuLabels).map(([key,label])=>({key:key as MenuKey,label}))
export function validMenu(data:MenuItem[]){
 return Array.isArray(data)&&data.length===defaultMenu.length&&new Set(data.map(x=>x?.key)).size===data.length&&data.every(x=>x&&Object.hasOwn(menuLabels,x.key)&&typeof x.label==='string'&&x.label.trim()&&x.label.length<=90)
}
