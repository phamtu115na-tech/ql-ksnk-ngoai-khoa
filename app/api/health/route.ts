import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export const runtime='nodejs';

export async function GET(){
 const db=supabaseAdmin();
 let supabaseDatabaseReachable=false;
 let settingsRowFound=false;
 if(db){
  const {data,error}=await db.from('ksnk_settings').select('id').eq('id',1).maybeSingle();
  supabaseDatabaseReachable=!error;
  settingsRowFound=Boolean(data);
 }
 const sessionSecret=process.env.SESSION_SECRET||'';
 return NextResponse.json({
  ok:true,
  app:'QL-KSNK-NGOAIKHOA',
  supabaseServerConfigured:!!db,
  supabaseDatabaseReachable,
  settingsRowFound,
  sessionSecretConfigured:sessionSecret.length>=32,
  defaultPasswordConfigured:Boolean(process.env.APP_DEFAULT_PASSWORD)
 });
}
