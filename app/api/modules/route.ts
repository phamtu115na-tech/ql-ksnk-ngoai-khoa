import {NextResponse} from 'next/server';
import {hasSession} from '../../../lib/auth';
import {buildLeavePlanning} from '../../../lib/leave-policy';
import {supabaseAdmin} from '../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type AnyRecord=Record<string,any>;
type LegacyRow={row_no:number;legacy_id?:string|null;data:AnyRecord};
type Filters={from?:string;to?:string;department?:string;person?:string;manager?:string;title?:string;priority?:string;status?:string;approvalStatus?:string;assignees?:string[];statuses?:string[];formCode?:string;type?:string;reportSection?:string[]};

const PAGE=1000;
const BASE_DEPARTMENTS=['VỆ SINH MÔI TRƯỜNG','ĐỒ VẢI','ĐỒ VẢI - PHÒNG VIP','GIÁM SÁT','DỤNG CỤ','VI PHẠM CHUNG'];
const TASK_PRIORITIES=['CHẬM','TRUNG BÌNH','NHANH','HOÀN THÀNH','TRONG TUẦN'];
const TASK_STATUSES=['CHƯA BẮT ĐẦU','ĐANG LÀM','ĐÃ HOÀN THÀNH','QUÁ HẠN'];
const TASK_EVAL_STATUSES=['CHƯA BẮT ĐẦU','XUẤT SẮC','TỐT','KHÁ','CHƯA ĐẠT_LÀM LẠI','KÉM','QUÁ HẠN'];
const TASK_APPROVAL_STATUSES=['CHƯA XIN Ý KIẾN','CHỜ PHÊ DUYỆT','ĐÃ PHÊ DUYỆT','YÊU CẦU BỔ SUNG','TỪ CHỐI'];
const TASK_REMINDER_STATUSES=['CHƯA THỰC HIỆN','ĐANG THỰC HIỆN','ĐÃ XONG'];
const VIOLATION_STATUSES=['Chưa xử lý','Đang xử lý','Đã xử lý','Đã khắc phục','Từ chối'];
const MANAGER_POSITION_WORDS=['truong khoa','pho khoa','truong bo phan','pho bo phan','to truong','pho to truong','truong nhom','pho nhom','quan ly','giam doc','pho giam doc','giam sat','manager','supervisor','leader'];
const S={
 staff:'DM_NHANVIEN',departments:'DM_BOPHAN',tasks:'GIAO VIỆC',reminders:'NHAC_VIEC_GHI_CHU',
 violations:'THEODOI_VIPHAM',errors:'DM_LOI',violationSummary:'TONG_HOP_VI_PHAM',violationSummaryLegacy:'tong_hop',
 checklists:'PHIEU_GIAMSAT',checklistDetails:'CT_PHIEU_GIAMSAT',checklistForms:'DM_PHIEU_GIAMSAT',
 checklistCriteria:'DM_BANGKIEM',checklistConfig:'DM_CAUHINH_PHIEU',
 weekly:'KE_HOACH_TUAN',monthly:'KE_HOACH_THANG',issues:'TON_TAI_KIEN_NGHI',
 opinions:'Y_KIEN_BAO_CAO',reportSnapshots:'BAO_CAO_BO_PHAN',kpi:'KPI_100_DIEM',kpiLegacy:'BANG_KE_QUA_GIAO_VIEC',kpiRules:'DM_QUYDOI_KPI',kpiFeedback:'Y_KIEN_KPI'
} as const;
const DONE=['hoan thanh','da hoan thanh','dong','da khac phuc','hoan tat','da xong'];
const TASK_SCORE:AnyRecord={'XUẤT SẮC':10,'TỐT':5,'KHÁ':0,'CHƯA ĐẠT':-5,'CHƯA ĐẠT_LÀM LẠI':-5,'LÀM LẠI':-5,'KÉM':-10,'QUÁ HẠN':-5};
const DEFAULT_RULES=([
 {order:1,ranking:'XUẤT SẮC',min:110,max:999999,color:'#2563EB'},
 {order:2,ranking:'TỐT',min:95,max:109.99,color:'#16A34A'},
 {order:3,ranking:'KHÁ',min:80,max:94.99,color:'#0891B2'},
 {order:4,ranking:'TRUNG BÌNH',min:65,max:79.99,color:'#F59E0B'},
 {order:5,ranking:'CHƯA ĐẠT',min:-999999,max:64.99,color:'#DC2626'}
]);

