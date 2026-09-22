'use client';

import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import PasswordSettings from './PasswordSettings';

type MainModule='staff'|'tasks'|'violations'|'checklists'|'plans'|'reports'|'kpi'|'alerts'|'settings';
type FormModule=MainModule|'reminders'|'issues'|'violationError'|'checklistForm'|'checklistCriterion'|'feedback'|'rule'|'taskApproval';
type AnyRecord=Record<string,any>;

const BASE_DEPARTMENTS=['VỆ SINH MÔI TRƯỜNG','ĐỒ VẢI','ĐỒ VẢI - PHÒNG VIP','GIÁM SÁT','DỤNG CỤ','VI PHẠM CHUNG'];
const MODULES:Array<{key:MainModule;label:string;number:string}>=([
 ['tasks','GIAO VIỆC & NHẮC VIỆC','1'],['violations','LỖI ĐỘT XUẤT / VI PHẠM','2'],
 ['plans','KẾ HOẠCH TUẦN / THÁNG','3'],['checklists','BẢNG KIỂM GIÁM SÁT','4'],['reports','BÁO CÁO TỔNG HỢP MỚI','5'],
 ['alerts','CẢNH BÁO & LỊCH CÔNG VIỆC','7'],['kpi','KPI 100 ĐIỂM','8'],['settings','CÀI ĐẶT','9']
] as Array<[MainModule,string,string]>).map(([key,label,number])=>({key,label,number}));
const STAFF_MODULE={key:'staff' as MainModule,label:'NHÂN SỰ & HỢP ĐỒNG',number:'6'};
const MODULE_LABELS:Record<string,string>={...Object.fromEntries(MODULES.map(x=>[x.key,x.label])),staff:STAFF_MODULE.label};

const REPORT_SECTIONS=[
 {id:'weekly',label:'1. KẾ HOẠCH TUẦN CỦA BỘ PHẬN'},
 {id:'monthly',label:'2. KẾ HOẠCH THÁNG CỦA BỘ PHẬN'},
 {id:'tasks',label:'3. CÔNG VIỆC TRỌNG ĐIỂM & ĐỘT XUẤT'},
 {id:'overview',label:'4. CHỈ SỐ TỔNG QUAN'},
 {id:'checklists',label:'5. PHÂN TÍCH BẢNG KIỂM'},
 {id:'routine',label:'6. THỐNG KÊ & PHÂN TÍCH LỖI THƯỜNG QUY'},
 {id:'sudden',label:'7. THỐNG KÊ LỖI ĐỘT XUẤT / VI PHẠM'},
 {id:'matrix',label:'8. MA TRẬN THEO TỪNG PHIẾU GIÁM SÁT'},
 {id:'kpi',label:'9. KPI 100 ĐIỂM — ĐÚNG LOGIC MENU KPI'},
 {id:'incidents',label:'10. NHẬT KÝ SỰ CỐ'},
 {id:'issues',label:'11. TỒN TẠI KHÁC & KIẾN NGHỊ'},
 {id:'next-week',label:'12. DANH SÁCH KẾ HOẠCH TUẦN SAU'}
];
const REPORT_SECTION_IDS=REPORT_SECTIONS.map(x=>x.id);

