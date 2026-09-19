import {timingSafeEqual} from 'crypto';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {makeSession,hasSession,sessionCookie} from '../../../lib/auth';

export async function GET(){return NextResponse.json({ok:true,authenticated:await hasSession()})}
export async function POST(req:Request){
 const {password}=await req.json();const expected=process.env.APP_DEFAULT_PASSWORD||'';
 const a=Buffer.from(String(password||'')),b=Buffer.from(expected);
 if(!expected||a.length!==b.length||!timingSafeEqual(a,b))return NextResponse.json({ok:false,error:'Mật khẩu không đúng'},{status:401});
 (await cookies()).set(sessionCookie.name,makeSession(),sessionCookie.options);
 return NextResponse.json({ok:true});
}
export async function DELETE(){(await cookies()).delete(sessionCookie.name);return NextResponse.json({ok:true})}
