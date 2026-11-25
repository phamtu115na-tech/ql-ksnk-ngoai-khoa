import {staffPosition,staffEmploymentStatus} from '../../../lib/staff-roles';
import {ksnkDepartment,activeDepartment} from '../../../lib/department-catalog';
import {defaults as matrixDefaults,colors as matrixColors,levels as matrixLevels,type Scale} from '../../../lib/matrix';
import {reportHero,heroFocus,validTemplate} from '../../../lib/report-template';
import {requireManagerEvaluation} from '../../../lib/task-evaluation';
import {NextResponse} from 'next/server';
import {actor,canOperateLegacy} from '../../../lib/auth';
import {buildLeavePlanning} from '../../../lib/leave-policy';
import {featureScope,inFeatureScope} from '../../../lib/feature-permissions';
import {supabaseAdmin} from '../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type AnyRecord=Record<string,any>;
type LegacyRow={id?:number;row_no:number;legacy_id?:string|null;data:AnyRecord};
type Filters={from?:string;to?:string;department?:string;person?:string;manager?:string;title?:string;priority?:string;workType?:string;status?:string;approvalStatus?:string;alertLevel?:string;readStatus?:string;assignees?:string[];statuses?:string[];formCode?:string;type?:string;reportSection?:string[]};

const PAGE=1000;
const TASK_PRIORITIES=['CHẬM','TRUNG BÌNH','NHANH','HOÀN THÀNH','TRONG TUẦN'];
const TASK_STATUSES=['CHƯA BẮT ĐẦU','ĐANG LÀM','ĐÃ HOÀN THÀNH','QUÁ HẠN'];
const TASK_EVAL_STATUSES=['CHƯA BẮT ĐẦU','XUẤT SẮC','TỐT','KHÁ','CHƯA ĐẠT_LÀM LẠI','KÉM','QUÁ HẠN'];
const TASK_APPROVAL_STATUSES=['CHƯA XIN Ý KIẾN','CHỜ PHÊ DUYỆT','ĐÃ PHÊ DUYỆT','YÊU CẦU BỔ SUNG','TỪ CHỐI'];
const TASK_WORK_TYPE_PRIORITY='CV TRỌNG ĐIỂM & ĐỘT XUẤT';
const TASK_WORK_TYPE_LONG_TERM='CV DÀI HẠN & KHÁC';
const TASK_WORK_TYPES=[TASK_WORK_TYPE_PRIORITY,TASK_WORK_TYPE_LONG_TERM];
const TASK_REMINDER_STATUSES=['CHƯA THỰC HIỆN','ĐANG THỰC HIỆN','ĐÃ XONG'];
const VIOLATION_STATUSES=['Chưa xử lý','Đang xử lý','Đã xử lý','Đã khắc phục','Từ chối'];
const VIOLATION_ERROR_LEVELS=['Nhắc nhở','Nhẹ','Trung bình','Nặng'];
const VIOLATION_ERROR_STATUSES=['Hoạt động','Không hoạt động'];
const ISSUE_STATUSES=['CHƯA KHẮC PHỤC','ĐANG XỬ LÝ','ĐÃ KHẮC PHỤC','QUÁ HẠN'];
const MANAGER_POSITION_WORDS=['truong khoa','pho khoa','truong bo phan','pho bo phan','to truong','pho to truong','truong nhom','pho nhom','quan ly','giam doc','pho giam doc','giam sat','manager','supervisor','leader'];
const S={
 staff:'DM_NHANVIEN',departments:'DM_BOPHAN',tasks:'GIAO VIỆC',reminders:'NHAC_VIEC_GHI_CHU',
 violations:'THEODOI_VIPHAM',errors:'DM_LOI',violationSummary:'TONG_HOP_VI_PHAM',violationSummaryLegacy:'tong_hop',
 checklists:'PHIEU_GIAMSAT',checklistDetails:'CT_PHIEU_GIAMSAT',checklistForms:'DM_PHIEU_GIAMSAT',
 checklistCriteria:'DM_BANGKIEM',checklistConfig:'DM_CAUHINH_PHIEU',
 weekly:'KE_HOACH_TUAN',monthly:'KE_HOACH_THANG',issues:'TON_TAI_KIEN_NGHI',
 opinions:'Y_KIEN_BAO_CAO',reportSnapshots:'BAO_CAO_BO_PHAN',kpi:'KPI_100_DIEM',kpiLegacy:'BANG_KE_QUA_GIAO_VIEC',kpiRules:'DM_QUYDOI_KPI',kpiFeedback:'Y_KIEN_KPI'
} as const;
const ALERT_STATE_TABLE='ksnk_alert_states';
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
function flag(value:unknown){if(typeof value==='boolean')return value;return ['true','1','yes','on','bat','bật','co','có','nhắc hàng ngày','nhac hang ngay'].includes(norm(value));}
function same(a:unknown,b:unknown){return norm(a)===norm(b);}
function isMissingAlertStateTable(error:unknown){const item=error as AnyRecord;const code=text(item?.code);const message=[code,text(item?.message),text(item?.details),text(item?.hint),text(error)].join(' ').toLowerCase();return code==='pgrst205'||code==='42p01'||message.includes('ksnk_alert_states')&&(['does not exist','schema cache','could not find the table','not found'].some(marker=>message.includes(marker)));}
function alertNotificationType(alert:AnyRecord){return text(alert.notificationType||alert.kind||'ALERT').toUpperCase();}
function alertIdentity(alert:AnyRecord){return text(alert.row_no??alert.id??alert.taskId??alert.title??JSON.stringify(alert));}
function alertKey(alert:AnyRecord){if(text(alert.alertKey))return text(alert.alertKey);const notificationType=alertNotificationType(alert);const daily=norm(alert.kind).includes('nhac viec hang ngay')||notificationType==='DAILY_REMINDER';return [text(alert.target||'alerts'),alertIdentity(alert),notificationType,text(alert.recipientKey||alert.recipient_key||''),daily?text(alert.date):''].join('|');}
function alertRecipientKey(alert:AnyRecord){if(text(alert.recipientKey))return text(alert.recipientKey);if(text(alert.notificationAudience).toUpperCase()==='MANAGER')return `manager:${text(alert.managerId||alert.managerName||'ALL').toLowerCase()}`;if(text(alert.notificationAudience).toUpperCase()==='EMPLOYEE')return `employee:${text(alert.personId||alert.person||'ALL').toLowerCase()}`;return 'ALL';}
function stateAlertRecord(alert:AnyRecord,now=new Date().toISOString()){return {alert_key:alertKey(alert),recipient_key:alertRecipientKey(alert),target:text(alert.target||'alerts'),kind:text(alert.kind||'THÔNG BÁO'),level:text(alert.level||''),alert_date:text(alert.date||''),title:text(alert.title||alert.notificationTitle||''),message:text(alert.message||''),instruction:text(alert.instruction||''),person:text(alert.person||''),person_id:text(alert.personId||''),manager_name:text(alert.managerName||''),manager_id:text(alert.managerId||''),row_no:Number.isFinite(Number(alert.row_no))?Number(alert.row_no):null,entity_id:text(alert.id||alert.taskId||''),notification_audience:text(alert.notificationAudience||''),notification_type:alertNotificationType(alert),approval_status:text(alert.approvalStatus||''),payload:alert,persistent:Boolean(alert.persistent),updated_at:now};}
async function readAlertStateRows(){
 try{
  const {data,error}=await db().from(ALERT_STATE_TABLE).select('alert_key,recipient_key,target,kind,level,alert_date,title,message,instruction,person,person_id,manager_name,manager_id,row_no,entity_id,notification_audience,notification_type,approval_status,payload,persistent,read_at,read_by,created_at,updated_at').order('created_at',{ascending:false}).limit(5000);
  if(error)throw error;
  return {rows:(data||[]) as AnyRecord[],available:true};
 }catch(error){
  if(isMissingAlertStateTable(error)){console.warn('[alerts:state-table-missing] Run supabase/20261005_alert_states.sql before enabling persistent read state.');return {rows:[] as AnyRecord[],available:false};}
  throw error;
 }
}
function alertFromState(row:AnyRecord){const payload=row.payload&&typeof row.payload==='object'&&!Array.isArray(row.payload)?row.payload:{};return {...payload,alertKey:text(row.alert_key),recipientKey:text(row.recipient_key),target:text(row.target)||payload.target||'tasks',kind:text(row.kind)||payload.kind||'THÔNG BÁO',level:text(row.level)||payload.level||'PHẢN HỒI MỚI',date:text(row.alert_date)||payload.date||'',title:text(row.title)||payload.title||'',message:text(row.message)||payload.message||'',instruction:text(row.instruction)||payload.instruction||'',person:text(row.person)||payload.person||'',personId:text(row.person_id)||payload.personId||'',managerName:text(row.manager_name)||payload.managerName||'',managerId:text(row.manager_id)||payload.managerId||'',notificationAudience:text(row.notification_audience)||payload.notificationAudience||'',notificationType:text(row.notification_type)||payload.notificationType||'',approvalStatus:text(row.approval_status)||payload.approvalStatus||'',persistent:Boolean(row.persistent||payload.persistent),readAt:text(row.read_at),readBy:text(row.read_by)};}
async function mergeAlertStates(alerts:AnyRecord[]){
 const result=await readAlertStateRows();
 const stateByKey=new Map(result.rows.map(row=>[text(row.alert_key),row]));
 const byKey=new Map<string,AnyRecord>();
 for(const alert of alerts){const key=alertKey(alert);const state=stateByKey.get(key);byKey.set(key,{...alert,alertKey:key,recipientKey:alertRecipientKey(alert),isRead:Boolean(state?.read_at),readAt:text(state?.read_at),readBy:text(state?.read_by),alertStateAvailable:result.available});}
 for(const row of result.rows.filter(item=>Boolean(item.persistent))){const alert=alertFromState(row);const key=alertKey(alert);if(byKey.has(key))continue;byKey.set(key,{...alert,isRead:Boolean(row.read_at),readAt:text(row.read_at),readBy:text(row.read_by),alertStateAvailable:result.available});}
 return {alerts:[...byKey.values()],available:result.available};
}
async function saveAlertReadState(body:AnyRecord){
 const action=text(body.action||'read').toLowerCase();if(!['read','unread'].includes(action))throw new Error('Trạng thái đọc cảnh báo không hợp lệ.');
 const alert=body.alert&&typeof body.alert==='object'?body.alert:{...body};const key=alertKey({...alert,alertKey:text(body.alertKey)||alert.alertKey});if(!key||key==='|||')throw new Error('Thiếu mã cảnh báo cần cập nhật.');
 const now=new Date().toISOString();const existingResult=await db().from(ALERT_STATE_TABLE).select('created_at,persistent,payload').eq('alert_key',key).maybeSingle();if(existingResult.error){if(isMissingAlertStateTable(existingResult.error))throw new Error('Chưa có bảng trạng thái cảnh báo trên Supabase. Hãy chạy file supabase/20261005_alert_states.sql.');throw existingResult.error;}
 const record={...stateAlertRecord({...alert,alertKey:key},now),persistent:Boolean(existingResult.data?.persistent||alert.persistent),created_at:existingResult.data?.created_at||now,read_at:action==='read'?now:null,read_by:action==='read'?(text(body.readBy)||'SYSTEM_ADMIN'):null,updated_at:now};
 const {error}=await db().from(ALERT_STATE_TABLE).upsert(record,{onConflict:'alert_key'});if(error)throw error;return {alertKey:key,isRead:action==='read',readAt:record.read_at};
}
async function savePersistentAlert(alert:AnyRecord){
 const key=alertKey(alert);const client=db();const existing=await client.from(ALERT_STATE_TABLE).select('alert_key').eq('alert_key',key).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return false;
 const {error}=await client.from(ALERT_STATE_TABLE).insert({...stateAlertRecord({...alert,alertKey:key,persistent:true}),persistent:true});if(error&&text(error.code)!=='23505')throw error;return !error;
}
function canonicalTaskWorkType(value:unknown){const valueNorm=norm(value);if(valueNorm.includes('trong diem')||valueNorm.includes('dot xuat'))return TASK_WORK_TYPE_PRIORITY;if(valueNorm.includes('dai han')||valueNorm.includes('khac'))return TASK_WORK_TYPE_LONG_TERM;return '';}
function taskWorkType(value:unknown){return canonicalTaskWorkType(value)||TASK_WORK_TYPE_LONG_TERM;}
function pick(data:AnyRecord,keys:string[]){for(const key of keys){if(data[key]!=null&&text(data[key]))return text(data[key]);}const normalizedKeys=keys.map(norm);for(const [key,value] of Object.entries(data)){if(normalizedKeys.includes(norm(key))&&value!=null&&text(value))return text(value);}return '';}
function num(value:unknown){const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?n:0;}
function ymd(value:unknown){
 const raw=text(value);if(!raw)return '';
 const iso=raw.match(/(\d{4}-\d{2}-\d{2})/);if(iso)return iso[1];
 const dmy=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(dmy)return `${dmy[3]}-${String(dmy[2]).padStart(2,'0')}-${String(dmy[1]).padStart(2,'0')}`;
 const compact=raw.match(/^(\d{4})(\d{2})(\d{2})$/);if(compact)return `${compact[1]}-${compact[2]}-${compact[3]}`;
 const serial=typeof value==='number'?value:/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):NaN;if(Number.isFinite(serial)&&serial>20000&&serial<80000){const d=new Date(Date.UTC(1899,11,30)+serial*86400000);return d.toISOString().slice(0,10);}
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
function parseFilters(url:URL):Filters{return {from:text(url.searchParams.get('from')),to:text(url.searchParams.get('to')),department:text(url.searchParams.get('department')),person:text(url.searchParams.get('person')),manager:text(url.searchParams.get('manager')),title:text(url.searchParams.get('title')),priority:text(url.searchParams.get('priority')),workType:text(url.searchParams.get('workType')),status:text(url.searchParams.get('status')),approvalStatus:text(url.searchParams.get('approvalStatus')),alertLevel:text(url.searchParams.get('alertLevel')),readStatus:text(url.searchParams.get('readStatus')),assignees:arrayParam(url,'assignees'),statuses:arrayParam(url,'statuses'),formCode:text(url.searchParams.get('formCode')),type:text(url.searchParams.get('type')),reportSection:arrayParam(url,'reportSection')};}

async function readSheet(sheet:string,hospitalOnly=false):Promise<LegacyRow[]>{
 const client=db();const rows:LegacyRow[]=[];let from=0;
 while(true){const {data,error}=await client.from('nk_legacy_rows').select('id,row_no,legacy_id,data').eq('sheet_name',sheet).order('row_no',{ascending:true}).range(from,from+PAGE-1);if(error)throw error;const part=(data||[]) as LegacyRow[];rows.push(...part.filter(row=>{const unit=norm(row.data?.unitId||row.data?.['Đơn vị']||row.data?.['Bệnh viện']);return !hospitalOnly||!unit||['surgery','ngoai khoa','benh vien ngoai khoa 115 nghe an'].includes(unit)}));if(part.length<PAGE)break;from+=PAGE;}
 return rows;
}
async function readSheets(sheets:string[]):Promise<LegacyRow[]>{
 const parts=await Promise.all(sheets.filter(Boolean).map(sheet=>readSheet(sheet)));
 return parts.flat().sort((a,b)=>a.row_no-b.row_no);
}
async function readRow(sheet:string,rowNo:number){const {data,error}=await db().from('nk_legacy_rows').select('id,row_no,legacy_id,data').eq('sheet_name',sheet).eq('row_no',rowNo).maybeSingle();if(error)throw error;return data as LegacyRow|null;}
async function nextRowNo(sheet:string){const {data,error}=await db().from('nk_legacy_rows').select('row_no').eq('sheet_name',sheet).order('row_no',{ascending:false}).limit(1);if(error)throw error;return Number(data?.[0]?.row_no||0)+1;}
async function saveRow(sheet:string,rowNo:number|undefined,data:AnyRecord){
 const client=db();const n=rowNo&&rowNo>0?rowNo:await nextRowNo(sheet);const old=rowNo&&rowNo>0?await readRow(sheet,rowNo):null;const merged={...(old?.data||{}),...data};
 const legacy=text(merged.ID||merged['Mã công việc']||merged['Mã NV']||merged['Mã VP']||merged['Mã phiếu']||merged['Mã KH']||merged['Mã TT']||merged['MÃ NHẮC VIỆC']||old?.legacy_id||`${sheet}:${n}`);
 const {error}=await client.from('nk_legacy_rows').upsert({sheet_name:sheet,row_no:n,legacy_id:legacy,data:merged},{onConflict:'sheet_name,row_no'});if(error)throw error;return n;
}
async function deleteRow(sheet:string,rowNo:number){if(!sheet||!rowNo)throw new Error('Thiếu bản ghi cần xóa');const {error}=await db().from('nk_legacy_rows').delete().eq('sheet_name',sheet).eq('row_no',rowNo);if(error)throw error;}
const EVIDENCE_BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'documents';
async function deleteChecklistHistory(rowNo:number){
 const client=db();const row=await readRow(S.checklists,rowNo);if(!row)throw new Error('Không tìm thấy phiếu giám sát cần xóa.');
 const checklistId=pick(row.data,['Mã phiếu','ID'])||text(row.legacy_id);const identifiers=[checklistId,text(row.legacy_id)].filter(Boolean);
 const details=await readSheet(S.checklistDetails);const detailRowNos=details.filter(item=>{const formId=pick(item.data,['Mã phiếu','Mã phiếu giám sát','Form ID']);return identifiers.some(id=>same(formId,id)||same(item.legacy_id,id));}).map(item=>item.row_no);
 if(detailRowNos.length){const {error}=await client.from('nk_legacy_rows').delete().eq('sheet_name',S.checklistDetails).in('row_no',detailRowNos);if(error)throw error;}
 const {data:evidenceRows,error:evidenceError}=await client.from('ksnk_evidence').select('id,legacy_id,storage_path').eq('module','checklists');if(evidenceError)throw evidenceError;
 const matching=(evidenceRows||[]).filter(item=>identifiers.some(id=>text(item.legacy_id)===id||text(item.legacy_id).startsWith(`${id}:`)));const paths=matching.map(item=>text(item.storage_path)).filter(Boolean);if(paths.length){const {error}=await client.storage.from(EVIDENCE_BUCKET).remove(paths);if(error)console.warn('[checklist-delete:storage]',error.message);}
 if(matching.length){const {error}=await client.from('ksnk_evidence').delete().in('id',matching.map(item=>item.id));if(error)throw error;}
 await deleteRow(S.checklists,rowNo);
}
function rowData(row:LegacyRow){return {row_no:row.row_no,legacy_id:row.legacy_id||'',data:row.data};}

