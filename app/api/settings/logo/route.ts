import {NextResponse} from 'next/server';
import {hasSession} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const SHEET='CAI_DAT_HE_THONG';
const BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'documents';
const MAX_FILE_SIZE=4*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
type AnyRecord=Record<string,any>;

function db(){const client=supabaseAdmin();if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');return client;}
function text(value:unknown){return value==null?'':String(value).trim();}
function safeName(value:string){return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-80)||'logo';}
async function readSettings(){const {data,error}=await db().from('ksnk_legacy_rows').select('row_no,legacy_id,data').eq('sheet_name',SHEET).eq('row_no',1).maybeSingle();if(error)throw error;return data as {row_no:number;legacy_id?:string|null;data:AnyRecord}|null;}
async function signedUrl(path:string){if(!path)return '';const {data}=await db().storage.from(BUCKET).createSignedUrl(path,600);return data?.signedUrl||'';}
async function ensureBucket(client:ReturnType<typeof supabaseAdmin>){if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');const existing=await client.storage.getBucket(BUCKET);if(existing.data)return;const created=await client.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_FILE_SIZE,allowedMimeTypes:[...ALLOWED]});if(!created.error)return;const after=await client.storage.getBucket(BUCKET);if(!after.data)throw created.error;}

export async function GET(){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{const row=await readSettings();const logoPath=text(row?.data?.['Logo path']||row?.data?.['Logo tệp']);return NextResponse.json({ok:true,logoPath,logoUrl:await signedUrl(logoPath)},{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){console.error('[logo-settings:get]',error);return NextResponse.json({ok:false,error:'Không đọc được logo cài đặt'},{status:503});}
}

export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({ok:false,error:'Yêu cầu không hợp lệ'},{status:403});
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const client=db();const form=await req.formData();const file=form.get('file');if(!(file instanceof File))return NextResponse.json({ok:false,error:'Vui lòng chọn tệp logo.'},{status:400});if(!ALLOWED.has(file.type)||file.size<=0||file.size>MAX_FILE_SIZE)return NextResponse.json({ok:false,error:'Logo chỉ nhận JPG, PNG hoặc WEBP, tối đa 4 MB.'},{status:400});
  await ensureBucket(client);const old=await readSettings();const extension=file.type.split('/')[1]||'png';const path=`settings/logo-${crypto.randomUUID()}-${safeName(file.name)}.${extension}`;const uploaded=await client.storage.from(BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(uploaded.error)throw uploaded.error;
  const data={...(old?.data||{}),'Logo path':path,'Logo tệp':file.name,'Cập nhật logo lúc':new Date().toISOString()};const {error}=await client.from('ksnk_legacy_rows').upsert({sheet_name:SHEET,row_no:1,legacy_id:old?.legacy_id||'CAI_DAT_HE_THONG',data},{onConflict:'sheet_name,row_no'});if(error){await client.storage.from(BUCKET).remove([path]);throw error;}
  const oldPath=text(old?.data?.['Logo path']);if(oldPath&&oldPath!==path)await client.storage.from(BUCKET).remove([oldPath]);
  return NextResponse.json({ok:true,logoPath:path,logoUrl:await signedUrl(path),message:'Đã cập nhật logo hệ thống.'});
 }catch(error){console.error('[logo-settings:post]',error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Không lưu được logo hệ thống'},{status:503});}
}
