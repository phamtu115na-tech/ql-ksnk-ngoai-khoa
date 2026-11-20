import {actor,db,signOut} from '../../../../lib/auth';
import {compare,hash} from 'bcryptjs';
import {randomUUID} from 'crypto';
export async function POST(req:Request){
 const me=await actor();if(!me)return Response.json({error:'Cần đăng nhập'},{status:401});
 const {currentPassword,newPassword,confirmPassword}=await req.json();
 const {data}=await db().from('cx_people').select('credential').eq('id',me.id).single();
 if(!data||typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<12||Buffer.byteLength(newPassword)>72||newPassword!==confirmPassword||!await compare(currentPassword,data.credential))return Response.json({error:'Kiểm tra mã hiện tại và mã mới (ít nhất 12 ký tự).'}, {status:400});
 const {data:changed,error}=await db().from('cx_people').update({credential:await hash(newPassword,12),version:randomUUID()}).eq('id',me.id).eq('version',me.version).select('id').single();
 if(error||!changed)return Response.json({error:'Hãy tải lại tài khoản.'},{status:409});
 await signOut();return Response.json({ok:true});
}
