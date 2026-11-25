import {NextResponse} from 'next/server';
import {supabaseAdmin,effectiveSupabaseUrl} from '../../../lib/supabase';
import {evidenceStoragePath} from '../../../lib/evidence-url';
import {actor,type Person} from '../../../lib/auth';
import {featureScope,inFeatureScope} from '../../../lib/feature-permissions';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_FILE_SIZE=8*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip','application/x-7z-compressed','application/x-rar-compressed','application/octet-stream','application/x-msdownload']);
const BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'documents';

function safeName(name:string){return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-100)}

async function ensureEvidenceBucket(db:ReturnType<typeof supabaseAdmin>){
 if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
 const existing=await db.storage.getBucket(BUCKET);
 if(existing.data)return;
 const created=await db.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_FILE_SIZE,allowedMimeTypes:[...ALLOWED]});
 if(!created.error)return;
 // Concurrent first uploads can race while creating the same bucket. Re-read
 // before surfacing the error so an already-created bucket remains usable.
 const after=await db.storage.getBucket(BUCKET);
 if(!after.data)throw created.error;
}

function sameName(a:unknown,b:unknown){
 const normalize=(value:unknown)=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ');
 return normalize(a)===normalize(b);
}
function assignedNames(value:unknown){return String(value??'').split(/[,;|]/).map(name=>name.trim()).filter(Boolean);}
async function workEvidenceAllowed(user:Person,module:'tasks'|'reminders',reference:string,editing:boolean){
 if(!reference||reference.length>160)return false;
 const scope=await featureScope(user,module,editing?'edit':'view');
 if(scope==='none')return false;
 const client=supabaseAdmin();if(!client)return false;
 const sheet=module==='tasks'?'GIAO VIỆC':'NHAC_VIEC_GHI_CHU';
 // Evidence records historically point to a legacy ID, a task code, or ROW<number>.
 // Always resolve the actual database row before deciding who may access a file.
 const {data:rows,error}=await client.from('nk_legacy_rows')
  .select('id,row_no,legacy_id,data').eq('sheet_name',sheet);
 if(error)throw error;
 const matches=(rows||[]).filter(row=>{
  const data=row.data as Record<string,unknown>||{};
  const id=module==='tasks'?data['ID']??data['Mã công việc']:data['MÃ NHẮC VIỆC']??data['Mã nhắc việc'];
  return [row.legacy_id,id,'ROW'+row.row_no].some(value=>Boolean(value)&&String(value)===reference);
 });
 if(matches.length!==1)return false; // Never guess a cross-department file owner.
 const row=matches[0],data=row.data as Record<string,unknown>||{};
 const department=String(data['Bộ phận']||data['Thuộc bộ phận']||'').trim();
 const names=assignedNames(module==='tasks'?data['Người thực hiện']??data['Người chịu trách nhiệm']:data['NGƯỜI LIÊN QUAN']??data['Người liên quan']);
 const {data:linked,error:threadError}=await client.from('cx_threads').select('owner_id,performers,units')
  .eq('source_row',row.id).eq('kind',module==='tasks'?'task':'reminder').limit(1);
 if(threadError)throw threadError;
 if((linked||[]).length>1)return false;
 const thread=linked?.[0];
 if(thread&&!Array.isArray(thread.units))return false;
 if(thread&&!thread.units.includes('surgery'))return false;
 // A report-scoped delegation is based on the original source's team,
 // never on an arbitrary evidence filename or a client-supplied team filter.
 const teamDept=String(user.team_department||user.department||'').trim();
 if(scope==='hospital')return true;
 if(scope==='team'&&teamDept&&department&&sameName(department,teamDept))return true;
 if(thread){
  if(!Array.isArray(thread.units)||!thread.units.includes('surgery'))return false;
  if(thread.owner_id===user.id||Array.isArray(thread.performers)&&thread.performers.includes(user.id))return true;
 }
 const {data:staff,error:staffError}=await client.from('nk_legacy_rows')
  .select('data').eq('sheet_name','DM_NHANVIEN');
 if(staffError)throw staffError;
 const directory=(staff||[]).map(row=>row.data as Record<string,unknown>||{});
 const userStaff=directory.filter(person=>user.staff_code
  ?sameName(person['Mã NV'],user.staff_code)
  :sameName(person['Họ và tên']??person['Họ tên'],user.name)&&sameName(person['Bộ phận'],user.department));
 if(!thread&&userStaff.length===1){
  const sender=module==='tasks'?data['Người giao việc']??data['Người giao']??data['Người tạo']:data['NGƯỜI NHẮC']??data['Người nhắc'];
  const identity=userStaff[0]['Họ và tên']??userStaff[0]['Họ tên'];
  if(sameName(sender,identity)||names.some(name=>sameName(name,identity)))return true;
 }
 const teamStaff=names.length>0&&names.every(name=>directory.some(person=>
  sameName(person['Họ và tên']??person['Họ tên'],name)&&sameName(person['Bộ phận'],teamDept)));
 return Boolean(scope==='team'&&teamDept&&!department&&teamStaff);
}
/**
 * Read the original plan/violation/issue row before resolving its evidence.
 * A team leader may access only files belonging to that team; report filtering
 * and user-supplied evidence IDs never authorize access by themselves.
 */
