import {actor,db,personFields,Person} from '../../../lib/auth';
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
type Thread={id:string;title:string;owner_id:string;performers:string[];observers:string[];units:string[];kind:string;seq:number;status:string;due:string;note:string};
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
 if(b.action==='me')return {me:a,people:await people(a.admin)};
 if(b.action==='sourceThread'){
 must(['reminder','task'].includes(b.kind)&&Number.isSafeInteger(b.row)&&b.row>0);
 const source=checked(await client.from('nk_legacy_rows').select('id,legacy_id,data').eq('sheet_name',b.kind==='task'?'GIAO VIỆC':'NHAC_VIEC_GHI_CHU').eq('row_no',b.row).maybeSingle());
 must(source&&(!b.ref||[source.legacy_id,source.data?.ID,source.data?.['MÃ NHẮC VIỆC']].includes(b.ref)),'Hồ sơ đã thay đổi. Tải lại danh sách.',404);
 const item=checked(await client.from('cx_threads').select('*').eq('source_row',source.id).maybeSingle());
 must(item&&member(item,a),'Chỉ người tham gia việc này được mở trò chuyện.',403);
 return {id:item.id};
 }
 if(b.action==='history'){
 must(['task','reminder'].includes(b.kind));
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
 return {staff,pending};
 }
 if(b.action==='account'){
 must(a.admin,'Chỉ quản trị viên được cấp tài khoản.',403);
 const name=str(b.name,120),username=str(b.username,50).toLowerCase();must(name&&/^[a-z0-9._-]{3,50}$/.test(username)&&b.unit===unit);
 const patch:Record<string,unknown>={name,username,unit:b.unit,legacy_operator:b.legacy===true,active:b.active===true,version:randomUUID()};
 if(b.staffCode){must(typeof b.staffCode==='string'&&b.staffCode.length<=150);patch.staff_code=b.staffCode;}
 if(b.code)patch.pending_login=false;
 if(b.code||!b.id){const code=str(b.code,72);must(code.length>=12&&Buffer.byteLength(code)<=72,'Mã cần ít nhất 12 ký tự và tối đa 72 byte.');patch.credential=await hash(code,12);}
 if(b.id){
 must(uuid(b.id)&&uuid(b.version)&&b.id!==a.id,'Dùng mục Đổi mã để cập nhật tài khoản đang đăng nhập.');
 const row=await client.from('cx_people').update(patch).eq('id',b.id).eq('unit',unit).eq('admin',false).eq('version',b.version).select('id').maybeSingle();if(row.error?.code==='23505')throw new Fail('Tên đăng nhập hoặc hồ sơ nhân viên đã được sử dụng');must(checked(row),'Tài khoản đã thay đổi. Hãy tải lại.',409);
 }else{const r=await client.from('cx_people').insert(patch);if(r.error?.code==='23505')throw new Fail('Tên đăng nhập hoặc hồ sơ nhân viên đã được sử dụng');checked(r);}
 return {ok:true};
 }
 if(b.action==='counts'){const [badges,latest]=await Promise.all([rpc('cx_badges',{who:a.id,scope}),rpc('cx_notification',{who:a.id})]);return {badges,latest};}
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
 const p=ids(b.performers),o=ids(b.observers||[]);must(p.length,'Chọn người thực hiện hoặc người nhận.');
 if(kind==='chat')must(p.length===1&&p[0]!==a.id&&!o.length);
 const selected=(await people()).filter(x=>(x.active||(kind!=='chat'&&x.pending_login))&&(p.includes(x.id)||o.includes(x.id)));
 must(new Set([...p,...o]).size===selected.length,'Người nhận không thuộc phạm vi tài khoản.',403);
 const u=[...new Set([a.unit,...selected.map(x=>x.unit)])],label=kind==='chat'?'Trao đổi riêng':str(b.title,180);
 must(label);const d=b.due||null;must(!d||/^\d{4}-\d{2}-\d{2}$/.test(d));
 const id=await rpc('cx_create',{t:b.id,k:kind,label,who:a.id,p,o,u,d,details:str(b.note||'',6000),pk:kind==='chat'?[a.id,p[0]].sort().join(':'):null,attachments:await attachments()});return {id};
 }
 must(uuid(b.id));const t=checked(await client.from('cx_threads').select('*').eq('id',b.id).maybeSingle()) as Thread;
 must(t&&member(t,a),'Chỉ thành viên của việc được mở trao đổi.',403);
 if(b.action==='thread'){
 const before=Number(b.before)||2147483647;
 const rows=checked(await client.from('cx_messages').select('*').eq('thread',t.id).lt('seq',before).order('seq',{ascending:false}).limit(50))||[];
 const participants=[...new Set([t.owner_id,...t.performers,...t.observers].filter(Boolean))];
 const members=checked(await client.from('cx_people').select('id,name,username,unit').in('id',participants))||[];
 return {item:t,members,rows:rows.reverse()};
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
 must(uuid(b.requestId));const status=b.action==='status'?b.status:null;
 if(status!==null)must(t.kind!=='chat'&&statuses.includes(status)&&(t.owner_id===a.id||t.performers.includes(a.id)),'Bạn không có quyền cập nhật trạng thái.',403);
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
