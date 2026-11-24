import {actor,db} from '../../../../lib/auth'
import {ROLES,validateMatrix,baselineForRole,type Role,type GrantMatrix} from '../../../../lib/feature-permissions'
export const dynamic='force-dynamic'
export async function GET(){
 const admin=await actor()
 if(!admin?.admin)return Response.json({error:'Chỉ quản trị viên được xem quy tắc cấp quyền.'},{status:403})
 const {data,error}=await db().from('nk_role_permission_defaults').select('role,grants,version,changed_at')
 if(error)return Response.json({error:'Chưa cài đặt bảng quy tắc cấp quyền.'},{status:503})
 return Response.json({roles:ROLES.map(role=>({role,...data?.find(x=>x.role===role),grants:data?.find(x=>x.role===role)?.grants||{},version:data?.find(x=>x.role===role)?.version||null,baseline:baselineForRole(role)}))},{headers:{'Cache-Control':'no-store'}})
}
export async function POST(req:Request){
 const admin=await actor()
 if(!admin?.admin)return Response.json({error:'Chỉ quản trị viên được sửa quy tắc cấp quyền.'},{status:403})
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Nguồn gửi không hợp lệ.'},{status:403})
 let body:{role?:string;version?:string|null;grants?:unknown}
 try{body=await req.json()}catch{return Response.json({error:'Dữ liệu không hợp lệ.'},{status:400})}
 if(!ROLES.includes(body.role as Role))return Response.json({error:'Chức vụ không hợp lệ.'},{status:400})
 let grants:GrantMatrix
 try{grants=validateMatrix(body.grants)}catch(e){return Response.json({error:e instanceof Error?e.message:'Quyền không hợp lệ.'},{status:400})}
 // Approving is a designation on an individual account, never automatic by role.
 if(grants.tasks?.approve&&grants.tasks.approve!=='none')
  return Response.json({error:'Quyền phê duyệt phải cấp theo cá nhân, không mở mặc định cho toàn chức vụ.'},{status:400})
 const {data,error}=await db().rpc('nk_set_role_permission_defaults',{
  who:admin.id,chosen_role:body.role,new_grants:grants,previous_version:body.version||null
 })
 if(error||!data)return Response.json({error:'Quy tắc đã thay đổi hoặc không lưu được. Hãy tải lại dữ liệu.'},{status:409})
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})
}
