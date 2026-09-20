import {NextResponse} from 'next/server';
import {hasSession} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const MAX_BATCH=500;
const MAX_DATA_BYTES=200000;

type ImportRow={
 sheet_name:string;
 row_no:number;
 legacy_id?:string;
 data:Record<string,unknown>;
};

function validRow(value:unknown):value is ImportRow{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Partial<ImportRow>;
 return typeof row.sheet_name==='string'&&row.sheet_name.trim().length>0
  &&Number.isInteger(row.row_no)&&Number(row.row_no)>0
  &&!!row.data&&typeof row.data==='object'&&!Array.isArray(row.data);
}

export async function POST(req:Request){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const body=await req.json();
  if(!Array.isArray(body?.rows))return NextResponse.json({ok:false,error:'Payload phải có mảng rows'},{status:400});
  if(body.rows.length>MAX_BATCH)return NextResponse.json({ok:false,error:'Mỗi lần tối đa '+MAX_BATCH+' dòng'},{status:413});
  const rows=body.rows as unknown[];
  const seen=new Set<string>();
  const normalized:ImportRow[]=[];
  for(const value of rows){
   if(!validRow(value))return NextResponse.json({ok:false,error:'Dòng dữ liệu không hợp lệ'},{status:400});
   const row=value as ImportRow;
   const sheet=row.sheet_name.trim();
   const key=sheet+'\\u0000'+row.row_no;
   if(seen.has(key))return NextResponse.json({ok:false,error:'Trùng sheet_name/row_no trong cùng một lô'},{status:409});
   seen.add(key);
   const dataBytes=Buffer.byteLength(JSON.stringify(row.data),'utf8');
   if(dataBytes>MAX_DATA_BYTES)return NextResponse.json({ok:false,error:'Một dòng dữ liệu vượt quá giới hạn kích thước'},{status:413});
   normalized.push({
    sheet_name:sheet,
    row_no:row.row_no,
    legacy_id:row.legacy_id?String(row.legacy_id):sheet+':'+row.row_no,
    data:row.data
   });
  }
  if(!normalized.length)return NextResponse.json({ok:true,accepted:0});
  const db=supabaseAdmin();
  if(!db)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const {error}=await db.from('ksnk_legacy_rows').upsert(normalized,{onConflict:'sheet_name,row_no'});
  if(error)throw error;
  return NextResponse.json({
   ok:true,
   accepted:normalized.length,
   sheets:[...new Set(normalized.map(row=>row.sheet_name))]
  });
 }catch(error){
  console.error('[workbook-import] failed:',error instanceof Error?error.message:error);
  return NextResponse.json({ok:false,error:'Không nhập được dữ liệu workbook'},{status:503});
 }
}
