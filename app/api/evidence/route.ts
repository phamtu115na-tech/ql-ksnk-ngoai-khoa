import {NextResponse} from 'next/server';
import {supabaseAdmin} from '../../../lib/supabase';
import {hasSession} from '../../../lib/auth';

export const runtime='nodejs';
const MAX_FILE_SIZE=8*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'documents';

function safeName(name:string){return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-100)}

export async function POST(req:Request){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const db=supabaseAdmin();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const form=await req.formData();const file=form.get('file');
  const module=String(form.get('module')||'');const legacyId=String(form.get('legacy_id')||'');
  if(!(file instanceof File)||!module||!legacyId)return NextResponse.json({ok:false,error:'Thiếu tệp hoặc mã công việc'},{status:400});
  if(file.size>MAX_FILE_SIZE||!ALLOWED.has(file.type))return NextResponse.json({ok:false,error:'Chỉ nhận JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX tối đa 8 MB'},{status:400});
  const path=`${module}/${legacyId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const {error:uploadError}=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(uploadError)throw new Error(`Không lưu được tài liệu minh chứng vào Storage bucket "${BUCKET}": ${uploadError.message}`);
  const {data:record,error}=await db.from('ksnk_evidence').insert({module,legacy_id:legacyId,file_name:file.name,storage_path:path,mime_type:file.type}).select('id,file_name,mime_type,created_at').single();
  if(error){await db.storage.from(BUCKET).remove([path]);throw error;}
  return NextResponse.json({ok:true,file:record});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

export async function GET(req:Request){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const db=supabaseAdmin();if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const u=new URL(req.url),module=u.searchParams.get('module')||'',legacyId=u.searchParams.get('legacy_id')||'';
  const {data,error}=await db.from('ksnk_evidence').select('id,file_name,storage_path,mime_type,created_at').eq('module',module).eq('legacy_id',legacyId).order('created_at',{ascending:false});
  if(error)throw error;
  const files=await Promise.all((data||[]).map(async f=>{const {data:signed}=await db.storage.from(BUCKET).createSignedUrl(f.storage_path,600);return {...f,storage_path:undefined,url:signed?.signedUrl||''}}));
  return NextResponse.json({ok:true,files},{headers:{'Cache-Control':'private, max-age=30'}});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