function monthBounds(){const d=new Date();const from=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;const last=new Date(d.getFullYear(),d.getMonth()+1,0);return {from,to:`${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`};}
function text(value:any){if(value==null)return '';if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);try{return JSON.stringify(value)}catch{return '[Dữ liệu]';}}
function formatDate(value:any){const raw=text(value);return raw?raw.slice(0,10):'—';}
function normalize(value:any){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function statusClass(value:any){const v=normalize(value);if(v.includes('hoan thanh')||v.includes('da khac phuc')||v.includes('da xong')||v==='dong')return 'ok';if(v.includes('qua han')||v.includes('khong dat')||v.includes('kem'))return 'danger';if(v.includes('dang')||v.includes('cho')||v.includes('chua'))return 'warn';return 'neutral';}
function alertVisualClass(alert:AnyRecord){const kind=normalize(alert?.kind);if(kind==='cong viec moi giao')return 'new-task';if(kind==='cong viec hom nay')return 'today-task';if(kind==='nghi phep')return 'leave-plan-alert';return statusClass(alert?.level);}
function isWaitingManager(value:any){return ['cho phe duyet','cho quan ly phan hoi','cho quan ly phe duyet'].includes(normalize(value));}
function approvalLabel(value:any){const v=normalize(value);if(isWaitingManager(value))return 'CHỜ PHÊ DUYỆT';if(v==='chua xin y kien'||v==='chua yeu cau')return 'CHƯA YÊU CẦU';return text(value);}
function approvalHistory(value:any):AnyRecord[]{if(Array.isArray(value))return value;const raw=text(value);if(!raw)return [];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[]}catch{return []}}
function approvalActionForAlert(alert:AnyRecord){const kind=normalize(alert?.kind);if(alert?.target!=='tasks')return '';if(isWaitingManager(alert?.approvalStatus)||kind.includes('phe duyet')||kind.includes('xin y kien'))return 'review';if(kind.includes('phan hoi')||normalize(alert?.approvalStatus).includes('yeu cau bo sung')||normalize(alert?.approvalStatus).includes('tu choi'))return 'feedback';return '';}
function paramsFor(module:MainModule,filters:AnyRecord){const p=new URLSearchParams({module});['from','to','department','person','manager','title','priority','status','approvalStatus','formCode','type'].forEach(k=>{if(filters[k])p.set(k,filters[k]);});['assignees','statuses','reportSection'].forEach(k=>{if(Array.isArray(filters[k]))p.set(k,JSON.stringify(filters[k]));});return p.toString();}
function Badge({value}:{value:any}){return <span className={'status-badge '+statusClass(value)}>{text(value)||'—'}</span>;}
function ApprovalSteps({status,action,compact=false}:{status?:any;action?:string;compact?:boolean}){
 const requestFlow=action==='request';const waitingManager=!requestFlow&&(action==='review'||isWaitingManager(status));const waitingEmployee=!requestFlow&&(action==='feedback'||['da phe duyet','yeu cau bo sung','tu choi'].includes(normalize(status)));
 const steps=waitingManager?['Mở “Chi tiết giao việc” và đọc toàn bộ nội dung, thời hạn, ghi chú cùng minh chứng.','Kiểm tra kết quả thực hiện và tài liệu/ảnh minh chứng trước khi quyết định.','Chọn “Đánh giá quản lý hiện tại”, chọn kết quả phê duyệt và nhập ý kiến quản lý.','Bấm “Lưu đánh giá & phê duyệt”; nếu chưa đủ thì chọn “Yêu cầu bổ sung” để chuyển lại cho nhân viên.']:waitingEmployee?['Mở chi tiết để đọc đánh giá và ý kiến quản lý mới nhất.','Thực hiện bổ sung hoặc giải trình theo yêu cầu; cập nhật ghi chú và minh chứng nếu cần.','Bấm “Gửi phản hồi” để hoàn tất vòng phản hồi và chuyển lại cho quản lý.']:['Chọn đúng người quản lý theo cột Chức vụ.','Nhập rõ nội dung cần xem xét, kết quả và minh chứng liên quan.','Bấm “Gửi xin phê duyệt”; hệ thống sẽ tạo cảnh báo cho quản lý đã chọn.'];
 return <div className={`approval-steps${compact?' compact':''}`}><strong>QUY TRÌNH THỰC HIỆN</strong><ol>{steps.map((step,index)=><li key={index}>{step}</li>)}</ol></div>;
}

function SmartMulti({options,value,onChange,placeholder}:{options:string[];value:string[];onChange:(values:string[])=>void;placeholder:string}){
 const[open,setOpen]=useState(false);const[query,setQuery]=useState('');const filtered=options.filter(x=>!query||normalize(x).includes(normalize(query)));
 return <div className="smart-picker"><button type="button" className="smart-picker-toggle" onClick={()=>setOpen(x=>!x)}>{value.length?`${value.length} đã chọn`:placeholder}<span>⌄</span></button>{open&&<div className="smart-picker-menu"><input placeholder="Gõ để lọc..." value={query} onChange={e=>setQuery(e.target.value)}/><div className="smart-picker-options">{filtered.map(option=><label key={option}><input type="checkbox" checked={value.includes(option)} onChange={e=>onChange(e.target.checked?[...value,option]:value.filter(x=>x!==option))}/><span>{option}</span></label>)}</div><button type="button" className="smart-picker-clear" onClick={()=>onChange([])}>Xóa lựa chọn</button></div>}</div>;
}