async function scopedRecordEvidenceAllowed(user:Person,module:'plans'|'violations'|'issues',reference:string,editing:boolean){
 if(!reference||reference.length>160)return false;
 const scope=await featureScope(user,module,editing?'edit':'view');
 if(scope==='none')return false;
 const client=supabaseAdmin();if(!client)return false;
 const sheets={plans:['KE_HOACH_TUAN','KE_HOACH_THANG'],
  violations:['THEODOI_VIPHAM'],issues:['TON_TAI_KIEN_NGHI']};
 const {data,error}=await client.from('nk_legacy_rows')
  .select('row_no,legacy_id,data').in('sheet_name',sheets[module]);
 if(error)throw error;
 const matched=(data||[]).filter(row=>{
  const detail=row.data as Record<string,unknown>||{};
  return [row.legacy_id,detail['ID'],detail['Mã KH'],detail['Mã kế hoạch'],
   detail['Mã VP'],detail['Mã vi phạm'],'ROW'+row.row_no].some(id=>id!=null&&String(id)===reference);
 });
 if(matched.length!==1)return false; // Never guess a cross-team file owner.
 const detail=matched[0].data as Record<string,unknown>||{};
 const unit=String(detail['unitId']||detail['Đơn vị']||detail['Bệnh viện']||'').trim();
 if(unit&&!['surgery','ngoai khoa','benh vien ngoai khoa 115 nghe an'].some(x=>sameName(unit,x)))return false;
 const department=detail['Bộ phận']||detail['Thuộc bộ phận']||detail['department'];
 const owner=detail['Người phụ trách']||detail['Người thực hiện']||
  detail['Họ tên']||detail['Nhân viên']||detail['Người bị ghi nhận'];
 const staffId=detail['Mã NV']||detail['Mã nhân viên'];
 return inFeatureScope(user,scope,department,staffId,owner);
}
async function evidenceAllowed(user:Person,module:string,reference:string,editing=false){
 if(user.admin||user.legacy_operator&&user.work_view&&(!editing||user.work_edit))return true;
 if((module==='tasks'||module==='reminders')&&reference)
  return workEvidenceAllowed(user,module,reference,editing);
 if((module==='plans'||module==='violations'||module==='issues')&&reference)
  return scopedRecordEvidenceAllowed(user,module,reference,editing);
 if(module!=='checklists'||!reference||!user.team_lead)return false;
 const response=await supabaseAdmin()?.rpc('nk_checklist_evidence_access',{who:user.id,ref:reference,editing});
 return response?.data===true;
}

