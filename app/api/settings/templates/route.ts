import {actor,db} from '../../../../lib/auth'
import {reportHero,heroFocus,validTemplate} from '../../../../lib/report-template'
const departments=['Dụng cụ','Vệ sinh môi trường','Đồ vải','Giám sát']
const defaults=departments.map(d=>reportHero(d)!)
const sheet='MAU_BAO_CAO_GIAO_BAN'
export async function GET(){
 if(!(await actor())?.admin)return Response.json({error:'Thiếu quyền cấu hình'},{status:403})
 const {data,error}=await db().from('nk_legacy_rows').select('legacy_id,data').eq('sheet_name',sheet)
 if(error)return Response.json({error:'Không đọc được mẫu báo cáo'},{status:503})
 return Response.json(defaults.map(d=>{const row=data.find(r=>r.legacy_id===d.key);return {key:d.key,template:row?.data?.template??{...d,focus:heroFocus[d.key]},version:row?.data?.version??null}}),{headers:{'Cache-Control':'private,no-store'}})
}
export async function POST(req:Request){
 const user=await actor()
 if(!user?.admin||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền cấu hình'},{status:403})
 const {key,version,template}=await req.json(),index=defaults.findIndex(d=>d.key===key)
 if(index<0||!validTemplate(template))return Response.json({error:'Tên, màu hoặc nội dung trọng tâm chưa hợp lệ.'},{status:400})
 const {title,department,subtitle,slogan,accent,focus}=template
 const data={version:crypto.randomUUID(),updatedBy:user.id,template:{title,department,subtitle,slogan,accent,focus}}
 const table=db().from('nk_legacy_rows')
 const q=version?table.update({data}).eq('sheet_name',sheet).eq('legacy_id',key).eq('data->>version',version):table.insert({sheet_name:sheet,row_no:index+1,legacy_id:key,data})
 const result=await q.select('row_no').maybeSingle()
 if(result.error&&result.error.code!=='23505')return Response.json({error:'Không lưu được mẫu'},{status:503})
 if(!result.data)return Response.json({error:'Mẫu vừa thay đổi, hãy tải lại.'},{status:409})
 return Response.json({version:data.version})
}
