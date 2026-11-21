import {NextResponse} from 'next/server';
import {hash,compare} from 'bcryptjs';
import {canOperateLegacy,db,signIn,signOut} from '../../../lib/auth';
import {timingSafeEqual,createHash} from 'crypto';
const digest=(v:string)=>createHash('sha256').update(v).digest();
export async function GET(){return NextResponse.json({authenticated:await canOperateLegacy()});}
export async function POST(req:Request){
 try{
 const {username:raw,password,unit}=await req.json();
 const username=String(raw||'').trim().toLowerCase();
 const denied=()=>NextResponse.json({error:'Kiểm tra đơn vị, tên và mã đăng nhập.'},{status:401});
 if(unit!=='surgery'||!/^[a-z0-9._-]{3,50}$/.test(username)||typeof password!=='string'||Buffer.byteLength(password)>72)return denied();
 const client=db(),minute=Math.floor(Date.now()/60000);
 const limit=await client.rpc('cx_attempt',{k:username+':'+minute});if(limit.error)throw limit.error;
 if(limit.data>10)return NextResponse.json({error:'Vui lòng thử lại sau một phút.'},{status:429});
 const lookup=()=>client.from('cx_people').select('*').eq('username',username).maybeSingle();
 let {data:user,error}=await lookup();if(error)throw error;
 const bootstrap=process.env.BOOTSTRAP_ADMIN_CODE||'';
 if(!user&&username==='admin'&&unit==='surgery'&&bootstrap.length>=12&&timingSafeEqual(digest(bootstrap),digest(password))){
 const ins=await client.from('cx_people').insert({username,name:'Quản trị Bệnh viện Ngoại khoa',unit,admin:true,credential:await hash(password,12)});
 if(ins.error&&ins.error.code!=='23505')throw ins.error;
 const result=await lookup();if(result.error)throw result.error;user=result.data;
 }
 if(!user?.active||user.unit!==unit||!await compare(password,user.credential))return denied();
 await signIn(user);return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Chưa kết nối được cơ sở dữ liệu. Kiểm tra biến môi trường và tập lệnh cài đặt SQL.'},{status:503});}
}
export async function DELETE(){await signOut();return NextResponse.json({ok:true});}
