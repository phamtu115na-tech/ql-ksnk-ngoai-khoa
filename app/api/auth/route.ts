import {timingSafeEqual} from 'crypto';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {makeSession,hasSession,sessionCookie,storedPassword,verifyPassword} from '../../../lib/auth';

export async function GET(){return NextResponse.json({ok:true,authenticated:await hasSession()})}
export async function POST(req:Request){
 try{
 const {password}=await req.json();
 if(typeof password!=='string'||Buffer.byteLength(password)>72)return NextResponse.json({ok:false,error:'Mật khẩu không hợp lệ'},{status:400});
 const hash=await storedPassword();
 if(!await verifyPassword(password,hash))return NextResponse.json({ok:false,error:'Mật khẩu không đúng'},{status:401});
 (await cookies()).set(sessionCookie.name,makeSession(hash),sessionCookie.options);
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false,error:'Không đăng nhập được. Kiểm tra cấu hình Supabase và SESSION_SECRET (ít nhất 32 ký tự).'},{status:503})}
}
export async function DELETE(){(await cookies()).delete(sessionCookie.name);return NextResponse.json({ok:true})}