function parseLeaveHistory(value:unknown):AnyRecord[]{if(Array.isArray(value))return value.filter(x=>x&&typeof x==='object') as AnyRecord[];const raw=text(value);if(!raw)return [];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x==='object') as AnyRecord[]:[]}catch{return [];}}
function leaveDaysOf(item:AnyRecord){return Math.max(0,num(item.days??item.leaveDays??item['Số ngày nghỉ']));}
function getStaff(rows:LegacyRow[]){return rows.map(row=>{const d=row.data;const contractEndDate=ymd(pick(d,['Ngày hết hạn hợp đồng','Ngày hết hạn Hợp đồng','Ngày kết thúc hợp đồng','Ngày hết hạn HĐ','Ngày kết thúc HĐ','Hạn hợp đồng','Hạn HĐ','Ngày hết hạn HĐLĐ','Ngày hết hạn hợp đồng lao động','Ngày kết thúc hợp đồng lao động','Contract End Date','contractEndDate']));const contractLevel=contractAlertLevel(contractEndDate);const position=pick(d,['Chức vụ','Chức danh']);const leaveHistory=parseLeaveHistory(d['Lịch sử nghỉ phép']??d.leaveHistory);const annualLeaveEntitlement=Math.max(0,num(pick(d,['Số ngày phép năm','Phép năm','Ngày phép năm'])));const leaveTaken=leaveHistory.reduce((sum,item)=>sum+leaveDaysOf(item),0)||Math.max(0,num(pick(d,['Số ngày đã nghỉ phép','Đã nghỉ phép','Ngày đã nghỉ'])));const leaveRemaining=Math.max(annualLeaveEntitlement-leaveTaken,0);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã NV']),name:pick(d,['Họ và tên','Họ tên']),department:pick(d,['Bộ phận']),position,managerNote:pick(d,['Lưu ý quản lý','Ghi chú quản lý','Lưu ý']),isManager:isManagerPosition(position),phone:pick(d,['Số điện thoại']),status:pick(d,['Trạng thái']),contractStartDate:ymd(pick(d,['Ngày ký hợp đồng','Ngày bắt đầu hợp đồng','Ngày ký HĐ','Ngày ký HĐLĐ'])),contractEndDate,contractAlert:contractLevel,contractDays:dayDelta(contractEndDate),annualLeaveEntitlement,leaveTaken,leaveRemaining,leaveHistory,data:d};}).filter(x=>x.name);}
function managerDirectory(staff:AnyRecord[]){return staff.filter(x=>x.isManager||isManagerPosition(x.position));}
function staffMap(staff:AnyRecord[]){return new Map<string,string>(staff.map(x=>[norm(x.name),text(x.department)] as [string,string]));}
function departmentOptions(catalogRows:LegacyRow[],staff:AnyRecord[]){
 const catalog=catalogRows.map(row=>({name:pick(row.data,['Tên bộ phận','Tên','Bộ phận']),status:pick(row.data,['Trạng thái'])||'Hoạt động'})).filter(x=>x.name);
 const known=new Set(catalog.map(row=>norm(row.name)));
 const names=[...catalog.filter(row=>activeDepartment(row.status)).map(row=>row.name),...staff.map(row=>text(row.department)).filter(name=>!known.has(norm(name)))];
 return [...new Set(names.filter(ksnkDepartment))].sort((a,b)=>a.localeCompare(b,'vi'));
}
function task(row:LegacyRow,map?:Map<string,string>,staffDirectory:AnyRecord[]=[]){
 const d=row.data;
 const rawAssignee=pick(d,['Người thực hiện','Người chịu trách nhiệm']);
 const rawAssigneeId=pick(d,['Mã NV','Mã nhân viên','Mã người thực hiện','Mã người chịu trách nhiệm','staffId']);
 const matches=staffDirectory.filter(x=>rawAssigneeId?same(x.id,rawAssigneeId):rawAssignee&&same(x.name,rawAssignee));
 const assigneeRecord=matches.length===1?matches[0]:undefined;
 const assignee=assigneeRecord?.name||rawAssignee;
 const assigneeId=assigneeRecord?.id||rawAssigneeId;
 const rawManager=pick(d,['Người quản lý phê duyệt','Quản lý phê duyệt','Người duyệt']);
 const rawManagerId=pick(d,['Mã người quản lý','Mã quản lý phê duyệt','Mã quản lý']);
 const managerRecord=staffDirectory.find(x=>(rawManagerId&&same(x.id,rawManagerId))||(rawManager&&same(x.name,rawManager)));
 const managerName=managerRecord?.name||rawManager;
 const managerId=managerRecord?.id||rawManagerId;
 const savedStatus=pick(d,['Trạng thái NV','Trạng thái'])||'CHƯA BẮT ĐẦU';
 const savedEvalStatus=pick(d,['Đánh giá quản lý','Đánh giá quản lý hiện tại','Đánh giá'])||'CHƯA BẮT ĐẦU';
 const startDate=ymd(d['Ngày bắt đầu']);
 const endDate=ymd(d['Ngày kết thúc']);
 const overdue=Boolean(endDate&&endDate<today()&&!done(savedStatus));
 const status=overdue?'QUÁ HẠN':savedStatus;
 const evalStatus=overdue&&!['XUẤT SẮC','TỐT','KHÁ','QUÁ HẠN'].includes(savedEvalStatus)?'QUÁ HẠN':savedEvalStatus;
 return {row_no:row.row_no,legacy_id:row.legacy_id||'',sourceId:row.id,id:pick(d,['ID','Mã công việc']),taskId:pick(d,['ID','Mã công việc']),assignee,assigneeId,department:pick(d,['Bộ phận','Thuộc bộ phận'])||assigneeRecord?.department||map?.get(norm(assignee))||'',assigner:pick(d,['Người giao việc','Người giao','Người tạo']),priority:pick(d,['Mức độ ưu tiên','Mức ưu tiên'])||'TRUNG BÌNH',workType:taskWorkType(pick(d,['Loại công việc','Phân loại công việc','Nhóm công việc','workType','taskType'])),title:pick(d,['Tiêu đề công việc','Tiêu đề']),description:pick(d,['Nội dung / Mô tả','Nội dung','Mô tả']),backup:pick(d,['Dự phòng','Phương án dự phòng']),startDate,endDate,status,savedStatus,note:pick(d,['Ghi chú NV','Ghi chú']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),evalStatus,savedEvalStatus,qlNote:pick(d,['Ghi chú quản lý','Ghi chú / Phản hồi quản lý']),managerOpinion:pick(d,['Ý kiến quản lý','Ý kiến của quản lý','Ý kiến trưởng khoa']),managerId,managerName,approvalStatus:pick(d,['Trạng thái phê duyệt','Trạng thái xin ý kiến'])||'CHƯA XIN Ý KIẾN',approvalDecision:pick(d,['Kết quả phê duyệt','Kết quả xử lý phê duyệt']),approvalRequest:pick(d,['Nội dung xin phê duyệt','Nội dung xin ý kiến quản lý','Yêu cầu phê duyệt','Nội dung xin ý kiến']),approvalRequestedAt:pick(d,['Thời gian xin phê duyệt','Thời gian xin ý kiến','Ngày xin ý kiến']),approvalResponse:pick(d,['Phản hồi quản lý','Nội dung phê duyệt']),approvalReviewedAt:pick(d,['Thời gian phê duyệt','Ngày phê duyệt']),employeeFeedback:pick(d,['Phản hồi nhân viên','Ý kiến phản hồi nhân viên']),employeeFeedbackStatus:pick(d,['Trạng thái phản hồi nhân viên'])||'',employeeFeedbackAt:pick(d,['Thời gian phản hồi nhân viên']),approvalHistory:parseApprovalHistory(d['Lịch sử phê duyệt']),evaluationCurrentBy:pick(d,['Người đánh giá hiện tại']),evaluationCurrentAt:pick(d,['Thời gian đánh giá hiện tại']),data:d};
}
function staffMatch(staff:AnyRecord[],value:unknown,id?:unknown){const valueText=text(value);const idText=text(id);return staff.find(person=>(idText&&same(person.id,idText))||(valueText&&same(person.name,valueText)));}
function reminder(row:LegacyRow){const d=row.data;const daily=flag(d['NHẮC HÀNG NGÀY']??d['Nhắc hàng ngày']??d.daily??d.remindDaily);return {row_no:row.row_no,legacy_id:row.legacy_id||'',sourceId:row.id,id:pick(d,['MÃ NHẮC VIỆC','Mã nhắc việc']),assigner:pick(d,['NGƯỜI NHẮC','Người nhắc']),reminderId:pick(d,['MÃ NHẮC VIỆC','Mã nhắc việc']),date:ymd(d['NGÀY NHẮC']??d['Ngày nhắc']),title:pick(d,['TIÊU ĐỀ NHẮC VIỆC','Tiêu đề nhắc việc']),note:pick(d,['NỘI DUNG / GHI CHÚ','Nội dung / Ghi chú','Ghi chú']),person:pick(d,['NGƯỜI LIÊN QUAN','Người liên quan']),status:pick(d,['TRẠNG THÁI','Trạng thái'])||'CHƯA THỰC HIỆN',daily,remindDaily:daily,imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),data:d};}
function violation(row:LegacyRow){const d=row.data;const person=pick(d,['Họ tên','Họ và tên']);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã VP','Mã vi phạm','ID']),date:ymd(d['Ngày vi phạm']),staffId:pick(d,['Mã NV']),person,name:person,department:pick(d,['Bộ phận']),errorId:pick(d,['Mã lỗi']),errorName:pick(d,['Tên lỗi']),level:pick(d,['Mức độ']),score:num(d['Điểm trừ']),points:num(d['Điểm trừ']),recorder:pick(d,['Người ghi nhận']),note:pick(d,['Ghi chú']),status:pick(d,['Trạng thái'])||'Chưa xử lý',imageName:pick(d,['Hình ảnh','Ảnh minh chứng']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),data:d};}
function plan(row:LegacyRow,type:string){const d=row.data;const saved=pick(d,['Trạng thái'])||'CHƯA BẮT ĐẦU';const toDate=ymd(d['Đến ngày']);const status=!done(saved)&&toDate&&toDate<today()?'QUÁ HẠN':saved;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã KH','ID']),type,fromDate:ymd(d['Từ ngày']),toDate,department:pick(d,['Bộ phận']),content:pick(d,['Nội dung']),description:pick(d,['Nội dung / Mô tả','Mô tả']),owner:pick(d,['Người phụ trách']),status,savedStatus:saved,result:pick(d,['Kết quả']),note:pick(d,['Ghi chú']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),managerId:pick(d,['Mã người quản lý','Mã quản lý phê duyệt','Mã quản lý']),managerName:pick(d,['Người quản lý phê duyệt','Quản lý phê duyệt','Người duyệt']),approvalStatus:pick(d,['Trạng thái phê duyệt','Trạng thái xin ý kiến'])||'CHƯA XIN Ý KIẾN',approvalDecision:pick(d,['Kết quả phê duyệt','Kết quả xử lý phê duyệt']),approvalRequest:pick(d,['Nội dung xin ý kiến quản lý','Nội dung xin phê duyệt','Yêu cầu phê duyệt']),approvalRequestedAt:pick(d,['Thời gian xin ý kiến','Thời gian xin phê duyệt','Ngày xin ý kiến']),approvalResponse:pick(d,['Phản hồi quản lý','Nội dung phê duyệt']),approvalReviewedAt:pick(d,['Thời gian phê duyệt','Ngày phê duyệt']),managerOpinion:pick(d,['Ý kiến quản lý','Ý kiến của quản lý','Ý kiến trưởng khoa']),approvalHistory:parseApprovalHistory(d['Lịch sử phê duyệt']),evaluationCurrentBy:pick(d,['Người đánh giá hiện tại']),evaluationCurrentAt:pick(d,['Thời gian đánh giá hiện tại']),completedAt:ymd(d['Ngày hoàn thành']),rootId:pick(d,['Mã kế hoạch gốc']),carryPeriod:pick(d,['Kỳ chuyển tiếp']),data:d};}
function issue(row:LegacyRow,map?:Map<string,string>){const d=row.data;const owner=pick(d,['Người phụ trách']);return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã TT','ID']),date:ymd(d['Ngày ghi nhận']??d['Ngày']),department:pick(d,['Bộ phận'])||map?.get(norm(owner))||'',issue:pick(d,['Tồn tại / Sự cố / Kiến nghị','Nội dung']),cause:pick(d,['Nguyên nhân']),action:pick(d,['Phương án khắc phục']),owner,deadline:ymd(d['Hạn xử lý']??d['Hạn']),status:pick(d,['Trạng thái'])||'CHƯA KHẮC PHỤC',recommendation:pick(d,['Kiến nghị']),note:pick(d,['Ghi chú']),kind:pick(d,['Loại nội dung','Loại']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),data:d};}
function opinion(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',opinionId:pick(d,['Mã ý kiến','Mã ý kiến báo cáo','ID']),fromDate:ymd(d['Từ ngày']),toDate:ymd(d['Đến ngày']),department:pick(d,['Bộ phận']),person:pick(d,['Nhân viên']),reportId:pick(d,['Mã phiếu','Mã báo cáo']),formCode:pick(d,['Mã phiếu']),formName:pick(d,['Tên phiếu']),opinion:pick(d,['Ý kiến khắc phục của tổ trưởng','Ý kiến','Nội dung góp ý','Ghi chú']),enteredBy:pick(d,['Người nhập','Người thực hiện']),status:pick(d,['Trạng thái'])||'Đã lưu',data:d};}
function checklist(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã phiếu','ID']),date:ymd(d['Ngày giám sát']??d['Ngày']),staffId:pick(d,['Mã NV']),person:pick(d,['Họ tên','Họ và tên']),name:pick(d,['Họ tên','Họ và tên']),department:pick(d,['Bộ phận']),supervisor:pick(d,['Người giám sát']),area:pick(d,['Khu vực']),shift:pick(d,['Ca']),formCode:pick(d,['Mã mẫu phiếu','Mã phiếu']),formName:pick(d,['Tên phiếu']),applied:num(d['Tổng áp dụng']),pass:num(d['Đạt']),fail:num(d['Không đạt']),rate:num(d['Tỷ lệ %']),kpi:num(d['Điểm KPI']??d['KPI bảng kiểm áp dụng']),note:pick(d,['Ghi chú']),imageName:pick(d,['Ảnh minh chứng','Hình ảnh']),documentName:pick(d,['Tài liệu minh chứng','Tài liệu đính kèm']),na:num(d['Không áp dụng']),data:d};}
function formMaster(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',code:pick(d,['Mã phiếu','Mã mẫu phiếu']),name:pick(d,['Tên phiếu','Tên mẫu phiếu']),department:pick(d,['Bộ phận']),description:pick(d,['Mô tả','Nội dung']),criteriaCount:pick(d,['Số tiêu chí']),status:pick(d,['Trạng thái'])||'Hoạt động',data:d};}
function criterion(row:LegacyRow){const d=row.data;return {row_no:row.row_no,legacy_id:row.legacy_id||'',id:pick(d,['Mã tiêu chí','ID']),formCode:pick(d,['Mã phiếu','Mã mẫu phiếu']),department:pick(d,['Bộ phận']),group:pick(d,['Nhóm tiêu chí','Nhóm']),content:pick(d,['Nội dung tiêu chí','Nội dung']),detail:pick(d,['Nội dung chi tiết','Chi tiết']),order:pick(d,['STT','Thứ tự']),allowImage:pick(d,['Cho phép hình ảnh','Cho phép ảnh'])||'Có',status:pick(d,['Trạng thái'])||'Hoạt động',data:d};}

function hasAssignee(list:unknown,name:unknown){return text(list).split(/[,;|]/).some(x=>same(x.trim(),name));}
function taskFilter(rows:AnyRecord[],f:Filters){const title=norm(f.title);return rows.filter(x=>overlap(x.startDate,x.endDate,f)&&(!f.department||same(x.department,f.department))&&(!f.person||hasAssignee(x.assignee,f.person))&&(!f.manager||same(x.managerName,f.manager))&&(!f.assignees?.length||f.assignees.some(y=>hasAssignee(x.assignee,y)))&&(!f.priority||same(x.priority,f.priority))&&(!f.workType||same(x.workType,f.workType))&&(!f.status||same(x.status,f.status))&&(!f.statuses?.length||f.statuses.some(y=>same(y,x.status)))&&(!f.approvalStatus||same(x.approvalStatus,f.approvalStatus)||isWaitingManager(f.approvalStatus)&&isWaitingManager(x.approvalStatus))&&(!title||norm(x.title).includes(title)));}
function taskSummary(rows:AnyRecord[],f:Filters){
 const scopeName=text(f.person)||(f.assignees?.length===1?f.assignees[0]:'TỔNG THỂ');
 const waitingManager=rows.filter(x=>isWaitingManager(x.approvalStatus)).length;
 const waitingEmployee=rows.filter(x=>['da phe duyet','yeu cau bo sung','tu choi'].includes(norm(x.approvalStatus))&&!x.employeeFeedback).length;
 return {scopeName,total:rows.length,completed:rows.filter(x=>done(x.status)).length,inProgress:rows.filter(x=>norm(x.status).includes('dang lam')||norm(x.status).includes('dang thuc hien')).length,notStarted:rows.filter(x=>norm(x.status).includes('chua bat dau')).length,overdue:rows.filter(x=>norm(x.status).includes('qua han')).length,pendingApproval:waitingManager+waitingEmployee,waitingManager,waitingEmployee};
}
function reminderFilter(rows:AnyRecord[],f:Filters){const title=norm(f.title);return rows.filter(x=>inRange(x.date,f)&&(!f.person||same(x.person,f.person))&&(!f.status||same(x.status,f.status))&&(!title||norm(x.title).includes(title)));}
function workload(rows:AnyRecord[],staff:AnyRecord[]){const names=[...new Set([...staff.map(x=>x.name),...rows.flatMap(x=>text(x.assignee).split(/[,;|]/).map(v=>v.trim())).filter(Boolean)])].filter(Boolean);return names.map(name=>{const mine=rows.filter(x=>hasAssignee(x.assignee,name));return {name,activeCount:mine.filter(x=>!done(x.status)&&!norm(x.status).includes('qua han')).length,completed:mine.filter(x=>done(x.status)).length,overdue:mine.filter(x=>norm(x.status).includes('qua han')).length,waitingManager:mine.filter(x=>isWaitingManager(x.approvalStatus)).length,waitingEmployee:mine.filter(x=>['da phe duyet','yeu cau bo sung','tu choi'].includes(norm(x.approvalStatus))&&!x.employeeFeedback).length,totalTasks:mine.length};});}
function rulesFrom(rows:AnyRecord[]){const rules=rows.map(row=>{const d=row.data||row;return {row_no:row.row_no,order:num(d['STT']??row.order),ranking:pick(d,['Xếp loại'])||text(row.ranking),min:num(d['Từ điểm']??row.min),max:num(d['Đến điểm']??row.max),color:pick(d,['Màu'])||row.color||'#6C757D',status:pick(d,['Trạng thái'])||'Hoạt động'};}).filter(x=>x.ranking&&norm(x.status)!=='tam ngung'&&norm(x.status)!=='ngung').sort((a,b)=>a.order-b.order);return rules.length?rules:DEFAULT_RULES;}
function rankFor(total:number,rules:AnyRecord[]){return rules.find(x=>total>=x.min&&total<=x.max)||rules[rules.length-1]||DEFAULT_RULES[DEFAULT_RULES.length-1];}
function taskScoreOf(value:unknown){const key=norm(value);if(key==='xuat sac')return 10;if(key==='tot')return 5;if(key==='kha')return 0;if(key==='chua dat'||key==='chua dat lam lai'||key==='lam lai')return -5;if(key==='kem')return -10;if(key==='qua han')return -5;return Number(TASK_SCORE[text(value).toUpperCase()]??0);}
function computeKpi(staff:AnyRecord[],tasks:AnyRecord[],checks:AnyRecord[],violations:AnyRecord[],rules:AnyRecord[]){return staff.map(s=>{const st=tasks.filter(x=>hasAssignee(x.assignee,s.name));const sc=checks.filter(x=>same(x.person,s.name));const sv=violations.filter(x=>same(x.person,s.name));let taskScore=0;const details:string[]=[];for(const x of st){const key=text(x.evalStatus).toUpperCase();const value=taskScoreOf(x.evalStatus);taskScore+=value;if(value)details.push(`${value>0?'+':''}${value} Giao việc: ${x.title} (${key})`);}const checklistScore=sc.reduce((n,x)=>n+num(x.percentKpi??x.kpi),0);for(const x of sc){const value=num(x.percentKpi??x.kpi);if(value)details.push(`${value>0?'+':''}${value} Bảng kiểm ${x.date}: ${x.percentRate??x.rate??0}%`);}const violationScore=-sv.reduce((n,x)=>n+Math.abs(num(x.points)),0);for(const x of sv){if(num(x.points))details.push(`-${Math.abs(num(x.points))} Vi phạm ${x.date}: ${x.errorName}`);}const total=100+taskScore+checklistScore+violationScore;const rank=rankFor(total,rules);return {staffId:s.id,name:s.name,person:s.name,department:s.department,position:s.position,base:100,taskScore,checklistScore,violationScore,total,ranking:rank.ranking,rank:rank.ranking,rankingColor:rank.color,details,taskCount:st.length,checkCount:sc.length,violationCount:sv.length};});}

function numberOr(value:unknown,fallback:number){return text(value)===''?fallback:num(value);}
function checklistConfig(row:LegacyRow){const d=row.data||{};const formCode=pick(d,['Mã phiếu','Mã mẫu phiếu']);if(!formCode)return null;return {row_no:row.row_no,legacy_id:row.legacy_id||'',formCode,thresholdA:numberOr(d['Ngưỡng A (%)'],95),thresholdB:numberOr(d['Ngưỡng B (%)'],90),thresholdC:numberOr(d['Ngưỡng C (%)'],80),labelA:pick(d,['Tên mức A'])||'A',labelB:pick(d,['Tên mức B'])||'B',labelC:pick(d,['Tên mức C'])||'C',labelBelow:pick(d,['Tên dưới C'])||'CHƯA ĐẠT',useCustomKpi:['co','có','yes','true'].includes(norm(d['Dùng KPI riêng'])),kpiBands:[{from:numberOr(d['KPI mức 1 từ %'],98),points:numberOr(d['KPI mức 1 điểm'],5)},{from:numberOr(d['KPI mức 2 từ %'],95),points:numberOr(d['KPI mức 2 điểm'],3)},{from:numberOr(d['KPI mức 3 từ %'],90),points:numberOr(d['KPI mức 3 điểm'],0)},{from:numberOr(d['KPI mức 4 từ %'],85),points:numberOr(d['KPI mức 4 điểm'],-2)},{from:numberOr(d['KPI mức 5 từ %'],80),points:numberOr(d['KPI mức 5 điểm'],-4)}],kpiBelow:numberOr(d['KPI dưới mức 5'],-5),status:pick(d,['Trạng thái'])||'Hoạt động',data:d};}
function checklistConfigFor(configs:AnyRecord[],formCode:string){return configs.find(x=>same(x.formCode,formCode)&&!['tam ngung','ngung'].includes(norm(x.status)))||null;}
function checklistRank(rate:number,config:AnyRecord|null){if(!config)return '';if(rate>=config.thresholdA)return config.labelA;if(rate>=config.thresholdB)return config.labelB;if(rate>=config.thresholdC)return config.labelC;return config.labelBelow;}
function checklistKpi(rate:number,config:AnyRecord|null){if(!config||!config.useCustomKpi)return rate>=95?5:rate>=90?3:rate>=80?0:rate>=70?-3:-5;const bands=[...(config.kpiBands||[])].sort((a,b)=>Number(b.from)-Number(a.from));return bands.find(x=>rate>=Number(x.from))?.points??config.kpiBelow??0;}
function checklistParityRow(row:LegacyRow,configs:AnyRecord[]){const base=checklist(row);const d=row.data||{};const config=checklistConfigFor(configs,base.formCode);const percentRate=numberOr(d['Tỷ lệ % chấm'],base.rate);const percentKpi=numberOr(d['KPI bảng kiểm áp dụng']??d['Điểm KPI'],checklistKpi(percentRate,config));return {...base,percentRate,percentRank:pick(d,['Xếp loại theo phiếu'])||checklistRank(percentRate,config),percentKpi,configuredKpi:checklistKpi(percentRate,config),scoringConfigured:Boolean(config),scoring:config};}
function checklistDetail(row:LegacyRow,forms:AnyRecord[]|Map<string,AnyRecord>){const d=row.data||{};const formId=pick(d,['Mã phiếu','Mã phiếu giám sát','Form ID'])||row.legacy_id||'';const form=forms instanceof Map?forms.get(norm(formId)):forms.find(x=>same(x.id,formId));return {row_no:row.row_no,legacy_id:row.legacy_id||'',formId,date:form?.date||'',staffId:form?.staffId||'',name:form?.person||'',department:form?.department||'',area:form?.area||'',formCode:form?.formCode||'',formName:form?.formName||'',criterionId:pick(d,['Mã tiêu chí','ID']),group:pick(d,['Nhóm tiêu chí','Nhóm']),content:pick(d,['Nội dung tiêu chí','Nội dung']),result:pick(d,['Kết quả','Kết quả chấm']),note:pick(d,['Ghi chú','Ghi chú lỗi']),order:numberOr(d['STT'],0),detail:pick(d,['Nội dung chi tiết','Chi tiết']),imageRef:pick(d,['Hình ảnh lỗi','Ảnh minh chứng','Hình ảnh'])||form?.imageName||'',documentRef:pick(d,['Tài liệu lỗi','Tài liệu minh chứng','Tài liệu đính kèm'])||form?.documentName||'',correctiveImageRef:pick(d,['Hình ảnh khắc phục','Ảnh khắc phục']),correctiveDocumentRef:pick(d,['Tài liệu khắc phục','Tài liệu khắc phục minh chứng']),data:d};}

function isSpecialDepartment(department:string){return ['ve sinh moi truong','dung cu','do vai','giam sat'].includes(norm(department));}
function reportErrorStats(details:AnyRecord[],scale:Scale=matrixDefaults):AnyRecord[]{
 const map=new Map<string,AnyRecord>();
 for(const x of details){
  const errorName=text(x.detail||x.content)||'Lỗi chưa có mô tả',key=norm(errorName);
  const item=map.get(key)||{errorName,count:0,totalPoints:0,critical:false};
  item.count++;item.totalPoints+=Math.abs(num(x.points));item.critical ||= /nghiem trong|rat nghiem trong/.test(norm(x.severity||x.level));map.set(key,item);
 }
 return [...map.values()].sort((a,b)=>Number(b.critical)-Number(a.critical)||b.count-a.count||a.errorName.localeCompare(b.errorName,'vi')).map(x=>{
  const idx=scale.count.findIndex(limit=>x.count<=limit),level=x.critical||idx<0?4:idx;
  return {...x,alert:x.critical||level>=2,alertLabel:x.critical?'Vi phạm nghiêm trọng':(scale.labels||matrixLevels)[level],color:(scale.colors||matrixColors)[level]};
 });
}

function reportStaffSummary(checks:AnyRecord[],details:AnyRecord[]):AnyRecord[]{const map=new Map<string,AnyRecord>();for(const x of checks){const key=x.staffId?`ID:${x.staffId}`:`NAME:${norm(x.person)}`;const item=map.get(key)||{staffId:x.staffId||'',name:x.person||'',areas:[],forms:0,evaluated:0,pass:0,fail:0,poor:0,errors:0};item.forms++;if(x.area&&!item.areas.includes(x.area))item.areas.push(x.area);map.set(key,item);}for(const x of details){const key=x.staffId?`ID:${x.staffId}`:`NAME:${norm(x.name)}`;const item=map.get(key)||{staffId:x.staffId||'',name:x.name||'',areas:[],forms:0,evaluated:0,pass:0,fail:0,poor:0,errors:0};if(x.area&&!item.areas.includes(x.area))item.areas.push(x.area);const result=norm(x.result);if(['dat','khong dat','kem'].includes(result)){item.evaluated++;if(result==='dat')item.pass++;if(result==='khong dat')item.fail++;if(result==='kem')item.poor++;if(result!=='dat')item.errors++;}map.set(key,item);}return [...map.values()].map((x:AnyRecord)=>({...x,total:x.evaluated,area:x.areas.join(' + ')||'Chưa ghi nhận',passRate:x.evaluated?100*x.pass/x.evaluated:null,errorRate:x.evaluated?Math.round(x.errors*1000/x.evaluated)/10:null})).sort((a:AnyRecord,b:AnyRecord)=>Number(a.errorRate||0)-Number(b.errorRate||0)||String(a.name).localeCompare(String(b.name),'vi'));}
function reportErrorDetails(details:AnyRecord[]):AnyRecord[]{return details.map((x:AnyRecord):AnyRecord=>({...x,errorName:text(x.errorName||x.detail||x.content)||'Lỗi chưa có mô tả',area:text(x.area)||'Chưa xác định',cause:text(x.cause)||'Chưa xác định',action:text(x.action)||'Yêu cầu khắc phục'})).sort((a:AnyRecord,b:AnyRecord)=>String(b.date||'').localeCompare(String(a.date||'')));}
function formMatrixParity(checks:AnyRecord[],details:AnyRecord[],criteria:AnyRecord[]):AnyRecord{
 const staffKey=(id:string,name:string)=>id?'id:'+norm(id):'name:'+norm(name);
 const criterionKey=(id:string,group:string,content:string)=>id?'id:'+norm(id):JSON.stringify([norm(group),norm(content)]);
 const staffMap=new Map<string,AnyRecord>();
 for(const x of checks){
  const key=staffKey(x.staffId,x.person),item=staffMap.get(key)||{staffId:x.staffId,name:x.person,areas:[]};
  if(x.area&&!item.areas.includes(x.area))item.areas.push(x.area);staffMap.set(key,item);
 }
 const staff=[...staffMap.values()].map<AnyRecord>(x=>({...x,area:x.areas.join(' + ')})).sort((a,b)=>text(a.name).localeCompare(text(b.name),'vi'));
 const formCode=checks[0]?.formCode||'',catalog=new Map<string,AnyRecord>(),cells=new Map<string,Map<string,number>>();
 for(const c of criteria.filter(c=>same(c.formCode,formCode)&&!['ngung','tam ngung'].includes(norm(c.status)))){
  catalog.set(criterionKey(c.id,c.group,c.content),c);
 }
 for(const d of details){
  const key=criterionKey(d.criterionId,d.group,d.content);
  if(!catalog.has(key))catalog.set(key,{...d,id:d.criterionId});
  const cell=JSON.stringify([key,staffKey(d.staffId,d.name)]),counts=cells.get(cell)||new Map<string,number>();
  const label=text(d.result)||'Chưa đánh giá';counts.set(label,(counts.get(label)||0)+1);cells.set(cell,counts);
 }
 const rows=[...catalog.entries()].sort((a,b)=>num(a[1].order)-num(b[1].order)).map(([key,c])=>({
  criterionId:c.id,formCode,group:c.group,order:c.order,criterion:c.content,detail:c.detail,isSection:false,
  values:staff.map(p=>{const counts=cells.get(JSON.stringify([key,staffKey(p.staffId,p.name)]));return counts?[...counts].map(([label,n])=>n===1?label:label+' × '+n).join(' · '):'Chưa đánh giá';})
 }));
 return {rows,staff,summary:reportStaffSummary(checks,details)};
}

function nextWeekRows(sources:AnyRecord[],to:string,department='',person=''){const base=new Date((to||today())+'T00:00:00');const day=base.getDay();const add=day===0?1:8-day;const start=new Date(base);start.setDate(start.getDate()+add);const end=new Date(start);end.setDate(end.getDate()+6);const from=ymd(start.toISOString());const until=ymd(end.toISOString());return sources.map(raw=>{const kind=raw.assignee!==undefined?'TASK':raw.issue!==undefined?'ISSUE':'PLAN';const owner=kind==='TASK'?raw.assignee:kind==='ISSUE'?raw.owner:raw.owner;const rawDepartment=raw.department||'';if(department&&rawDepartment&&!same(rawDepartment,department))return null;if(person&&owner&&!same(owner,person))return null;const fromDate=kind==='TASK'?raw.startDate:kind==='ISSUE'?raw.date:raw.fromDate;const toDate=kind==='TASK'?raw.endDate:kind==='ISSUE'?raw.deadline:raw.toDate;const status=text(raw.status);const statusNorm=norm(status);const open=kind==='TASK'?['chua bat dau','dang lam','qua han'].some(x=>statusNorm.includes(x)):kind==='ISSUE'?!['da khac phuc','da hoan thanh','dong','hoan tat'].some(x=>statusNorm.includes(x)):!done(status);const overlap=(!fromDate||fromDate<=until)&&(!toDate||toDate>=from);const carry=!overlap&&(!toDate||toDate<from);if(!open||(!overlap&&!carry))return null;const title=kind==='TASK'?raw.title:kind==='ISSUE'?raw.issue:raw.content;const description=raw.description||(kind==='ISSUE'?[raw.cause,raw.action].filter(Boolean).join(' · '):'');const note=kind==='TASK'?(raw.qlNote||raw.managerOpinion||raw.approvalResponse||raw.note||''):kind==='ISSUE'?(raw.note||raw.recommendation||raw.action||''):(raw.note||'');return {...raw,workType:taskWorkType(raw.workType||raw['Loại công việc']),__reportNextWeek:true,kind,source:kind==='TASK'?'GIAO VIỆC':kind==='ISSUE'?'TỒN TẠI / SỰ CỐ / KIẾN NGHỊ':'KẾ HOẠCH',type:kind==='TASK'?'Công việc':kind==='ISSUE'?'Tồn tại / sự cố / kiến nghị':raw.type==='THÁNG'?'Kế hoạch tháng':'Kế hoạch tuần',fromDate,toDate,content:title||description,description,owner,note};}).filter(Boolean).sort((a:any,b:any)=>String(a.toDate||'9999-12-31').localeCompare(String(b.toDate||'9999-12-31'))).slice(0,200) as AnyRecord[];}
function buildChecklistParity(f:Filters,staff:AnyRecord[],departments:string[]){return Promise.all([readSheet(S.checklists,true),readSheet(S.checklistForms,true),readSheet(S.checklistCriteria,true),readSheet(S.checklistDetails,true),readSheet(S.checklistConfig,true)]).then(([historyRows,formRows,criterionRows,detailRows,configRows])=>{const configs=configRows.map(checklistConfig).filter(Boolean) as AnyRecord[];const all=historyRows.map(x=>checklistParityRow(x,configs));const rows=all.filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person))&&(!f.formCode||same(x.formCode,f.formCode)));const forms=all;const masterForms=formRows.map(formMaster);const criteria=criterionRows.map(criterion);const formMap=all.map(x=>x as AnyRecord);const ambiguous=new Set(all.filter(x=>f.department&&!same(x.department,f.department)).map(x=>String(x.id)));const selected=new Set(rows.filter(x=>!ambiguous.has(String(x.id))).map(x=>String(x.id)));const details=detailRows.map(x=>checklistDetail(x,formMap)).filter(x=>selected.has(String(x.formId)));const summary={total:rows.length,applied:rows.reduce((n,x)=>n+num(x.applied),0),pass:rows.reduce((n,x)=>n+num(x.pass),0),fail:rows.reduce((n,x)=>n+num(x.fail),0),na:rows.reduce((n,x)=>n+num(x.na),0),averageRate:rows.length?Math.round(rows.reduce((n,x)=>n+num(x.rate),0)/rows.length*100)/100:0,averagePercentRate:rows.length?Math.round(rows.reduce((n,x)=>n+num(x.percentRate),0)/rows.length*100)/100:0};return {rows,total:rows.length,forms:masterForms,criteria,details,historyDetails:details,percentConfig:configs,scoring:configs,staff,departments,summary,options:{formCodes:masterForms.map(x=>x.code),results:['ĐẠT','KHÔNG ĐẠT','KHÔNG ÁP DỤNG'],statuses:['Hoạt động','Tạm ngưng']}};});}
async function buildReportsParity(f:Filters,staff:AnyRecord[],departments:string[],map:Map<string,string>){const [taskRows,violationRows,checkRows,detailRows,formRows,criterionRows,configRows,weekRows,monthRows,issueRows,opinionRows,snapshotRows,ruleRows]=await Promise.all([readSheet(S.tasks,true),readSheet(S.violations,true),readSheet(S.checklists,true),readSheet(S.checklistDetails,true),readSheet(S.checklistForms,true),readSheet(S.checklistCriteria,true),readSheet(S.checklistConfig,true),readSheet(S.weekly,true),readSheet(S.monthly,true),readSheet(S.issues,true),readSheet(S.opinions,true),readSheet(S.reportSnapshots,true),readSheet(S.kpiRules,true)]);const scale=(await readSheet('CAI_DAT_MA_TRAN'))[0]?.data?.scale||matrixDefaults;const configs=configRows.map(checklistConfig).filter(Boolean) as AnyRecord[];const criteria=criterionRows.map(criterion);const tasks=taskFilter(taskRows.map(x=>task(x,map)),f);const violations=violationRows.map(violation).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person)));const checks=checkRows.map(x=>checklistParityRow(x,configs)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person)));const formMap=new Map(checks.map(x=>[norm(x.id),x]));const selected=new Set(checks.map(x=>String(x.id)));const details=detailRows.map(x=>checklistDetail(x,formMap)).filter(x=>selected.has(String(x.formId)));const plans=[...weekRows.map(x=>plan(x,'TUẦN')),...monthRows.map(x=>plan(x,'THÁNG'))].filter(x=>overlap(x.fromDate,x.toDate,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.owner,f.person)));const issues=issueRows.map(x=>issue(x,map)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.owner,f.person)));const deps=[...new Set([...departments,...tasks.map(x=>x.department),...violations.map(x=>x.department),...checks.map(x=>x.department),...plans.map(x=>x.department),...issues.map(x=>x.department)].filter(Boolean))].filter(x=>!f.department||same(x,f.department)).sort((a,b)=>a.localeCompare(b,'vi'));const rows=deps.map(department=>{const t=tasks.filter(x=>same(x.department,department));const v=violations.filter(x=>same(x.department,department));const c=checks.filter(x=>same(x.department,department));const p=plans.filter(x=>same(x.department,department));const i=issues.filter(x=>same(x.department,department));return {department,taskCount:t.length,completedTasks:t.filter(x=>done(x.status)).length,overdueTasks:t.filter(x=>norm(x.status).includes('qua han')||(!done(x.status)&&x.endDate<today())).length,violationCount:v.length,violationPoints:v.reduce((n,x)=>n+Math.abs(num(x.points)),0),checklistCount:c.length,checklistApplied:c.reduce((n,x)=>n+num(x.applied),0),checklistPass:c.reduce((n,x)=>n+num(x.pass),0),checklistFails:c.reduce((n,x)=>n+num(x.fail),0),checklistNa:c.reduce((n,x)=>n+num(x.na),0),checklistRate:c.length?Math.round(c.reduce((n,x)=>n+num(x.rate),0)/c.length*100)/100:0,planCount:p.length,openPlans:p.filter(x=>!done(x.status)).length,issueCount:i.length};});const failDetails=details.filter(x=>['khong dat','kem'].includes(norm(x.result)));const errorStats=reportErrorStats(failDetails,scale);const suddenErrorStats=reportErrorStats(violations.map(x=>({detail:x.errorName,points:x.points,name:x.person,severity:x.level})),scale);const formGroups=[...new Map<string,string>(checks.filter(x=>Boolean(x.formCode)).map(x=>[String(x.formCode),String(x.formName||x.formCode)] as [string,string])).entries()].map(([formCode,formName])=>{const formChecks=checks.filter(x=>same(x.formCode,formCode));const ids=new Set(formChecks.map(x=>String(x.id)));const formDetails=details.filter(x=>ids.has(String(x.formId)));const evaluated=formDetails.filter(x=>['dat','khong dat','kem'].includes(norm(x.result)));const pass=evaluated.filter(x=>norm(x.result)==='dat').length;const errors=reportErrorStats(formDetails.filter(x=>['khong dat','kem'].includes(norm(x.result))),scale);const matrix=formMatrixParity(formChecks,formDetails,criteria);return {formCode,formName,formCount:formChecks.length,evaluated:evaluated.length,pass,fail:evaluated.length-pass,passRate:evaluated.length?Math.round(pass*1000/evaluated.length)/10:0,marks:formDetails.map(({row_no,formId,date,staffId,name,department,area,criterionId,group,content,result})=>({row_no,formId,date,staffId,name,department,area,criterionId,group,content,result})),rows:matrix.rows,summary:matrix.summary,staff:matrix.staff,errorStats:errors,errorDetails:reportErrorDetails(formDetails.filter(x=>['khong dat','kem'].includes(norm(x.result)))),conclusion:!evaluated.length?'Chưa có lượt đánh giá hợp lệ trong kỳ.':errors.length?`Phiếu ${formName}: tỷ lệ đạt ${evaluated.length?Math.round(pass*1000/evaluated.length)/10:0}%, cần theo dõi ${errors[0].errorName}.`:`Phiếu ${formName}: không ghi nhận lỗi không đạt trong kỳ.`};});const matrixStaff=reportStaffSummary(checks,details);const matrixRows=matrixStaff.map(x=>({...x,department:checks.find(y=>same(y.person,x.name))?.department||'',formCodes:[...new Set(checks.filter(y=>same(y.person,x.name)).map(y=>y.formCode).filter(Boolean))].join(', ')}));const scopedStaff=staff.filter(x=>(!f.department||same(x.department,f.department))&&(!f.person||norm(x.name).includes(norm(f.person))));const rules=rulesFrom(ruleRows.map(rowData));const kpiRows=computeKpi(scopedStaff,tasks,checks,violations,rules);const summary={weeklyTotal:plans.filter(x=>x.type==='TUẦN').length,weeklyDone:plans.filter(x=>x.type==='TUẦN'&&done(x.status)).length,monthlyTotal:plans.filter(x=>x.type==='THÁNG').length,monthlyDone:plans.filter(x=>x.type==='THÁNG'&&done(x.status)).length,taskTotal:tasks.length,taskDone:tasks.filter(x=>done(x.status)).length,overdue:tasks.filter(x=>norm(x.status).includes('qua han')||(!done(x.status)&&x.endDate<today())).length,checklistForms:checks.length,checklistApplied:checks.reduce((n,x)=>n+num(x.applied),0),checklistPass:checks.reduce((n,x)=>n+num(x.pass),0),checklistFails:checks.reduce((n,x)=>n+num(x.fail),0),checklistNa:checks.reduce((n,x)=>n+num(x.na),0),checklistAvgRate:checks.length?Math.round(checks.reduce((n,x)=>n+num(x.rate),0)/checks.length*100)/100:0,uniqueErrors:errorStats.length,errorRecords:failDetails.length,warningErrors:errorStats.filter(x=>x.alert).length,violationCount:violations.length,violationPoints:violations.reduce((n,x)=>n+Math.abs(num(x.points)),0),issueCount:issues.length};const reportOpinions=opinionRows.map(opinion).filter(x=>(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person))&&(!f.from||!x.fromDate||x.fromDate===f.from)&&(!f.to||!x.toDate||x.toDate===f.to));const incidentIssues=issues.filter(x=>{const kind=norm(x.kind);return kind.includes('su co')||kind.includes('nhat ky')||norm(x.issue).includes('su co');});const otherIssues=issues.filter(x=>!incidentIssues.some(y=>y.row_no===x.row_no));const alias=f.department?(await readSheet(S.departments)).find(r=>same(r.data['Tên bộ phận'],f.department))?.data:null;const baseHero=reportHero(alias?.['Tên mẫu báo cáo gốc']||alias?.['Tên bộ phận trước']||f.department||'')||reportHero(f.department||'');const template=baseHero?(await readSheet('MAU_BAO_CAO_GIAO_BAN')).find(r=>r.legacy_id===baseHero.key)?.data?.template:null;const hero=baseHero?{...baseHero,focus:heroFocus[baseHero.key]||[],...(template&&validTemplate(template)?template:{})}:null;const routineAnalysis=errorStats.length?[`Tổng số lỗi thường quy: ${failDetails.length}.`,`Lỗi xuất hiện nhiều nhất: ${errorStats[0].errorName} (${errorStats[0].count} lần).`,errorStats.some(x=>x.alert)?'Có nhóm lỗi đạt/vượt ngưỡng cảnh báo lặp lại.':'Chưa có nhóm lỗi nào vượt ngưỡng cảnh báo lặp lại.']:['Không ghi nhận lỗi thường quy trong kỳ báo cáo.'];const suddenAnalysis=suddenErrorStats.length?[`Ghi nhận ${violations.length} lỗi đột xuất, tổng ${summary.violationPoints} điểm trừ.`,`Lỗi đột xuất nổi bật: ${suddenErrorStats[0].errorName} (${suddenErrorStats[0].count} lần).`]:['Không ghi nhận lỗi đột xuất/vi phạm trong kỳ báo cáo.'];return {rows,total:rows.length,departments:deps,staff,filters:f,reportType:hero?'SPECIAL':'GENERIC',specialDepartment:hero?(f.department||''):'',reportHero:hero,weekly:plans.filter(x=>x.type==='TUẦN'),monthly:plans.filter(x=>x.type==='THÁNG'),tasks,plans,checks,violations,issues,incidentIssues,otherIssues,opinions:reportOpinions,snapshots:snapshotRows.map(rowData),nextWeekPlan:nextWeekRows([...weekRows.map(x=>plan(x,'TUẦN')),...monthRows.map(x=>plan(x,'THÁNG')),...taskRows.map(x=>task(x,map)),...issueRows.map(x=>issue(x,map))],f.to||'',f.department||'',f.person||''),summary,special:{errorStats,failures:failDetails,conclusion:violations.length?`Ghi nhận ${violations.length} vi phạm, tổng ${summary.violationPoints} điểm trừ.`:'Không ghi nhận vi phạm trong kỳ báo cáo.'},errorStats,errorDetails:reportErrorDetails(failDetails),suddenErrorStats,routineAnalysis,suddenAnalysis,formMatrices:formGroups,matrixCriteria:criteria,matrixStaff,matrixRows,staffSummary:matrixStaff,kpiReport:{rows:kpiRows,total:kpiRows.length,summary:{averageScore:kpiRows.length?Math.round(kpiRows.reduce((n,x)=>n+x.total,0)/kpiRows.length*10)/10:0,totalScore:kpiRows.reduce((n,x)=>n+x.total,0)},conclusion:kpiRows.length?`Điểm KPI bình quân: ${Math.round(kpiRows.reduce((n,x)=>n+x.total,0)/kpiRows.length*10)/10}.`:'Chưa đủ dữ liệu KPI.'}};}

