import {actor,db} from '../../../../lib/auth'
import {normalizeMenu,validMenu} from '../../../../lib/menu'
const sheet='CAI_DAT_MENU_NGOAI_KHOA'
export async function GET(){
 if(!await actor())return Response.json({error:'Chưa đăng nhập'},{status:401})
 const {data,error}=await db().from('nk_legacy_rows').select('data').eq('sheet_name',sheet).eq('row_no',1).maybeSingle()
 if(error)return Response.json({error:'Không đọc được danh mục hiển thị.'},{status:503})
 return Response.json({items:normalizeMenu(data?.data?.items),version:data?.data?.version??null},{headers:{'Cache-Control':'private,no-store'}})
}
export async function POST(req:Request){
 const user=await actor()
 if(!user?.admin||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền cấu hình'},{status:403})
 const {items,version}=await req.json()
 if(!validMenu(items))return Response.json({error:'Kiểm tra lại tên và thứ tự hiển thị.'},{status:400})
 const table=db().from('nk_legacy_rows'),data={items,version:crypto.randomUUID(),updatedBy:user.id}
 const q=version?table.update({data}).eq('sheet_name',sheet).eq('row_no',1).eq('data->>version',version):table.insert({sheet_name:sheet,row_no:1,legacy_id:sheet,data})
 const r=await q.select('row_no').maybeSingle()
 if(r.error&&r.error.code!=='23505')return Response.json({error:'Không lưu được danh mục.'},{status:503})
 if(!r.data)return Response.json({error:'Danh mục vừa thay đổi, hãy tải lại.'},{status:409})
 return Response.json({version:data.version})
}
