import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {makeSession,hasSession,sessionCookie,storedPassword,verifyPassword,ensureDefaultPasswordStored} from '../../../lib/auth';

function configError(error:unknown){
 const message=error instanceof Error?error.message:'';
 if(message.includes('SESSION_SECRET'))return 'SESSION_SECRET phải có ít nhất 32 ký tự trên Vercel.';
 if(message.includes('Thiếu cấu hình Supabase'))return 'Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc SUPABASE_SECRET_KEY trên Vercel.';
 if(message.includes('[PGRST205]')||message.includes('[42P01]'))return 'Supabase đang trỏ tới project không có bảng public.ksnk_settings. Kiểm tra SUPABASE_URL.';
 if(message.includes('[42501]')||message.includes('[PGRST301]')||message.includes('Invalid API key')||message.includes('Unauthorized'))return 'Khóa server Supabase không hợp lệ hoặc không có quyền đọc public.ksnk_settings.';
 if(message.includes('Không đọc được cấu hình đăng nhập'))return 'Không đọc được bảng public.ksnk_settings trên Supabase. Kiểm tra khóa server và tên project.';
 return 'Không đăng nhập được. Kiểm tra cấu hình Supabase và SESSION_SECRET (ít nhất 32 ký tự).';
}

export async function GET(){return NextResponse.json({ok:true,authenticated:await hasSession()})}

export async function POST(req:Request){
 try{
  const {password}=await req.json();
  if(typeof password!=='string'||Buffer.byteLength(password)>72)return NextResponse.json({ok:false,error:'Mật khẩu không hợp lệ'},{status:400});
  const passwordHash=await storedPassword();
  if(!await verifyPassword(password,passwordHash))return NextResponse.json({ok:false,error:'Mật khẩu không đúng'},{status:401});
  if(!passwordHash){
   try{await ensureDefaultPasswordStored()}catch(error){console.error('[auth] default password bootstrap failed:',error instanceof Error?error.message:error)}
  }
  (await cookies()).set(sessionCookie.name,makeSession(passwordHash),sessionCookie.options);
  return NextResponse.json({ok:true});
 }catch(error){
  console.error('[auth] sign-in failed:',error instanceof Error?error.message:error);
  return NextResponse.json({ok:false,error:configError(error)},{status:503});
 }
}

export async function DELETE(){(await cookies()).delete(sessionCookie.name);return NextResponse.json({ok:true})}