async function buildModule(moduleName:string,f:Filters){
 const [staffRows,departmentRows]=await Promise.all([readSheet(S.staff),readSheet(S.departments)]);const staff=getStaff(staffRows);const managers=managerDirectory(staff);const departments=departmentOptions(departmentRows,staff);const map=staffMap(staff);
 if(moduleName==='checklists')return buildChecklistParity(f,staff,departments);
 if(moduleName==='reports'){const user=await actor();const allowed=user?await featureScope(user,'reports','export'):'none';return {...await buildReportsParity(f,staff,departments,map),canExport:allowed!=='none'};}
 if(moduleName==='staff'){
  const rows=staff.filter(x=>(!f.department||same(x.department,f.department))&&(!f.person||norm(x.name).includes(norm(f.person))));
  const leavePlanning=buildLeavePlanning(rows,departments);
  const leaveSummary={annualLeave:leavePlanning.summary.annualLeave,taken:leavePlanning.summary.taken,remaining:leavePlanning.summary.remaining,activeEmployees:leavePlanning.summary.activeEmployees,employeesWithLeaveRemaining:leavePlanning.summary.employeesWithLeaveRemaining,employeesUsedUp:leavePlanning.summary.employeesUsedUp};
  return {rows,total:rows.length,departments,staff,managerStaff:managers,contractAlerts:rows.filter(x=>Boolean(x.contractAlert)),leaveSummary,leavePlan:leavePlanning.departments,leavePlanSummary:leavePlanning.summary,leavePlanMeta:{year:leavePlanning.year,currentMonth:leavePlanning.currentMonth,currentMonthLabel:leavePlanning.currentMonthLabel,monthsRemaining:leavePlanning.monthsRemaining,referenceDaysPerEmployeePerMonth:leavePlanning.referenceDaysPerEmployeePerMonth}};
 }
 if(moduleName==='tasks'){const [taskRows,reminderRows]=await Promise.all([readSheet(S.tasks),readSheet(S.reminders)]);const all=taskRows.map(x=>task(x,map));const rows=taskFilter(all,f);const reminders=reminderFilter(reminderRows.map(reminder),f);const approvalCandidates=rows.filter(x=>isWaitingManager(x.approvalStatus)||(['da phe duyet','yeu cau bo sung','tu choi'].includes(norm(x.approvalStatus))&&!x.employeeFeedback));const approvalItems=f.manager?approvalCandidates:[];const approvalSummary={waitingManager:f.manager?rows.filter(x=>isWaitingManager(x.approvalStatus)).length:0,waitingEmployee:f.manager?rows.filter(x=>['da phe duyet','yeu cau bo sung','tu choi'].includes(norm(x.approvalStatus))&&!x.employeeFeedback).length:0};return {rows,total:rows.length,taskSummary:taskSummary(rows,f),reminders,reminderTotal:reminders.length,staff,managerStaff:managers,departments,options:{workTypes:TASK_WORK_TYPES,priorities:[...new Set([...TASK_PRIORITIES,...all.map(x=>x.priority).filter(Boolean)])].sort(),statuses:[...new Set([...TASK_STATUSES,...all.map(x=>x.status).filter(Boolean)])].sort(),evalStatuses:[...new Set([...TASK_EVAL_STATUSES,...all.map(x=>x.evalStatus).filter(Boolean)])].sort(),approvalStatuses:[...new Set([...TASK_APPROVAL_STATUSES,...all.map(x=>x.approvalStatus).filter(Boolean)])].sort(),managers:managers.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi')),reminderStatuses:[...new Set([...TASK_REMINDER_STATUSES,...reminderRows.map(x=>reminder(x).status).filter(Boolean)])].sort(),assignees:[...new Set(staff.map(x=>x.name).filter(Boolean))]},approvalItems,approvalSummary,workload:workload(rows,staff)};}
 if(moduleName==='reminders'){const rows=reminderFilter((await readSheet(S.reminders)).map(reminder),f);return {rows,total:rows.length,staff,departments,options:{statuses:[...new Set([...TASK_REMINDER_STATUSES,...rows.map(x=>x.status).filter(Boolean)])].sort()}};}
 if(moduleName==='violations'){const [source,errorRows,summaryRows]=await Promise.all([readSheet(S.violations),readSheet(S.errors),readSheets([S.violationSummary,S.violationSummaryLegacy])]);const rows=source.map(violation).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person))&&(!f.status||same(x.status,f.status)));const errorCatalog=errorRows.map(r=>{const d=r.data;return {row_no:r.row_no,id:pick(d,['Mã lỗi']),name:pick(d,['Tên lỗi']),department:pick(d,['Bộ phận']),level:pick(d,['Mức độ']),score:num(d['Điểm trừ']),note:pick(d,['Ghi chú']),status:pick(d,['Trạng thái']),data:d};});const violationStatuses=[...new Set([...VIOLATION_STATUSES,...source.map(row=>pick(row.data,['Trạng thái'])).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'vi'));const violationLevels=[...new Set([...VIOLATION_ERROR_LEVELS,...errorCatalog.map(x=>x.level),...source.map(row=>pick(row.data,['Mức độ']))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));const errorLevels=[...new Set([...VIOLATION_ERROR_LEVELS,...errorCatalog.map(x=>x.level)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));const errorStatuses=[...new Set([...VIOLATION_ERROR_STATUSES,...errorCatalog.map(x=>x.status)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));return {rows,total:rows.length,errors:errorRows.map(rowData),errorCatalog,monthlySummary:summaryRows.map(rowData),summary:staff.map(s=>({name:s.name,department:s.department,score:rows.filter(x=>same(x.person,s.name)).reduce((n,x)=>n+num(x.score),0)})).filter(x=>x.score>0),staff,departments,options:{violationStatuses,violationLevels,errorLevels,errorStatuses,recorders:staff.map(x=>x.name).filter(Boolean)}};}
 if(moduleName==='checklists'){const [history,formRows,criterionRows,detailRows,configRows]=await Promise.all([readSheet(S.checklists),readSheet(S.checklistForms),readSheet(S.checklistCriteria),readSheet(S.checklistDetails),readSheet(S.checklistConfig)]);const rows=history.map(checklist).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person))&&(!f.formCode||same(x.formCode,f.formCode)));return {rows,total:rows.length,forms:formRows.map(formMaster),criteria:criterionRows.map(criterion),details:detailRows.map(rowData),percentConfig:configRows.map(rowData),staff,departments,summary:{total:rows.length,pass:rows.reduce((n,x)=>n+num(x.pass),0),fail:rows.reduce((n,x)=>n+num(x.fail),0),averageRate:rows.length?Math.round(rows.reduce((n,x)=>n+num(x.rate),0)/rows.length*100)/100:0}};}
 if(moduleName==='plans'){const [week,month,issueRows]=await Promise.all([readSheet(S.weekly),readSheet(S.monthly),readSheet(S.issues)]);const rows=[...week.map(x=>plan(x,'TUẦN')),...month.map(x=>plan(x,'THÁNG'))].filter(x=>(!f.type||x.type===f.type)&&overlap(x.fromDate,x.toDate,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.owner,f.person))&&(!f.status||same(x.status,f.status)));const issues=issueRows.map(x=>issue(x,map)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.owner,f.person)));const issueStatuses=[...new Set([...ISSUE_STATUSES,...issueRows.map(row=>pick(row.data,['Trạng thái'])).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'vi'));return {rows,total:rows.length,issues,staff,departments,summary:{total:rows.length,done:rows.filter(x=>done(x.status)).length,overdue:rows.filter(x=>norm(x.status)==='qua han').length,openIssues:issues.filter(x=>!done(x.status)).length},options:{statuses:[...new Set([...rows.map(x=>x.status),'CHƯA BẮT ĐẦU','ĐANG THỰC HIỆN','HOÀN THÀNH','QUÁ HẠN','CHUYỂN TIẾP'].filter(Boolean))],issueStatuses}};}
 if(moduleName==='reports')return buildReports(f,staff,departments,map);
 if(moduleName==='kpi')return buildKpi(f,staff,departments,map);
 if(moduleName==='alerts')return buildAlerts(f,staff,departments,map);
 const raw=await readSheet(moduleName);return {rows:raw.map(rowData),total:raw.length,departments,staff};
}