export async function POST(req:Request){
 const user=await actor();if(!user)return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const db=supabaseAdmin();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const form=await req.formData();const file=form.get('file');
  const module=String(form.get('module')||'');const legacyId=String(form.get('legacy_id')||'');
  if(!await evidenceAllowed(user,module,legacyId,true))return NextResponse.json({ok:false,error:'Minh chứng ngoài phạm vi bộ phận'},{status:403});
  if(!(file instanceof File)||!module||!legacyId)return NextResponse.json({ok:false,error:'Thiếu tệp hoặc mã công việc'},{status:400});
  if(file.size>MAX_FILE_SIZE||!ALLOWED.has(file.type))return NextResponse.json({ok:false,error:'Chỉ nhận JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX, ZIP, 7Z, RAR hoặc EXE tối đa 8 MB'},{status:400});
  await ensureEvidenceBucket(db);
  const path=`${module}/${legacyId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const {error:uploadError}=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(uploadError)throw new Error(`Không lưu được tài liệu minh chứng vào Storage bucket "${BUCKET}": ${uploadError.message}`);
  const {data:record,error}=await db.from('ksnk_evidence').insert({module,legacy_id:legacyId,file_name:file.name,storage_path:path,mime_type:file.type}).select('id,file_name,mime_type,created_at').single();
  if(error){await db.storage.from(BUCKET).remove([path]);throw error;}
  return NextResponse.json({ok:true,file:record});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

export async function GET(req:Request){
 const user=await actor();if(!user)return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const db=supabaseAdmin();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const u=new URL(req.url),module=u.searchParams.get('module')||'',legacyId=u.searchParams.get('legacy_id')||'';
  if(u.searchParams.get('open')==='1'){
   const id=u.searchParams.get('id');const reference=u.searchParams.get('reference');
   let query=db.from('ksnk_evidence').select('id,file_name,storage_path,mime_type,module,legacy_id');
   if(id)query=query.eq('id',id);
   else if(reference){const path=evidenceStoragePath(reference,effectiveSupabaseUrl(),BUCKET);if(!path)return NextResponse.json({ok:false,error:'Liên kết không thuộc kho minh chứng của hệ thống.'},{status:400});query=query.eq('storage_path',path);}
   else return NextResponse.json({ok:false,error:'Thiếu mã tệp.'},{status:400});
   const {data:records,error:lookupError}=await query.limit(1);if(lookupError)throw lookupError;
   const record=records?.[0];if(!record)return NextResponse.json({ok:false,error:'Không tìm thấy tệp minh chứng hoặc tệp đã bị xóa.'},{status:404});
   if(!await evidenceAllowed(user,record.module,record.legacy_id))return NextResponse.json({ok:false,error:'Minh chứng ngoài phạm vi bộ phận'},{status:403});
   const {data:file,error:downloadError}=await db.storage.from(BUCKET).download(record.storage_path);
   if(downloadError||!file)throw new Error('Không tải được tệp minh chứng. '+(downloadError?.message||''));
   const inline=['image/jpeg','image/png','image/webp','application/pdf'].includes(record.mime_type);
   return new Response(file.stream(),{headers:{'Content-Type':record.mime_type||'application/octet-stream','Content-Disposition':`${inline?'inline':'attachment'}; filename="${safeName(record.file_name)}"; filename*=UTF-8''${encodeURIComponent(record.file_name).replace(/'/g,'%27')}`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
  }
  if(!await evidenceAllowed(user,module,legacyId))return NextResponse.json({ok:false,error:'Minh chứng ngoài phạm vi bộ phận'},{status:403});
  const {data,error}=await db.from('ksnk_evidence').select('id,file_name,storage_path,mime_type,created_at').eq('module',module).eq('legacy_id',legacyId).order('created_at',{ascending:false});
  if(error)throw error;
  const files=(data||[]).map(f=>({...f,storage_path:undefined,url:'/api/evidence?open=1&id='+encodeURIComponent(String(f.id))}));
  return NextResponse.json({ok:true,files},{headers:{'Cache-Control':'private, no-store, max-age=0'}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

export async function DELETE(req:Request){
 const user=await actor();if(!user)return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const db=supabaseAdmin();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const id=new URL(req.url).searchParams.get('id')||'';
  if(!id)return NextResponse.json({ok:false,error:'Thiếu mã tệp minh chứng'},{status:400});
  const {data:record,error:readError}=await db.from('ksnk_evidence').select('id,storage_path,module,legacy_id').eq('id',id).maybeSingle();
  if(readError)throw readError;
  if(!record)return NextResponse.json({ok:false,error:'Không tìm thấy tệp minh chứng'},{status:404});
  if(!await evidenceAllowed(user,record.module,record.legacy_id,true))
   return NextResponse.json({ok:false,error:'Không có quyền xóa minh chứng của tác vụ này.'},{status:403});
  if(record.storage_path){
   const {error:storageError}=await db.storage.from(BUCKET).remove([record.storage_path]);
   if(storageError)throw storageError;
  }
  const {error}=await db.from('ksnk_evidence').delete().eq('id',id);
  if(error)throw error;
  return NextResponse.json({ok:true,id});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
