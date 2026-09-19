import {createHmac,timingSafeEqual} from 'crypto';
import {cookies} from 'next/headers';

const COOKIE='ksnk_session';
function secret(){return process.env.SESSION_SECRET||''}
function signature(payload:string){return createHmac('sha256',secret()).update(payload).digest('hex')}
export function makeSession(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+12*60*60*1000})).toString('base64url');return payload+'.'+signature(payload)}
export async function hasSession(){
 const token=(await cookies()).get(COOKIE)?.value||'',dot=token.lastIndexOf('.');
 if(!secret()||dot<1)return false;
 const payload=token.slice(0,dot),given=Buffer.from(token.slice(dot+1)),expected=Buffer.from(signature(payload));
 if(given.length!==expected.length||!timingSafeEqual(given,expected))return false;
 try{return JSON.parse(Buffer.from(payload,'base64url').toString()).exp>Date.now()}catch{return false}
}
export const sessionCookie={name:COOKIE,options:{httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*60*60}};