function ReportSectionPicker({value,onChange}:{value:string[];onChange:(values:string[])=>void}){
 const allSelected=value.length===REPORT_SECTION_IDS.length;
 const toggle=(id:string,checked:boolean)=>onChange(checked?[...new Set([...value,id])]:value.filter(x=>x!==id));
 return <fieldset className="report-section-picker"><legend>CHỌN MỤC BÁO CÁO HIỂN THỊ</legend><div className="report-section-options">{REPORT_SECTIONS.map(section=><label key={section.id}><input type="checkbox" checked={value.includes(section.id)} onChange={e=>toggle(section.id,e.target.checked)}/><span>{section.label}</span></label>)}</div><div className="report-section-actions"><button type="button" onClick={()=>onChange(allSelected?[]:REPORT_SECTION_IDS)}>{allSelected?'BỎ CHỌN TẤT CẢ':'CHỌN TẤT CẢ'}</button><small>{value.length}/{REPORT_SECTION_IDS.length} mục đang hiển thị</small></div></fieldset>;
}

function SmartStaffPicker({staff,value,onChange,department='',placeholder='Gõ tên để lọc',showPosition=false}:{staff:AnyRecord[];value:any;onChange:(value:string)=>void;department?:string;placeholder?:string;showPosition?:boolean}){
 const[open,setOpen]=useState(false);const[query,setQuery]=useState('');const selected=text(value);const selectedStaff=staff.find(x=>sameValue(x.name,selected));const display=showPosition&&selectedStaff?[selectedStaff.name,selectedStaff.position].filter(Boolean).join(' · '):selected;const options=staff.filter(x=>!department||normalize(x.department)===normalize(department)||normalize(x.name)===normalize(selected));const filtered=options.filter(x=>!query||normalize(x.id).includes(normalize(query))||normalize(x.name).includes(normalize(query))||normalize(x.department).includes(normalize(query))||normalize(x.position).includes(normalize(query)));
 return <div className="smart-staff-picker"><input value={open?query:display} placeholder={placeholder} autoComplete="off" onFocus={()=>{setOpen(true);setQuery('')}} onChange={e=>{onChange('');setOpen(true);setQuery(e.target.value)}} onBlur={()=>setTimeout(()=>setOpen(false),150)}/>{open&&<div className="smart-staff-menu">{filtered.length?filtered.map(x=><button type="button" key={x.id||x.name} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(x.name);setQuery('');setOpen(false)}}><b>{x.name}</b><small>{[x.id,x.department,x.position||'Chưa có Chức vụ'].filter(Boolean).join(' · ')}</small></button>):<div className="smart-staff-empty">Không tìm thấy nhân sự phù hợp.</div>}</div>}</div>;
}

function SmartErrorPicker({errors,value,selectedName,onSelect,onClear,placeholder='Gõ tên hoặc mã lỗi để lọc'}:{errors:AnyRecord[];value:any;selectedName?:any;onSelect:(error:AnyRecord)=>void;onClear:()=>void;placeholder?:string}){
 const[open,setOpen]=useState(false);const[query,setQuery]=useState('');const selected=errors.find(x=>normalize(x.id)===normalize(value));const display=selected?[selected.id,selected.name].filter(Boolean).join(' - '):value?(selectedName?[value,selectedName].join(' - '):text(value)):'';const activeErrors=errors.filter(x=>!normalize(x.status).includes('ngung')&&!normalize(x.status).includes('tam dung'));const filtered=activeErrors.filter(x=>!query||[x.id,x.name,x.department,x.level].some(v=>normalize(v).includes(normalize(query))));
 return <div className="smart-staff-picker"><input value={open?query:display} placeholder={placeholder} autoComplete="off" onFocus={()=>{setOpen(true);setQuery('')}} onChange={e=>{onClear();setOpen(true);setQuery(e.target.value)}} onBlur={()=>setTimeout(()=>setOpen(false),150)}/>{open&&<div className="smart-staff-menu">{filtered.length?filtered.map(x=><button type="button" key={x.id||x.name} onMouseDown={e=>e.preventDefault()} onClick={()=>{onSelect(x);setQuery('');setOpen(false)}}><b>{[x.id,x.name].filter(Boolean).join(' - ')}</b><small>{[x.department,x.level,x.score!=null?`Trừ ${x.score} điểm`:'' ].filter(Boolean).join(' · ')}</small></button>):<div className="smart-staff-empty">Không tìm thấy lỗi phù hợp.</div>}</div>}</div>;
}

