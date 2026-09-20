import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export const runtime='nodejs';

const fallbackUrl='https://swgpwbrtxvezkykablws.supabase.co';

export async function GET(){
 const db=supabaseAdmin();
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||fallbackUrl;
 const projectRef=supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co(?:\/|$)/)?.[1]||null;
 let supabaseDatabaseReachable=false;
 let settingsRowFound=false;
 let supabaseErrorCode:string|null=null;
 if(db){
  const {data,error}=await db.from('ksnk_settings').select('id').eq('id',1).maybeSingle();
  supabaseDatabaseReachable=!error;
  settingsRowFound=Boolean(data);
  supabaseErrorCode=error&&typeof error.code==='string'?error.code:null;
 }
 const sessionSecret=process.env.SESSION_SECRET||'';
 return NextResponse.json({
  ok:true,
  app:'QL-KSNK-NGOAIKHOA',
  supabaseProjectRef:projectRef,
  supabaseServerConfigured:!!db,
  supabaseDatabaseReachable,
  supabaseErrorCode,
  settingsRowFound,
  sessionSecretConfigured:sessionSecret.length>=32,
  defaultPasswordConfigured:Boolean(process.env.APP_DEFAULT_PASSWORD)
 });
}