function db(){const client=supabaseAdmin();if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');return client;}
function text(value:unknown){return value==null?'':String(value).trim();}
function norm(value:unknown){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ');}
function same(a:unknown,b:unknown){return norm(a)===norm(b);}
function pick(data:AnyRecord,keys:string[]){for(const key of keys){if(data[key]!=null&&text(data[key]))return text(data[key]);}return '';}
function num(value:unknown){const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?n:0;}
function ymd(value:unknown){
 const raw=text(value);if(!raw)return '';
 const iso=raw.match(/(\d{4}-\d{2}-\d{2})/);if(iso)return iso[1];
 const dmy=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(dmy)return `${dmy[3]}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
 if(typeof value==='number'&&value>20000&&value<80000){const d=new Date(Date.UTC(1899,11,30)+value*86400000);return d.toISOString().slice(0,10);}
 const d=new Date(raw);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function today(){const d=new Date();return d.toISOString().slice(0,10);}
function done(value:unknown){const valueNorm=norm(value);return DONE.some(word=>valueNorm.includes(word));}
function dayDelta(value:unknown){const raw=ymd(value);if(!raw)return null;const target=new Date(`${raw}T00:00:00`);const current=new Date(`${today()}T00:00:00`);return Math.round((target.getTime()-current.getTime())/86400000);}
function alertLevel(value:unknown){const delta=dayDelta(value);if(delta===null||delta>7)return '';if(delta<0)return 'QUÁ HẠN';if(delta===0)return 'HÔM NAY';if(delta<=3)return '1–3 NGÀY';return '4–7 NGÀY';}
function contractAlertLevel(value:unknown){const delta=dayDelta(value);if(delta===null||delta>10)return '';if(delta<0)return 'HỢP ĐỒNG QUÁ HẠN';if(delta===0)return 'HẾT HẠN HÔM NAY';if(delta<=3)return 'CÒN 1–3 NGÀY';return 'CÒN 4–10 NGÀY';}
function isManagerPosition(value:unknown){const position=norm(value);return Boolean(position&&MANAGER_POSITION_WORDS.some(word=>position.includes(word)));}
function isWaitingManager(value:unknown){return ['cho phe duyet','cho quan ly phan hoi','cho quan ly phe duyet'].includes(norm(value));}
function parseApprovalHistory(value:unknown):AnyRecord[]{
 const raw=text(value);if(!raw)return [];
 try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x==='object'):[];}catch{return []}
}
function appendApprovalHistory(data:AnyRecord,event:AnyRecord){
 const history=[...parseApprovalHistory(data['Lịch sử phê duyệt']),{...event}].slice(-100);
 data['Lịch sử phê duyệt']=JSON.stringify(history);
}
function overlap(startValue:unknown,endValue:unknown,filters:Filters){const start=ymd(startValue);const end=ymd(endValue)||start;if(!filters.from&&!filters.to)return true;return (!end||end>=(filters.from||'0000-01-01'))&&(!start||start<=(filters.to||'9999-12-31'));}
function inRange(value:unknown,filters:Filters){const date=ymd(value);return (!filters.from||!date||date>=filters.from)&&(!filters.to||!date||date<=filters.to);}
function arrayParam(url:URL,name:string){const raw=url.searchParams.get(name);if(!raw)return [];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.map(text).filter(Boolean):[];}catch{return raw.split('|').map(text).filter(Boolean);}}
function parseFilters(url:URL):Filters{return {from:text(url.searchParams.get('from')),to:text(url.searchParams.get('to')),department:text(url.searchParams.get('department')),person:text(url.searchParams.get('person')),manager:text(url.searchParams.get('manager')),title:text(url.searchParams.get('title')),priority:text(url.searchParams.get('priority')),status:text(url.searchParams.get('status')),approvalStatus:text(url.searchParams.get('approvalStatus')),assignees:arrayParam(url,'assignees'),statuses:arrayParam(url,'statuses'),formCode:text(url.searchParams.get('formCode')),type:text(url.searchParams.get('type')),reportSection:arrayParam(url,'reportSection')};}

async function readSheet(sheet:string):Promise<LegacyRow[]>{
 const client=db();const rows:LegacyRow[]=[];let from=0;
 while(true){const {data,error}=await client.from('ksnk_legacy_rows').select('row_no,legacy_id,data').eq('sheet_name',sheet).order('row_no',{ascending:true}).range(from,from+PAGE-1);if(error)throw error;const part=(data||[]) as LegacyRow[];rows.push(...part);if(part.length<PAGE)break;from+=PAGE;}
 return rows;
}
async function readSheets(sheets:string[]):Promise<LegacyRow[]>{
 const parts=await Promise.all(sheets.filter(Boolean).map(readSheet));
 return parts.flat().sort((a,b)=>a.row_no-b.row_no);
}
async function readRow(sheet:string,rowNo:number){const {data,error}=await db().from('ksnk_legacy_rows').select('row_no,legacy_id,data').eq('sheet_name',sheet).eq('row_no',rowNo).maybeSingle();if(error)throw error;return data as LegacyRow|null;}
async function nextRowNo(sheet:string){const {data,error}=await db().from('ksnk_legacy_rows').select('row_no').eq('sheet_name',sheet).order('row_no',{ascending:false}).limit(1);if(error)throw error;return Number(data?.[0]?.row_no||0)+1;}
async function saveRow(sheet:string,rowNo:number|undefined,data:AnyRecord){
 const client=db();const n=rowNo&&rowNo>0?rowNo:await nextRowNo(sheet);const old=rowNo&&rowNo>0?await readRow(sheet,rowNo):null;const merged={...(old?.data||{}),...data};
 const legacy=text(merged.ID||merged['Mã công việc']||merged['Mã NV']||merged['Mã VP']||merged['Mã phiếu']||merged['Mã KH']||merged['Mã TT']||merged['MÃ NHẮC VIỆC']||old?.legacy_id||`${sheet}:${n}`);
 const {error}=await client.from('ksnk_legacy_rows').upsert({sheet_name:sheet,row_no:n,legacy_id:legacy,data:merged},{onConflict:'sheet_name,row_no'});if(error)throw error;return n;
}
async function deleteRow(sheet:string,rowNo:number){if(!sheet||!rowNo)throw new Error('Thiếu bản ghi cần xóa');const {error}=await db().from('ksnk_legacy_rows').delete().eq('sheet_name',sheet).eq('row_no',rowNo);if(error)throw error;}
function rowData(row:LegacyRow){return {row_no:row.row_no,legacy_id:row.legacy_id||'',data:row.data};}

function parseLeaveHistory(value:unknown):AnyRecord[]{if(Array.isArray(value))return value.filter(x=>x&&typeof x==='object') as AnyRecord[];const raw=text(value);if(!raw)return [];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x==='object') as AnyRecord[]:[]}catch{return [];}}
function leaveDaysOf(item:AnyRecord){return Math.max(0,num(item.days??item.leaveDays??item['Số ngày nghỉ']));}
function getStaff(rows:LegacyRow[]){return rows.map(row=>{const d=row.data;const contractEndDate=ymd(pick(d,['Ngày hết hạn hợp đồng','Ngày kết thúc hợp đồng','Ngày hết hạn HĐ','Hạn hợp đồng']));const contractLevel=contractAlertLevel(contractEndDate);const position=pick(d,['Chức vụ','Chức danh']);const leaveHistory=parseLeaveHistory(d['Lịch sử nghỉ phép']??d.leaveHistory);const annualLeaveEntitlement=Math.max(0,num(pick(d,['Số ngày phép năm','Phép năm','Ngày phép năm'])));const leaveTaken=leaveHistory.reduce((sum,item)=>sum+leaveDaysOf(item),0)||Math.max(0,num(pick(d,['Số ngày đã nghỉ phép','Đã nghỉ phép','Ngày đã nghỉ'])));const leaveRemaining=Math.max(annualLeaveEntitlement-leaveTaken,0);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã NV']),name:pick(d,['Họ và tên','Họ tên']),department:pick(d,['Bộ phận']),position,managerNote:pick(d,['Lưu ý quản lý','Ghi chú quản lý','Lưu ý']),isManager:isManagerPosition(position),phone:pick(d,['Số điện thoại']),status:pick(d,['Trạng thái']),contractStartDate:ymd(pick(d,['Ngày ký hợp đồng','Ngày bắt đầu hợp đồng','Ngày ký HĐ'])),contractEndDate,contractAlert:contractLevel,contractDays:dayDelta(contractEndDate),annualLeaveEntitlement,leaveTaken,leaveRemaining,leaveHistory,data:d};}).filter(x=>x.name);}
function managerDirectory(staff:AnyRecord[]){return staff.filter(x=>x.isManager||isManagerPosition(x.position));}
function staffMap(staff:AnyRecord[]){return new Map<string,string>(staff.map(x=>[norm(x.name),text(x.department)] as [string,string]));}
function departmentOptions(catalogRows:LegacyRow[],staff:AnyRecord[]){
 const catalog=catalogRows.map(row=>({name:pick(row.data,['Tên bộ phận','Tên','Bộ phận']),status:pick(row.data,['Trạng thái'])||'Hoạt động'})).filter(x=>x.name);
 const names=catalogRows.length?catalog.filter(x=>!['da xoa','xoa','ngung','tam ngung'].includes(norm(x.status))).map(x=>x.name):[...BASE_DEPARTMENTS,...staff.map(x=>x.department).filter(Boolean)];
 return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'vi'));
}
function task(row:LegacyRow,map?:Map<string,string>){const d=row.data;const assignee=pick(d,['Người thực hiện','Người chịu trách nhiệm']);const savedStatus=pick(d,['Trạng thái NV','Trạng thái'])||'CHƯA BẮT ĐẦU';const savedEvalStatus=pick(d,['Đánh giá quản lý','Đánh giá quản lý hiện tại','Đánh giá'])||'CHƯA BẮT ĐẦU';const startDate=ymd(d['Ngày bắt đầu']);const endDate=ymd(d['Ngày kết thúc']);const overdue=Boolean(endDate&&endDate<today()&&!done(savedStatus));const status=overdue?'QUÁ HẠN':savedStatus;const evalStatus=overdue&&!['XUẤT SẮC','TỐT','KHÁ','QUÁ HẠN'].includes(savedEvalStatus)?'QUÁ HẠN':savedEvalStatus;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['ID','Mã công việc']),taskId:pick(d,['ID','Mã công việc']),assignee,department:pick(d,['Bộ phận','Thuộc bộ phận'])||map?.get(norm(assignee))||'',assigner:pick(d,['Người giao việc','Người giao','Người tạo']),priority:pick(d,['Mức độ ưu tiên','Mức ưu tiên'])||'TRUNG BÌNH',title:pick(d,['Tiêu đề công việc','Tiêu đề']),description:pick(d,['Nội dung / Mô tả','Nội dung','Mô tả']),backup:pick(d,['Dự phòng','Phương án dự phòng']),startDate,endDate,status,savedStatus,note:pick(d,['Ghi chú NV','Ghi chú']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),evalStatus,savedEvalStatus,qlNote:pick(d,['Ghi chú quản lý','Ghi chú / Phản hồi quản lý']),managerOpinion:pick(d,['Ý kiến quản lý','Ý kiến của quản lý','Ý kiến trưởng khoa']),managerId:pick(d,['Mã người quản lý','Mã quản lý phê duyệt','Mã quản lý']),managerName:pick(d,['Người quản lý phê duyệt','Quản lý phê duyệt','Người duyệt']),approvalStatus:pick(d,['Trạng thái phê duyệt','Trạng thái xin ý kiến'])||'CHƯA XIN Ý KIẾN',approvalDecision:pick(d,['Kết quả phê duyệt','Kết quả xử lý phê duyệt']),approvalRequest:pick(d,['Nội dung xin ý kiến quản lý','Nội dung xin phê duyệt','Yêu cầu phê duyệt','Nội dung xin ý kiến']),approvalRequestedAt:pick(d,['Thời gian xin ý kiến','Thời gian xin phê duyệt','Ngày xin ý kiến']),approvalResponse:pick(d,['Phản hồi quản lý','Nội dung phê duyệt']),approvalReviewedAt:pick(d,['Thời gian phê duyệt','Ngày phê duyệt']),employeeFeedback:pick(d,['Phản hồi nhân viên','Ý kiến phản hồi nhân viên']),employeeFeedbackStatus:pick(d,['Trạng thái phản hồi nhân viên'])||'',employeeFeedbackAt:pick(d,['Thời gian phản hồi nhân viên']),approvalHistory:parseApprovalHistory(d['Lịch sử phê duyệt']),evaluationCurrentBy:pick(d,['Người đánh giá hiện tại']),evaluationCurrentAt:pick(d,['Thời gian đánh giá hiện tại']),data:d};}
function reminder(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['MÃ NHẮC VIỆC','Mã nhắc việc']),reminderId:pick(d,['MÃ NHẮC VIỆC','Mã nhắc việc']),date:ymd(d['NGÀY NHẮC']??d['Ngày nhắc']),title:pick(d,['TIÊU ĐỀ NHẮC VIỆC','Tiêu đề nhắc việc']),note:pick(d,['NỘI DUNG / GHI CHÚ','Nội dung / Ghi chú','Ghi chú']),person:pick(d,['NGƯỜI LIÊN QUAN','Người liên quan']),status:pick(d,['TRẠNG THÁI','Trạng thái'])||'CHƯA THỰC HIỆN',data:d};}
function violation(row:LegacyRow){const d=row.data;const person=pick(d,['Họ tên','Họ và tên']);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã VP','Mã vi phạm','ID']),date:ymd(d['Ngày vi phạm']),staffId:pick(d,['Mã NV']),person,name:person,department:pick(d,['Bộ phận']),errorId:pick(d,['Mã lỗi']),errorName:pick(d,['Tên lỗi']),level:pick(d,['Mức độ']),score:num(d['Điểm trừ']),points:num(d['Điểm trừ']),recorder:pick(d,['Người ghi nhận']),note:pick(d,['Ghi chú']),status:pick(d,['Trạng thái'])||'Chưa xử lý',imageName:pick(d,['Hình ảnh','Ảnh minh chứng']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),data:d};}
function plan(row:LegacyRow,type:string){const d=row.data;const saved=pick(d,['Trạng thái'])||'CHƯA BẮT ĐẦU';const toDate=ymd(d['Đến ngày']);const status=!done(saved)&&toDate&&toDate<today()?'QUÁ HẠN':saved;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã KH','ID']),type,fromDate:ymd(d['Từ ngày']),toDate,department:pick(d,['Bộ phận']),content:pick(d,['Nội dung']),description:pick(d,['Nội dung / Mô tả','Mô tả']),owner:pick(d,['Người phụ trách']),status,savedStatus:saved,result:pick(d,['Kết quả']),note:pick(d,['Ghi chú']),managerId:pick(d,['Mã người quản lý','Mã quản lý phê duyệt','Mã quản lý']),managerName:pick(d,['Người quản lý phê duyệt','Quản lý phê duyệt','Người duyệt']),approvalStatus:pick(d,['Trạng thái phê duyệt','Trạng thái xin ý kiến'])||'CHƯA XIN Ý KIẾN',approvalDecision:pick(d,['Kết quả phê duyệt','Kết quả xử lý phê duyệt']),approvalRequest:pick(d,['Nội dung xin ý kiến quản lý','Nội dung xin phê duyệt','Yêu cầu phê duyệt']),approvalRequestedAt:pick(d,['Thời gian xin ý kiến','Thời gian xin phê duyệt','Ngày xin ý kiến']),approvalResponse:pick(d,['Phản hồi quản lý','Nội dung phê duyệt']),approvalReviewedAt:pick(d,['Thời gian phê duyệt','Ngày phê duyệt']),managerOpinion:pick(d,['Ý kiến quản lý','Ý kiến của quản lý','Ý kiến trưởng khoa']),approvalHistory:parseApprovalHistory(d['Lịch sử phê duyệt']),evaluationCurrentBy:pick(d,['Người đánh giá hiện tại']),evaluationCurrentAt:pick(d,['Thời gian đánh giá hiện tại']),completedAt:ymd(d['Ngày hoàn thành']),rootId:pick(d,['Mã kế hoạch gốc']),carryPeriod:pick(d,['Kỳ chuyển tiếp']),data:d};}
function issue(row:LegacyRow,map?:Map<string,string>){const d=row.data;const owner=pick(d,['Người phụ trách']);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã TT','ID']),date:ymd(d['Ngày ghi nhận']??d['Ngày']),department:pick(d,['Bộ phận'])||map?.get(norm(owner))||'',issue:pick(d,['Tồn tại / Sự cố / Kiến nghị','Nội dung']),cause:pick(d,['Nguyên nhân']),action:pick(d,['Phương án khắc phục']),owner,deadline:ymd(d['Hạn xử lý']??d['Hạn']),status:pick(d,['Trạng thái'])||'CHƯA KHẮC PHỤC',recommendation:pick(d,['Kiến nghị']),note:pick(d,['Ghi chú']),kind:pick(d,['Loại nội dung','Loại']),data:d};}
function opinion(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',opinionId:pick(d,['Mã ý kiến','Mã ý kiến báo cáo','ID']),fromDate:ymd(d['Từ ngày']),toDate:ymd(d['Đến ngày']),department:pick(d,['Bộ phận']),person:pick(d,['Nhân viên']),reportId:pick(d,['Mã phiếu','Mã báo cáo']),formCode:pick(d,['Mã phiếu']),formName:pick(d,['Tên phiếu']),opinion:pick(d,['Ý kiến khắc phục của tổ trưởng','Ý kiến','Nội dung góp ý','Ghi chú']),enteredBy:pick(d,['Người nhập','Người thực hiện']),status:pick(d,['Trạng thái'])||'Đã lưu',data:d};}
function checklist(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã phiếu','ID']),date:ymd(d['Ngày giám sát']??d['Ngày']),staffId:pick(d,['Mã NV']),person:pick(d,['Họ tên','Họ và tên']),name:pick(d,['Họ tên','Họ và tên']),department:pick(d,['Bộ phận']),supervisor:pick(d,['Người giám sát']),area:pick(d,['Khu vực']),shift:pick(d,['Ca']),formCode:pick(d,['Mã mẫu phiếu','Mã phiếu']),formName:pick(d,['Tên phiếu']),applied:num(d['Tổng áp dụng']),pass:num(d['Đạt']),fail:num(d['Không đạt']),rate:num(d['Tỷ lệ %']),kpi:num(d['Điểm KPI']??d['KPI bảng kiểm áp dụng']),note:pick(d,['Ghi chú']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),na:num(d['Không áp dụng']),dat