function Field({label,value,onChange,type='text',children,wide=false,required=false}:{label:string;value:any;onChange:(value:string)=>void;type?:string;children?:React.ReactNode;wide?:boolean;required?:boolean}){return <label className={wide?'form-field wide':'form-field'}>{label}{children||<input type={type} value={text(value)} onChange={e=>onChange(e.target.value)} required={required}/>}</label>;}

export default function Home(){
 const bounds=useMemo(monthBounds,[]);const[authenticated,setAuthenticated]=useState<boolean|null>(null);const[active,setActive]=useState<MainModule|null>(null);const[payload,setPayload]=useState<AnyRecord>({rows:[],staff:[],departments:[]});const[homeAlerts,setHomeAlerts]=useState<AnyRecord[]>([]);const[homeStaff,setHomeStaff]=useState<AnyRecord[]>([]);const[health,setHealth]=useState<AnyRecord|null>(null);const[appSettings,setAppSettings]=useState({unitName:'BỆNH VIỆN 115',softwareName:'HỆ THỐNG QUẢN LÝ KSNK'});const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[loginError,setLoginError]=useState('');const[refresh,setRefresh]=useState(0);const[modal,setModal]=useState<AnyRecord|null>(null);const[modalError,setModalError]=useState('');const[form,setForm]=useState<AnyRecord>({});const[pendingAlert,setPendingAlert]=useState<AnyRecord|null>(null);const[menuOpen,setMenuOpen]=useState(true);
 const[filters,setFilters]=useState<AnyRecord>({from:bounds.from,to:bounds.to,department:'',person:'',manager:'',title:'',priority:'',status:'',approvalStatus:'',assignees:[],statuses:[],formCode:'',type:'TUẦN',reportSection:REPORT_SECTION_IDS});
 useEffect(()=>{fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(setHealth).catch(()=>setHealth({ok:false}));fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()).then(j=>setAuthenticated(Boolean(j.authenticated))).catch(()=>setAuthenticated(false));},[]);
 useEffect(()=>{if(authenticated!==true)return;const loadSettings=()=>{fetch('/api/settings/general',{cache:'no-store'}).then(r=>r.json()).then(j=>{if(j.ok)setAppSettings({unitName:j.unitName,softwareName:j.softwareName});}).catch(()=>undefined);};loadSettings();window.addEventListener('ksnk-general-settings-updated',loadSettings);return()=>window.removeEventListener('ksnk-general-settings-updated',loadSettings);},[authenticated,refresh]);
 const load=useCallback(async()=>{if(!authenticated||!active||active==='settings')return;setLoading(true);setError('');try{const r=await fetch('/api/modules?'+paramsFor(active,filters),{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.detail||j.error||'Không tải được dữ liệu');setPayload(j);}catch(e){setError(e instanceof Error?e.message:'Không tải được dữ liệu');setPayload({rows:[],staff:[],departments:[]});}finally{setLoading(false);}},[authenticated,active,JSON.stringify(filters),refresh]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(!authenticated||active)return;fetch('/api/modules?module=alerts',{cache:'no-store'}).then(r=>r.json()).then(j=>{setHomeAlerts(j.rows||[]);setHomeStaff(j.staff||[]);}).catch(()=>{setHomeAlerts([]);setHomeStaff([]);});},[authenticated,active,refresh]);
 const departments=useMemo<string[]>(()=>{const values=(Array.isArray(payload.departments)&&payload.departments.length?payload.departments:BASE_DEPARTMENTS) as string[];return [...new Set<string>(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));},[payload.departments]);
 const staffNames=useMemo(()=>((payload.staff||[]) as AnyRecord[]).map(x=>x.name).filter(Boolean),[payload.staff]);
 function setFilter(name:string,value:any){setFilters((prev:AnyRecord)=>({...prev,[name]:value}));}
 function openModule(key:MainModule){setActive(key);setError('');setPayload({rows:[],staff:[],departments:[]});}
 function openAlert(alert:AnyRecord){setPendingAlert(alert);setFilters((prev:AnyRecord)=>({...prev,from:'',to:'',department:alert.department||prev.department,person:alert.person||prev.person,manager:alert.managerName||prev.manager,approvalStatus:alert.approvalStatus||prev.approvalStatus}));openModule(alert.target==='plans'?'plans':alert.target==='staff'?'staff':alert.target==='alerts'?'alerts':'tasks');}
 function filterAlertManager(managerName:string){setPendingAlert(null);setFilters((prev:AnyRecord)=>({...prev,from:'',to:'',manager:managerName,approvalStatus:'CHỜ PHÊ DUYỆT'}));openModule('alerts');}
 function openCreate(key:FormModule,initial:AnyRecord={}){
  const today=new Date().toISOString().slice(0,10);let next:AnyRecord={};
  if(key==='tasks')next={taskId:`CV${Date.now()}`,department:filters.department||'',assigner:'',priority:'TRUNG BÌNH',status:'CHƯA BẮT ĐẦU',evalStatus:'CHƯA BẮT ĐẦU',startDate:today};
  if(key==='reminders')next={reminderId:`NV${Date.now()}`,date:today,status:'CHƯA THỰC HIỆN'};
  if(key==='staff')next={status:'Đang làm việc',annualLeaveEntitlement:''};
  if(key==='violations')next={id:`VP${Date.now()}`,date:today,status:'Chưa xử lý'};
  if(key==='plans')next={id:'',type:filters.type||'TUẦN',fromDate:filters.from||bounds.from,toDate:filters.to||bounds.to,status:'CHƯA BẮT ĐẦU'};
  if(key==='issues')next={id:`TT${Date.now()}`,date:today,status:'CHƯA KHẮC PHỤC'};
  if(key==='reports')next={opinionId:`YK${Date.now()}`,fromDate:filters.from,toDate:filters.to,department:filters.department,status:'Đã lưu'};
  if(key==='checklists')next={date:today,details:[]};
  if(key==='checklistForm')next={status:'Hoạt động'};
  if(key==='checklistCriterion')next={status:'Hoạt động',allowImage:'Có',order:1};
  if(key==='violationError')next={status:'Hoạt động',level:'Nhắc nhở',score:0};
  if(key==='feedback')next={from:filters.from,to:filters.to,department:filters.department,person:filters.person};
  if(key==='rule')next={status:'Hoạt động',color:'#6C757D'};
  next={...next,...initial};
  if(key==='checklists'&&initial.formCode){const selected=(payload.forms||[]).find((item:AnyRecord)=>sameValue(item.code,initial.formCode));next.formName=selected?.name||'';next.department=selected?.department||next.department||'';next.details=(payload.criteria||[]).filter((item:AnyRecord)=>sameValue(item.formCode,initial.formCode)).sort((a:AnyRecord,b:AnyRecord)=>Number(a.order||0)-Number(b.order||0)).map((item:AnyRecord)=>({criterionCode:item.id,group:item.group,content:item.content,detail:item.detail,order:item.order,allowImage:item.allowImage||'Có',result:'',note:''}));}
  setModalError('');setForm(next);setModal({module:key});
 }
 function openEdit(key:FormModule,row:AnyRecord){setModalError('');setForm({...row,__module:key});setModal({module:key,row_no:row.row_no,source:row});}
 function change(name:string,value:any){setForm((prev:AnyRecord)=>({...prev,[name]:value}));}
 async function save(e:FormEvent){
  e.preventDefault();if(!modal)return;setError('');setModalError('');
  try{
   const current=e.currentTarget as HTMLFormElement;
   const imageInput=current.elements.namedItem('evidenceImageFile') as HTMLInputElement|null;
   const documentInput=current.elements.namedItem('evidenceDocumentFile') as HTMLInputElement|null;
   const legacyInput=current.elements.namedItem('evidenceFile') as HTMLInputElement|null;
   const imageFile=imageInput?.files?.[0];const documentFile=documentInput?.files?.[0];const legacyFile=legacyInput?.files?.[0];
   const evidenceFiles=[imageFile,documentFile,legacyFile].filter((file,index,array):file is File=>Boolean(file)&&array.indexOf(file)===index);
   const checklistDetailFiles=modal.module==='checklists'?Array.from(current.querySelectorAll<HTMLInputElement>('input[data-checklist-detail-image]')).flatMap(input=>{const file=input.files?.[0];return file?[{file,criterion:text(input.dataset.criterionCode)}]:[]}):[];
   if(modal.module==='violations'&&(!form.person||!form.staffId||!form.errorId||!form.recorder))throw new Error('Vui lòng chọn nhân viên, lỗi vi phạm và người ghi nhận từ danh mục.');
   if(modal.module==='checklists'){
    const details=Array.isArray(form.details)?form.details as AnyRecord[]:[];
    if(!form.formCode||!form.formName)throw new Error('PHẢI CHỌN PHIẾU GIÁM SÁT trước khi lưu.');
    if(!details.length)throw new Error('Phiếu chưa có tiêu chí để chấm.');
    for(const [index,item] of d