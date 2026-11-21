import {db,hasSession} from '../../../lib/auth';
export async function GET(){if(!await hasSession())return Response.json({error:'Cần quyền quản trị'},{status:403});
 const {count,error}=await db().from('nk_legacy_rows').select('id',{count:'exact',head:true});return Response.json({ok:!error,legacyRows:count});}
