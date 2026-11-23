import {actor,db} from '../../../../lib/auth'
import {effectiveMatrix,featureLabels,actionLabels,FEATURE_ACTIONS,validateMatrix,type GrantMatrix,type Scope} from '../../../../lib/feature-permissions'

export const dynamic='force-dynamic'
export async function GET(req:Request){
 const admin=await actor()
 if(!admin?.admin)return Response.json({error:'Chỉ quản trị viên được mở bảng phân quyền.'},{status:403})
 const client=db()
 const [people,grants,old]=await Promise.all([
  client.from('cx_people').select('id,name,username,department,staff_code,team_department,legacy_operator,team_lead,work_role_reviewed,work_view,work_edit,active,unit,admin,pending_login,version').eq('unit','surgery').eq('active',true).eq('admin',false).order('name'),
  client.from('nk_feature_permissions').select('person,grants,version'),
  client.from('nk_report_permissions').select('person,scope,can_export')
 ])
 if(people.error||grants.error||old.error)return Response.json({error:'Chưa cài migration ma trận phân quyền hoặc chưa truy cập được dữ liệu.'},{status:503})
 const grantMap=new Map((grants.data||[]).map(g=>[g.person,g]))
 const legacyMap=new Map((old.data||[]).map(g=>[g.person,g]))
 const rows=(people.data||[]).map(person=>{
  const grant=grantMap.get(person.id)
  const legacy=legacyMap.get(person.id)
  return {...person,version:grant?.version||null,
   overrides:(grant?.grants||{}) as GrantMatrix,
   effective:effectiveMatrix(person,grant?.grants as GrantMatrix|undefined,legacy as {scope:Scope;can_export:boolean}|undefined)}
 })
 const personId=new URL(req.url).searchParams.get('person')
 let history:unknown[]=[]
 if(personId){
  if(!rows.some(row=>row.id===personId))return Response.json({error:'Nhân viên không thuộc đơn vị.'},{status:404})
  const h=await client.from('nk_feature_permission_history').select('changed_at,changed_by,previous_grants,current_grants').eq('person',personId).order('changed_at',{ascending:false}).limit(20)
  if(h.error)return Response.json({error:'Không đọc được lịch sử cấp quyền.'},{status:503})
  history=h.data||[]
 }
 return Response.json({people:rows,features:FEATURE_ACTIONS,featureLabels,actionLabels,history},{headers:{'Cache-Control':'private,no-store'}})
}
export async function POST(req:Request){
 const admin=await actor()
 if(!admin?.admin)return Response.json({error:'Chỉ quản trị viên được cấp quyền.'},{status:403})
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403})
 let body:{person?:string;version?:string|null;overrides?:unknown}
 try{body=await req.json()}catch{return Response.json({error:'Dữ liệu không hợp lệ.'},{status:400})}
 if(!body.person||!/^[-0-9a-f]{36}$/i.test(body.person))return Response.json({error:'Mã tài khoản không hợp lệ.'},{status:400})
 let validated:GrantMatrix
 try{validated=validateMatrix(body.overrides)}catch(error){return Response.json({error:error instanceof Error?error.message:'Quyền không hợp lệ'},{status:400})}
 const person=(await db().from('cx_people').select('id,unit,active,admin,legacy_operator,team_lead,work_role_reviewed,work_view,work_edit').eq('id',body.person).maybeSingle())
 if(person.error||!person.data||person.data.unit!=='surgery'||!person.data.active||person.data.admin)
  return Response.json({error:'Tài khoản không được phép cấp quyền.'},{status:403})
 // Never grant a broader scope than the person's verified management boundary.
 const ceiling=person.data.legacy_operator&&person.data.work_view?'hospital':
   person.data.team_lead&&person.data.work_role_reviewed&&person.data.work_view?'team':'self'
 const rank={none:0,self:1,team:2,hospital:3}
 for(const [feature,row] of Object.entries(validated)){
  for(const [action,scope] of Object.entries(row||{})){
   if(rank[scope as keyof typeof rank]>rank[ceiling])return Response.json({error:'Phạm vi vượt quá chức danh đã xác minh.'},{status:403})
   if(feature==='tasks'&&action==='approve'&&scope!=='none')return Response.json({error:'Quyền phê duyệt thực hiện qua người duyệt được chỉ định.'},{status:400})
  }
 }
 const result=await db().rpc('nk_set_feature_permissions',{who:admin.id,target_person:body.person,new_grants:validated,previous_version:body.version||null})
 if(result.error||!result.data)return Response.json({error:'Không lưu được hoặc dữ liệu quyền đã thay đổi. Hãy tải lại.'},{status:409})
 return Response.json({ok:true},{headers:{'Cache-Control':'private,no-store'}})
}
