import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_REF='swgpwbrtxvezkykablws';
export const SUPABASE_FALLBACK_URL='https://swgpwbrtxvezkykablws.supabase.co';
const fallbackAnon='sb_publishable_9r1va6JjYbcbXmnDn7Z6CQ_-VrBW0Yu';

function normalize(value?:string){
 return value?.trim().replace(/^(['"])(.*)\\1$/,'$2')||'';
}

function projectRefFromUrl(value:string){
 return value.match(/^https:\/\/([^.]+)\.supabase\.co(?:\/|$)/)?.[1]||null;
}

function configuredUrl(){
 return normalize(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function effectiveSupabaseUrl(){
 const url=configuredUrl();
 return projectRefFromUrl(url)===SUPABASE_PROJECT_REF?url:SUPABASE_FALLBACK_URL;
}

export function supabaseConfigInfo(){
 const url=configuredUrl();
 return {
  configuredProjectRef:projectRefFromUrl(url),
  effectiveProjectRef:projectRefFromUrl(effectiveSupabaseUrl())
 };
}

function normalizedServerKeys(){
 const publicKey=normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
 const rawKeys=[process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY]
  .map(normalize)
  .filter(Boolean);
 return [...new Set(rawKeys)].filter(key=>{
  if(key===publicKey||key.startsWith('sb_publishable_'))return false;
  const parts=key.split('.');
  if(parts.length===3){
   try{
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    if(payload?.role==='anon')return false;
   }catch{}
  }
  return true;
 });
}

export function supabaseAdminCandidates(){
 const url=effectiveSupabaseUrl();
 return normalizedServerKeys().map(key=>createClient(url,key,{auth:{persistSession:false}}));
}

export function supabaseBrowser(){
 const configured=projectRefFromUrl(configuredUrl())===SUPABASE_PROJECT_REF;
 return createClient(
  effectiveSupabaseUrl(),
  configured?normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)||fallbackAnon:fallbackAnon
 );
}

export function supabaseAdmin(){
 return supabaseAdminCandidates()[0]||null;
}
