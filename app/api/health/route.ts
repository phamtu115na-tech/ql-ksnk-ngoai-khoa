import {db} from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(){
 try{const {error}=await db().from('cx_people').select('id',{count:'exact',head:true});if(error)throw error;
 return Response.json({ok:true,supabaseDatabaseReachable:true});}
 catch{return Response.json({ok:false,error:'Kiểm tra SUPABASE_URL, khóa máy chủ và SQL cài đặt.'},{status:503});}
}
