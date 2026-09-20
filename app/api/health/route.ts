import { NextResponse } from 'next/server';
import { supabaseAdminCandidates, supabaseConfigInfo } from '../../../lib/supabase';

export const runtime='nodejs';

export async function GET(){
 const dbs=supabaseAdminCandidates();
 const config=supabaseConfigInfo();
 let supabaseDatabaseReachable=false;
 let settingsRowFound=false;
 let supabaseErrorCode:string|null=null;
 for(const db of dbs){
  const {data,error}=await db.from('ksnk_settings').select('id').eq('id',1).maybeSingle();
  if(!error){
   supabaseDatabaseReachable=true;
   if(data)settingsRowFound=true;
   supabaseErrorCode=null;
   if(data)break;
   continue;
  }
  if(typeof error.code==='string')supabaseErrorCode=error.code;
 }
 const sessionSecret=process.env.SESSION_SECRET||'';
 return NextResponse.json({
  ok:true,
  app:'QL-KSNK-NGOAIKHOA',
  deploymentVersion:'supabase-config-v4',
  supabaseConfiguredProjectRef:config.configuredProjectRef,
  supabaseProjectRef:config.effectiveProjectRef,
  supabaseServerConfigured:dbs.length>0,
  supabaseDatabaseReachable,
  supabaseErrorCode,
  settingsRowFound,
  serverKeyCandidateCount:dbs.length,
  sessionSecretConfigured:sessionSecret.length>=32,
  defaultPasswordConfigured:Boolean(process.env.APP_DEFAULT_PASSWORD)
 });
}
