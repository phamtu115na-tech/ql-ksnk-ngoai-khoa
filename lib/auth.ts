import {createHmac,timingSafeEqual} from 'crypto';
import {cookies} from 'next/headers';
import {compare,hash} from 'bcryptjs';
import {supabaseAdminCandidates} from './supabase';

const COOKIE='ksnk_session';
function secret(){return process.env.SESSION_SECRET||''}
function signature(payload:string){return createHmac('sha256',secret()).update(payload).digest('hex')}
export async function storedPassword(){
 const dbs=supabaseAdminCandidates();
 if(!dbs.length)throw new Error('Thiếu cấu hình Supabase');
 let successfulQuery=false;
 let lastCode='';
 for(const db of dbs){
  const {data,error}=await db.from('ksnk_settings').select('password_hash').eq('id',1).maybeSingle();
  if(!error){
   successfulQuery=true;
   if(data?.password_hash)return data.password_hash as string;
   continue;
  }
  if(typeof error.code==='string')lastCode=error.code;
 }
 if(successfulQuery)return undefined;
 throw new Error('Không đọc được cấu hình đăng nhập'+(lastCode?' ['+lastCode+']':''));
}

export async function ensureDefaultPasswordStored(){
 const expected=process.env.APP_DEFAULT_PASSWORD||'';
 if(!expected)return;
 const dbs=supabaseAdminCandidates();
 if(!dbs.length)return;
 const passwordHash=await hash(expected,12);
 for(const db of dbs){
  const {data,error}=await db.from('ksnk_settings').select('id,password_hash').eq('id',1).maybeSingle();
  if(error)continue;
  if(data?.password_hash)return;
  const write=data
   ? await db.from('ksnk_settings').update({password_hash:passwordHash,updated_at:new Date().toISOString()}).eq('id',1)
   : await db.from('ksnk_settings').insert({id:1,hospital_name:'BỆNH VIỆN 115',password_hash:passwordHash});
  if(!write.error)return;
 }
}

export async function verifyPassword(password:string,hashValue:string|null|undefined){
 if(hashValue)return compare(password,hashValue);
 const expected=process.env.APP_DEFAULT_PASSWORD||'';
 const a=Buffer.from(password),b=Buffer.from(expected);
 return Boolean(expected)&&a.length===b.length&&timingSafeEqual(a,b);
}
function version(hashValue:string|null|undefined){return signature('credential:'+ (hashValue||process.env.APP_DEFAULT_PASSWORD||''))}
export function makeSession(hashValue?:string|null){
 if(secret().length<32)throw new Error('SESSION_SECRET cần ít nhất 32 ký tự');
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+12*60*60*1000,v:version(hashValue)})).toString('base64url');return payload+'.'+signature(payload);
}
export async function hasSession(){
 const token=(await cookies()).get(COOKIE)?.value||'',dot=token.lastIndexOf('.');
 if(!secret()||dot<1)return false;
 const payload=token.slice(0,dot),given=Buffer.from(token.slice(dot+1)),expected=Buffer.from(signature(payload));
 if(given.length!==expected.length||!timingSafeEqual(given,expected))return false;
 try{const claims=JSON.parse(Buffer.from(payload,'base64url').toString());return claims.exp>Date.now()&&claims.v===version(await storedPassword())}catch{return false}
}
export const sessionCookie={name:COOKIE,options:{httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*60*60}};
