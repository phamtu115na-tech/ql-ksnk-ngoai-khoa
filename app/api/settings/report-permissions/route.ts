import {actor,db} from '../../../../lib/auth'
export async function GET(){
 if(!(await actor())?.admin)return Response.json({error:'Thiếu quyền'},{status:403})
 const people=await db().from('cx_people').select('id,name,username,department').eq('unit','surgery').eq('active',true).eq('admin',false).order('name')
 const grants=await db().from('nk_report_permissions').select('person,scope,can_export,version')
 if(people.error||grants.error)return Response.json({error:'Chưa đọc được bảng quyền. Kiểm tra migration phân quyền báo cáo.'},{status:503})
 return Response.json({people:people.data,grants:grants.data},{headers:{'Cache-Control':'private,no-store'}})
}
export async function POST(req:Request){
 const user=await actor()
 if(!user?.admin||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền'},{status:403})
 const b=await req.json()
 if(!['self','team','hospital','none'].includes(b.scope)||typeof b.can_export!=='boolean')return Response.json({error:'Phạm vi không hợp lệ'},{status:400})
 const {data,error}=await db().rpc('nk_report_grant',{who:user.id,target_person:b.person,new_scope:b.scope,allow_export:b.scope!=='none'&&b.can_export,previous_version:b.version||null})
 return error||!data?Response.json({error:'Không lưu được quyền hoặc dữ liệu vừa thay đổi.'},{status:409}):Response.json({ok:true})
}