async function buildReports(f:Filters,staff:AnyRecord[],departments:string[],map:Map<string,string>){
 const [taskRows,violationRows,checkRows,weekRows,monthRows,issueRows,opinionRows,snapshotRows]=await Promise.all([readSheet(S.tasks),readSheet(S.violations),readSheet(S.checklists),readSheet(S.weekly),readSheet(S.monthly),readSheet(S.issues),readSheet(S.opinions),readSheet(S.reportSnapshots)]);
 const tasks=taskFilter(taskRows.map(x=>task(x,map)),f);const violations=violationRows.map(violation).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person)));const checks=checkRows.map(checklist).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person)));const plans=[...weekRows.map(x=>plan(x,'TUẦN')),...monthRows.map(x=>plan(x,'THÁNG'))].filter(x=>overlap(x.fromDate,x.toDate,f)&&(!f.department||same(x.department,f.department))&&(!f.person||same(x.owner,f.person)));const issues=issueRows.map(x=>issue(x,map)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department)));
 const deps=[...new Set([...departments,...tasks.map(x=>x.department),...violations.map(x=>x.department),...checks.map(x=>x.department),...plans.map(x=>x.department),...issues.map(x=>x.department)].filter(Boolean))].filter(x=>!f.department||same(x,f.department)).sort((a,b)=>a.localeCompare(b,'vi'));
 const rows=deps.map(department=>{const t=tasks.filter(x=>same(x.department,department));const v=violations.filter(x=>same(x.department,department));const c=checks.filter(x=>same(x.department,department));const p=plans.filter(x=>same(x.department,department));const i=issues.filter(x=>same(x.department,department));return {department,taskCount:t.length,completedTasks:t.filter(x=>done(x.status)).length,overdueTasks:t.filter(x=>norm(x.status).includes('qua han')||(!done(x.status)&&x.endDate<today())).length,violationCount:v.length,violationPoints:v.reduce((n,x)=>n+Math.abs(num(x.points)),0),checklistCount:c.length,checklistRate:c.length?Math.round(c.reduce((n,x)=>n+num(x.rate),0)/c.length*100)/100:0,checklistFails:c.reduce((n,x)=>n+num(x.fail),0),planCount:p.length,openPlans:p.filter(x=>!done(x.status)).length,issueCount:i.length};});
 const errors=new Map<string,AnyRecord>();for(const x of violations){const key=x.errorName||'Chưa phân loại';const item=errors.get(key)||{errorName:key,count:0,totalPoints:0};item.count++;item.totalPoints+=Math.abs(num(x.points));errors.set(key,item);}
 return {rows,total:rows.length,departments,staff,totals:{tasks:tasks.length,taskDone:tasks.filter(x=>done(x.status)).length,violations:violations.length,violationPoints:violations.reduce((n,x)=>n+Math.abs(num(x.points)),0),checklists:checks.length,checklistFails:checks.reduce((n,x)=>n+num(x.fail),0),plans:plans.length,plansDone:plans.filter(x=>done(x.status)).length,issues:issues.length},tasks,plans,checks,violations,issues,opinions:opinionRows.map(opinion),snapshots:snapshotRows.map(rowData),special:{errorStats:[...errors.values()].sort((a,b)=>b.count-a.count),failures:checks.filter(x=>num(x.fail)>0),conclusion:violations.length?`Ghi nhận ${violations.length} vi phạm, tổng ${violations.reduce((n,x)=>n+Math.abs(num(x.points)),0)} điểm trừ.`:'Không ghi nhận vi phạm trong kỳ báo cáo.'}};
}

async function buildKpi(f:Filters,staff:AnyRecord[],departments:string[],map:Map<string,string>){
 const [taskRows,checkRows,violationRows,storedRows,legacyStoredRows,ruleRows,feedbackRows,configRows,opinionRows]=await Promise.all([readSheet(S.tasks),readSheet(S.checklists),readSheet(S.violations),readSheet(S.kpi),readSheet(S.kpiLegacy),readSheet(S.kpiRules),readSheet(S.kpiFeedback),readSheet(S.checklistConfig),readSheet(S.opinions)]);
 const configs=configRows.map(x=>checklistConfig(x)).filter(Boolean) as AnyRecord[];const tasks=taskFilter(taskRows.map(x=>task(x,map)),{...f,person:''});const checks=checkRows.map(x=>checklistParityRow(x,configs)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||norm(x.person).includes(norm(f.person))));const violations=violationRows.map(x=>violation(x)).filter(x=>inRange(x.date,f)&&(!f.department||same(x.department,f.department))&&(!f.person||norm(x.person).includes(norm(f.person))));const scopedStaff=staff.filter(x=>(!f.department||same(x.department,f.department))&&(!f.person||norm(x.name).includes(norm(f.person))));const rules=rulesFrom(ruleRows.map(rowData));const rows=computeKpi(scopedStaff,tasks,checks,violations,rules);const stored=storedRows.concat(legacyStoredRows).map(row=>{const d=row.data;return {row_no:row.row_no,sheet:storedRows.includes(row)?S.kpi:S.kpiLegacy,legacy_id:row.legacy_id||'',snapshotId:pick(d,['Mã kỳ KPI','Mã bảng KPI']),savedAt:pick(d,['Ngày lưu bảng KPI','Thời gian lưu','Cập nhật lúc']),date:ymd(d['Thời gian lưu']),fromDate:ymd(d['Từ ngày']),toDate:ymd(d['Đến ngày']),staffId:pick(d,['Mã NV']),person:pick(d,['Họ tên','Nhân viên']),department:pick(d,['Bộ phận']),position:pick(d,['Chức vụ']),base:num(d['Điểm gốc']),taskScore:num(d['Điểm giao việc']),checklistScore:num(d['Điểm bảng kiểm']),violationScore:num(d['Điểm vi phạm']),total:num(d['Tổng điểm']),rank:pick(d,['Xếp loại']),detail:pick(d,['Chi tiết']),data:d};}).filter(x=>(!f.from||!x.fromDate||x.fromDate>=f.from)&&(!f.to||!x.toDate||x.toDate<=f.to));const rankCounts=rules.reduce((out,rule)=>{out[rule.ranking]=rows.filter(x=>x.ranking===rule.ranking).length;return out;},{} as AnyRecord);const summary={staffCount:rows.length,totalScore:rows.reduce((n,x)=>n+x.total,0),averageScore:rows.length?Math.round(rows.reduce((n,x)=>n+x.total,0)/rows.length*10)/10:0,totalTaskScore:rows.reduce((n,x)=>n+x.taskScore,0),totalChecklistScore:rows.reduce((n,x)=>n+x.checklistScore,0),totalViolationScore:rows.reduce((n,x)=>n+x.violationScore,0),rankCounts};const opinions=opinionRows.map(opinion).filter(x=>(!f.department||same(x.department,f.department))&&(!f.person||same(x.person,f.person))&&(!f.from||!x.fromDate||x.fromDate===f.from)&&(!f.to||!x.toDate||x.toDate===f.to));return {rows,total:rows.length,stored,departments,staff,rules,conversionRules:rules,feedback:feedbackRows.map(rowData),opinions,summary,conclusion:rows.length?`Điểm KPI bình quân của ${rows.length} nhân viên: ${summary.averageScore.toFixed(1)} điểm.`:'Không có dữ liệu KPI phù hợp với bộ lọc hiện tại.'};
}

