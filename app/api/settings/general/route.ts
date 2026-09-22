import {NextResponse} from 'next/server';
import {hasSession} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const SHEET='CAI_DAT_HE_THONG';
const DEFAULT_UNIT_NAME='BỆNH VIỆN 115';
const DEFAULT_SOFTWARE_NAME='HỆ THỐNG QUẢN LÝ KSNK';
type AnyRecord=Record<string,any>;

function db(){const client=supabaseAdmin();if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');return client;}
function text(value:unknown){return value==null?'':String(value).trim();}
function clean(value:unknown,label:string,fallback:string){const result=text(value).replace(/\s+/g,' ');if(!result)return fallback;if(result.length>160)throw new Error(`${label} không được vượt quá 160 ký tự.`);return result;}
function cleanOptional(value:unknown,label:string,max=1000){const result=text(value);if(result.length>max)throw new Error(`${label} không được vượt quá ${max} ký tự.`);return result;}
async function readSettings(){const {data,error}=await db().from('ksnk_legacy_rows').select('row_no,legacy_id,data').eq('sheet_name',SHEET).eq('row_no',1).maybeSingle();if(error)throw error;return data as {row_no:number;legacy_id?:string|null;data:AnyRecord}|null;}

export async function GET(){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const row=await readSettings();const data=row?.data||{};
  return NextResponse.json({ok:true,unitName:clean(data['Tên đơn vị'],'Tên đơn vị',DEFAULT_UNIT_NAME),softwareName:clean(data['Tên hệ thống phần mềm'],'Tên hệ thống phần mềm',DEFAULT_SOFTWARE_NAME),cssdReportUrl:cleanOptional(data['Đường link dữ liệu DỤNG CỤ']||data['BC_CSSD_SOURCE_URL']||data['Đường link báo cáo DỤNG CỤ'],'Đường link dữ liệu DỤNG CỤ'),cssdSourceSheet:cleanOptional(data['Tên sheet dữ liệu DỤNG CỤ']||data['BC_CSSD_SOURCE_SHEET']||'DỤNG CỤ BẬN','Tên sheet dữ liệu DỤNG CỤ',160)||'DỤNG CỤ BẬN',cssdTargetPerDay:text(data['Mục tiêu bộ dụng cụ/ngày']||data['BC_CSSD_TARGET_PER_DAY'])},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('[general-settings:get]',error);return NextResponse.json({ok:false,error:'Không đọc được tên hiển thị hệ thống'},{status:503});}
}

export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({ok:false,error:'Yêu cầu không hợp lệ'},{status:403});
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const body=(await req.json()) as AnyRecord;const unitName=clean(body.unitName,'Tên đơn vị',DEFAULT_UNIT_NAME);const softwareName=clean(body.softwareName,'Tên hệ thống phần mềm',DEFAULT_SOFTWARE_NAME);const cssdReportUrl=cleanOptional(body.cssdReportUrl,'Đường link dữ liệu DỤNG CỤ');const cssdSourceSheet=cleanOptional(body.cssdSourceSheet,'Tên sheet dữ liệu DỤNG CỤ',160)||'DỤNG CỤ BẬN';const targetText=text(body.cssdTargetPerDay);const cssdTargetPerDay=targetText===''?'':String(Math.max(0,Number(targetText)||0));const old=await readSettings();
  const data={...(old?.data||{}),'Tên đơn vị':unitName,'Tên hệ thống phần mềm':softwareName,'Đường link dữ liệu DỤNG CỤ':cssdReportUrl,'Tên sheet dữ liệu DỤNG CỤ':cssdSourceSheet,'Mục tiêu bộ dụng cụ/ngày':cssdTargetPerDay,'BC_CSSD_SOURCE_URL':cssdReportUrl,'BC_CSSD_SOURCE_SHEET':cssdSourceSheet,'BC_CSSD_TARGET_PER_DAY':cssdTargetPerDay,'Cập nhật lúc':new Date().toISOString()};
  const {error}=await db().from('ksnk_legacy_rows').upsert({sheet_name:SHEET,row_no:1,legacy_id:old?.legacy_id||'CAI_DAT_HE_THONG',data},{onConflict:'sheet_name,row_no'});if(error)throw error;
  return NextResponse.json({ok:true,unitName,softwareName,cssdReportUrl,cssdSourceSheet,cssdTargetPerDay,message:'Đã lưu tên hiển thị và cấu hình nguồn dữ liệu DỤNG CỤ.'});
 }catch(error){console.error('[general-settings:post]',error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Không lưu được cài đặt hiển thị'},{status:503});}
}
