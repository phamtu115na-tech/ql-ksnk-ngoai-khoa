import {staffPosition,staffEmploymentStatus,roleAllowedByPosition} from '../../../lib/staff-roles';
import {actor,db,personFields,Person} from '../../../lib/auth';
import {featureScope} from '../../../lib/feature-permissions';
import {randomUUID} from 'crypto';
import {hash} from 'bcryptjs';
export const dynamic='force-dynamic';
const unit='surgery';
const kinds=['task','reminder','chat'];
const statuses=['Mới','Đã nhận','Đang thực hiện','Hoàn thành'];
const mime=['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
class Fail extends Error{constructor(msg:string,public status=400){super(msg)}}
function must(ok:unknown,msg='Dữ liệu không hợp lệ',status=400):asserts ok{if(!ok)throw new Fail(msg,status)}
function str(v:unknown,max:number){must(typeof v==='string'&&v.trim().length<=max);return v.trim()}
function ids(v:unknown):string[]{must(Array.isArray(v)&&v.length<=200&&v.every(uuid));return [...new Set<string>(v)]}
function uuid(v:unknown){return typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v)}
function checked<T>(r:{data:T,error:unknown}){if(r.error)throw r.error;return r.data}
type Thread={source_row:number;id:string;title:string;owner_id:string;performers:string[];observers:string[];units:string[];kind:string;seq:number;status:string;due:string;note:string};
function member(t:Thread,a:Person){return (t.units.length===1&&t.units[0]===unit&&a.unit===unit)&&[t.owner_id,...t.performers,...t.observers].includes(a.id)}
async function dispatch(req:Request){
 const a=await actor();must(a,'Vui lòng đăng nhập lại.',401);
 const b=await req.json(),client=db(),files=client.storage.from('connect-files');
 const scope=unit;
 must(!b.scope||b.scope===scope);
 const rpc=async(name:string,args:Record<string,unknown>)=>checked(await client.rpc(name,args));
 async function people(all=false){
 const result:Person[]=[];
 for(let start=0;;start+=500){
 let q=client.from('cx_people').select(personFields).order('id').range(start,start+499);
 if(!all)q=q.or('active.eq.true,pending_login.eq.true');
 q=q.eq('unit',unit);
 const page=checked(await q)||[];result.push(...page);if(page.length<500)break;
 }return result;
 }
 if(b.action==='me'){
 const directory=await people(a.admin);
 const reviewers=await client.from('cx_people').select('id').eq('unit',unit).eq('can_approve_work',true).eq('active',true);
 const granted=new Set((reviewers.data||[]).map(p=>p.id));
 return {me:a,reviewSettingsReady:!reviewers.error,people:directory.map(p=>({...p,can_approve_work:granted.has(p.id)}))};
 }
 if(b.action==='sourceThread'){
 must(['reminder','task'].includes(b.kind)&&Number.isSafeInteger(b.row)&&b.row>0);
 const source=checked(await client.from('nk_legacy_rows').select('id,legacy_id,data').eq('sheet_name',b.kind==='task'?'GIAO VIỆC':'NHAC_VIEC_GHI_CHU').eq('row_no',b.row).maybeSingle());
 must(source&&(!b.ref||[source.legacy_id,source.data?.ID,source.data?.['MÃ NHẮC VIỆC']].includes(b.ref)),'Hồ sơ đã thay đổi. Tải lại danh sách.',404);
 const item=checked(await client.from('cx_threads').select('*').eq('source_row',source.id).maybeSingle());
 must(item&&await rpc('nk_check_work',{who:a.id,work_id:item.id}),'Chỉ người tham gia việc này được mở trò chuyện.',403);
 return {id:item.id};
 }
 if(b.action==='sourceThreadById'){
  must(['task','reminder'].includes(b.kind)&&Number.isSafeInteger(b.sourceId)&&b.sourceId>0);
  const source=checked(await client.from('nk_legacy_rows').select('id,sheet_name').eq('id',b.sourceId).eq('sheet_name',b.kind==='task'?'GIAO VIỆC':'NHAC_VIEC_GHI_CHU').maybeSingle());
  must(source,'Không tìm thấy dữ liệu tác vụ cũ.',404);
  const item=checked(await client.from('cx_threads').select('id').eq('source_row',source.id).eq('kind',b.kind).maybeSingle());
  must(item&&await rpc('nk_check_work',{who:a.id,work_id:item.id}),'Tác vụ không thuộc phạm vi được phân công.',403);
  return {id:item.id};
 }
 if(b.action==='history'){
 must(['task','reminder'].includes(b.kind));
 const historyScope=await featureScope(a,b.kind==='task'?'tasks':'reminders','history');
 must(historyScope!=='none','Không được cấp quyền xem lịch sử giao/nhắc việc.',403);
 return {rows:await rpc('cx_history',{who:a.id,k:b.kind,scope,skip_rows:Math.max(0,Number(b.offset)||0)})};
 }
 if(['directory','sync','confirm'].includes(b.action)){
 must(a.admin,'Cần quyền quản trị',403);
 if(b.action==='sync'){await rpc('cx_refresh_links',{});return {ok:true};}
 if(b.action==='confirm'){
 must(checked(await client.from('cx_staff_catalog').select('source_id').eq('unit',unit).eq('source_id',b.employee).maybeSingle()),'Nhân sự ngoài phạm vi bệnh viện.',403);
 must(await rpc('cx_confirm_role',{src:b.src,role_name:b.role,raw_token:b.token,by_code:b.match_code,employee:b.employee}),'Hồ sơ đã thay đổi. Tải lại để kiểm tra.',409);return {ok:true};
 }
 const staff=[],pending=[];
 for(let start=0;;start+=500){
 const rows=checked(await client.from('cx_staff_catalog').select('*').eq('unit',unit).order('source_id').range(start,start+499))||[];
 staff.push(...rows);if(rows.length<500)break;
 }
 for(let start=0;;start+=500){
 const rows=checked(await client.from('cx_work_people').select('source_id,unit,role,token,match_code').eq('unit',unit).is('staff_code',null).order('source_id').order('role').order('token').range(start,start+499))||[];
 pending.push(...rows);if(rows.length<500)break;
 }
 const hrRecords=checked(await client.from('ksnk_legacy_rows').select('id,data').eq('sheet_name','DM_NHANVIEN'))||[];
 const hrById=new Map(hrRecords.map((record:{id:number;data:Record<string,unknown>})=>[record.id,record.data]));
 return {staff:staff.map(employee=>{
  const hr=hrById.get(Number(employee.source_id))||{};
  return {...employee,position:staffPosition(hr['Chức vụ'])||String(hr['Chức vụ']||''),employmentStatus:staffEmploymentStatus(hr['Trạng thái'])||String(hr['Trạng thái']||'')};
 }),pending};
 }
 if(b.action==='account'){
 must(a.admin,'Chỉ quản trị viên được cấp tài khoản.',403);
 const name=str(b.name,120),username=str(b.username,50).toLowerCase();must(name&&/^[a-z0-9._-]{3,50}$/.test(username)&&b.unit===unit);
 let linked:null|{position:string;status:string;department:string;name:string}=null;
 if(b.staffCode){
  const code=str(b.staffCode,150);
  const list=checked(await client.from('cx_staff_catalog').select('source_id,name,department,copies').eq('unit',unit).eq('code',code).limit(2));
  must(list&&list.length===1&&Number(list[0].copies)===1,'Mã nhân viên chưa có hồ sơ duy nhất trong Nhân sự & Hợp đồng.',409);
  const record=checked(await client.from('ksnk_legacy_rows').select('data').eq('sheet_name','DM_NHANVIEN').eq('id',list[0].source_id).maybeSingle());
  must(record,'Không tìm thấy hồ sơ nhân sự liên kết.',409);
  linked={position:staffPosition(record.data?.['Chức vụ']),status:staffEmploymentStatus(record.data?.['Trạng thái']),department:list[0].department,name:list[0].name};
  must(linked.status,'Trạng thái nhân sự chưa được chuẩn hóa.',409);
  must(linked.status!=='Đã nghỉ việc'||b.active!==true,'Nhân sự đã nghỉ việc không được kích hoạt tài khoản.',409);
  if(b.role!==undefined){
   must(linked.position,'Hãy chuẩn hóa Chức vụ tại Nhân sự & Hợp đồng.',409);
   must(roleAllowedByPosition(b.role,linked.position),'Phân quyền không khớp Chức vụ trong Nhân sự & Hợp đồng.',409);
  }
 }
 const patch:Record<string,unknown>={name:linked?.name||name,username,unit:b.unit,legacy_operator:b.legacy===true,active:b.active===true,version:randomUUID()};
 if(linked)patch.department=linked.department;
 if(b.role!==undefined){
 must(['chief','team','staff'].includes(b.role)&&typeof b.view==='boolean'&&typeof b.edit==='boolean'&&(!b.edit||b.view));
 patch.work_role_reviewed=true;patch.legacy_operator=b.role==='chief';patch.team_lead=b.role==='team';patch.work_view=b.view;patch.work_edit=b.edit;
 if(b.role!=='team')patch.team_department=null;
 if(b.role==='team'){
 const dep=str(linked?.department||b.department||'',150);must(dep,'Hãy chọn bộ phận của tổ trưởng.');
 must((await people(true)).some(p=>p.department===dep),'Bộ phận chưa có trong danh mục nhân sự.');patch.team_department=dep;
 }
 }
 if(typeof b.canApproveWork==='boolean')patch.can_approve_work=b.canApproveWork&&b.edit===true&&['chief','team'].includes(b.role);
 if(b.staffCode){must(typeof b.staffCode==='string'&&b.staffCode.length<=150);patch.staff_code=b.staffCode;}
 if(b.code)patch.pending_login=false;
 if(b.code||!b.id){const code=str(b.code,72);must(code.length>=12&&Buffer.byteLength(code)<=72,'Mã cần ít nhất 12 ký tự và tối đa 72 byte.');patch.credential=await hash(code,12);}
 if(b.id){
 must(uuid(b.id)&&uuid(b.version)&&b.id!==a.id,'Dùng mục Đổi mã để cập nhật tài khoản đang đăng nhập.');
 const row=await client.from('cx_people').update(patch).eq('id',b.id).eq('unit',unit).eq('admin',false).eq('version',b.version).select('id').maybeSingle();if(row.error?.code==='23505')throw new Fail('Tên đăng nhập hoặc hồ sơ nhân viên đã được sử dụng');must(checked(row),'Tài khoản đã thay đổi. Hãy tải lại.',409);
 }else{const r=await client.from('cx_people').insert(patch);if(r.error?.code==='23505')throw new Fail('Tên đăng nhập hoặc hồ sơ nhân viên đã được sử dụng');checked(r);}
 return {ok:true};
 }
 if(b.action==='approvalEvents'){
  const result=await client.rpc('nk_my_work_events',{who:a.id});
  if(result.error?.code==='PGRST202')return [];
  return checked(result);

 }
 if(b.action==='ackEvent'){
  must(Number.isSafeInteger(b.eventId)&&b.eventId>0);
  const now=new Date().toISOString();
  const result=await client.from('nk_work_events').update(b.handled?{read_at:now,handled_at:now}:{read_at:now}).eq('id',b.eventId).eq('recipient',a.id).select('id').maybeSingle();
  must(checked(result),'Ngoài phạm vi thông báo',403);return {ok:true};
 }
 if(b.action==='workAlerts'){
 const kind=b.kind||'all',offset=b.offset??0;
 must(['all','task','reminder'].includes(kind)&&Number.isSafeInteger(offset)&&offset>=0);
 return await rpc('nk_work_alerts',{who:a.id,filter_kind:kind,skip_rows:offset});
 }
 if(b.action==='counts'){const [badges,latest]=await Promise.all([rpc('cx_badges',{who:a.id,scope}),rpc('cx_notification',{who:a.id})]);return {badges,latest};}
 if(b.action==='workRows'){
 must(['task','reminder'].includes(b.kind)&&Number.isSafeInteger(b.offset)&&b.offset>=0);
 const page=await rpc('cx_board',{who:a.id,scope,screen:b.kind,skip_rows:b.offset}) as
  Array<{item:Record<string,unknown>;unread:number}>;
 if(!page.length)return page;
 const meta=await rpc('nk_warning_meta',{who:a.id,work_ids:page.map(row=>String(row.item.id))}) as
  Array<{id:string;received_by:string[];daily:boolean;daily_done_today:boolean}>;
 const byId=new Map(meta.map(entry=>[entry.id,entry]));
 return page.map(row=>({...row,item:{...row.item,...(byId.get(String(row.item.id))||{})}}));
 }
 if(b.action==='board'){
 const screen=b.kind||'all';must(screen==='all'||kinds.includes(screen));
 const [due,rows,badges,latest]=await Promise.all([
 rpc('cx_due',{who:a.id,scope}),rpc('cx_board',{who:a.id,scope,screen,skip_rows:Math.max(0,Number(b.offset)||0)}),
 rpc('cx_badges',{who:a.id,scope}),rpc('cx_notification',{who:a.id})]);
 return {due,rows,badges,latest};
 }
 if(b.action==='upload'){
 must(mime.includes(b.mime)&&Number.isInteger(b.size)&&b.size>0&&b.size<=8388608,'Tệp không đúng định dạng hoặc vượt 8 MB.');
 const path=a.id+'/'+randomUUID();
 const data=checked(await files.createSignedUploadUrl(path));must(data);
 return {path,url:data.signedUrl};
 }
 async function attachments(){
 const list=b.files||[];must(Array.isArray(list)&&list.length<=4);
 let images=0,docs=0;const result=[];
 for(const f of list){
 must(typeof f.path==='string'&&f.path.startsWith(a!.id+'/')&&uuid(f.path.split('/')[1])&&f.path.split('/').length===2);
 const info=checked(await files.info(f.path));must(info&&mime.includes(info.contentType||info.metadata?.mimetype));
 const type=info.contentType||info.metadata?.mimetype;type.startsWith('image/')?images++:docs++;
 result.push({path:f.path,name:str(f.name,150),mime:type});
 }must(images<=3&&docs<=1,'Mỗi lần gửi tối đa 3 ảnh và 1 tài liệu.');return result;
 }
 if(b.action==='create'){
 const kind=b.kind;must(kinds.includes(kind)&&uuid(b.id));
 if(kind!=='chat'){
  const granted=await featureScope(a,kind==='task'?'tasks':'reminders','create');
  must(granted==='hospital'||granted==='team',
   'Chưa được cấp quyền tạo tác vụ hoặc vượt phạm vi phân công.',403);
 }
 const p=ids(b.performers),o=ids(b.observers||[]);must(p.length,'Chọn người thực hiện hoặc người nhận.');
 if(kind==='chat')must(p.length===1&&p[0]!==a.id&&!o.length);
 const selected=(await people()).filter(x=>(x.active||(kind!=='chat'&&x.pending_login))&&(p.includes(x.id)||o.includes(x.id)));
 must(new Set([...p,...o]).size===selected.length,'Người nhận không thuộc phạm vi tài khoản.',403);
 if(kind!=='chat'&&(await featureScope(a,kind==='task'?'tasks':'reminders','create'))==='team'){const department=(a.team_department||a.department||'').trim().toLocaleLowerCase('vi');must(department&&selected.every(p=>p.department?.trim().toLocaleLowerCase('vi')===department),'Chỉ được giao việc cho nhân viên trong bộ phận phụ trách.',403);}
 const u=[...new Set([a.unit,...selected.map(x=>x.unit)])],label=kind==='chat'?'Trao đổi riêng':str(b.title,180);
 must(label);const d=b.due||null;must(!d||/^\d{4}-\d{2}-\d{2}$/.test(d));
 const id=await rpc('cx_create',{t:b.id,k:kind,label,who:a.id,p,o,u,d,details:str(b.note||'',6000),pk:kind==='chat'?[a.id,p[0]].sort().join(':'):null,attachments:await attachments()});return {id};
 }
 must(uuid(b.id));const t=checked(await client.from('cx_threads').select('*').eq('id',b.id).maybeSingle()) as Thread;
 const access=t&&await rpc('nk_check_work',{who:a.id,work_id:t.id});
 must(access,'Tác vụ ngoài phạm vi tài khoản.',403);
 const editScope=t.kind==='chat'?'none':await featureScope(a,t.kind==='task'?'tasks':'reminders','edit');
 const writable=t.kind==='chat'||editScope!=='none'&&(a.admin||a.work_edit||member(t,a)||editScope==='team'||editScope==='hospital');
 // Edits from a participant still pass the existing SQL work-thread authorization.

 if(t.source_row&&['status','detailSave','edit'].includes(b.action)){
  const source=checked(await client.from('nk_legacy_rows').select('data').eq('id',t.source_row).maybeSingle());
  must(source?.data?.['Trạng thái phê duyệt']!=='ĐÃ PHÊ DUYỆT','Hãy mở lại tác vụ trước khi sửa.',409);
 }
 if(['edit','detailSave','send','status','receive'].includes(b.action))must(writable,'Tài khoản chỉ có quyền xem.',403);
 if(b.action==='decision'){
  must(writable&&t.kind!=='chat'&&uuid(b.requestId)&&['request','approve','supplement','reject','reopen'].includes(b.operation));
  if(b.operation!=='request'){
   const permission=await featureScope(a,'tasks','approve');
   must(permission!=='none','Quyền phê duyệt đã bị tắt trong ma trận.',403);
  }
  must(b.operation!=='request'||uuid(b.reviewer));
  must(await rpc('nk_work_decision',{who:a.id,work_id:t.id,rid:b.requestId,operation:b.operation,reviewer:b.reviewer||null,note:str(b.note||'',2000),expected:str(b.expected||'',120)}),'Quyền hoặc trạng thái tác vụ vừa thay đổi. Mở lại để kiểm tra.',409);return {ok:true};
 }
 if(b.action==='detailSave'){
 const label=str(b.title,180);must(label&&uuid(b.requestId)&&b.requestId!==a.id&&Number.isInteger(b.expected));
 must(!b.due||/^\d{4}-\d{2}-\d{2}$/.test(b.due));
 must(await rpc('nk_save_detail',{work_id:t.id,who:a.id,expected:b.expected,rid:b.requestId,label,details:str(b.note||'',6000),deadline:b.due||null,personal:str(b.personal||'',6000),opinion:b.opinion==null?null:str(b.opinion,6000)}),'Phiếu đã thay đổi. Mở lại để cập nhật.',409);
 return {ok:true};
 }
 if(b.action==='receive'){must(await rpc('nk_receive_work',{t:t.id,who:a.id}),'Bạn không phải người thực hiện.',403);return {ok:true};}
 if(b.action==='dailyDone'){
  must(t.kind==='reminder'&&t.performers.includes(a.id),'Chỉ người được nhắc mới được xác nhận ngày này.',403);
  must(await rpc('nk_daily_work_done',{who:a.id,work_id:t.id}),'Nhắc việc không còn hiệu lực hoặc chưa đến ngày.',409);
  return {ok:true};
 }

 if(b.action==='thread'){
 const before=Number(b.before)||2147483647;
 const rows=checked(await client.from('cx_messages').select('*').eq('thread',t.id).lt('seq',before).order('seq',{ascending:false}).limit(50))||[];
 const participants=[...new Set([t.owner_id,...t.performers,...t.observers].filter(Boolean))];
 const members=checked(await client.from('cx_people').select('id,name,username,unit').in('id',participants))||[];
 const receipts=t.performers.length?checked(await client.from('cx_messages').select('sender,request_id').eq('thread',t.id).in('request_id',t.performers)):[];
 const source=t.source_row?checked(await client.from('nk_legacy_rows').select('data').eq('id',t.source_row).maybeSingle())?.data||{}:{};
 const personal=t.kind!=='chat'?checked(await client.from('nk_personal_work_notes').select('note').eq('thread',t.id).eq('person',a.id).maybeSingle())?.note||'':'';
 const dept=String(source['Bộ phận']||source['Thuộc bộ phận']||'').trim();
 const assignments=t.performers.length&&a.team_lead?(await people(true)).filter(p=>t.performers.includes(p.id)):[];
 const managedDepartment=a.team_department||a.department;
 const manages=a.admin||a.legacy_operator||(a.team_lead&&!!managedDepartment&&(dept?dept.trim().toLowerCase()===managedDepartment.trim().toLowerCase():assignments.length===t.performers.length&&assignments.length>0&&assignments.every(p=>p.department===managedDepartment)));
 const originalFields=t.kind==='task'?[
  ['Mã công việc',source['ID']||source['Mã công việc']],
  ['Phân loại công việc',source['Loại công việc']||source['Phân loại công việc']],
  ['Từ ngày',source['Ngày bắt đầu']],
  ['Trạng thái nhân viên',source['Trạng thái NV']||source['Trạng thái nhân viên']],
  ['Đánh giá quản lý',source['Đánh giá quản lý']||source['Đánh giá quản lý hiện tại']],
  ['Ghi chú nhân viên',source['Ghi chú NV']||source['Ghi chú nhân viên']],
  ['Người quản lý phê duyệt',source['Người quản lý phê duyệt']],
  ['Phương án dự phòng',source['Dự phòng']||source['Phương án dự phòng']||source['Dự phòng / phương án dự phòng']],
  ['Nội dung xin phê duyệt',source['Nội dung xin phê duyệt']||source['Nội dung xin ý kiến quản lý']],
  ['Phản hồi quản lý',source['Phản hồi quản lý']],
  ['Ảnh minh chứng đã lưu',source['Ảnh minh chứng']||source['Hình ảnh']],
  ['Tài liệu minh chứng đã lưu',source['Tài liệu minh chứng']||source['Tài liệu đính kèm']]
 ]:t.kind==='reminder'?[
  ['Mã nhắc việc',source['MÃ NHẮC VIỆC']||source['Mã nhắc việc']],
  ['Nhắc hằng ngày',source['NHẮC HÀNG NGÀY']??source['Nhắc hàng ngày']],
  ['Trạng thái nhắc việc',source['TRẠNG THÁI']||source['Trạng thái']],
  ['Ảnh minh chứng đã lưu',source['Ảnh minh chứng']||source['Hình ảnh']],
  ['Tài liệu minh chứng đã lưu',source['Tài liệu minh chứng']||source['Tài liệu đính kèm']]
 ]:[];
 const approvalScope=t.kind==='task'?await featureScope(a,'tasks','approve'):'none';
 return {item:t,members,personal,originalFields,approvalStatus:source['Trạng thái phê duyệt']||(t.kind==='task'?'CHƯA XIN Ý KIẾN':'KHÔNG YÊU CẦU'),approvalHistory:source['Lịch sử phê duyệt']||'[]',reviewer:source['Tài khoản duyệt']||'',canReview:approvalScope!=='none'&&(a.admin||(manages&&(source['Tài khoản duyệt']===a.id||(!source['Tài khoản duyệt']&&a.staff_code&&source['Mã người quản lý']===a.staff_code)))),opinion:source['Ý kiến quản lý']||'',department:dept,priority:source['Mức độ ưu tiên']||'',writable,manage:manages,received:(receipts||[]).filter(x=>x.sender===x.request_id).map(x=>x.sender),rows:rows.reverse()};
 }
 if(b.action==='edit'){
 const title=str(b.title,180);must(title&&uuid(b.requestId)&&Number.isInteger(b.expected)&&/^\d{4}-\d{2}-\d{2}$/.test(b.due));
 must(await rpc('cx_edit',{t:t.id,who:a.id,label:title,details:str(b.note,6000),d:b.due,expected:b.expected,rid:b.requestId}),'Việc đã thay đổi hoặc bạn không phải người tạo. Mở lại để cập nhật.',409);return {ok:true};
 }
 if(b.action==='read'){
 must(Number.isInteger(b.seq)&&b.seq>=0&&b.seq<=t.seq);
 await rpc('cx_read',{t:t.id,who:a.id,n:b.seq});return {ok:true};
 }
 if(b.action==='file'){
 const m=checked(await client.from('cx_messages').select('files').eq('thread',t.id).eq('seq',b.seq).maybeSingle());
 must(m?.files.some((f:{path:string})=>f.path===b.path),'Không có tệp này.',404);
 return checked(await files.createSignedUrl(b.path,90));
 }
 if(b.action==='send'||b.action==='status'){
 must(uuid(b.requestId)&&b.requestId!==a.id);const status=b.action==='status'?b.status:null;
 if(status!==null)must(t.kind!=='chat'&&statuses.includes(status)&&editScope!=='none'&&(t.owner_id===a.id||t.performers.includes(a.id)||editScope==='team'||editScope==='hospital'),'Bạn không có quyền cập nhật trạng thái.',403);
 const body=status?'Cập nhật trạng thái: '+status:str(b.body||'',6000),list=await attachments();must(body||list.length,'Nhập nội dung hoặc chọn tệp.');
 await rpc('cx_append',{t:t.id,who:a.id,txt:body,attachments:list,rid:b.requestId,new_status:status});return {ok:true};
 }
 throw new Fail('Thao tác không hợp lệ');
}
export async function POST(req:Request){
 try{return Response.json(await dispatch(req),{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){if(e instanceof Fail)return Response.json({error:e.message},{status:e.status});
 console.error('connect',typeof e==='object'&&e&&'code'in e?e.code:'request');
 return Response.json({error:'Không lưu hoặc tải được dữ liệu. Kiểm tra kết nối và cài đặt Supabase.'},{status:503});}
}
