import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hash} from 'bcryptjs';
import {hasSession,storedPassword,verifyPassword,sessionCookie} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';

export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({ok:false,error:'Yêu cầu không hợp lệ'},{status:403});
 if(!await hasSession())return NextResponse.json({ok:false,error:'Vui lòng đăng nhập lại'},{status:401});
 try{
  const {currentPassword,newPassword,confirmPassword}=await req.json();
  if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword!==confirmPassword||newPassword.length<12||Buffer.byteLength(newPassword)>72||Buffer.byteLength(currentPassword)>72)
   return NextResponse.json({ok:false,error:'Mật khẩu mới cần ít nhất 12 ký tự, tối đa 72 byte và xác nhận phải trùng khớp.'},{status:400});
  const old=await storedPassword();
  if(!await verifyPassword(currentPassword,old))return NextResponse.json({ok:false,error:'Mật khẩu hiện tại không đúng'},{status:400});
  if(currentPassword===newPassword)return NextResponse.json({ok:false,error:'Mật khẩu mới phải khác mật khẩu hiện tại'},{status:400});
  const password_hash=await hash(newPassword,12);
  const db=supabaseAdmin();if(!db)throw new Error();
  // Compare-and-set prevents simultaneous requests from overwriting another change.
  const {data:existing,error:readError}=await db.from('ksnk_settings').select('id').eq('id',1).maybeSingle();
  if(readError)throw readError;
  if(existing){
   let update=db.from('ksnk_settings').update({password_hash,updated_at:new Date().toISOString()}).eq('id',1);
   update=old?update.eq('password_hash',old):update.is('password_hash',null);
   const {data,error}=await update.select('id');
   if(error||!data?.length)throw new Error();
  }else{
   const {error}=await db.from('ksnk_settings').insert({id:1,password_hash});
   if(error)throw error;
  }
  (await cookies()).delete(sessionCookie.name);
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false,error:'Không lưu được mật khẩu. Vui lòng thử lại.'},{status:503})}
}
