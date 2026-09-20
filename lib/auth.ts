import {createHmac,timingSafeEqual} from 'crypto';
import {cookies} from 'next/headers';
import {compare} from 'bcryptjs';
import {supabaseAdmin} from './supabase';

const COOKIE='ksnk_session';
function secret(){return process.env.SESSION_SECRET||''}
function signature(payload:string){return createHmac('sha256',secret()).update(payload).digest('hex')}
export async function storedPassword(){
 const db=supabaseAdmin();if(!db)throw new Error('Thiếu cấu hình Supabase');
 const {data,error}=await db.from('ksnk_settings').select('password_hash').eq('id',1).maybeSingle();
 if(error){
  const code=typeof error.code==='string'?' ['+error.code+']':'';
  throw new Error('Không đọc được cấu hình đăng nhập'+code);
 }
 return data?.password_hash as string|null|undefined;
}
export async function verifyPassword(password:string,hash:string|null|undefined){
 if(hash)return compare(password,hash);
 const expected=process.env.APP_DEFAULT_PASSWORD||'';
 const a=Buffer.from(password),b=Buffer.from(expected);
 return Boolean(expected)&&a.length===b.length&&timingSafeEqual(a,b);
}
function version(hash:string|null|undefined){return signature('credential:'+ (hash||process.env.APP_DEFAULT_PASSWORD||''))}
export function makeSession(hash?:string|null){
 if(secret().length<32)throw new Error('SESSION_SECRET cần ít nhất 32 ký tự');
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+12*60*60*1000,v:version(hash)})).toString('base64url');return payload+'.'+signature(payload);
}
export async function hasSession(){
 const token=(await cookies()).get(COOKIE)?.value||'',dot=token.lastIndexOf('.');
 if(!secret()||dot<1)return false;
 const payload=token.slice(0,dot),given=Buffer.from(token.slice(dot+1)),expected=Buffer.from(signature(payload));
 if(given.length!==expected.length||!timingSafeEqual(given,expected))return false;
 try{const claims=JSON.parse(Buffer.from(payload,'base64url').toString());return claims.exp>Date.now()&&claims.v===version(await storedPassword())}catch{return false}
}
export const sessionCookie={name:COOKIE,options:{httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*60*60}};