async function buildAlerts(f:Filters,staff:AnyRecord[],departments:string[],map:Map<string,string>){
 const [taskRows,weekRows,monthRows,reminderRows,checklistRows,issueRows]=await Promise.all([readSheet(S.tasks),readSheet(S.weekly),readSheet(S.monthly),readSheet(S.reminders),readSheet(S.checklists),readSheet(S.issues)]);
 const alerts:AnyRecord[]=[];
 const currentDay=today();
 const currentMonth=currentDay.slice(0,7);
 const approvalScope=Boolean(f.manager||f.approvalStatus);
 const matchesPerson=(person:unknown)=>!f.person||same(person,f.person);
 const matchesDepartment=(department:unknown)=>!f.department||same(department,f.department);
 const matchesAlertLevel=(level:unknown)=>!f.alertLevel||same(level,f.alertLevel);
 const matchesTask=(x:AnyRecord)=>matchesDepartment(x.department)&&matchesPerson(x.assignee)&&(!f.manager||same(x.managerName,f.manager))&&(!f.approvalStatus||same(x.approvalStatus,f.approvalStatus)||(isWaitingManager(f.approvalStatus)&&isWaitingManager(x.approvalStatus)));

 for(const x of staff){
  const level=contractAlertLevel(x.contractEndDate);
  if(level&&!f.manager&&!f.approvalStatus&&matchesDepartment(x.department)&&matchesPerson(x.name)){const expired=level==='HỢP ĐỒNG QUÁ HẠN';alerts.push({kind:'HỢP ĐỒNG',level,date:x.contractEndDate,title:expired?`Hợp đồng của ${x.name} đã quá hạn`:`Hợp đồng của ${x.name} sắp đến hạn`,instruction:expired?'Mở mục Nhân sự, kiểm tra ngay hồ sơ và cập nhật gia hạn hợp đồng.':'Mở mục Nhân sự, kiểm tra ngày hết hạn và thực hiện gia hạn hoặc cập nhật hồ sơ.',person:x.name,department:x.department,target:'staff',row_no:x.row_no,id:x.id,contractStartDate:x.contractStartDate,contractEndDate:x.contractEndDate,contractDays:x.contractDays});}
 }

 const leavePlanning=buildLeavePlanning(staff,departments);
 if(!approvalScope){
  for(const plan of leavePlanning.departments){
   const hasPerson=!f.person||plan.staff.some(row=>same(row.name,f.person));
   if(plan.remainingDays<=0||plan.warningLevel==='TRONG GIỚI HẠN'||!matchesDepartment(plan.department)||!hasPerson)continue;
   alerts.push({kind:'NGHỈ PHÉP',level:plan.warningLevel,date:currentDay,title:`${plan.department}: còn ${plan.remainingDays} ngày phép`,instruction:`Bố trí tối thiểu ${plan.minimumEmployeesPerMonth} nhân sự nghỉ mỗi tháng; bình quân cần xếp khoảng ${plan.averageDaysPerMonth} ngày phép/tháng trong ${plan.monthsRemaining} tháng còn lại.`,department:plan.department,target:'staff',leavePlan:plan});
  }
 }

 for(const row of taskRows){
  const x=task(row,map,staff);
  if(!matchesTask(x))continue;
  const endDelta=dayDelta(x.endDate);
  const assignedDate=ymd(pick(row.data,['Ngày giao việc','Ngày phân công','Ngày tạo công việc','Ngày tạo','Thời gian tạo','Created At','created_at']))||x.startDate;
  const assignedDelta=dayDelta(assignedDate);
  const open=!done(x.status);
  let taskKind='';
  let taskLevel='';
  if(open&&endDelta!==null&&endDelta<0){taskKind='CÔNG VIỆC QUÁ HẠN';taskLevel='QUÁ HẠN';}
  else if(open&&endDelta===0){taskKind='CÔNG VIỆC HÔM NAY';taskLevel='HÔM NAY';}
  else if(open&&assignedDelta!==null&&assignedDelta<=0&&assignedDelta>=-7){taskKind='CÔNG VIỆC MỚI GIAO';taskLevel='MỚI GIAO';}
  else if(open&&endDelta!==null&&endDelta>0&&endDelta<=7){taskKind='CÔNG VIỆC TRONG TUẦN';taskLevel='TRONG TUẦN';}
  else if(open&&x.endDate?.slice(0,7)===currentMonth){taskKind='CÔNG VIỆC TRONG THÁNG';taskLevel='TRONG THÁNG';}
  if(taskKind&&!f.approvalStatus)alerts.push({kind:taskKind,level:taskLevel,date:taskKind==='CÔNG VIỆC MỚI GIAO'?assignedDate:(x.endDate||assignedDate||currentDay),title:x.title,instruction:taskKind==='CÔNG VIỆC QUÁ HẠN'?'Mở chi tiết, nhập lý do hoặc cập nhật trạng thái xử lý ngay.':taskKind==='CÔNG VIỆC MỚI GIAO'?'Mở chi tiết, kiểm tra yêu cầu và cập nhật trạng thái đã nhận.':'Mở chi tiết, kiểm tra hạn xử lý và cập nhật tiến độ.',person:x.assignee,department:x.department,managerName:x.managerName,approvalStatus:x.approvalStatus,target:'tasks',row_no:x.row_no,id:x.id});

  if(isWaitingManager(x.approvalStatus))alerts.push({kind:'PHÊ DUYỆT',level:'CHỜ QUẢN LÝ PHÊ DUYỆT',date:x.approvalRequestedAt||currentDay,title:`Xin phê duyệt: ${x.title}`,instruction:'Mở Chi tiết giao việc, kiểm tra toàn bộ nội dung, minh chứng và Đánh giá quản lý hiện tại; sau đó chọn Phê duyệt hoặc Yêu cầu bổ sung.',person:x.assignee,department:x.department,managerName:x.managerName,approvalStatus:x.approvalStatus,approvalRequest:x.approvalRequest,target:'tasks',row_no:x.row_no,id:x.id});
  if(['da phe duyet','yeu cau bo sung','tu choi'].includes(norm(x.approvalStatus))&&!x.employeeFeedback)alerts.push({kind:'PHẢN HỒI',level:'CHỜ NHÂN VIÊN PHẢN HỒI',date:x.approvalReviewedAt||currentDay,title:`Phản hồi quản lý: ${x.title}`,instruction:'Mở chi tiết, đọc ý kiến quản lý, bổ sung nội dung hoặc tài liệu nếu được yêu cầu rồi gửi phản hồi.',person:x.assignee,department:x.department,managerName:x.managerName,approvalStatus:x.approvalStatus,approvalResponse:x.approvalResponse,target:'tasks',row_no:x.row_no,id:x.id});
  const distinctManagerOpinion=!f.approvalStatus&&x.managerOpinion&&(!x.approvalResponse||norm(x.managerOpinion)!==norm(x.approvalResponse));
  if(distinctManagerOpinion)alerts.push({kind:'Ý KIẾN QUẢN LÝ',level:'PHẢN HỒI MỚI',date:x.approvalReviewedAt||currentDay,title:`Ý kiến quản lý mới: ${x.title}`,instruction:'Mở chi tiết giao việc, đọc chỉ đạo mới và cập nhật phản hồi hoặc trạng thái thực hiện.',person:x.assignee,department:x.department,managerName:x.managerName,managerOpinion:x.managerOpinion,target:'tasks',row_no:x.row_no,id:x.id});
 }

 for(const x of [...weekRows.map(row=>plan(row,'TUẦN')),...monthRows.map(row=>plan(row,'THÁNG'))]){const owner=staffMatch(staff,x.owner);const person=owner?.name||x.owner;const department=x.department||owner?.department||map.get(norm(person))||'';const level=alertLevel(x.toDate);if(!approvalScope&&level&&!done(x.status)&&matchesDepartment(department)&&matchesPerson(person))alerts.push({kind:x.type==='TUẦN'?'KẾ HOẠCH TUẦN':'KẾ HOẠCH THÁNG',level,date:x.toDate,title:x.content,instruction:'Mở mục Kế hoạch, cập nhật tiến độ, kết quả hoặc chuyển tiếp kế hoạch nếu chưa hoàn thành.',person,personId:owner?.id||'',department,target:'plans',row_no:x.row_no,id:x.id,type:x.type});}
  for(const x of reminderRows.map(reminder)){const personRecord=staffMatch(staff,x.person);const person=personRecord?.name||x.person;const department=personRecord?.department||'';const dailyActive=x.daily&&x.date&&x.date<=currentDay;const baseLevel=alertLevel(x.date);const level=dailyActive?'NHẮC HÀNG NGÀY':baseLevel||'NHẮC';if(!approvalScope&&!done(x.status)&&matchesPerson(person)&&(dailyActive||Boolean(baseLevel)))alerts.push({kind:dailyActive?'NHẮC VIỆC HÀNG NGÀY':'NHẮC VIỆC',level,date:dailyActive?currentDay:x.date,title:x.title,instruction:dailyActive?'Mở chi tiết nhắc việc mỗi ngày; thông báo tiếp tục đến khi bấm “TẮT NHẮC HÀNG NGÀY” hoặc chuyển trạng thái ĐÃ XONG.':'Mở mục Nhắc việc và cập nhật trạng thái sau khi thực hiện.',person,personId:personRecord?.id||'',department,target:'reminders',row_no:x.row_no,id:x.id,daily:x.daily,imageName:x.imageName,documentName:x.documentName,notificationAudience:'EMPLOYEE',notificationType:dailyActive?'DAILY_REMINDER':'REMINDER'});}
  for(const x of issueRows.map(row=>issue(row,map))){const owner=staffMatch(staff,x.owner);const person=owner?.name||x.owner;const department=x.department||owner?.department||map.get(norm(person))||'';const level=alertLevel(x.deadline);if(!approvalScope&&level&&!done(x.status)&&matchesDepartment(department)&&matchesPerson(person))alerts.push({kind:'TỒN TẠI / KIẾN NGHỊ',level,date:x.deadline,title:x.issue||'Tồn tại cần xử lý',instruction:'Mở mục Kế hoạch, xem tồn tại/kiến nghị và cập nhật phương án khắc phục, người phụ trách hoặc trạng thái.',person,personId:owner?.id||'',department,status:x.status,target:'issues',row_no:x.row_no,id:x.id,notificationAudience:'EMPLOYEE',notificationType:'ISSUE'});}
  for(const x of checklistRows.map(checklist)){const personRecord=staffMatch(staff,x.person,x.staffId);const person=personRecord?.name||x.person;const department=x.department||personRecord?.department||'';if(!approvalScope&&x.date===currentDay&&num(x.fail)>0&&matchesDepartment(department)&&matchesPerson(person))alerts.push({kind:'BẢNG KIỂM CẦN XỬ LÝ',level:'HÔM NAY',date:x.date,title:(x.formName||'Phiếu giám sát')+': '+(person||'Chưa có nhân viên'),instruction:'Mở bảng kiểm, xem chi tiết tiêu chí Không đạt/Kém và cập nhật biện pháp khắc phục.',person,personId:personRecord?.id||x.staffId||'',department,target:'checklists',row_no:x.row_no,id:x.id,notificationAudience:'EMPLOYEE',notificationType:'CHECKLIST'});}
 for(const alert of alerts){
   if(alert.target!=='tasks'){if(alert.notificationAudience==='EMPLOYEE'){alert.notificationTitle=alert.title;alert.message=alert.instruction||'Mở chi tiết để xem và cập nhật.';}continue;}
  if(alert.kind==='CÔNG VIỆC MỚI GIAO'){
   alert.notificationTitle=`CÔNG VIỆC MỚI GIAO: ${alert.title}`;alert.title=alert.notificationTitle;alert.message='Bạn có công việc mới. Mở chi tiết để xem yêu cầu, thời hạn và cập nhật trạng thái.';alert.notificationAudience='EMPLOYEE';alert.notificationType='NEW_TASK';
  }else if(alert.kind==='PHÊ DUYỆT'){
   alert.notificationTitle=`XIN PHÊ DUYỆT: ${alert.title.replace(/^Xin phê duyệt:\s*/i,'')}`;alert.title=alert.notificationTitle;alert.message=`${alert.person||'Nhân viên'} đã gửi nội dung xin phê duyệt cho ${alert.managerName||'quản lý'}.`;alert.notificationAudience='MANAGER';alert.notificationType='APPROVAL_REQUEST';
  }else if(alert.kind==='PHẢN HỒI'){
   alert.notificationTitle=`PHẢN HỒI PHÊ DUYỆT: ${alert.title.replace(/^Phản hồi quản lý:\s*/i,'')}`;alert.title=alert.notificationTitle;alert.message=`${alert.managerName||'Quản lý'} đã phản hồi công việc. ${alert.approvalResponse||'Mở chi tiết để xem kết quả phê duyệt và ý kiến quản lý.'}`;alert.notificationAudience='EMPLOYEE';alert.notificationType='MANAGER_RESPONSE';
  }else if(alert.kind==='Ý KIẾN QUẢN LÝ'){
   alert.notificationTitle=`PHẢN HỒI QUẢN LÝ: ${alert.title.replace(/^Ý kiến quản lý mới:\s*/i,'')}`;alert.title=alert.notificationTitle;alert.message=`${alert.managerName||'Quản lý'} đã gửi ý kiến: ${alert.managerOpinion||'Mở chi tiết để xem.'}`;alert.notificationAudience='EMPLOYEE';alert.notificationType='MANAGER_OPINION';
  }
 }
 const merged=await mergeAlertStates(alerts);
 const managerStaff=managerDirectory(staff);const managers=managerStaff.map(x=>text(x.name)).filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));const alertLevels=[...new Set(merged.alerts.map(alert=>text(alert.level)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));const visibleAlerts=merged.alerts.filter(alert=>matchesAlertLevel(alert.level)&&(!alert.persistent||(!f.department||same(alert.department,f.department))&&matchesPerson(alert.person)&&(!f.manager||same(alert.managerName,f.manager))&&(!f.approvalStatus||same(alert.approvalStatus,f.approvalStatus)))&&(!f.readStatus||f.readStatus==='all'||(f.readStatus==='unread'&&!alert.isRead)||(f.readStatus==='read'&&alert.isRead))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 return {rows:visibleAlerts,total:visibleAlerts.length,departments,staff,managerStaff,alertStateAvailable:merged.available,options:{approvalStatuses:TASK_APPROVAL_STATUSES,managers,alertLevels,readStatuses:['unread','read','all']}};
}

function canonical(moduleName:string,body:AnyRecord){const data=body.data&&typeof body.data==='object'&&!Array.isArray(body.data)?body.data:{};
 if(moduleName==='staff'){
  const history=parseLeaveHistory(data['Lịch sử nghỉ phép']??data.leaveHistory??body['Lịch sử nghỉ phép']??body.leaveHistory);
  const rawEntitlement=body.annualLeaveEntitlement??pick(data,['Số ngày phép năm','Phép năm','Ngày phép năm']);
  const hasEntitlement=text(rawEntitlement)!=='';
  const annualLeaveEntitlement=hasEntitlement?Math.max(0,num(rawEntitlement)):0;
 if(body.__leaveAction==='delete'){
   const leaveId=text(body.leaveId||body.__leaveId);const index=history.findIndex(item=>leaveId&&text(item.id||item.leaveId)===leaveId);if(index<0)throw new Error('Không tìm thấy lần nghỉ phép cần xóa.');history.splice(index,1);
  }else if(body.__leaveAction==='edit'){
   const leaveId=text(body.leaveId||body.__leaveId);const index=history.findIndex(item=>leaveId&&text(item.id||item.leaveId)===leaveId);if(index<0)throw new Error('Không tìm thấy lần nghỉ phép cần sửa.');const leaveDateFrom=ymd(body.leaveDateFrom);const leaveDateTo=ymd(body.leaveDateTo)||leaveDateFrom;const leaveDays=Number(body.leaveDays);if(!leaveDateFrom)throw new Error('Vui lòng nhập ngày bắt đầu nghỉ phép.');if(leaveDateTo<leaveDateFrom)throw new Error('Đến ngày nghỉ phép không được trước từ ngày.');if(!Number.isFinite(leaveDays)||leaveDays<=0)throw new Error('Số ngày nghỉ phép phải lớn hơn 0.');if(!annualLeaveEntitlement)throw new Error('Vui lòng nhập Số ngày phép năm trước khi sửa nghỉ phép.');const oldDays=leaveDaysOf(history[index]);const taken=history.reduce((sum,item)=>sum+leaveDaysOf(item),0)-oldDays;if(taken+leaveDays>annualLeaveEntitlement)throw new Error(`Số ngày nghỉ vượt quỹ phép năm còn lại (${Math.max(annualLeaveEntitlement-taken,0)} ngày).`);history[index]={...history[index],id:leaveId||history[index].id,fromDate:leaveDateFrom,toDate:leaveDateTo,days:leaveDays,note:text(body.leaveNote),updatedAt:new Date().toISOString()};
  }else if(body.__leaveEntry){
   const leaveDateFrom=ymd(body.leaveDateFrom);const leaveDateTo=ymd(body.leaveDateTo)||leaveDateFrom;const leaveDays=Number(body.leaveDays);
   if(!leaveDateFrom)throw new Error('Vui lòng nhập ngày bắt đầu nghỉ phép.');
   if(leaveDateTo<leaveDateFrom)throw new Error('Đến ngày nghỉ phép không được trước từ ngày.');
   if(!Number.isFinite(leaveDays)||leaveDays<=0)throw new Error('Số ngày nghỉ phép phải lớn hơn 0.');
   if(!annualLeaveEntitlement)throw new Error('Vui lòng nhập Số ngày phép năm trước khi ghi nhận nghỉ phép.');
   const taken=history.reduce((sum,item)=>sum+leaveDaysOf(item),0);if(taken+leaveDays>annualLeaveEntitlement)throw new Error(`Số ngày nghỉ vượt quỹ phép năm còn lại (${Math.max(annualLeaveEntitlement-taken,0)} ngày).`);
   history.push({id:`NP${Date.now()}`,fromDate:leaveDateFrom,toDate:leaveDateTo,days:leaveDays,note:text(body.leaveNote),recordedAt:new Date().toISOString()});
  }
  const leaveTaken=history.reduce((sum,item)=>sum+leaveDaysOf(item),0);const leaveRemaining=Math.max(annualLeaveEntitlement-leaveTaken,0);
  const leaveOnly=Boolean(body.__leaveEntry||body.__leaveAction);const rawPosition=body.position??data['Chức vụ'];const normalizedPosition=staffPosition(rawPosition);if(!normalizedPosition&&!leaveOnly)throw new Error('Hãy chọn Chức vụ hợp lệ từ danh mục.');
  const normalizedStatus=staffEmploymentStatus(body.status??data['Trạng thái']);if(!normalizedStatus)throw new Error('Chọn Trạng thái: Đang làm việc hoặc Đã nghỉ việc.');
  return {'Mã NV':body.id??data['Mã NV']??'','Họ và tên':body.name??data['Họ và tên']??'','Bộ phận':body.department??data['Bộ phận']??'','Chức vụ':normalizedPosition||rawPosition||'','Lưu ý quản lý':body.managerNote??data['Lưu ý quản lý']??data['Ghi chú quản lý']??data['Lưu ý']??'','Số điện thoại':body.phone??data['Số điện thoại']??'','Ngày ký hợp đồng':body.contractStartDate??data['Ngày ký hợp đồng']??data['Ngày bắt đầu hợp đồng']??'','Ngày hết hạn hợp đồng':body.contractEndDate??data['Ngày hết hạn hợp đồng']??data['Ngày kết thúc hợp đồng']??'','Số ngày phép năm':hasEntitlement?annualLeaveEntitlement:(data['Số ngày phép năm']??''),'Số ngày đã nghỉ phép':leaveTaken,'Số ngày phép còn lại':leaveRemaining,'Lịch sử nghỉ phép':JSON.stringify(history),'Trạng thái':normalizedStatus};
 }
 if(moduleName==='tasks')return {'ID':text(body.taskId??data.ID??'')||`CV${Date.now()}`,'Người thực hiện':body.assignee??data['Người thực hiện']??'','Bộ phận':body.department??data['Bộ phận']??data['Thuộc bộ phận']??'','Thuộc bộ phận':body.department??data['Thuộc bộ phận']??data['Bộ phận']??'','Người giao việc':body.assigner??data['Người giao việc']??data['Người giao']??data['Người tạo']??'','Mức độ ưu tiên':body.priority??data['Mức độ ưu tiên']??'TRUNG BÌNH','Loại công việc':body.workType??body.taskType??body.workCategory??data['Loại công việc']??data['Phân loại công việc']??data['Nhóm công việc']??data.workType??data.taskType??'','Tiêu đề công việc':body.title??data['Tiêu đề công việc']??'','Nội dung / Mô tả':body.description??data['Nội dung / Mô tả']??'','Dự phòng':body.backup??data['Dự phòng']??data['Phương án dự phòng']??'','Ngày bắt đầu':body.startDate??data['Ngày bắt đầu']??'','Ngày kết thúc':body.endDate??data['Ngày kết thúc']??'','Trạng thái NV':body.status??data['Trạng thái NV']??'CHƯA BẮT ĐẦU','Ghi chú NV':body.note??data['Ghi chú NV']??'','Ảnh minh chứng':body.imageName??data['Ảnh minh chứng']??'','Tài liệu minh chứng':body.documentName??data['Tài liệu minh chứng']??data['Tài liệu đính kèm']??'','Đánh giá quản lý':body.evalStatus??data['Đánh giá quản lý']??data['Đánh giá quản lý hiện tại']??'CHƯA BẮT ĐẦU','Đánh giá quản lý hiện tại':body.evalStatus??data['Đánh giá quản lý hiện tại']??data['Đánh giá quản lý']??'CHƯA BẮT ĐẦU','Ghi chú quản lý':body.qlNote??data['Ghi chú quản lý']??'','Ý kiến quản lý':body.managerOpinion??data['Ý kiến quản lý']??data['Ý kiến của quản lý']??'','Mã người quản lý':body.managerId??data['Mã người quản lý']??data['Mã quản lý phê duyệt']??'','Người quản lý phê duyệt':body.managerName??data['Người quản lý phê duyệt']??data['Quản lý phê duyệt']??'','Trạng thái phê duyệt':body.approvalStatus??data['Trạng thái phê duyệt']??data['Trạng thái xin ý kiến']??'CHƯA XIN Ý KIẾN','Nội dung xin ý kiến quản lý':body.approvalRequest??data['Nội dung xin ý kiến quản lý']??data['Nội dung xin phê duyệt']??data['Yêu cầu phê duyệt']??'','Nội dung xin phê duyệt':body.approvalRequest??data['Nội dung xin phê duyệt']??data['Nội dung xin ý kiến quản lý']??'','Thời gian xin ý kiến':body.approvalRequestedAt??data['Thời gian xin ý kiến']??data['Thời gian xin phê duyệt']??'','Phản hồi quản lý':body.approvalResponse??data['Phản hồi quản lý']??'','Ngày phê duyệt':body.approvalReviewedAt??data['Ngày phê duyệt']??'','Phản hồi nhân viên':body.employeeFeedback??data['Phản hồi nhân viên']??'','Trạng thái phản hồi nhân viên':body.employeeFeedbackStatus??data['Trạng thái phản hồi nhân viên']??'','Thời gian phản hồi nhân viên':body.employeeFeedbackAt??data['Thời gian phản hồi nhân viên']??''};
 if(moduleName==='reminders')return {'MÃ NHẮC VIỆC':text(body.reminderId??body.id??data['MÃ NHẮC VIỆC']??'')||'NV'+Date.now(),'NGÀY NHẮC':body.date??body.reminderDate??data['NGÀY NHẮC']??'','TIÊU ĐỀ NHẮC VIỆC':body.title??data['TIÊU ĐỀ NHẮC VIỆC']??'','NỘI DUNG / GHI CHÚ':body.note??data['NỘI DUNG / GHI CHÚ']??'','NGƯỜI LIÊN QUAN':body.person??data['NGƯỜI LIÊN QUAN']??'','TRẠNG THÁI':body.status??data['TRẠNG THÁI']??'CHƯA THỰC HIỆN','NHẮC HÀNG NGÀY':body.daily??body.remindDaily??data['NHẮC HÀNG NGÀY']??data['Nhắc hàng ngày']??false,'Ảnh minh chứng':body.imageName??data['Ảnh minh chứng']??data['Hình ảnh']??'','Tài liệu minh chứng':body.documentName??data['Tài liệu minh chứng']??data['Tài liệu đính kèm']??''};
 if(moduleName==='violations')return {'Mã VP':text(body.id??data['Mã VP']??'')||`VP${Date.now()}`,'Ngày vi phạm':body.date??data['Ngày vi phạm']??'','Mã NV':body.staffId??data['Mã NV']??'','Họ tên':body.person??data['Họ tên']??'','Bộ phận':body.department??data['Bộ phận']??'','Mã lỗi':body.errorId??data['Mã lỗi']??'','Tên lỗi':body.errorName??data['Tên lỗi']??'','Mức độ':body.level??data['Mức độ']??'','Điểm trừ':body.score??data['Điểm trừ']??0,'Người ghi nhận':body.recorder??data['Người ghi nhận']??'','Ghi chú':body.note??data['Ghi chú']??'','Trạng thái':body.status??data['Trạng thái']??'Chưa xử lý','Hình ảnh':body.imageName??data['Hình ảnh']??data['Ảnh minh chứng']??'','Tài liệu minh chứng':body.documentName??data['Tài liệu minh chứng']??data['Tài liệu đính kèm']??''};
 if(moduleName==='violationError')return {'Mã lỗi':text(body.id??data['Mã lỗi']??'')||`L${Date.now()}`,'Tên lỗi':body.name??data['Tên lỗi']??'','Bộ phận':body.department??data['Bộ phận']??'','Mức độ':body.level??data['Mức độ']??'Nhắc nhở','Điểm trừ':body.score??data['Điểm trừ']??0,'Ghi chú':body.note??data['Ghi chú']??'','Trạng thái':body.status??data['Trạng thái']??'Hoạt động'};
 if(moduleName==='plans')return {'Mã KH':text(body.id??data['Mã KH']??'')||`KH${Date.now()}`,'Từ ngày':body.fromDate??data['Từ ngày']??'','Đến ngày':body.toDate??data['Đến ngày']??'','Bộ phận':body.department??data['Bộ phận']??'','Nội dung':body.content??data['Nội dung']??'','Người phụ trách':body.owner??data['Người phụ trách']??'','Trạng thái':body.status??data['Trạng thái']??'CHƯA BẮT ĐẦU','Kết quả':body.result??data['Kết quả']??'','Ghi chú':body.note??data['Ghi chú']??'','Ngày hoàn thành':body.completedAt??data['Ngày hoàn thành']??'','Nội dung / Mô tả':body.description??data['Nội dung / Mô tả']??data['Mô tả']??'','Ảnh minh chứng':body.imageName??data['Ảnh minh chứng']??data['Hình ảnh']??'','Tài liệu minh chứng':body.documentName??data['Tài liệu minh chứng']??data['Tài liệu đính kèm']??''};
 if(moduleName==='issues')return {'Mã TT':text(body.id??data['Mã TT']??'')||`TT${Date.now()}`,'Ngày ghi nhận':body.date??data['Ngày ghi nhận']??'','Bộ phận':body.department??data['Bộ phận']??'','Tồn tại / Sự cố / Kiến nghị':body.issue??data['Tồn tại / Sự cố / Kiến nghị']??'','Nguyên nhân':body.cause??data['Nguyên nhân']??'','Phương án khắc phục':body.action??data['Phương án khắc phục']??'','Người phụ trách':body.owner??data['Người phụ trách']??'','Hạn xử lý':body.deadline??data['Hạn xử lý']??'','Trạng thái':body.status??data['Trạng thái']??'CHƯA KHẮC PHỤC','Kiến nghị':body.recommendation??data['Kiến nghị']??'','Ghi chú':body.note??data['Ghi chú']??'','Loại nội dung':body.kind??data['Loại nội dung']??''};
 if(moduleName==='reports')return {'Mã ý kiến':text(body.opinionId??data['Mã ý kiến']??'')||`YK${Date.now()}`,'Từ ngày':body.fromDate??body.from??data['Từ ngày']??'','Đến ngày':body.toDate??body.to??data['Đến ngày']??'','Bộ phận':body.department??data['Bộ phận']??'','Nhân viên':body.person??data['Nhân viên']??'','Mã phiếu':body.formCode??body.reportId??data['Mã phiếu']??'','Tên phiếu':body.formName??data['Tên phiếu']??'','Ý kiến khắc phục của tổ trưởng':body.opinion??data['Ý kiến khắc phục của tổ trưởng']??'','Người nhập':body.enteredBy??data['Người nhập']??'','Trạng thái':body.status??data['Trạng thái']??'Đã lưu'};
 if(moduleName==='feedback')return {'Mã ý kiến':text(body.id??data['Mã ý kiến']??'')||`YK-KPI-${Date.now()}`,'Từ ngày':body.from??data['Từ ngày']??'','Đến ngày':body.to??data['Đến ngày']??'','Bộ phận':body.department??data['Bộ phận']??'','Nhân viên':body.person??data['Nhân viên']??'','Nội dung góp ý':body.text??data['Nội dung góp ý']??'','Người nhập':body.author??data['Người nhập']??'','Cập nhật lúc':new Date().toISOString()};
 if(moduleName==='rule')return {'STT':body.order??data['STT']??1,'Xếp loại':body.ranking??data['Xếp loại']??'','Từ điểm':body.min??data['Từ điểm']??0,'Đến điểm':body.max??data['Đến điểm']??0,'Màu':body.color??data['Màu']??'#6C757D','Trạng thái':body.status??data['Trạng thái']??'Hoạt động','Cập nhật lúc':new Date().toISOString()};
 if(moduleName==='checklistForm')return {'Mã phiếu':body.code??data['Mã phiếu']??'','Tên phiếu':body.name??data['Tên phiếu']??'','Bộ phận':body.department??data['Bộ phận']??'','Mô tả':body.description??data['Mô tả']??'','Trạng thái':body.status??data['Trạng thái']??'Hoạt động'};
 if(moduleName==='checklistCriterion')return {'Mã tiêu chí':text(body.id??data['Mã tiêu chí']??'')||`BK${Date.now()}`,'Mã phiếu':body.formCode??data['Mã phiếu']??'','Bộ phận':body.department??data['Bộ phận']??'','Nhóm tiêu chí':body.group??data['Nhóm tiêu chí']??'Chung','Nội dung tiêu chí':body.content??data['Nội dung tiêu chí']??'','Nội dung chi tiết':body.detail??data['Nội dung chi tiết']??body.content??'','STT':body.order??data.STT??'','Cho phép hình ảnh':body.allowImage??data['Cho phép hình ảnh']??'Có','Trạng thái':body.status??data['Trạng thái']??'Hoạt động'};
 if(moduleName==='checklistConfig'){const bands=Array.isArray(body.kpiBands)?body.kpiBands as AnyRecord[]:[];return {'Mã phiếu':body.formCode??data['Mã phiếu']??'', 'Ngưỡng A (%)':body.thresholdA??data['Ngưỡng A (%)']??95,'Ngưỡng B (%)':body.thresholdB??data['Ngưỡng B (%)']??90,'Ngưỡng C (%)':body.thresholdC??data['Ngưỡng C (%)']??80,'Tên mức A':body.labelA??data['Tên mức A']??'A','Tên mức B':body.labelB??data['Tên mức B']??'B','Tên mức C':body.labelC??data['Tên mức C']??'C','Tên dưới C':body.labelBelow??data['Tên dưới C']??'CHƯA ĐẠT','Dùng KPI riêng':body.useCustomKpi===true||['co','có','true','1','yes'].includes(norm(body.useCustomKpi))?'Có':data['Dùng KPI riêng']??'Không','KPI mức 1 từ %':body.kpiBands?.[0]?.from??data['KPI mức 1 từ %']??98,'KPI mức 1 điểm':body.kpiBands?.[0]?.points??data['KPI mức 1 điểm']??5,'KPI mức 2 từ %':body.kpiBands?.[1]?.from??data['KPI mức 2 từ %']??95,'KPI mức 2 điểm':body.kpiBands?.[1]?.points??data['KPI mức 2 điểm']??3,'KPI mức 3 từ %':body.kpiBands?.[2]?.from??data['KPI mức 3 từ %']??90,'KPI mức 3 điểm':body.kpiBands?.[2]?.points??data['KPI mức 3 điểm']??0,'KPI mức 4 từ %':body.kpiBands?.[3]?.from??data['KPI mức 4 từ %']??85,'KPI mức 4 điểm':body.kpiBands?.[3]?.points??data['KPI mức 4 điểm']??-2,'KPI mức 5 từ %':body.kpiBands?.[4]?.from??data['KPI mức 5 từ %']??80,'KPI mức 5 điểm':body.kpiBands?.[4]?.points??data['KPI mức 5 điểm']??-4,'KPI dưới mức 5':body.kpiBelow??data['KPI dưới mức 5']??-5,'Trạng thái':body.status??data['Trạng thái']??'Hoạt động'};}
 if(moduleName==='kpi')return {'Thời gian lưu':body.date??new Date().toISOString(),'Ngày lưu bảng KPI':body.savedAt??body.date??new Date().toISOString(),'Mã kỳ KPI':body.snapshotId??'','Từ ngày':body.fromDate??'','Đến ngày':body.toDate??'','Mã NV':body.staffId??'','Họ tên':body.person??body.name??'','Bộ phận':body.department??'','Chức vụ':body.position??'','Điểm gốc':body.base??100,'Điểm giao việc':body.taskScore??0,'Điểm bảng kiểm':body.checklistScore??0,'Điểm vi phạm':body.violationScore??0,'Tổng điểm':body.total??0,'Xếp loại':body.ranking??body.rank??'','Chi tiết':Array.isArray(body.details)?body.details.join(' | '):body.detail??''};
 return data;}
function sheetFor(moduleName:string,body:AnyRecord){return ({staff:S.staff,tasks:S.tasks,reminders:S.reminders,violations:S.violations,violationError:S.errors,issues:S.issues,reports:S.opinions,kpi:S.kpi,feedback:S.kpiFeedback,rule:S.kpiRules,checklistForm:S.checklistForms,checklistCriterion:S.checklistCriteria,checklistConfig:S.checklistConfig}[moduleName]||(moduleName==='plans'?(text(body.type).toUpperCase()==='THÁNG'?S.monthly:S.weekly):''));}
function findById(rows:LegacyRow[],id:string){return rows.find(r=>same(r.legacy_id,id)||same(pick(r.data,['ID','Mã công việc','Mã VP','Mã phiếu','Mã KH','Mã TT','MÃ NHẮC VIỆC','Mã NV']),id));}
function nextDate(value:string,days:number){const d=new Date(`${value}T00:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function carryDates(from:string,to:string,type:string){if(type==='THÁNG'){const d=new Date(`${from||to}T00:00:00`);const first=new Date(d.getFullYear(),d.getMonth()+1,1);const last=new Date(d.getFullYear(),d.getMonth()+2,0);return {from:first.toISOString().slice(0,10),to:last.toISOString().slice(0,10)};}return {from:nextDate(from||to,7),to:nextDate(to||from,7)};}
function resolveTaskStaffName(staff:AnyRecord[],value:unknown,label:string,existing?:unknown){const input=text(value);if(!input)throw new Error(`${label} không được để trống. Vui lòng chọn từ danh sách nhân sự.`);const matched=staff.find(x=>same(x.name,input));if(matched)return text(matched.name);if(existing&&same(existing,input))return text(existing);throw new Error(`${label} phải được chọn từ danh sách nhân sự.`);}

async function saveChecklistParity(raw:AnyRecord){
 const details=Array.isArray(raw.details)?raw.details as AnyRecord[]:[];
 if(!details.length)throw new Error('Chưa có tiêu chí bảng kiểm.');
 const formCode=text(raw.formCode),formName=text(raw.formName);
 if(!formCode||!formName)throw new Error('Phải chọn phiếu giám sát.');
 let applied=0,pass=0,fail=0,na=0;
 for(const [index,item] of details.entries()){
  const result=norm(item.result);
  if(!result)throw new Error(`Chưa chọn kết quả tại tiêu chí số ${index+1}.`);
  if(result==='n/a'||result==='na'||result==='khong ap dung'){na++;continue;}
  if(result!=='dat'&&result!=='khong dat'&&result!=='kem')throw new Error(`Kết quả không hợp lệ tại tiêu chí số ${index+1}.`);
  applied++;
  if(result==='dat')pass++;
  else{fail++;if(!text(item.note))throw new Error(`Tiêu chí không đạt số ${index+1} cần nhập ghi chú lỗi.`);}
 }
 const rate=applied?Math.round(pass*10000/applied)/100:0;
 const configs=(await readSheet(S.checklistConfig)).map(checklistConfig).filter(Boolean) as AnyRecord[];
 const config=checklistConfigFor(configs,formCode);
 const percentRank=checklistRank(rate,config);
 const kpi=checklistKpi(rate,config);
 const user=await actor();if(!user)throw Error('Chưa đăng nhập.');
 const header={'Ngày giám sát':raw.date||today(),'Mã NV':raw.staffId||'','Họ tên':raw.staffName||'',
  'Bộ phận':raw.department||'','Người giám sát':raw.supervisor||'','Khu vực':raw.area||'','Ca':raw.shift||'',
  'Tổng áp dụng':applied,'Đạt':pass,'Không đạt':fail,'Không áp dụng':na,'Tỷ lệ %':rate,'Điểm KPI':kpi,
  'Tỷ lệ % chấm':rate,'Xếp loại theo phiếu':percentRank,'KPI bảng kiểm áp dụng':kpi,
  'Ghi chú':raw.note||'',...(raw.imageName?{'Ảnh minh chứng':raw.imageName}:{}),...(raw.documentName?{'Tài liệu minh chứng':raw.documentName}:{}),
  'Thời gian lưu':new Date().toISOString(),'Mã mẫu phiếu':formCode,'Tên phiếu':formName};
 const marks=details.map(item=>({row_no:item.row_no,'Mã tiêu chí':item.criterionCode||item.id||'','Nhóm tiêu chí':item.group||'',
   'Nội dung tiêu chí':item.content||'','Kết quả':item.result||'','Ghi chú':item.note||'',
   'STT':item.order||'','Nội dung chi tiết':item.detail||'',...(item.errorImage?{'Hình ảnh lỗi':item.errorImage}:{}),
   ...(item.fixImage?{'Hình ảnh khắc phục':item.fixImage}:{})}));
 const result=await db().rpc('nk_save_checklist',{who:user.id,rid:raw.requestId||crypto.randomUUID(),header,marks,existing_row:Number(raw.row_no)||0,expected_header:raw.row_no?raw.data:null});
 if(result.error){if(result.error.code==='PGRST202'&&!raw.row_no&&(user.admin||user.legacy_operator))return saveChecklist(raw);throw Error(result.error.code==='PGRST202'?'Cần cài migration phiên bản phiếu giám sát.':result.error.message);}
 return {...result.data,formCode,formName,applied,pass,fail,na,rate,percentRate:rate,percentRank,kpi,percentKpi:kpi};
}

async function saveChecklist(raw:AnyRecord){
 const details=Array.isArray(raw.details)?raw.details as AnyRecord[]:[];if(!details.length)throw new Error('Chưa có tiêu chí bảng kiểm.');const formCode=text(raw.formCode);const formName=text(raw.formName);if(!formCode||!formName)throw new Error('Phải chọn phiếu giám sát.');let applied=0,pass=0,fail=0,na=0;
 for(const [index,x] of details.entries()){const result=norm(x.result);if(!result)throw new Error(`Chưa chọn kết quả tại tiêu chí số ${index+1}.`);if(result==='na'||result==='n/a'||result==='khong ap dung'){na++;continue;}if(result!=='dat'&&result!=='khong dat'&&result!=='kem')throw new Error(`Kết quả không hợp lệ tại tiêu chí số ${index+1}.`);applied++;if(result==='dat')pass++;else{fail++;if(!text(x.note))throw new Error(`Tiêu chí không đạt số ${index+1} cần nhập ghi chú lỗi.`);}}
 const rate=applied?Math.round(pass*10000/applied)/100:0;const config=checklistConfigFor((await readSheet(S.checklistConfig)).map(checklistConfig).filter(Boolean) as AnyRecord[],formCode);const kpi=checklistKpi(rate,config);const id=`PGS${Date.now()}${Math.floor(Math.random()*1000)}`;const rowNo=await saveRow(S.checklists,undefined,{'Mã phiếu':id,'Ngày giám sát':raw.date||today(),'Mã NV':raw.staffId||'','Họ tên':raw.staffName||'','Bộ phận':raw.department||'','Người giám sát':raw.supervisor||'','Khu vực':raw.area||'','Ca':raw.shift||'','Tổng áp dụng':applied,'Đạt':pass,'Không đạt':fail,'Tỷ lệ %':rate,'Điểm KPI':kpi,'Ghi chú':raw.note||'','Ảnh minh chứng':raw.imageName||'','Tài liệu minh chứng':raw.documentName||'','Thời gian lưu':new Date().toISOString(),'Mã mẫu phiếu':formCode,'Tên phiếu':formName,'Không áp dụng':na,'Tỷ lệ % chấm':rate,'Xếp loại theo phiếu':checklistRank(rate,config),'KPI bảng kiểm áp dụng':kpi});let detailNo=await nextRowNo(S.checklistDetails);for(const x of details){await saveRow(S.checklistDetails,detailNo++,{'Mã phiếu':id,'Mã tiêu chí':x.criterionCode||x.id||'','Nhóm tiêu chí':x.group||'','Nội dung tiêu chí':x.content||'','Kết quả':x.result||'','Ghi chú':x.note||'','STT':x.order||'','Nội dung chi tiết':x.detail||'','Hình ảnh lỗi':x.errorImage||'','Hình ảnh khắc phục':x.fixImage||''});}return {id,row_no:rowNo,rate,kpi,pass,fail,na};
}
async function saveTaskApproval(body:AnyRecord){
 const row=await readRow(S.tasks,Number(body.row_no));if(!row)throw new Error('Không tìm thấy công việc cần phê duyệt.');
 const staff=getStaff(await readSheet(S.staff));const managers=managerDirectory(staff);const current=task(row,staffMap(staff),staff);const action=text(body.action)||'request';const data={...row.data};const now=new Date().toISOString();
 if(action==='request'){
  const manager=managers.find(x=>same(x.name,body.managerName)||same(x.id,body.managerId));if(!manager)throw new Error('Vui lòng chọn người có Chức vụ quản lý từ danh sách nhân sự.');
  if(!text(body.approvalRequest))throw new Error('Vui lòng nhập nội dung xin phê duyệt.');
  data['Mã người quản lý']=manager.id||'';data['Người quản lý phê duyệt']=manager.name;data['Trạng thái phê duyệt']='CHỜ PHÊ DUYỆT';data['Nội dung xin ý kiến quản lý']=text(body.approvalRequest);data['Nội dung xin phê duyệt']=text(body.approvalRequest);data['Thời gian xin ý kiến']=now;data['Thời gian xin phê duyệt']=now;data['Phản hồi quản lý']='';data['Ngày phê duyệt']='';data['Phản hồi nhân viên']='';data['Trạng thái phản hồi nhân viên']='';data['Thời gian phản hồi nhân viên']='';
  appendApprovalHistory(data,{action:'REQUEST_APPROVAL',status:'CHỜ PHÊ DUYỆT',managerName:manager.name,managerId:manager.id||'',request:text(body.approvalRequest),at:now});
 }else if(action==='review'){
  const reviewer=await actor();if(!reviewer)throw Error('Chưa đăng nhập.');
  if((await featureScope(reviewer,'tasks','approve'))==='none')throw Error('Quyền phê duyệt đã bị thu hồi trong ma trận.');
  if(!same(current.approvalStatus,'CHỜ PHÊ DUYỆT'))throw Error('Tác vụ chưa ở trạng thái chờ phê duyệt.');
  if(!reviewer.admin){const grant=await db().from('cx_people').select('can_approve_work').eq('id',reviewer.id).maybeSingle();
   if(!grant.data?.can_approve_work||(!current.managerId||current.managerId!==reviewer.staff_code))throw Error('Chỉ người được chỉ định và có quyền phê duyệt mới được duyệt.');
  }
  const manager=managers.find(x=>same(x.name,body.managerName)||same(x.id,body.managerId));const existingManager=managers.find(x=>same(x.name,current.managerName)||same(x.id,current.managerId));if(!manager&&!existingManager)throw new Error('Vui lòng chọn người có Chức vụ quản lý từ danh sách nhân sự.');
  const selectedManager=existingManager||manager;const managerName=selectedManager?.name||current.managerName;const status=text(body.approvalStatus);const evaluation=text(body.evalStatus||current.evalStatus);const response=text(body.approvalResponse);if(!['ĐÃ PHÊ DUYỆT','YÊU CẦU BỔ SUNG','TỪ CHỐI'].includes(status))throw new Error('Trạng thái phê duyệt không hợp lệ.');if(!TASK_EVAL_STATUSES.includes(evaluation))throw new Error('Vui lòng chọn Đánh giá quản lý hiện tại.');if((status==='YÊU CẦU BỔ SUNG'||status==='TỪ CHỐI')&&!response)throw new Error('Vui lòng nhập ý kiến hoặc lý do xử lý.');
  data['Mã người quản lý']=selectedManager?.id||current.managerId||'';data['Người quản lý phê duyệt']=managerName;data['Trạng thái phê duyệt']=status;data['Đánh giá quản lý']=evaluation;data['Đánh giá quản lý hiện tại']=evaluation;data['Người đánh giá hiện tại']=managerName;data['Thời gian đánh giá hiện tại']=now;data['Phản hồi quản lý']=response;data['Ý kiến quản lý']=response;data['Ghi chú quản lý']=response;data['Ngày phê duyệt']=now;data['Trạng thái phản hồi nhân viên']='CHỜ NHÂN VIÊN PHẢN HỒI';data['Phản hồi nhân viên']='';data['Thời gian phản hồi nhân viên']='';
  appendApprovalHistory(data,{action:status==='ĐÃ PHÊ DUYỆT'?'APPROVE':status==='YÊU CẦU BỔ SUNG'?'REQUEST_SUPPLEMENT':'REJECT',status,managerName,managerId:selectedManager?.id||current.managerId||'',evaluation,opinion:response,at:now});
 }else if(action==='feedback'){
  if(!text(body.employeeFeedback))throw new Error('Vui lòng nhập phản hồi của nhân viên.');
  data['Phản hồi nhân viên']=text(body.employeeFeedback);data['Trạng thái phản hồi nhân viên']='ĐÃ PHẢN HỒI';data['Thời gian phản hồi nhân viên']=now;appendApprovalHistory(data,{action:'EMPLOYEE_FEEDBACK',status:'ĐÃ PHẢN HỒI',managerName:current.managerName||'',feedback:text(body.employeeFeedback),at:now});
 }else throw new Error('Thao tác phê duyệt không hợp lệ.');
 const rowNo=await saveRow(S.tasks,row.row_no,data);let notificationStored=false;
 if(action==='feedback'){
  const feedbackAt=text(data['Thời gian phản hồi nhân viên'])||now;
  const feedbackAlert={alertKey:`tasks:${row.row_no}:EMPLOYEE_FEEDBACK:${feedbackAt}`,recipientKey:`manager:${text(current.managerId||current.managerName||'ALL').toLowerCase()}`,target:'tasks',kind:'NHÂN VIÊN ĐÃ PHẢN HỒI',level:'PHẢN HỒI MỚI',date:feedbackAt,title:`Nhân viên đã phản hồi: ${current.title||'Công việc'}`,notificationTitle:`NHÂN VIÊN ĐÃ PHẢN HỒI: ${current.title||'Công việc'}`,message:`${current.assignee||'Nhân viên'} đã gửi phản hồi cho công việc này.`,instruction:'Mở chi tiết giao việc để đọc phản hồi và cập nhật bước xử lý tiếp theo.',person:current.assignee,personId:current.assigneeId,department:current.department,managerName:current.managerName,managerId:current.managerId,approvalStatus:pick(data,['Trạng thái phê duyệt']),employeeFeedback:text(data['Phản hồi nhân viên']),notificationAudience:'MANAGER',notificationType:'EMPLOYEE_FEEDBACK',persistent:true,row_no:row.row_no,id:current.id};
  try{notificationStored=await savePersistentAlert(feedbackAlert);}catch(error){console.warn('[alerts:feedback-notification]',error instanceof Error?error.message:error);}
 }
 return {row_no:rowNo,id:current.id,action,approvalStatus:pick(data,['Trạng thái phê duyệt']),evaluation:pick(data,['Đánh giá quản lý']),employeeFeedbackStatus:pick(data,['Trạng thái phản hồi nhân viên']),approvalHistory:parseApprovalHistory(data['Lịch sử phê duyệt']),notificationStored};
}
async function inlineUpdate(body:AnyRecord){const kind=text(body.kind).toUpperCase();if(kind==='OPINION'){const rows=await readSheet(S.opinions);const found=Number(body.row_no)?rows.find(x=>x.row_no===Number(body.row_no)):rows.find(x=>same(pick(x.data,['Từ ngày']),body.fromDate)&&same(pick(x.data,['Đến ngày']),body.toDate)&&same(pick(x.data,['Bộ phận']),body.department)&&same(pick(x.data,['Mã phiếu']),body.formCode));const data=canonical('reports',{...body,data:found?.data||{}});const rowNo=await saveRow(S.opinions,found?.row_no,data);return {row_no:rowNo,kind};}const sheet=kind==='TASK'?S.tasks:kind==='PLAN'?(text(body.planType).toUpperCase()==='THÁNG'?S.monthly:S.weekly):kind==='VIOLATION'?S.violations:kind==='ISSUE'?S.issues:'';if(!sheet)throw new Error('Loại dữ liệu cập nhật không hỗ trợ.');const rows=await readSheet(sheet);const found=Number(body.row_no)?rows.find(x=>x.row_no===Number(body.row_no)):findById(rows,text(body.id));if(!found)throw new Error('Không tìm thấy bản ghi cần cập nhật.');const data={...found.data};if(kind==='TASK'){requireManagerEvaluation(found.data['Trạng thái NV'],body.status,body.evalStatus??found.data['Đánh giá quản lý']??found.data['Đánh giá quản lý hiện tại']);if(body.status!==undefined)data['Trạng thái NV']=body.status;if(body.evalStatus!==undefined)data['Đánh giá quản lý']=body.evalStatus;if(body.note!==undefined)data['Ghi chú quản lý']=body.note;if(body.managerOpinion!==undefined)data['Ý kiến quản lý']=body.managerOpinion;}else if(kind==='PLAN'){if(body.status!==undefined)data['Trạng thái']=body.status;if(body.note!==undefined)data['Ghi chú']=body.note;if(body.description!==undefined)data['Nội dung / Mô tả']=body.description;}else if(kind==='ISSUE'){const fields:Record<string,string>={date:'Ngày ghi nhận',department:'Bộ phận',issue:'Tồn tại / Sự cố / Kiến nghị',cause:'Nguyên nhân',action:'Phương án khắc phục',owner:'Người phụ trách',deadline:'Hạn xử lý',status:'Trạng thái',recommendation:'Kiến nghị',note:'Ghi chú'};for(const [key,column] of Object.entries(fields))if(body[key]!==undefined)data[column]=body[key];}else{if(body.status!==undefined)data['Trạng thái']=body.status;if(body.note!==undefined)data['Ghi chú']=body.note;}await saveRow(sheet,found.row_no,data);return {row_no:found.row_no,kind};}

export async function GET(req:Request){const viewer=await actor();if(!viewer)return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});try{const url=new URL(req.url);const moduleName=text(url.searchParams.get('module'))||'tasks';
 if(url.searchParams.has('workThread')){
 const id=url.searchParams.get('workThread');const access=await db().rpc('nk_check_work',{who:viewer.id,work_id:id});if(access.error||!access.data)return NextResponse.json({ok:false},{status:403});const {data:t,error}=await db().from('cx_threads').select('source_row,kind').eq('id',id).eq('units','{surgery}').maybeSingle();if(error)throw error;
 if(!t||!['task','reminder'].includes(t.kind))return NextResponse.json({ok:false},{status:404});
 const source=await db().from('nk_legacy_rows').select('id,row_no,legacy_id,data').eq('id',t.source_row).eq('sheet_name',t.kind==='task'?S.tasks:S.reminders).maybeSingle();if(source.error)throw source.error;
 if(!source.data)return NextResponse.json({ok:false},{status:404});
 const rights=await getWorkEditRights(viewer,t.kind==='task'?'tasks':'reminders',source.data.row_no);
 // Quyền quản lý phê duyệt phải được đối chiếu tại server, không dựa vào nhãn Chức vụ trên giao diện.
 let canReview=false,managerAccount=false;
 if(t.kind==='task'){
  const {data:person,error:personError}=await db().from('cx_people')
   .select('active,admin,legacy_operator,team_lead,work_role_reviewed,work_view,work_edit,can_approve_work,staff_code')
   .eq('id',viewer.id).maybeSingle();
  if(personError)throw personError;
  managerAccount=Boolean(person?.active&&(person.admin||person.legacy_operator||person.team_lead)&&person.work_view);
  const state=norm(pick(source.data.data,['Trạng thái phê duyệt','Trạng thái xin ý kiến']));
  const pending=['cho phe duyet','cho quan ly phan hoi','cho quan ly phe duyet'].includes(state);
  if(pending&&person?.active){
   const {data:threadInfo,error:threadError}=await db().from('cx_threads').select('owner_id,performers').eq('id',id).maybeSingle();
   if(threadError)throw threadError;
   const excluded=threadInfo?.owner_id===viewer.id||
     Boolean(Array.isArray(threadInfo?.performers)&&threadInfo.performers.includes(viewer.id)&&
       text(source.data.data?.['Người xin duyệt ID'])===viewer.id);
   const assigned=text(source.data.data?.['Tài khoản duyệt']);
   const namedCode=text(source.data.data?.['Mã người quản lý']);
   const matchingAssignee=assigned?assigned===viewer.id:Boolean(namedCode&&person.staff_code&&same(namedCode,person.staff_code));
   canReview=Boolean(!excluded&&(person.admin||
     (person.can_approve_work&&person.work_edit&&
       (person.legacy_operator||(person.work_role_reviewed&&person.team_lead))&&matchingAssignee)));
  }
 }
 return NextResponse.json({ok:true,kind:t.kind,row:t.kind==='task'?task(source.data):reminder(source.data),canEdit:Boolean(rights?.canSave),canReview,managerAccount});
 }
 const viewFeature=({checklists:'checklists',reports:'reports',violations:'violations',plans:'plans',staff:'staff',tasks:'tasks',reminders:'reminders',alerts:'alerts',kpi:'kpi'} as Record<string,'checklists'|'reports'|'violations'|'plans'|'staff'|'tasks'|'reminders'|'alerts'|'kpi'>)[moduleName];
 const viewScope=viewFeature?await featureScope(viewer,viewFeature,'view'):null;
 if(viewFeature&&viewScope==='none')return NextResponse.json({ok:false,error:'Chưa được cấp quyền xem phân hệ.'},{status:403});
 const fullAccess=viewer.admin||(viewer.legacy_operator&&viewer.work_view)||viewScope==='hospital';
 if(!fullAccess){
  const allowed=['tasks','reminders','violations','plans','checklists','reports','staff','alerts','kpi'];
  if(!allowed.includes(moduleName))return NextResponse.json({ok:false,error:'Phân hệ ngoài phạm vi tài khoản.'},{status:403});
  const department=text(viewer.team_lead?(viewer.team_department||viewer.department):viewer.department);
  if(!department)return NextResponse.json({ok:false,error:'Tài khoản chưa có bộ phận được xác thực.'},{status:403});
  const allStaff=getStaff(await readSheet(S.staff,true));
  const identity=allStaff.find(x=>text(viewer.staff_code)&&same(x.id,viewer.staff_code))||allStaff.find(x=>same(x.name,viewer.name)&&same(x.department,department));
  if(!identity&&!viewer.team_lead)return NextResponse.json({ok:false,error:'Tài khoản chưa liên kết hồ sơ nhân viên.'},{status:403});
  const ownName=identity?.name||viewer.name;
  const teamScope=viewScope==='team'||Boolean(viewer.team_lead&&viewer.work_view&&viewScope!=='self'&&viewScope!==null);
  const member=(name:unknown)=>allStaff.some(x=>same(x.name,name)&&same(x.department,department));
  const f=parseFilters(url);
  if(teamScope&&f.person&&!member(f.person))return NextResponse.json({ok:false,error:'Nhân viên ngoài phạm vi tổ phụ trách.'},{status:403});
  f.department=department;
  if(!teamScope){f.person=['tasks','reminders'].includes(moduleName)?'':ownName;f.manager='';f.assignees=[];}
  const result:AnyRecord=await buildModule(moduleName,f);
  const staff=(result.staff||[]).filter((x:AnyRecord)=>same(x.department,department)&&(teamScope||same(x.name,ownName)));
  const safe:AnyRecord={...result,staff,departments:[department],scope:teamScope?'department':'self',fixedDepartment:department,
    fixedPerson:teamScope?'':ownName,canExport:moduleName==='reports'&&result.canExport===true,
    permissions:{scope:teamScope?'department':'self',canManage:teamScope,canEdit:teamScope,
      canRecordViolation:teamScope,canManageErrorCatalog:teamScope,canManageStaff:teamScope,
      canManageTemplates:teamScope,canManageKpiRules:false}};
  if(moduleName==='tasks'){
    if(!teamScope){
      safe.rows=(result.rows||[]).filter((x:AnyRecord)=>hasAssignee(x.assignee,ownName)||same(x.assigner,ownName));
      safe.total=safe.rows.length;
      safe.taskSummary=taskSummary(safe.rows,{...f,person:ownName});
      safe.reminders=(result.reminders||[]).filter((x:AnyRecord)=>hasAssignee(x.person,ownName)||same(x.assigner,ownName));
      safe.reminderTotal=safe.reminders.length;
    }
    safe.workload=(result.workload||[]).filter((x:AnyRecord)=>teamScope?member(x.name):same(x.name,ownName));
    safe.approvalItems=(result.approvalItems||[]).filter((x:AnyRecord)=>teamScope?same(x.department,department):same(x.assignee,ownName));
  }
  if(moduleName==='reminders'){
    safe.rows=(result.rows||[]).filter((x:AnyRecord)=>teamScope
      ?text(x.person).split(/[,;|]/).map(name=>name.trim()).filter(Boolean).every(name=>member(name))&&Boolean(text(x.person))
      :hasAssignee(x.person,ownName)||same(x.assigner,ownName));
    safe.total=safe.rows.length;
  }
  if(moduleName==='violations'){
    safe.errorCatalog=(result.errorCatalog||[]).filter((x:AnyRecord)=>same(x.department,department));
    safe.errors=(result.errors||[]).filter((x:AnyRecord)=>same(x.data?.['Bộ phận']||x.department,department));
    safe.monthlySummary=[];
  }
  if(moduleName==='staff'){
    safe.leavePlan=(result.leavePlan||[]).filter((x:AnyRecord)=>same(x.department,department));
    safe.contractAlerts=(result.contractAlerts||[]).filter((x:AnyRecord)=>teamScope||same(x.name,ownName));
  }
  if(moduleName==='kpi'){
    safe.stored=(result.stored||[]).filter((x:AnyRecord)=>same(x.department,department)&&(teamScope||same(x.person,ownName)));
    safe.feedback=(result.feedback||[]).filter((x:AnyRecord)=>same(x.data?.['Bộ phận']||x.department,department)&&(teamScope||same(x.data?.['Nhân viên']||x.person,ownName)));
  }
  if(moduleName==='checklists'){
    safe.canViewChecklistHistory=(await featureScope(viewer,'checklists','history'))!=='none';
    const add=await featureScope(viewer,'checklists','create'),edit=await featureScope(viewer,'checklists','edit'),del=await featureScope(viewer,'checklists','delete');
    safe.canScore=add!=='none'||edit!=='none';
    safe.canManageTemplates=(await featureScope(viewer,'checklistTemplates','edit'))!=='none';
    safe.canCreateTemplate=(await featureScope(viewer,'checklistTemplates','create'))!=='none';
    safe.canDeleteTemplate=(await featureScope(viewer,'checklistTemplates','delete'))!=='none';
    safe.canCreateChecklist=add!=='none';safe.canEditChecklist=edit!=='none';safe.canDeleteChecklist=del!=='none';
    safe.teamChecklist=viewer.team_lead&&!viewer.legacy_operator&&(await featureScope(viewer,'checklistTemplates','edit'))==='none';
    safe.rows=(result.rows||[]).filter((row:AnyRecord)=>teamScope||same(row.person,ownName));
    if(!safe.canViewChecklistHistory){safe.rows=[];safe.details=[];safe.total=0;}
    safe.total=safe.rows.length;
    const visibleIds=new Set(safe.rows.map((row:AnyRecord)=>String(row.id)));
    safe.details=(result.details||[]).filter((row:AnyRecord)=>visibleIds.has(String(row.formId)));
    safe.forms=(result.forms||[]).filter((x:AnyRecord)=>!x.department||same(x.department,department));
    const codes=new Set(safe.forms.map((x:AnyRecord)=>norm(x.code)));
    safe.criteria=(result.criteria||[]).filter((x:AnyRecord)=>codes.has(norm(x.formCode))&&(!x.department||same(x.department,department)));
    safe.percentConfig=(result.percentConfig||[]).filter((x:AnyRecord)=>codes.has(norm(x.formCode)));
    safe.scoring=safe.percentConfig;
  }
  if(moduleName==='reports'){
    safe.canExport=(await featureScope(viewer,'reports','export'))!=='none';
    safe.snapshots=[];
    safe.matrixCriteria=(result.matrixCriteria||[]).filter((x:AnyRecord)=>!x.department||same(x.department,department));
    safe.nextWeekPlan=(result.nextWeekPlan||[]).filter((x:AnyRecord)=>
      same(x.department,department)&&(teamScope||same(x.owner||x.assignee||x.person,ownName)));
  }
  if(moduleName==='alerts'){
    safe.rows=(result.rows||[]).filter((x:AnyRecord)=>teamScope?same(x.department,department):
      same(x.person,ownName)||text(x.personId)&&same(x.personId,viewer.staff_code));
    safe.total=safe.rows.length;
  }
  return NextResponse.json({ok:true,module:moduleName,...safe},{headers:{'Cache-Control':'private,no-store'}});
 }
 const grantedFilters=parseFilters(url);
 if(viewFeature&&viewScope!=='hospital'&&viewScope!==null){
  const ownDepartment=text(viewer.team_department||viewer.department);
  if(!ownDepartment)return NextResponse.json({ok:false,error:'Chưa liên kết bộ phận.'},{status:403});
  if(grantedFilters.department&&!same(grantedFilters.department,ownDepartment))return NextResponse.json({ok:false,error:'Bộ phận ngoài phạm vi.'},{status:403});
  grantedFilters.department=ownDepartment;
  if(viewScope==='self'){
   if(grantedFilters.person&&!same(grantedFilters.person,viewer.name))return NextResponse.json({ok:false,error:'Nhân viên ngoài phạm vi.'},{status:403});
   grantedFilters.person=viewer.name;
  }
 }
 const result:AnyRecord=await buildModule(moduleName,grantedFilters);
 if(viewFeature&&viewScope!==null&&viewScope!=='hospital'){
  const ownDept=text(viewer.team_department||viewer.department);
  result.departments=[ownDept];
  result.staff=(result.staff||[]).filter((x:AnyRecord)=>same(x.department,ownDept)&&(viewScope==='team'||same(x.name,viewer.name)));
  if(moduleName==='reports'){
   result.snapshots=[];
   result.matrixCriteria=(result.matrixCriteria||[]).filter((x:AnyRecord)=>!x.department||same(x.department,ownDept));
   result.nextWeekPlan=(result.nextWeekPlan||[]).filter((x:AnyRecord)=>same(x.department,ownDept)&&(viewScope==='team'||same(x.owner||x.assignee||x.person,viewer.name)));
  }
  if(moduleName==='checklists'){
   result.forms=(result.forms||[]).filter((x:AnyRecord)=>!x.department||same(x.department,ownDept));
   const codes=new Set(result.forms.map((x:AnyRecord)=>norm(x.code)));
   result.criteria=(result.criteria||[]).filter((x:AnyRecord)=>codes.has(norm(x.formCode)));
   result.percentConfig=(result.percentConfig||[]).filter((x:AnyRecord)=>codes.has(norm(x.formCode)));
   result.scoring=result.percentConfig;
  }
 }
 if(moduleName==='checklists'){
  result.canViewChecklistHistory=(await featureScope(viewer,'checklists','history'))!=='none';
  result.canManageTemplates=(await featureScope(viewer,'checklistTemplates','edit'))!=='none';
  result.canCreateTemplate=(await featureScope(viewer,'checklistTemplates','create'))!=='none';
  result.canDeleteTemplate=(await featureScope(viewer,'checklistTemplates','delete'))!=='none';
  if(!result.canViewChecklistHistory){result.rows=[];result.details=[];result.total=0;}
  result.canCreateChecklist=(await featureScope(viewer,'checklists','create'))!=='none';
  result.canEditChecklist=(await featureScope(viewer,'checklists','edit'))!=='none';
  result.canDeleteChecklist=(await featureScope(viewer,'checklists','delete'))!=='none';
  result.canScore=result.canCreateChecklist||result.canEditChecklist;
 }
 return NextResponse.json({ok:true,module:moduleName,...result},{headers:{'Cache-Control':'private, no-store'}});}catch(error){console.error('[modules:get]',error);return NextResponse.json({ok:false,error:'Không tải được dữ liệu phân hệ',detail:error instanceof Error?error.message:'Lỗi Supabase'},{status:503});}}

/** Quyền sửa phiếu đang tồn tại theo danh tính người giao / người thực hiện / tổ trưởng.
 * Không dùng tên do client gửi lên để xác nhận quyền. */
async function getWorkEditRights(user:NonNullable<Awaited<ReturnType<typeof actor>>>,moduleName:'tasks'|'reminders',rowNo:number){
 if(!Number.isSafeInteger(rowNo)||rowNo<=0)return null;
 const sheet=moduleName==='tasks'?S.tasks:S.reminders;
 const row=await readRow(sheet,rowNo);
 if(!row)return null;
 const old=row.data||{};
 const granted=await featureScope(user,moduleName,'edit');
 const staff=getStaff(await readSheet(S.staff,true));
 const names=text(moduleName==='tasks'?pick(old,['Người thực hiện','Người chịu trách nhiệm']):pick(old,['NGƯỜI LIÊN QUAN','Người liên quan']))
  .split(/[,;|]/).map(value=>value.trim()).filter(Boolean);
 const sender=pick(old,moduleName==='tasks'?['Người giao việc','Người giao','Người tạo']:['NGƯỜI NHẮC','Người nhắc']);
 const dept=text(pick(old,['Bộ phận','Thuộc bộ phận']));
 const teamDept=text(user.team_department||user.department);
 const manager=granted==='hospital';
 const delegatedTeam=granted==='team'&&Boolean(teamDept&&dept&&same(teamDept,dept));
 const allInTeam=names.length>0&&names.every(name=>staff.some(person=>same(person.name,name)&&same(person.department,teamDept)));
 const teamLead=delegatedTeam&&allInTeam||Boolean(user.team_lead&&user.work_view&&user.work_edit&&granted==='team'&&teamDept&&allInTeam&&(!dept||same(dept,teamDept)));
 const threadQuery=await db().from('cx_threads').select('owner_id,performers,units')
  .eq('source_row',row.id).eq('kind',moduleName==='tasks'?'task':'reminder').limit(1).maybeSingle();
 if(threadQuery.error)throw threadQuery.error;
 const thread=threadQuery.data;
 const inUnit=Boolean(Array.isArray(thread?.units)&&thread.units.includes('surgery'));
 let owner=Boolean(inUnit&&thread?.owner_id===user.id);
 let performer=Boolean(inUnit&&Array.isArray(thread?.performers)&&thread.performers.includes(user.id));
 if(!thread){
  const identity=user.staff_code?staff.find(person=>same(person.id,user.staff_code)):
   (()=>{const matched=staff.filter(person=>same(person.name,user.name)&&same(person.department,user.department));return matched.length===1?matched[0]:undefined})();
  if(identity){owner=same(sender,identity.name);performer=names.some(name=>same(name,identity.name));}
 }
 return {row,manager,teamLead,owner,performer,canSave:granted!=='none'&&(manager||teamLead||owner||performer)};
}

export async function POST(req:Request){const user=await actor();if(!user)return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});try{const body=(await req.json()) as AnyRecord;const moduleName=text(body.module);const op=text(body.op)||'save';
 if(moduleName==='checklists'){
  const rowNo=Number(body.row_no)||0;
  const action=op==='delete'?'delete':rowNo>0?'edit':'create';
  const granted=await featureScope(user,'checklists',action);
  if(granted==='none')return NextResponse.json({ok:false,error:'Chưa được cấp quyền '+action+' phiếu giám sát.'},{status:403});
  const previous=rowNo>0?await readRow(S.checklists,rowNo):null;
  if(rowNo>0&&!previous)return NextResponse.json({ok:false,error:'Không tìm thấy phiếu giám sát.'},{status:404});
  if(previous&&!['','surgery','ngoai khoa','benh vien ngoai khoa 115 nghe an'].includes(norm(previous.data?.unitId||previous.data?.['Đơn vị']||previous.data?.['Bệnh viện'])))
   return NextResponse.json({ok:false,error:'Phiếu thuộc bệnh viện khác.'},{status:403});
  const input=(body.data&&typeof body.data==='object'?body.data:body) as AnyRecord;
  const old=previous?.data;
  const department=old?pick(old,['Bộ phận']):text(input.department||input['Bộ phận']);
  const name=old?pick(old,['Họ tên','Họ và tên']):text(input.staffName||input.person);
  const staffId=old?pick(old,['Mã NV']):text(input.staffId);
  if(!inFeatureScope(user,granted,department,staffId,name))
   return NextResponse.json({ok:false,error:'Phiếu giám sát ngoài phạm vi cấp quyền.'},{status:403});
  if(old&&op!=='delete'&&text(input.department||input['Bộ phận'])&&!same(department,input.department||input['Bộ phận']))
   return NextResponse.json({ok:false,error:'Không được chuyển phiếu sang bộ phận khác.'},{status:403});
 }

 // Other operational modules use the same per-feature matrix. Do not trust a department in the request.
 const featureMap:Record<string,'violations'|'plans'|'issues'|'staff'|'kpi'|'checklistTemplates'>={
  violations:'violations',violationError:'violations',plans:'plans',issues:'issues',
  staff:'staff',kpi:'kpi',checklistForm:'checklistTemplates',
  checklistCriterion:'checklistTemplates',checklistConfig:'checklistTemplates'
 };
 const editFeature=featureMap[moduleName];
 if(editFeature){
  const update=Number(body.row_no)>0;
  const action=op==='delete'||op==='delete_report'?'delete':update||['complete','reset','plan_status','carry','save_report','save_rules'].includes(op)?'edit':'create';
  const granted=await featureScope(user,editFeature,action);
  if(granted==='none')return NextResponse.json({ok:false,error:'Chưa được cấp quyền '+action+' trong phân hệ.'},{status:403});
  const sheet=sheetFor(moduleName,body);
  const existing=update&&sheet?await readRow(sheet,Number(body.row_no)):null;
  if(update&&sheet&&!existing)return NextResponse.json({ok:false,error:'Không tìm thấy hồ sơ.'},{status:404});
  const input=(body.data&&typeof body.data==='object'?body.data:body) as AnyRecord;
  const original=existing?.data as AnyRecord|undefined;
  const oldDept=original&&text(original['Bộ phận']||original['Thuộc bộ phận']||original.department);
  const requestedDept=text(input.department||input['Bộ phận']||input['Thuộc bộ phận']);
  let dept=oldDept||requestedDept;
  if(['checklistCriterion','checklistConfig'].includes(moduleName)){
   const formCode=text(input.formCode||input['Mã phiếu']||original?.['Mã phiếu']);
   const master=(await readSheet(S.checklistForms,true)).map(formMaster).find(x=>same(x.code,formCode));
   if(!master)return NextResponse.json({ok:false,error:'Không tìm thấy mẫu phiếu cần cấu hình.'},{status:404});
   dept=text(master.department);
   if(requestedDept&&!same(requestedDept,dept))return NextResponse.json({ok:false,error:'Bộ phận của tiêu chí khác mẫu phiếu gốc.'},{status:403});
   if(original&&oldDept&&!same(oldDept,dept))return NextResponse.json({ok:false,error:'Không được chuyển tiêu chí/KPI sang mẫu phiếu thuộc bộ phận khác.'},{status:403});
  }
  if(moduleName==='checklistForm'&&original&&requestedDept&&!same(oldDept,requestedDept))
   return NextResponse.json({ok:false,error:'Không được chuyển mẫu phiếu sang bộ phận khác.'},{status:403});
  const staffId=original?text(original['Mã NV']):text(input.staffId||input['Mã NV']);
  const person=original?text(original['Họ tên']||original['Họ và tên']||original['Người phụ trách']||original['Người thực hiện']):text(input.person||input.staffName||input.owner||input['Người phụ trách']||input['Họ tên']);
  if(!inFeatureScope(user,granted,dept,staffId,person))
   return NextResponse.json({ok:false,error:'Hồ sơ nằm ngoài phạm vi cấp quyền.'},{status:403});
  if(original&&requestedDept&&oldDept&&!same(requestedDept,oldDept))
   return NextResponse.json({ok:false,error:'Không được chuyển hồ sơ sang bộ phận khác.'},{status:403});
 }
 if(moduleName==='reports'){
  if(op==='delete'&&!user.admin)return NextResponse.json({ok:false,error:'Chỉ quản trị viên được xóa báo cáo.'},{status:403});
  const kind=text(body.kind).toUpperCase();
  const itemFeature=kind==='TASK'?'tasks':kind==='PLAN'?'plans':kind==='VIOLATION'?'violations':kind==='ISSUE'?'issues':'reports';
  const scope=await featureScope(user,itemFeature as 'tasks'|'plans'|'violations'|'issues'|'reports','edit');
  if(scope==='none')return NextResponse.json({ok:false,error:'Chưa được cấp quyền sửa nội dung báo cáo.'},{status:403});
  const sheet=kind==='TASK'?S.tasks:kind==='PLAN'?(text(body.planType).toUpperCase()==='THÁNG'?S.monthly:S.weekly):
   kind==='VIOLATION'?S.violations:kind==='ISSUE'?S.issues:S.opinions;
  const rows=await readSheet(sheet,true);
  const existing=Number(body.row_no)>0?rows.find(x=>x.row_no===Number(body.row_no)):
   text(body.id)?rows.find(x=>same(x.legacy_id,body.id)||same(x.data?.['ID'],body.id)):null;
  if(op==='inline'&&kind!=='OPINION'&&!existing)
   return NextResponse.json({ok:false,error:'Không tìm thấy hồ sơ cần sửa.'},{status:404});
  const old=existing?.data||{};
  const dept=pick(old,['Bộ phận','Thuộc bộ phận'])||text(body.department);
  const person=pick(old,['Họ tên','Người thực hiện','Người phụ trách','Nhân viên'])||text(body.person||body.owner);
  if(!inFeatureScope(user,scope,dept,pick(old,['Mã NV']),person))
   return NextResponse.json({ok:false,error:'Không được sửa báo cáo ngoài phạm vi.'},{status:403});
  if(existing&&body.department&&!same(body.department,dept))
   return NextResponse.json({ok:false,error:'Không được chuyển bản ghi sang bộ phận khác.'},{status:403});
 }
 if(['tasks','reminders'].includes(moduleName)&&['save','daily','delete'].includes(op)){
  const action=op==='delete'?'delete':Number(body.row_no)>0?'edit':'create';
  const granted=await featureScope(user,moduleName as 'tasks'|'reminders',action);
  if(granted==='none')return NextResponse.json({ok:false,error:'Quyền '+action+' đã bị thu hồi trong ma trận cấp quyền.'},{status:403});
 }
 const workUpdate=(moduleName==='tasks'||moduleName==='reminders')&&['save','daily'].includes(op)&&Number(body.row_no)>0;
 const workRights=workUpdate?await getWorkEditRights(user,moduleName as 'tasks'|'reminders',Number(body.row_no)):null;
 if(workUpdate&&!workRights?.canSave)
  return NextResponse.json({ok:false,error:'Không có quyền sửa: tài khoản không phải người giao, người thực hiện hoặc tổ trưởng phụ trách.'},{status:403});
 if(workRights&&norm(pick(workRights.row.data,['Trạng thái phê duyệt','Trạng thái xin ý kiến']))==='da phe duyet')
  return NextResponse.json({ok:false,error:'Công việc đã phê duyệt; phải mở lại trước khi sửa.'},{status:409});
 const broadFeature=moduleName==='checklists'?'checklists':editFeature;
 const broadAction=op==='delete'?'delete':Number(body.row_no)>0?'edit':'create';
 const delegatedScope=broadFeature?await featureScope(user,broadFeature,broadAction):'none';
 if(!(user.admin||(user.legacy_operator&&user.work_view&&user.work_edit)||workRights?.canSave||delegatedScope==='hospital')){
  const actionScope=moduleName==='checklists'?await featureScope(user,'checklists',op==='delete'?'delete':Number(body.row_no)>0?'edit':'create'):
   editFeature?await featureScope(user,editFeature,op==='delete'?'delete':Number(body.row_no)>0?'edit':'create'):'none';
  const team=actionScope==='team'||Boolean(user.team_lead&&user.work_view&&user.work_edit);
  const department=text(user.team_lead?(user.team_department||user.department):user.department);
  if(!department)return NextResponse.json({ok:false,error:'Tài khoản chưa xác định bộ phận.'},{status:403});
  if(moduleName==='alerts'&&['read','unread'].includes(op))
   return NextResponse.json({ok:true,...await saveAlertReadState(body)});
  const allow=team?['plans','issues','violations','violationError','checklists','checklistForm','checklistCriterion','checklistConfig','staff','kpi','reports']:
   ['plans','issues','checklists','violations','violationError','checklistForm','checklistCriterion','checklistConfig','staff','kpi','reports'];
  if(!allow.includes(moduleName)||!['save','complete','reset','plan_status','carry','delete'].includes(op))
   return NextResponse.json({ok:false,error:'Thao tác ngoài quyền tài khoản.'},{status:403});
  if(!team&&['delete','carry'].includes(op)&&!(editFeature&&(await featureScope(user,editFeature,op==='delete'?'delete':'edit'))!=='none'))
   return NextResponse.json({ok:false,error:'Nhân viên không có quyền xóa hoặc luân chuyển hồ sơ.'},{status:403});
  const sheet=sheetFor(moduleName,body),existing=sheet&&Number(body.row_no)>0?await readRow(sheet,Number(body.row_no)):null;
  if(!sheet||Number(body.row_no)>0&&!existing)return NextResponse.json({ok:false,error:'Không tìm thấy hồ sơ hợp lệ.'},{status:404});
  const data=body.data&&typeof body.data==='object'&&!Array.isArray(body.data)?body.data:body;
  const oldDepartment=text(existing?.data?.['Bộ phận']||existing?.data?.['Thuộc bộ phận']);
  const newDepartment=text(data.department||data['Bộ phận']||data['Thuộc bộ phận']);
  if(oldDepartment&&!same(oldDepartment,department)||newDepartment&&!same(newDepartment,department))
   return NextResponse.json({ok:false,error:'Hồ sơ ngoài phạm vi bộ phận.'},{status:403});
  if(!existing&&!newDepartment)return NextResponse.json({ok:false,error:'Phải chọn bộ phận để tạo hồ sơ.'},{status:400});
  if(!team){
   const staff=getStaff(await readSheet(S.staff,true));
   const identity=staff.find(x=>text(user.staff_code)&&same(x.id,user.staff_code))||
     staff.find(x=>same(x.name,user.name)&&same(x.department,department));
   if(!identity)return NextResponse.json({ok:false,error:'Chưa liên kết tài khoản với hồ sơ nhân viên.'},{status:403});
   const owner=text(existing?.data?.['Người phụ trách']||existing?.data?.['Người thực hiện']||
     data.owner||data.person||data['Người phụ trách']);
   if(!same(owner,identity.name))
    return NextResponse.json({ok:false,error:'Chỉ được cập nhật hồ sơ chính mình.'},{status:403});
   const proposed=text(data.owner||data.person||data['Người phụ trách']);
   if(proposed&&!same(proposed,identity.name))
    return NextResponse.json({ok:false,error:'Không được chuyển hồ sơ cho nhân viên khác.'},{status:403});
  }
  if(moduleName==='checklists'&&op==='save'){
   const forms=(await readSheet(S.checklistForms,true)).map(formMaster);
   const code=text(data.formCode),old=existing&&checklist(existing);
   if(old&&!same(old.formCode,code)||!old&&!forms.some(f=>same(f.code,code)&&(!f.department||same(f.department,department))))
    return NextResponse.json({ok:false,error:'Mẫu phiếu ngoài phạm vi.'},{status:403});
   return NextResponse.json({ok:true,...await saveChecklistParity({...data,department,supervisor:user.name})});
  }
  if(moduleName==='checklistForm'&&op==='delete'){
   const formCode=text(existing?.data?.['Mã phiếu']);
   if(!formCode)return NextResponse.json({ok:false,error:'Không tìm thấy mẫu phiếu.'},{status:404});
   const [history,criteria]=await Promise.all([readSheet(S.checklists,true),readSheet(S.checklistCriteria,true)]);
   if(history.some(row=>same(pick(row.data,['Mã mẫu phiếu','Mã phiếu']),formCode))||
      criteria.some(row=>same(pick(row.data,['Mã phiếu']),formCode)))
    return NextResponse.json({ok:false,error:'Mẫu phiếu đã có tiêu chí hoặc lịch sử chấm. Hãy tạm ngưng thay vì xóa để bảo toàn dữ liệu.'},{status:409});
  }
 }
 if(op==='delete'&&moduleName==='checklistForm'){
  const existing=await readRow(S.checklistForms,Number(body.row_no));
  if(!existing)return NextResponse.json({ok:false,error:'Không tìm thấy mẫu phiếu.'},{status:404});
  const formCode=pick(existing.data,['Mã phiếu']);
  const [used,criteria]=await Promise.all([readSheet(S.checklists,true),readSheet(S.checklistCriteria,true)]);
  if(used.some(row=>same(pick(row.data,['Mã mẫu phiếu','Mã phiếu']),formCode))||
     criteria.some(row=>same(pick(row.data,['Mã phiếu']),formCode)))
   return NextResponse.json({ok:false,error:'Mẫu phiếu đang được sử dụng. Hãy tạm ngưng để bảo toàn lịch sử và tiêu chí.'},{status:409});
 }
 if(moduleName==='alerts'&&['read','unread'].includes(op))return NextResponse.json({ok:true,...await saveAlertReadState(body)});
 if(moduleName==='kpi'&&op==='delete_report'){
  const entries=Array.isArray(body.entries)?body.entries as AnyRecord[]:[];
  if(!entries.length)throw new Error('Không có kỳ KPI cần xóa.');
  const client=db();
  for(const entry of entries){const sheet=[S.kpi,S.kpiLegacy].includes(text(entry.sheet) as typeof S.kpi|typeof S.kpiLegacy)?text(entry.sheet):S.kpi;const rowNo=Number(entry.row_no);if(!Number.isSafeInteger(rowNo)||rowNo<=0)continue;
   const selected=await readRow(sheet,rowNo);
   if(!selected)return NextResponse.json({ok:false,error:'Không tìm thấy kỳ KPI.'},{status:404});
   const scope=await featureScope(user,'kpi','delete');
   const item=selected.data||{};
   if(!inFeatureScope(user,scope,pick(item,['Bộ phận']),pick(item,['Mã NV']),pick(item,['Họ tên','Họ và tên'])))
    return NextResponse.json({ok:false,error:'Không được xóa kỳ KPI ngoài phạm vi.'},{status:403});
   const {error}=await client.from('nk_legacy_rows').delete().eq('sheet_name',sheet).eq('row_no',rowNo);if(error)throw error;}
  return NextResponse.json({ok:true,deletedCount:entries.length});
 }
 if(moduleName==='reminders'&&op==='daily'){const row=await readRow(S.reminders,Number(body.row_no));if(!row)throw new Error('Không tìm thấy nhắc việc.');const data:AnyRecord={...row.data,'NHẮC HÀNG NGÀY':Boolean(body.daily)};if(Boolean(body.daily)&&done(data['TRẠNG THÁI']))data['TRẠNG THÁI']='CHƯA THỰC HIỆN';await saveRow(S.reminders,row.row_no,data);return NextResponse.json({ok:true,row_no:row.row_no,daily:Boolean(body.daily)});}
 if(op==='delete'){if(moduleName==='checklists'){await deleteChecklistHistory(Number(body.row_no));}else{const sheet=sheetFor(moduleName,body);if(!sheet||body.sheet&&body.sheet!==sheet)throw Error('Bảng không thuộc phân hệ.');await deleteRow(sheet,Number(body.row_no));}return NextResponse.json({ok:true});}
 if(op==='inline')return NextResponse.json({ok:true,...await inlineUpdate(body)});
 if(moduleName==='tasks'&&op==='approval'){if(text(body.action||'request')==='request')return NextResponse.json({ok:false,error:'Vui lòng gửi yêu cầu bằng biểu mẫu Quản lý phê duyệt (theo Chức vụ) đã liên kết tài khoản, tránh gửi trùng.'},{status:409});return NextResponse.json({ok:true,...await saveTaskApproval(body)});}
 if(moduleName==='checklists'&&(op==='save'||!op))return NextResponse.json({ok:true,...await saveChecklistParity(body.data||body)});
 if(moduleName==='plans'&&['complete','reset','plan_status'].includes(op)){const sheet=sheetFor('plans',body);const row=await readRow(sheet,Number(body.row_no));if(!row)throw new Error('Không tìm thấy kế hoạch.');const data={...row.data};const status=op==='complete'?'HOÀN THÀNH':op==='reset'?'CHƯA BẮT ĐẦU':body.status||'CHƯA BẮT ĐẦU';data['Trạng thái']=status;data['Kết quả']=body.result??data['Kết quả']??'';data['Ngày hoàn thành']=status==='HOÀN THÀNH'?today():'';await saveRow(sheet,row.row_no,data);return NextResponse.json({ok:true,row_no:row.row_no});}
 if(moduleName==='plans'&&op==='carry'){const sheet=sheetFor('plans',body);const row=await readRow(sheet,Number(body.row_no));if(!row)throw new Error('Không tìm thấy kế hoạch cần chuyển tiếp.');const old=plan(row,text(body.type).toUpperCase()||'TUẦN');const next=carryDates(old.fromDate,old.toDate,old.type);await saveRow(sheet,row.row_no,{...row.data,'Trạng thái':'CHUYỂN TIẾP','Kỳ chuyển tiếp':old.type==='THÁNG'?'THÁNG SAU':'TUẦN SAU'});const newId=old.type==='THÁNG'?`KHM${Date.now()}`:`KHT${Date.now()}`;const newRow=await saveRow(sheet,undefined,{...row.data,'Mã KH':newId,'Từ ngày':next.from,'Đến ngày':next.to,'Trạng thái':'CHƯA BẮT ĐẦU','Kết quả':'','Ngày hoàn thành':'','Mã kế hoạch gốc':old.rootId||old.id,'Kỳ chuyển tiếp':old.type==='THÁNG'?'THÁNG SAU':'TUẦN SAU'});return NextResponse.json({ok:true,row_no:newRow,id:newId});}
 if(moduleName==='kpi'&&op==='save_report'){const scope=await featureScope(user,'kpi','edit');const dept=text(body.department||user.team_department||user.department);if(!inFeatureScope(user,scope,dept,user.staff_code,body.person||user.name))return NextResponse.json({ok:false,error:'Không được lưu KPI ngoài phạm vi.'},{status:403});if(scope!=='hospital'&&(!same(dept,user.team_department||user.department)||scope==='self'&&body.person&&!same(body.person,user.name)))return NextResponse.json({ok:false,error:'Không được xuất kỳ KPI ngoài phạm vi.'},{status:403});const allStaff=getStaff(await readSheet(S.staff));const result=await buildKpi({from:text(body.fromDate),to:text(body.toDate),department:dept,person:scope==='self'?user.name:text(body.person)},allStaff,[],staffMap(allStaff));const rows=result.rows as AnyRecord[];if(!rows.length)throw new Error('Không có dữ liệu KPI phù hợp để lưu.');const snapshotId=`KPI-${Date.now()}`;const savedAt=new Date().toISOString();for(const x of rows)await saveRow(S.kpi,undefined,canonical('kpi',{...x,fromDate:body.fromDate,toDate:body.toDate,snapshotId,savedAt}));return NextResponse.json({ok:true,savedCount:rows.length,snapshotId,savedAt});}
 if(moduleName==='feedback'&&(op==='save_feedback'||op==='save')){const scope=await featureScope(user,'kpi','edit');if(!inFeatureScope(user,scope,body.department,undefined,body.person))return NextResponse.json({ok:false,error:'Phản hồi KPI ngoài phạm vi cấp quyền.'},{status:403});const rows=await readSheet(S.kpiFeedback);const found=rows.find(r=>same(pick(r.data,['Từ ngày']),body.from)&&same(pick(r.data,['Đến ngày']),body.to)&&same(pick(r.data,['Bộ phận']),body.department)&&same(pick(r.data,['Nhân viên']),body.person));const rowNo=await saveRow(S.kpiFeedback,found?.row_no,canonical('feedback',body));return NextResponse.json({ok:true,row_no:rowNo});}
 if(moduleName==='rule'&&op==='save_rules'){if(!user.admin)return NextResponse.json({ok:false,error:'Chỉ quản trị viên được thay đổi quy tắc KPI toàn khoa.'},{status:403});const rows=Array.isArray(body.rows)?body.rows as AnyRecord[]:[];if(!rows.length)throw new Error('Phải có ít nhất một mức xếp loại KPI.');if(rows.some(row=>!text(row.min).trim()||!text(row.max).trim()||!text(row.ranking).trim()))throw new Error('Vui lòng nhập tên xếp loại, Từ điểm và Đến điểm.');const normalized:AnyRecord[]=rows.map((row,index)=>({...row,order:Number(row.order)||index+1,min:Number(row.min),max:Number(row.max)}));if(normalized.some(row=>!text(row.ranking)||!Number.isFinite(row.min)||!Number.isFinite(row.max)||row.max<row.min))throw new Error('Mỗi mức KPI phải có tên và khoảng điểm hợp lệ.');const sorted:AnyRecord[]=normalized.slice().sort((a,b)=>a.min-b.min);for(let index=1;index<sorted.length;index++){if(sorted[index].min<=sorted[index-1].max)throw new Error(`Khoảng điểm KPI bị chồng lấn giữa “${sorted[index-1].ranking}” và “${sorted[index].ranking}”.`);}const existing=await readSheet(S.kpiRules);const keep=new Set(normalized.map(row=>Number(row.row_no)).filter(row=>Number.isFinite(row)&&row>0));for(const old of existing){if(!keep.has(old.row_no)){const {error}=await db().from('nk_legacy_rows').delete().eq('sheet_name',S.kpiRules).eq('row_no',old.row_no);if(error)throw error;}}for(const x of normalized)await saveRow(S.kpiRules,Number(x.row_no)||undefined,canonical('rule',x));return NextResponse.json({ok:true,savedCount:normalized.length});}
 const sheet=sheetFor(moduleName,body);if(!sheet)throw new Error('Thiếu sheet phân hệ.');const data=canonical(moduleName,body);
 if(workRights){
  const old=workRights.row.data||{};
  if(moduleName==='tasks'){
   if(!workRights.manager&&!workRights.teamLead&&!workRights.owner&&!same(data['Người thực hiện'],pick(old,['Người thực hiện','Người chịu trách nhiệm'])))
    return NextResponse.json({ok:false,error:'Người thực hiện không thể tự thay đổi danh sách được giao.'},{status:403});
   if(!workRights.manager&&!workRights.owner&&!same(data['Bộ phận'],pick(old,['Bộ phận','Thuộc bộ phận'])))
    return NextResponse.json({ok:false,error:'Không được chuyển công việc sang bộ phận ngoài quyền.'},{status:403});
   if(workRights.teamLead&&!workRights.manager&&!workRights.owner&&!same(data['Người thực hiện'],pick(old,['Người thực hiện','Người chịu trách nhiệm']))){
    const teamDept=text(user.team_department||user.department);
    const staffs=getStaff(await readSheet(S.staff,true));
    const people=text(data['Người thực hiện']).split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
    if(!people.length||!people.every(name=>staffs.some(person=>same(person.name,name)&&same(person.department,teamDept))))
     return NextResponse.json({ok:false,error:'Tổ trưởng chỉ được điều chỉnh người thực hiện thuộc bộ phận mình.'},{status:403});
   }
   for(const field of ['ID','Người giao việc','Trạng thái phê duyệt','Kết quả phê duyệt','Nội dung xin phê duyệt','Nội dung xin ý kiến quản lý','Thời gian xin ý kiến','Thời gian xin phê duyệt','Ngày xin ý kiến','Phản hồi quản lý','Thời gian phê duyệt','Ngày phê duyệt','Lịch sử phê duyệt']){
    if(old[field]!==undefined)data[field]=old[field];else delete data[field];
   }
   if(!workRights.manager&&!workRights.teamLead){
    for(const field of ['Đánh giá quản lý','Đánh giá quản lý hiện tại','Ghi chú quản lý','Ý kiến quản lý','Người quản lý phê duyệt','Mã người quản lý'])
     if(old[field]!==undefined)data[field]=old[field];else delete data[field];
   }
  }else{
   for(const field of ['MÃ NHẮC VIỆC','NGƯỜI NHẮC','Người nhắc']){
    if(old[field]!==undefined)data[field]=old[field];else delete data[field];
   }
   if(!workRights.manager&&!workRights.teamLead&&!workRights.owner&&!same(data['NGƯỜI LIÊN QUAN'],pick(old,['NGƯỜI LIÊN QUAN','Người liên quan'])))
    return NextResponse.json({ok:false,error:'Không được tự chuyển nhắc việc cho người khác.'},{status:403});
   if(workRights.teamLead&&!workRights.manager&&!workRights.owner&&!same(data['NGƯỜI LIÊN QUAN'],pick(old,['NGƯỜI LIÊN QUAN','Người liên quan']))){
    const teamDept=text(user.team_department||user.department);
    const staffs=getStaff(await readSheet(S.staff,true));
    const people=text(data['NGƯỜI LIÊN QUAN']).split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
    if(!people.length||!people.every(name=>staffs.some(person=>same(person.name,name)&&same(person.department,teamDept))))
     return NextResponse.json({ok:false,error:'Tổ trưởng chỉ được nhắc nhân viên trong bộ phận mình.'},{status:403});
   }
  }
 }if(moduleName==='reminders'&&!text(data['NGƯỜI LIÊN QUAN']).trim())throw new Error('Người liên quan là bắt buộc. Vui lòng chọn nhân sự từ danh sách.');if(moduleName==='plans'){const owner=text(data['Người phụ trách']).trim();if(!owner)throw new Error('Người phụ trách là bắt buộc. Hãy chọn một nhân sự từ danh sách trước khi lưu.');const staffList=getStaff(await readSheet(S.staff));const ownerRecord=staffList.find(person=>same(person.name,owner));if(!ownerRecord)throw new Error('Người phụ trách phải được chọn từ danh sách nhân viên.');data['Người phụ trách']=ownerRecord.name;data['Bộ phận']=ownerRecord.department||text(data['Bộ phận']);const from=ymd(data['Từ ngày']);const to=ymd(data['Đến ngày']);if(!from||!to)throw new Error('Kế hoạch phải có đầy đủ Từ ngày và Đến ngày.');if(to<from)throw new Error('Đến ngày không được trước Từ ngày.');if(text(body.weekday)&&text(body.type).toUpperCase()!=='THÁNG'){const date=new Date(`${from}T00:00:00`);const weekday=String(date.getDay()===0?7:date.getDay());if(weekday!==text(body.weekday))throw new Error('Thứ đã chọn không khớp với ngày thực hiện.');}}if(moduleName==='reminders'&&!TASK_REMINDER_STATUSES.includes(text(data['TRẠNG THÁI']))&&!same(data['TRẠNG THÁI'],'ĐÃ HOÀN THÀNH'))throw new Error('Trạng thái nhắc việc không hợp lệ.');if(moduleName==='violations'){const staffList=getStaff(await readSheet(S.staff));const selectedStaff=staffList.find(x=>same(x.name,data['Họ tên'])||same(x.id,data['Mã NV']));if(!selectedStaff)throw new Error('Nhân viên phải được chọn từ danh mục nhân viên.');const catalogDepartments=departmentOptions(await readSheet(S.departments),staffList);if(text(data['Bộ phận'])&&!catalogDepartments.some(x=>same(x,data['Bộ phận'])))throw new Error('Bộ phận phải được chọn từ danh mục bộ phận.');const sourceStatuses=(await readSheet(S.violations)).map(row=>pick(row.data,['Trạng thái'])).filter(Boolean);const allowedStatuses=[...new Set([...VIOLATION_STATUSES,...sourceStatuses])];if(!allowedStatuses.some(x=>same(x,data['Trạng thái'])))throw new Error('Trạng thái vi phạm không hợp lệ.');const recorder=staffList.find(x=>same(x.name,data['Người ghi nhận'])||same(x.id,data['Người ghi nhận']));if(!recorder)throw new Error('Người ghi nhận phải được chọn từ danh mục nhân viên.');data['Mã NV']=selectedStaff.id||data['Mã NV']||'';data['Họ tên']=selectedStaff.name;data['Bộ phận']=text(data['Bộ phận'])||selectedStaff.department||'';data['Người ghi nhận']=recorder.name;}if(moduleName==='violationError'){const staffList=getStaff(await readSheet(S.staff));const catalogDepartments=departmentOptions(await readSheet(S.departments),staffList);if(!text(data['Tên lỗi']))throw new Error('Tên lỗi không được để trống.');if(!text(data['Bộ phận'])||!catalogDepartments.some(x=>same(x,data['Bộ phận'])))throw new Error('Bộ phận của danh mục lỗi phải được chọn từ danh mục bộ phận.');const sourceErrors=await readSheet(S.errors);const allowedLevels=[...new Set([...VIOLATION_ERROR_LEVELS,...sourceErrors.map(row=>pick(row.data,['Mức độ']))].filter(Boolean))];const allowedStatuses=[...new Set([...VIOLATION_ERROR_STATUSES,...sourceErrors.map(row=>pick(row.data,['Trạng thái']))].filter(Boolean))];if(!allowedLevels.some(x=>same(x,data['Mức độ'])))throw new Error('Mức độ lỗi không hợp lệ.');if(!allowedStatuses.some(x=>same(x,data['Trạng thái'])))throw new Error('Trạng thái danh mục lỗi không hợp lệ.');const duplicate=sourceErrors.find(row=>row.row_no!==Number(body.row_no)&&same(pick(row.data,['Mã lỗi']),data['Mã lỗi']));if(duplicate)throw new Error('Mã lỗi đã tồn tại, hệ thống không cho lưu trùng.');}if(moduleName==='staff'){
  const code=text(data['Mã NV']),name=text(data['Họ và tên']);
  if(!code||!name)throw new Error('Mã NV và Họ tên là bắt buộc.');
  const existing=body.row_no?await readRow(S.staff,Number(body.row_no)):null;
  if(existing&&!same(code,pick(existing.data,['Mã NV'])))throw new Error('Mã NV đã liên kết tài khoản. Không thể đổi trực tiếp, hãy đối chiếu bằng quản trị.');
  const roster=await readSheet(S.staff);
  if(roster.some(row=>row.row_no!==Number(body.row_no)&&same(code,pick(row.data,['Mã NV']))))throw new Error('Mã NV đã có trong danh mục nhân sự.');
 }if(moduleName==='tasks'){const existing=body.row_no?await readRow(S.tasks,Number(body.row_no)):null;requireManagerEvaluation(existing?.data['Trạng thái NV'],data['Trạng thái NV'],data['Đánh giá quản lý']);if(!text(data['Tiêu đề công việc']))throw new Error('Tiêu đề công việc không được để trống.');const selectedWorkType=canonicalTaskWorkType(data['Loại công việc']);if(!selectedWorkType){if(body.row_no&&!text(data['Loại công việc']))data['Loại công việc']=TASK_WORK_TYPE_LONG_TERM;else throw new Error('Phải chọn Phân loại công việc: CV TRỌNG ĐIỂM & ĐỘT XUẤT hoặc CV DÀI HẠN & KHÁC.');}else data['Loại công việc']=selectedWorkType;const start=ymd(data['Ngày bắt đầu']);const end=ymd(data['Ngày kết thúc']);if(!end)throw new Error('Đến ngày là bắt buộc. Vui lòng nhập Đến ngày trước khi lưu công việc.');if(start&&end&&end<start)throw new Error('Ngày kết thúc không được trước ngày bắt đầu.');const staffList=getStaff(await readSheet(S.staff));const selected=text(data['Người thực hiện']).split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
 if(!selected.length)throw new Error('Hãy chọn người thực hiện.');
 const previous=existing?.data||{};
 if(!same(data['Người thực hiện'],previous['Người thực hiện'])){
 for(const name of selected){if(staffList.filter(p=>same(p.name,name)).length!==1)throw new Error('Cần đối chiếu nhân sự: '+name);}
 for(const key of ['Mã NV','Mã nhân viên','Mã người thực hiện','Mã người chịu trách nhiệm','staffId'])data[key]='';
 }
 data['Người thực hiện']=[...new Set(selected)].join(', ');if(body.row_no&&!existing)throw new Error('Phiếu không còn tồn tại.');data['Người giao việc']=existing?pick(existing.data,['Người giao việc','Người giao','Người tạo']):user.name;data['Bộ phận']=text(data['Bộ phận'])||staffList.find(x=>same(x.name,data['Người thực hiện']))?.department||'';data['Thuộc bộ phận']=data['Bộ phận'];}if(moduleName==='issues'){if(!text(data['Tồn tại / Sự cố / Kiến nghị']))throw new Error('Nội dung tồn tại/kiến nghị không được để trống.');const staffList=getStaff(await readSheet(S.staff));const catalogDepartments=departmentOptions(await readSheet(S.departments),staffList);if(text(data['Bộ phận'])&&!catalogDepartments.some(x=>same(x,data['Bộ phận'])))throw new Error('Bộ phận tồn tại/kiến nghị phải được chọn từ danh mục bộ phận.');if(text(data['Người phụ trách'])&&!staffList.some(x=>same(x.name,data['Người phụ trách'])))throw new Error('Người phụ trách phải được chọn từ danh mục nhân viên.');const sourceStatuses=(await readSheet(S.issues)).map(row=>pick(row.data,['Trạng thái'])).filter(Boolean);const allowedStatuses=[...new Set([...ISSUE_STATUSES,...sourceStatuses])];if(!allowedStatuses.some(x=>same(x,data['Trạng thái'])))throw new Error('Trạng thái tồn tại/kiến nghị không hợp lệ.');}if((moduleName==='reminders'||moduleName==='tasks')&&!body.row_no){
 const created=await db().rpc('nk_create_work',{sheet,fields:data,who:user.id});
 if(created.error)throw created.error;
 return NextResponse.json({ok:true,row_no:created.data,id:text(data.ID||data['MÃ NHẮC VIỆC'])});
 }const rowNo=await saveRow(sheet,Number(body.row_no)||undefined,data);return NextResponse.json({ok:true,row_no:rowNo,id:text(data['Mã phiếu']||data['Mã KH']||data['Mã VP']||data['Mã TT']||data['MÃ NHẮC VIỆC']||data.ID||'')});
 }catch(error){console.error('[modules:post]',error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Không lưu được dữ liệu'},{status:503});}}
