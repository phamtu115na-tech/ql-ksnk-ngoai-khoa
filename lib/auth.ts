import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'crypto';
import {supabaseAdmin} from './supabase';

export const sessionCookie={name:'ksnk_session',options:{httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:43200}};
export function db(){const client=supabaseAdmin();if(!client)throw Error('Thiếu cấu hình Supabase');return client;}
export type Person={id:string;name:string;username:string;unit:string;admin:boolean;active:boolean;legacy_operator:boolean;work_role_reviewed:boolean;team_lead:boolean;team_department:string|null;work_view:boolean;work_edit:boolean;department:string;pending_login:boolean;staff_code:string|null;can_approve_work?:boolean;version:string};
export const personFields='id,name,username,unit,admin,active,legacy_operator,work_role_reviewed,team_lead,team_department,work_view,work_edit,department,staff_code,can_approve_work,pending_login,version';
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function actor():Promise<Person|null>{
 const value=(await cookies()).get(sessionCookie.name)?.value;
 if(!value||!/^[0-9a-f]{64}$/.test(value))return null;
 const session=await db().from('cx_sessions').select('person,version').eq('token',digest(value)).gt('expires',new Date().toISOString()).maybeSingle();
 if(session.error)throw session.error;
 if(!session.data)return null;
 const user=await db().from('cx_people').select(personFields).eq('id',session.data.person).eq('unit','surgery').eq('version',session.data.version).eq('active',true).maybeSingle();
 if(user.error)throw user.error;return user.data;
}
export async function hasSession(){return Boolean((await actor())?.admin);}
export async function signIn(user:Person){
 const raw=randomBytes(32).toString('hex');
 const client=db();
 await client.from('cx_sessions').delete().lt('expires',new Date().toISOString());
 const {error}=await client.from('cx_sessions').insert({token:digest(raw),person:user.id,version:user.version,expires:new Date(Date.now()+43200000).toISOString()});
 if(error)throw error;
 (await cookies()).set(sessionCookie.name,raw,sessionCookie.options);
}
export async function signOut(){
 const jar=await cookies(),token=jar.get(sessionCookie.name)?.value;
 if(token){const {error}=await db().from('cx_sessions').delete().eq('token',digest(token));if(error)throw error;}
 jar.delete(sessionCookie.name);
}

export async function canOperateLegacy(write=false){const u=await actor();return Boolean(u&&(u.admin||(u.legacy_operator&&u.work_view&&(!write||u.work_edit))));}
