import {NextResponse} from 'next/server';
import {hasSession} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';
import {loadCssdReport} from '../../../../lib/cssd-report';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type AnyRecord=Record<string,any>;
const SHEET='CAI_DAT_HE_THONG';
function text(value:unknown){return value==null?'':String(value).trim();}
function db(){const client=supabaseAdmin();if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');return client;}

export async function GET(req:Request){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const url=new URL(req.url);const from=text(url.searchParams.get('from'));const to=text(url.searchParams.get('to'));const {data,error}=await db().from('ksnk_legacy_rows').select('data').eq('sheet_name',SHEET).eq('row_no',1).maybeSingle();if(error)throw error;const settings=(data?.data||{}) as AnyRecord;const result=await loadCssdReport({cssdReportUrl:settings['Đường link dữ liệu DỤNG CỤ']||settings['BC_CSSD_SOURCE_URL']||settings['Đường link báo cáo DỤNG CỤ'],cssdSourceSheet:settings['Tên sheet dữ liệu DỤNG CỤ']||settings['BC_CSSD_SOURCE_SHEET'],cssdTargetPerDay:settings['Mục tiêu bộ dụng cụ/ngày']||settings['BC_CSSD_TARGET_PER_DAY']},from,to);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('[cssd-report:get]',error);return NextResponse.json({ok:false,configured:true,error:error instanceof Error?error.message:'Không đọc được nguồn dữ liệu DỤNG CỤ'},{status:503});}
}
